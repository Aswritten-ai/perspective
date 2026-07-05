#!/usr/bin/env node
// Materialize the public perspective from this repo's TX corpus (task-316).
//
//   node scripts/public-transform/materialize.mjs --out /tmp/public-out [--dry-run]
//
// Layers:
//   1. mechanical  — registry name replacement, pattern redaction, IRI renames
//   2. verdicts    — sticky per-entity public/private classifications
//                    (.aswritten/public/verdicts.json; judge.mjs fills gaps)
//   3. human gate  — output lands as a PR on the public repo; nothing publishes
//                    without review
//
// Entities without a verdict are WITHHELD (private-until-judged), so a
// missing/failed judge run can never leak anything. Unregistered Actor_*
// entities are NOT withheld — they are anonymized implicitly (stable Person_NN
// token from .aswritten/public/anon-map.json, generic prose descriptor) and
// flagged in the PRIVATE report for promotion to real profile.json entries.
//
// PRIVACY INVARIANT: the --out tree receives ONLY the transformed corpus.
// The report, the pending/withheld lists, and the anon map name what was
// elided, so they live in THIS (private) repo — .aswritten/public/ — and the
// public PR body carries counts only. Nothing pre-elision may reach the
// public repo, its PR bodies, or its git history.

import fs from 'fs';
import path from 'path';
import {
  splitStatements, parseInsertData, mentionedEntities,
  mapLiterals, mapComments, stripValueRefs, maskLiterals, unmaskLiterals,
} from './lib/parse.mjs';
import { collectEntities, hashOf } from './lib/corpus.mjs';
import {
  loadProfile, registryEntries, buildNameMap, deriveIriRenames,
  applyIriRenames, anonymizeLiteral, renameFile, sweepRegex,
} from './lib/mechanical.mjs';
import { validateSparql } from './lib/validate.mjs';

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };

const ROOT = process.cwd();
const TX_DIR = path.join(ROOT, '.aswritten/tx');
const DIGEST_DIR = path.join(ROOT, '.aswritten/digests');
const PROFILE = path.join(ROOT, '.aswritten/public/profile.json');
const VERDICTS = path.join(ROOT, '.aswritten/public/verdicts.json');
const ANON_MAP = path.join(ROOT, '.aswritten/public/anon-map.json');
const PRIVATE_OUT = path.join(ROOT, '.aswritten/public'); // report + PR body live here
const OUT = opt('--out', null);
const DRY = flag('--dry-run');
if (!OUT && !DRY) { console.error('need --out <dir> or --dry-run'); process.exit(2); }

const profile = loadProfile(PROFILE);
const verdicts = fs.existsSync(VERDICTS) ? JSON.parse(fs.readFileSync(VERDICTS, 'utf8')) : {};
const redactions = profile.redactions || [];
// nameMap is built AFTER pass 2: unregistered actors add implicit anonymize
// entries to the in-memory profile during verdict resolution.

// ── Pass 1: collect entities across the corpus ─────────────────────────────
const { files, entities, allIris } = collectEntities(TX_DIR);

// ── Pass 2: resolve verdicts ────────────────────────────────────────────────
const registry = registryEntries(profile);
const removedActors = registry.filter(r => r.verdict === 'remove');

// Implicit anonymization of unregistered actors: stable tokens persist in the
// private anon map so re-runs produce identical IRIs. Tokens are readable
// tree/bird pseudonyms — obviously fake, never colliding with a real name.
const PSEUDONYMS = [
  'Alder', 'Aspen', 'Birch', 'Cedar', 'Cypress', 'Hazel', 'Juniper', 'Larch',
  'Laurel', 'Linden', 'Maple', 'Poplar', 'Rowan', 'Sequoia', 'Spruce',
  'Sycamore', 'Tamarack', 'Walnut', 'Willow', 'Heron', 'Ibis', 'Magpie',
  'Oriole', 'Osprey', 'Plover', 'Sparrow', 'Starling', 'Tern', 'Wren',
  'Finch', 'Kestrel', 'Lark', 'Sandpiper', 'Curlew', 'Egret', 'Gannet',
  'Harrier', 'Kite', 'Nuthatch', 'Pipit', 'Raven', 'Osier', 'Hawthorn',
  'Bracken', 'Sorrel', 'Tansy', 'Vetch', 'Yarrow',
];
const anonMap = fs.existsSync(ANON_MAP) ? JSON.parse(fs.readFileSync(ANON_MAP, 'utf8')) : {};
const usedToks = new Set(Object.values(anonMap));
const nextTok = () => PSEUDONYMS.find(p => !usedToks.has(p)) || `Person${String(usedToks.size + 1).padStart(2, '0')}`;

