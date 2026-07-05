// SPARQL TX file parsing for the public-perspective transform.
// Not a full SPARQL parser: a string/IRI/comment-aware structural scanner
// tuned to the shapes the extraction pipeline emits (see task-316 and
// .claude/commands/transform.md "SPARQL Integrity" for why entity URIs are
// never touched and all edits are mechanical).

/** Character scan driver. Calls visit(ch, i, state) only OUTSIDE strings,
 *  IRIs, and comments. Returns nothing; visit may record positions. */
function scan(text, visit) {
  let inString = false, inTriple = false, inIRI = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inTriple) {
      if (ch === '"' && text[i + 1] === '"' && text[i + 2] === '"') { inTriple = false; i += 2; }
      continue;
    }
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (inIRI) { if (ch === '>') inIRI = false; continue; }
    if (ch === '"') {
      if (text[i + 1] === '"' && text[i + 2] === '"') { inTriple = true; i += 2; }
      else inString = true;
      continue;
    }
    if (ch === '<') { inIRI = true; continue; }
    if (ch === '#') { while (i < text.length && text[i] !== '\n') i++; continue; }
    const skip = visit(ch, i);
    if (typeof skip === 'number') i = skip;
  }
}

/** Split text into top-level statements (split on `;` at brace depth 0). */
export function splitStatements(text) {
  const statements = [];
  let depth = 0, start = 0;
  scan(text, (ch, i) => {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === ';' && depth === 0) { statements.push(text.slice(start, i)); start = i + 1; }
  });
  const tail = text.slice(start);
  if (tail.trim()) statements.push(tail);
  return statements;
}

/** Extract the PREFIX header lines from the file (kept verbatim on output). */
export function extractPrefixes(text) {
  return text.split('\n').filter(l => /^\s*PREFIX\s/i.test(l));
}

const TOKEN = 'narr:[A-Za-z0-9_]+';

/** Mask string literals with placeholders so regex passes can't touch their
 *  contents. Returns { masked, literals } — unmask() restores them. */
export function maskLiterals(text) {
  const literals = []; // { value, triple }
  let out = '', inString = false, inTriple = false, inIRI = false, escaped = false, cur = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inTriple) {
      if (ch === '"' && text[i + 1] === '"' && text[i + 2] === '"') {
        inTriple = false; i += 2;
        out += '\x00L' + literals.length + '\x00';
        literals.push({ value: cur, triple: true });
        cur = '';
        continue;
      }
      cur += ch;
      continue;
    }
    if (inString) {
      if (escaped) { escaped = false; cur += ch; continue; }
      if (ch === '\\') { escaped = true; cur += ch; continue; }
      if (ch === '"') {
        inString = false;
        out += '\x00L' + literals.length + '\x00';
        literals.push({ value: cur, triple: false });
        cur = '';
        continue;
      }
      cur += ch;
      continue;
    }
    if (inIRI) { out += ch; if (ch === '>') inIRI = false; continue; }
    if (ch === '"') {
      if (text[i + 1] === '"' && text[i + 2] === '"') { inTriple = true; i += 2; }
      else inString = true;
      continue;
    }
    if (ch === '<') { inIRI = true; out += ch; continue; }
    out += ch;
  }
  return { masked: out, literals };
}

export function unmaskLiterals(masked, literals) {
  return masked.replace(/\x00L(\d+)\x00/g, (_, n) => {
    const { value, triple } = literals[+n];
    return triple ? '"""' + value + '"""' : '"' + value + '"';
  });
}

/** All narr: entity IRIs mentioned OUTSIDE string literals. */
export function mentionedEntities(stmt) {
  const { masked } = maskLiterals(stmt);
  return [...new Set(masked.match(new RegExp(TOKEN, 'g')) || [])];
}

/** Find the index of the `}` matching the `{` at openIdx (string-aware). */
function matchBrace(text, openIdx) {
  let depth = 0, found = -1;
  scan(text, (ch, i) => {
    if (i < openIdx || found !== -1) return;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) found = i; }
  });
  return found;
}

/**
 * Split the body of a graph block into triple groups terminated by `.`.
 * Returns [{subject, text}] where subject is the first narr: token outside
 * literals (null for e.g. comment-only chunks).
 */
export function splitTripleGroups(body) {
  const groups = [];
  const ends = [];
  scan(body, (ch, i) => {
    if (ch !== '.') return;
    // ignore decimals like 3.5 (both neighbors digits)
    if (/[0-9]/.test(body[i - 1] || '') && /[0-9]/.test(body[i + 1] || '')) return;
    ends.push(i);
  });
  let start = 0;
  for (const end of ends) {
    const text = body.slice(start, end + 1);
    const { masked } = maskLiterals(text);
    const m = masked.match(new RegExp(`(${TOKEN})`));
    groups.push({ subject: m ? m[1] : null, text });
    start = end + 1;
  }
  const tail = body.slice(start);
  if (tail) {
    // Whitespace-only remainders must survive reassembly byte-for-byte.
    const { masked } = maskLiterals(tail);
    groups.push({ subject: (masked.match(new RegExp(`(${TOKEN})`)) || [null, null])[1], text: tail });
  }
  return groups;
}

