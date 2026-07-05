// Mechanical (deterministic, no-LLM) transform layer: name replacement in
// literals, pattern redaction, and IRI local-name renames. The LLM never
// rewrites text — it only classifies entities (see judge.mjs). Everything
// here is find/replace with explicit maps, per the SPARQL-integrity rules
// in .claude/commands/transform.md.

import fs from 'fs';

export function loadProfile(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

const kebab = s => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** All registry entries (actors + orgs) with their canonical name attached. */
export function registryEntries(profile) {
  const out = [];
  for (const [name, e] of Object.entries(profile.actors || {})) out.push({ name, kind: 'actor', ...e });
  for (const [name, e] of Object.entries(profile.orgs || {})) out.push({ name, kind: 'org', ...e });
  return out;
}

/**
 * Build the literal-replacement map from anonymized registry entries:
 * full names + aliases -> replacement phrase, plus kebab-case forms
 * (for memory paths like "2026-03-17-jane-doe-....md") -> kebab(iriToken).
 * Longest-first so "Jane Doe" wins over "Jane".
 */
export function buildNameMap(profile) {
  const map = [];
  for (const e of registryEntries(profile)) {
    if (e.verdict !== 'anonymize') continue;
    const names = [e.name, ...(e.aliases || [])];
    for (const n of names) {
      // Registered names match case-insensitively ("JANE" in a shouting
      // comment is still the name). Implicit entries stay case-sensitive —
      // their guessed words can be dictionary words ("Wolf").
      map.push({ from: n, to: e.replacement, ci: !e.implicit });
      // kebab forms exist for memory paths ("2026-03-17-jane-doe-....md").
      // Registered entries carry real names — single-word kebabs are safe
      // ("acme" in a filename). Implicit entries carry GUESSED words that
      // may be dictionary words ("advisor", "written") — those only get the
      // hyphenated (multi-word) form, which can't collide with prose.
      const k = kebab(n);
      if (k.includes('-') || !e.implicit) map.push({ from: k, to: kebab(e.iriToken) });
    }
    // concatenated form appears in prose as link text / shorthand ("JaneDoe")
    const concat = e.name.replace(/\s+/g, '');
    if (concat !== e.name) map.push({ from: concat, to: e.replacement });
  }
  map.sort((a, b) => b.from.length - a.from.length);
  return map;
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The leak-sweep word list: every registered (non-implicit, non-keep) name,
 * alias, and name word >= 5 chars, minus generic org-suffix words. Used by
 * the materialize gate AND the standalone sweep.mjs the workflow runs over
 * the staged public tree — the same list must guard every output surface
 * (corpus, scripts, site, PR bodies).
 */
const SWEEP_WORD_STOP = new Set(['Group', 'Capital', 'Enterprises', 'Investors', 'Company', 'Partners', 'Ventures', 'Collective', 'Labs']);
export function sweepNames(profile) {
  const sweep = [];
  for (const e of registryEntries(profile)) {
    if (e.verdict === 'keep' || e.implicit) continue;
    sweep.push(e.name, ...(e.aliases || []));
    for (const w of e.name.split(/\s+/)) if (w.length >= 5 && !SWEEP_WORD_STOP.has(w)) sweep.push(w);
  }
  return [...new Set(sweep)];
}

/** Case-insensitive boundary-guarded matcher over the sweep list. */
export function sweepRegex(profile) {
  return new RegExp(`(?<![A-Za-z0-9_])(${sweepNames(profile).sort((a, b) => b.length - a.length).map(escapeRe).join('|')})(?![A-Za-z0-9_])`, 'i');
}

/** Apply the name map + redaction patterns to one literal string. */
export function anonymizeLiteral(value, nameMap, redactions) {
  let out = value;
  for (const { from, to, ci } of nameMap) {
    // underscore in the guard: IRI-ish tokens (Actor_Jane_X) are renamed by
    // applyIriRenames, never chopped mid-token by name replacement
    out = out.replace(new RegExp(`(?<![A-Za-z0-9_])${escapeRe(from)}(?![A-Za-z0-9_])`, ci ? 'gi' : 'g'), to);
  }
  for (const r of redactions) {
    out = out.replace(new RegExp(r.pattern, 'g'), r.replacement);
  }
  return out;
}

/**
 * Derive IRI local-name rename tokens from anonymized entries: the
 * concatenated full name, plus each name word of length >= 4 (so
 * narr:Obs_JaneSkepticismQuote -> narr:Obs_AdvisorSkepticismQuote).
 * Generic org-suffix words are excluded — "Group" must not rename
 * narr:Arch_GroupAsRepo. Returns [{token, to}] longest-first.
 */
const TOKEN_STOPWORDS = new Set([
  'Group', 'Ventures', 'Enterprises', 'Investors', 'Labs', 'Collective', 'Company', 'Partners',
  // generic words that show up in auto-derived (implicit) actor names — the
  // identifying concat form ("BradReview") is still a token; the bare generic
  // word must not rename unrelated IRIs (Obs_ReviewProcess)
  'Review', 'Prospect', 'Lawyer', 'Retainer', 'Archetype', 'Content', 'Marketing', 'Call',
]);

export function iriTokens(profile) {
  // Tokens contained in a keep-verdict name are off-limits: an implicit
  // "Anthony Maley" entry's "Maley" token must not rename Actor_TonyMaley.
  const keepConcats = registryEntries(profile)
    .filter(r => r.verdict === 'keep')
    .flatMap(r => [r.name, ...(r.aliases || [])].map(n => n.replace(/\s+/g, '')));
  const ok = t => !TOKEN_STOPWORDS.has(t) && !keepConcats.some(k => k.includes(t));
  const toks = [];
  for (const e of registryEntries(profile)) {
    if (e.verdict !== 'anonymize') continue;
    const words = e.name.split(/\s+/);
    const concat = words.join('');
    if (ok(concat)) toks.push({ token: concat, to: e.iriToken });
    for (const w of words) if (w.length >= 4 && ok(w)) toks.push({ token: w, to: e.iriToken });
    for (const a of e.aliases || []) {
      const aw = a.replace(/\s+/g, '');
      if ((aw.length >= 4 || aw === a.toUpperCase()) && ok(aw)) toks.push({ token: aw, to: e.iriToken });
    }
  }
  toks.sort((a, b) => b.token.length - a.token.length);
  return toks;
}

/**
 * Given every IRI local name in the corpus, build a concrete rename map
 * narr:Old -> narr:New for IRIs whose local name contains a private-name
 * token. Applied globally as exact token swaps.
 */
export function deriveIriRenames(allIris, profile) {
  const toks = iriTokens(profile);
  const renames = new Map();
  for (const iri of allIris) {
    const local = iri.replace(/^narr:/, '');
    let renamed = local;
    for (const { token, to } of toks) {
      if (renamed.includes(token)) renamed = renamed.split(token).join(to);
    }
    if (renamed !== local) {
      // collapse adjacent duplicate segments: two name words mapping to the
      // same token otherwise yield Actor_DesignCollaborator_DesignCollaborator
      renamed = renamed.split('_').filter((s, i, a) => s !== a[i - 1]).join('_');
      renames.set(iri, `narr:${renamed}`);
    }
  }
  // collision check: two sources mapping to the same target get suffixes
  const seen = new Map();
  for (const [from, to] of renames) {
    if (seen.has(to) && seen.get(to) !== from) {
      let i = 2;
      while (seen.has(`${to}_${i}`)) i++;
      renames.set(from, `${to}_${i}`);
      seen.set(`${to}_${i}`, from);
    } else {
      seen.set(to, from);
    }
  }
  return renames;
}

/** Apply IRI renames on the LOCAL name with boundary guards. Matches every
 *  surface an IRI local name appears on: prefixed (narr:X), full IRI (#X>),
 *  backtick/prose references inside literals, and comments. Local names are
 *  long camel-case tokens, so boundary-guarded bare matching is safe. */
export function applyIriRenames(text, renames) {
  let out = text;
  for (const [from, to] of renames) {
    const localFrom = from.replace(/^narr:/, '');
    const localTo = to.replace(/^narr:/, '');
    out = out.replace(new RegExp(`(?<![A-Za-z0-9_])${escapeRe(localFrom)}(?![A-Za-z0-9_])`, 'g'), localTo);
  }
  return out;
}

/** Rename an output filename via the kebab name map (TX/digest filenames
 *  embed people/org names). */
export function renameFile(filename, nameMap, renames) {
  let out = filename;
  for (const { from, to } of nameMap) {
    if (!from.includes(' ')) out = out.split(from).join(to.replace(/\s+/g, '-'));
  }
  // digest filenames are IRI local names (Actor_Scarlet.trig)
  for (const [from, to] of renames) {
    out = out.split(from.replace(/^narr:/, '')).join(to.replace(/^narr:/, ''));
  }
  return out;
}