// Words derivable from an Actor_* local that are safe to treat as name parts:
// long enough to be a name, not a generic role/word, not a 3-letter acronym.
const GENERIC_NAME_WORDS = new Set([
  'CTO', 'CEO', 'COO', 'CFO', 'Review', 'Prospect', 'Lawyer', 'Retainer',
  'Archetype', 'Content', 'Marketing', 'Call', 'Way',
]);
function guessNameWords(local) {
  return local.replace(/^Actor_/, '').split('_')
    // split at lowercase→uppercase only: "JaneDoe" -> Jane Doe, but
    // "AB1C" stays whole (digit boundaries are not word boundaries)
    .flatMap(seg => seg.replace(/([a-z])([A-Z])/g, '$1 $2').split(' '))
    .filter((w, i, a) => (w.length >= 4 || /^[A-Z][a-z]{2}$/.test(w)) && !GENERIC_NAME_WORDS.has(w) && a.indexOf(w) === i);
}

function actorMatch(iri, e) {
  // IRI-token match first: the entry's tokens provably cover the local name,
  // so keep/anonymize renaming is guaranteed to apply to the IRI itself.
  const local = iri.replace(/^narr:/, '');
  for (const r of registry) {
    // aliases count: Actor_AnthonyMaley must match "Tony Maley" via its
    // "Anthony Maley" alias, or it gets implicit-anonymized as a stranger
    for (const n of [r.name, ...(r.aliases || [])]) {
      const concat = n.replace(/\s+/g, '');
      const first = n.split(/\s+/)[0];
      if (local.includes(concat) || (local.includes(first) && first.length >= 4)) return { r, byIri: true };
    }
    // r.iriToken counts too: an IRI already carrying a replacement token is
    // already safe — never re-anonymize it.
    if (r.iriToken && local.includes(r.iriToken)) return { r, byIri: true };
  }
  // Literal-mention match may only DEMOTE (anonymize/remove) — a bio that
  // merely mentions a keep-verdict person must never make this actor public
  // under its own unrenamed IRI (that leaked Actor_<RealName> entities).
  for (const r of registry) {
    if (r.verdict !== 'keep' && e.literals.some(l => l.includes(r.name))) return { r, byIri: false };
  }
  return null;
}

const resolution = new Map(); // iri -> { verdict: 'public'|'private'|'pending', why }
let pendingCount = 0;
const flaggedActors = [];
const forcedRenames = new Map(); // implicit-anon actor IRIs -> Actor_Person_NN

function implicitAnon(iri) {
  const local = iri.replace(/^narr:/, '');
  if (!anonMap[iri]) { anonMap[iri] = nextTok(); usedToks.add(anonMap[iri]); }
  // Persona/archetype IRIs (Actor_Char_*) carry vocabulary, not names —
  // deriving prose-replacement rules from them clobbers ordinary words
  // ("advisor" -> "person30"). Rename the IRI only.
  const persona = /^Char_/.test(local.replace(/^Actor_/, ''));
  const words = persona ? [] : guessNameWords(local);
  const name = words.join(' ') || local; // key must be unique-ish and non-empty
  if (!persona && !profile.actors[name]) {
    profile.actors[name] = {
      verdict: 'anonymize', replacement: 'a collaborator',
      iriToken: anonMap[iri], aliases: words.filter(w => w !== name),
      implicit: true,
    };
  }
  // Guarantee the IRI rename even when the derived tokens can't cover the
  // local name (Actor_AJ_Cox: "Cox" is too short to be a token).
  forcedRenames.set(iri, `narr:Actor_${anonMap[iri]}`);
  flaggedActors.push({ iri, as: `narr:Actor_${anonMap[iri]}`, guessed: name });
}

