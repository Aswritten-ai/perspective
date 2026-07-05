#!/usr/bin/env node
// Merge out-of-band judge output (verdicts-*.jsonl) into
// .aswritten/public/verdicts.json, joining hashes from the exported chunks.
//   node scripts/public-transform/merge-verdicts.mjs --dir <pending-dir> [--by <label>]
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const DIR = opt('--dir', null);
const BY = opt('--by', 'claude (subscription backfill)');
if (!DIR) { console.error('need --dir <dir with chunk-*.json + verdicts-*.jsonl>'); process.exit(2); }

const ROOT = process.cwd();
const VERDICTS = path.join(ROOT, '.aswritten/public/verdicts.json');
const verdicts = fs.existsSync(VERDICTS) ? JSON.parse(fs.readFileSync(VERDICTS, 'utf8')) : {};

// hash lookup from the exported chunks
const hashes = new Map();
for (const f of fs.readdirSync(DIR).filter(f => /^chunk-\d+\.json$/.test(f))) {
  for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) hashes.set(e.iri, e.hash);
}

let merged = 0, skipped = 0, dupes = 0, badLines = 0;
const seen = new Set();
for (const f of fs.readdirSync(DIR).filter(f => /^verdicts-\d+\.jsonl$/.test(f)).sort()) {
  for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let v;
    try { v = JSON.parse(line); } catch { badLines++; continue; }
    if (!v.iri || !['public', 'private'].includes(v.verdict)) { badLines++; continue; }
    if (seen.has(v.iri)) { dupes++; continue; }
    seen.add(v.iri);
    const hash = hashes.get(v.iri);
    if (!hash) { skipped++; continue; } // not in this export — stale line
    verdicts[v.iri] = {
      verdict: v.verdict, reason: (v.reason || '').slice(0, 200),
      hash, by: BY, at: new Date().toISOString().slice(0, 10),
    };
    merged++;
  }
}

fs.writeFileSync(VERDICTS, JSON.stringify(verdicts, null, 2));
const counts = Object.values(verdicts).reduce((a, v) => (a[v.verdict] = (a[v.verdict] || 0) + 1, a), {});
console.log(`merged=${merged} dupes=${dupes} skipped=${skipped} badLines=${badLines}`);
console.log(`verdicts.json now: ${JSON.stringify(counts)} (total ${Object.keys(verdicts).length})`);
const unjudged = [...hashes.keys()].filter(iri => !verdicts[iri]);
console.log(`still unjudged from this export: ${unjudged.length}`);
if (unjudged.length) fs.writeFileSync(path.join(DIR, 'unjudged.json'), JSON.stringify(unjudged, null, 1));