/**
 * Parse one statement into:
 *  { kind: 'insert-data', graph, head, groups, tail }  — INSERT DATA blocks
 *  { kind: 'update', text }                            — DELETE/INSERT/WHERE
 *  { kind: 'other',  text }                            — anything else
 */
export function parseInsertData(stmt) {
  if (!/INSERT\s+DATA/i.test(stmt)) {
    return { kind: /DELETE|INSERT/i.test(stmt) ? 'update' : 'other', text: stmt };
  }
  const { masked } = maskLiterals(stmt);
  const graphMatch = masked.match(/GRAPH\s+(narr:[A-Za-z0-9_]+)\s*\{/i);
  if (graphMatch) {
    // Positions in `masked` don't map to `stmt`, so relocate in the raw text
    // by searching for the same anchor (graph IRI + `{`) outside literals.
    const anchor = new RegExp(`GRAPH\\s+${graphMatch[1].replace(':', '\\:')}\\s*\\{`, 'i');
    const am = stmt.match(anchor);
    const open = stmt.indexOf(am[0]) + am[0].length - 1; // index of `{`
    const close = matchBrace(stmt, open);
    return {
      kind: 'insert-data', graph: graphMatch[1],
      head: stmt.slice(0, open + 1), tail: stmt.slice(close),
      groups: splitTripleGroups(stmt.slice(open + 1, close)),
    };
  }
  const open = stmt.indexOf('{');
  const close = matchBrace(stmt, open);
  return {
    kind: 'insert-data', graph: null,
    head: stmt.slice(0, open + 1), tail: stmt.slice(close),
    groups: splitTripleGroups(stmt.slice(open + 1, close)),
  };
}

/** Extract every string literal from a chunk of SPARQL text. */
export function extractLiterals(text) {
  return maskLiterals(text).literals;
}

/** Replace every string literal's VALUE via fn(string) -> string, leaving
 *  all non-literal text (URIs, syntax) byte-identical. */
export function mapLiterals(text, fn) {
  const { masked, literals } = maskLiterals(text);
  return unmaskLiterals(masked, literals.map(l => ({ ...l, value: fn(l.value) })));
}

/** Replace every comment's text via fn(commentBody) -> commentBody.
 *  Comments are `#` to end-of-line outside strings and IRIs — inert to the
 *  parser but a leak surface for names. */
export function mapComments(text, fn) {
  let out = '', inString = false, inTriple = false, inIRI = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inTriple) {
      out += ch;
      if (ch === '"' && text[i + 1] === '"' && text[i + 2] === '"') { inTriple = false; out += '""'; i += 2; }
      continue;
    }
    if (inString) {
      out += ch;
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (inIRI) { out += ch; if (ch === '>') inIRI = false; continue; }
    if (ch === '"') {
      out += ch;
      if (text[i + 1] === '"' && text[i + 2] === '"') { inTriple = true; out += '""'; i += 2; }
      else inString = true;
      continue;
    }
    if (ch === '<') { inIRI = true; out += ch; continue; }
    if (ch === '#') {
      let j = i;
      while (j < text.length && text[j] !== '\n') j++;
      out += fn(text.slice(i, j));
      i = j - 1;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Remove IRIs (as value tokens, outside literals) from a chunk: handles
 *  comma lists and sole-value properties. Subject-position removal is the
 *  caller's job (drop the whole group). */
export function stripValueRefs(text, removedSet) {
  const { masked, literals } = maskLiterals(text);
  let out = masked;
  for (const iri of removedSet) {
    const esc = iri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // middle/last of a comma list:  ", narr:X"
    out = out.replace(new RegExp(`,\\s*${esc}(?![A-Za-z0-9_])`, 'g'), '');
    // first of a comma list:  "narr:X ,"
    out = out.replace(new RegExp(`${esc}(?![A-Za-z0-9_])\\s*,`, 'g'), '');
    // sole value: "pred narr:X ;" -> drop property+terminator; "pred narr:X ."
    // -> keep the `.` (trailing `;` before `.` is grammatical, but keep clean)
    out = out.replace(
      new RegExp(`(^|;|\\n)([ \\t]*)((?:[a-zA-Z][\\w-]*:)?[A-Za-z0-9_]+)\\s+${esc}(?![A-Za-z0-9_])\\s*([;.])`, 'g'),
      (m, pre, ws, pred, term) => (term === '.' ? `${pre}${ws}.` : pre),
    );
  }
  return unmaskLiterals(out, literals);
}