for (const [iri, e] of entities) {
  const hash = hashOf(e);
  if ((profile.removeEntities || []).includes(iri)) {
    resolution.set(iri, { verdict: 'private', why: 'profile.removeEntities' });
    continue;
  }
  // entities that mention a remove-verdict person are withheld outright
  if (removedActors.some(r => e.literals.some(l => new RegExp(`(?<![A-Za-z0-9])${r.name}(?![A-Za-z0-9])`).test(l)))) {
    resolution.set(iri, { verdict: 'private', why: 'mentions removed actor' });
    continue;
  }
  if (/^narr:Actor_/.test(iri)) {
    // IRI-pattern rules first (model actors, public figures, etc.)
    const pat = (profile.actorIriPatterns || []).find(p => new RegExp(p.pattern).test(iri));
    const m = actorMatch(iri, e);
    if (m && m.r.verdict === 'remove') {
      resolution.set(iri, { verdict: 'private', why: `registry:${m.r.name}:remove` });
      continue;
    }
    if (!pat && (!m || !m.byIri)) {
      // Unregistered actor (or literal-only match, which can't rename the
      // IRI): anonymize implicitly rather than withhold — the entity stays
      // in the graph under a stable Person_NN identity, and the derived name
      // words drive prose replacement corpus-wide. Flagged in the PRIVATE
      // report so a real registry entry can replace this later.
      implicitAnon(iri);
      // content still falls through to the verdict store below
    }
    // Registry governs NAMING only; the actor entity's CONTENT still needs a
    // verdict (bios accumulate operational/personal detail).
    // fall through to the verdict store below
  }
  const v = verdicts[iri];
  if (v && v.hash === hash) {
    resolution.set(iri, { verdict: v.verdict, why: 'verdict' });
  } else {
    resolution.set(iri, { verdict: 'pending', why: v ? 'stale verdict (content changed)' : 'unjudged' });
    pendingCount++;
  }
}

