// Output validation — the four hard checks from .claude/commands/transform.md
// "SPARQL Integrity", each learned from a real compile-pipeline failure.

export function validateSparql(text, { allowTripleQuotes = false } = {}) {
  const errors = [];

  // Check 1: balanced braces, string/IRI/comment-aware
  let depth = 0, inString = false, inIRI = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (inIRI) { if (ch === '>') inIRI = false; continue; }
    if (ch === '"') { inString = true; continue; }
    if (ch === '<') { inIRI = true; continue; }
    if (ch === '#') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) { errors.push(`unbalanced '}' at index ${i}`); break; }
  }
  if (depth > 0) errors.push(`unclosed '{' (depth ${depth} at EOF)`);
  if (inString) errors.push('unterminated string literal');

  // Check 2: triple-quoted strings (TX parser doesn't support them)
  if (!allowTripleQuotes && text.includes('"""')) errors.push('triple-quoted string present');

  // Check 3: bare quote right after an opening brace
  if (/INSERT\s+DATA\s*\{\s*"/.test(text)) errors.push('INSERT DATA { " — bare literal after brace');

  // Check 4: property with no value before a closing brace, e.g. `prov:generated}`
  if (/[a-zA-Z][\w-]*:[A-Za-z0-9_]+\s*\}/.test(text.replace(/"(?:[^"\\]|\\.)*"/g, 'L'))) {
    // note: masked literals first so prose can't false-positive
    errors.push('property without value before }');
  }

  return errors;
}