// ── Pass 2.5: collect every IRI surface, then sweep REFERENCE-ONLY actors ──
// Digests reference full <...#Local> IRIs, prose literals quote bare locals
// ("Extends Claim_XShapePattern"), and agent IRIs use /agent/Local. An
// Actor_* IRI that is only ever referenced (never asserted as an entity)
// skips pass 2 entirely — it must still be anonymized (Actor_BillCromie
// leaked exactly this way).
if (fs.existsSync(DIGEST_DIR)) {
  for (const f of fs.readdirSync(DIGEST_DIR).filter(f => f.endsWith('.trig'))) {
    const t = fs.readFileSync(path.join(DIGEST_DIR, f), 'utf8');
    for (const m of t.matchAll(/#([A-Za-z0-9_]+)>/g)) allIris.add('narr:' + m[1]);
    for (const m of t.matchAll(/\/agent\/([A-Za-z0-9_]+)/g)) allIris.add('narr:' + m[1]);
  }
}
for (const [, e] of entities) {
  for (const l of e.literals) {
    for (const m of l.matchAll(/(?<![A-Za-z0-9_])([A-Z][A-Za-z0-9]*_[A-Za-z0-9_]+)(?![A-Za-z0-9_])/g)) allIris.add('narr:' + m[1]);
  }
}
for (const f of files) {
  const t = fs.readFileSync(path.join(TX_DIR, f), 'utf8');
  for (const m of t.matchAll(/\/agent\/([A-Za-z0-9_]+)/g)) allIris.add('narr:' + m[1]);
}
for (const iri of allIris) {
  if (!/^narr:Actor_/.test(iri) || resolution.has(iri)) continue;
  const pat = (profile.actorIriPatterns || []).find(p => new RegExp(p.pattern).test(iri));
  const m = actorMatch(iri, { literals: [] });
  if (!pat && (!m || !m.byIri)) implicitAnon(iri);
}

// Implicit entries are now in the in-memory profile — build the name map and
// persist the anon-map allocations (private repo state, like verdicts.json).
const nameMap = buildNameMap(profile);
if (!DRY) fs.writeFileSync(ANON_MAP, JSON.stringify(anonMap, null, 2));

const isPrivate = iri => {
  const r = resolution.get(iri);
  return r ? r.verdict !== 'public' : false; // unknown IRIs (hubs referenced but never asserted) pass through
};
const privateSet = new Set([...resolution.entries()].filter(([, r]) => r.verdict !== 'public').map(([i]) => i));

// ── Pass 3: IRI renames (derived from anonymized names) ────────────────────
const renames = deriveIriRenames([...allIris], profile);
// Forced renames WIN: a token-derived partial (Actor_AJ_Person32) must not
// beat the wholesale Person_NN rename for an implicit-anon actor IRI.
for (const [from, to] of forcedRenames) renames.set(from, to);

// ── Pass 4: transform TX files ──────────────────────────────────────────────
const stats = { files: files.length, kept: 0, droppedFiles: 0, groupsKept: 0, groupsDropped: 0, updatesDropped: 0, validationErrors: [] };
const outputs = new Map(); // outPath -> content

for (const f of files) {
  const text = fs.readFileSync(path.join(TX_DIR, f), 'utf8');
  const stmts = splitStatements(text);
  const outStmts = [];
  let publicContent = false;

  for (const stmt of stmts) {
    const p = parseInsertData(stmt);
    if (p.kind === 'update') {
      if (mentionedEntities(stmt).some(iri => privateSet.has(iri))) { stats.updatesDropped++; continue; }
      outStmts.push(stmt);
      continue;
    }
    if (p.kind === 'other') { outStmts.push(stmt); continue; }
    const keptGroups = [];
    for (const g of p.groups) {
      if (g.subject && !g.subject.startsWith('narr:Tx_') && privateSet.has(g.subject)) {
        stats.groupsDropped++;
        continue;
      }
      keptGroups.push(g);
      if (g.subject && !g.subject.startsWith('narr:Tx_')) { stats.groupsKept++; publicContent = true; }
    }
    // a graph block with only whitespace/Tx groups left and no entity content
    const hasEntityContent = keptGroups.some(g => g.subject && !g.subject.startsWith('narr:Tx_'));
    if (p.graph && !hasEntityContent) continue; // drop empty named-graph statement
    outStmts.push(p.head + keptGroups.map(g => g.text).join('') + p.tail);
  }

  if (!publicContent) { stats.droppedFiles++; continue; } // provenance-only or fully-private file

  let out = outStmts.join(';');
  // strip references to private entities from kept text (prov:generated lists etc.)
  out = stripValueRefs(out, privateSet);
  // Rename IRI-ish tokens FIRST (so name replacement can't chop them mid-token),
  // then anonymize names + redact patterns — in literals and comments alike.
  out = mapLiterals(out, v => anonymizeLiteral(applyIriRenames(v, renames), nameMap, redactions));
  out = mapComments(out, c => anonymizeLiteral(applyIriRenames(c, renames), nameMap, redactions));
  // rename IRIs containing private-name tokens in the syntax itself
  {
    const { masked, literals } = maskLiterals(out);
    out = unmaskLiterals(applyIriRenames(masked, renames), literals);
  }

  const errs = validateSparql(out);
  if (errs.length) stats.validationErrors.push({ file: f, errs });

  const outName = renameFile(f, nameMap, renames);
  outputs.set(path.join('.aswritten/tx', outName), out);
  stats.kept++;
}

// ── Pass 5: transform digests (mechanical only; regen recommended) ─────────
let digestStats = { kept: 0, dropped: 0 };
if (fs.existsSync(DIGEST_DIR)) {
  for (const f of fs.readdirSync(DIGEST_DIR).filter(f => f.endsWith('.trig'))) {
    const hub = 'narr:' + f.replace(/\.trig$/, '');
    if (privateSet.has(hub)) { digestStats.dropped++; continue; }
    let text = fs.readFileSync(path.join(DIGEST_DIR, f), 'utf8');
    text = mapLiterals(text, v =>
      anonymizeLiteral(applyIriRenames(v, renames), nameMap, redactions));
    {
      const { masked, literals } = maskLiterals(text);
      text = unmaskLiterals(applyIriRenames(masked, renames), literals);
    }
    const outName = renameFile(f, nameMap, renames);
    outputs.set(path.join('.aswritten/digests', outName), text);
    digestStats.kept++;
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
const publicN = [...resolution.values()].filter(r => r.verdict === 'public').length;
const privateN = [...resolution.values()].filter(r => r.verdict === 'private').length;
const pendings = [...resolution.entries()].filter(([, r]) => r.verdict === 'pending');

// The FULL report names what was elided (withheld IRIs, implicit actors,
// source path) — it is private-repo state and must never reach the public
// repo, a public PR body, or public git history.
const report = {
  generatedFrom: ROOT,
  entities: entities.size,
  public: publicN,
  private: privateN,
  pending: pendings.length,
  implicitActors: flaggedActors,
  txFiles: { total: files.length, kept: stats.kept, dropped: stats.droppedFiles },
  groups: { kept: stats.groupsKept, dropped: stats.groupsDropped },
  updatesDropped: stats.updatesDropped,
  digests: digestStats,
  iriRenames: renames.size,
  validationErrors: stats.validationErrors,
  pendingList: pendings.slice(0, 500).map(([iri, r]) => `${iri} (${r.why})`),
};

console.log(JSON.stringify(report, null, 2));

if (stats.validationErrors.length) {
  console.error(`\nVALIDATION FAILURES in ${stats.validationErrors.length} files — not writing output.`);
  process.exit(1);
}

// ── Leak-sweep gate: no registered private name may survive in any output ──
// path or content, ANY CASE (lowercase path forms are how "acme" once
// slipped through a case-sensitive ad-hoc sweep). Fails the run like a
// validation error; withhold-everything beats publish-one-name.
{
  const re = sweepRegex(profile);
  const leaks = [];
  for (const [rel, content] of outputs) {
    const pm = rel.match(re);
    if (pm) leaks.push(`${rel} (filename: ${pm[1]})`);
    const cm = content.match(re);
    if (cm) leaks.push(`${rel} (content: ${cm[1]})`);
  }
  if (leaks.length) {
    console.error(`\nLEAK SWEEP FAILED — registered private names in output; not writing:\n  ${leaks.slice(0, 20).join('\n  ')}`);
    process.exit(1);
  }
}

if (!DRY && OUT) {
  // Public side: corpus files ONLY.
  for (const [rel, content] of outputs) {
    const dest = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  // Private side: full report + the PR body the workflow posts publicly.
  fs.writeFileSync(path.join(PRIVATE_OUT, 'materialization-report.json'), JSON.stringify(report, null, 2));
  const prBody = `## Public perspective materialization

Generated from the private graph by the materialization pipeline. Everything
in this PR is post-elision: registry names replaced, private entities removed,
unregistered actors anonymized to stable pseudonyms (tree/bird names —
\`Actor_Wren\`, \`Actor_Juniper\` — obviously fake, mapped privately).
**Nothing publishes until a human merges this PR.** Review the diff for
anonymization misses and over-sharing.

| | |
|---|---|
| Entities in graph | ${entities.size} |
| Published | ${publicN} |
| Withheld | ${privateN + pendings.length} |
| TX files kept / total | ${stats.kept} / ${files.length} |
| Digests kept / dropped | ${digestStats.kept} / ${digestStats.dropped} |
| IRI renames applied | ${renames.size} |
| Implicitly anonymized actors | ${flaggedActors.length} |

### Notes
- The itemized withheld/anonymized lists are recorded in the private repo
  (\`.aswritten/public/materialization-report.json\`), never here.
- Digests were transformed mechanically (names, redactions, IRI renames). Narrations may still summarize withheld children; regenerate digests on this repo for a clean read surface.
- Verdicts are sticky: re-runs only re-judge new/changed entities.
`;
  fs.writeFileSync(path.join(PRIVATE_OUT, 'PR_BODY.md'), prBody);
  console.error(`\nWrote ${outputs.size} corpus files to ${OUT}; report + PR body to ${PRIVATE_OUT}`);
}
