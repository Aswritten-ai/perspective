#!/usr/bin/env node
// Export unjudged entities as JSON chunks for out-of-band classification
// (e.g. the one-time subscription-agent backfill). Same queue logic as judge.mjs.
//   node scripts/public-transform/export-pending.mjs --out <dir> --chunks 10
import fs from 'fs';
import path from 'path';
import { collectEntities, hashOf } from './lib/corpus.mjs';
import { loadProfile, registryEntries } from './lib/mechanical.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const OUT = opt('--out', '/tmp/pending-entities');
const CHUNKS = +opt('--chunks', 10);

const ROOT = process.cwd();
const profile = loadProfile(path.join(ROOT, '.aswritten/public/profile.json'));
const VERDICTS = path.join(ROOT, '.aswritten/public/verdicts.json');
const verdicts = fs.existsSync(VERDICTS) ? JSON.parse(fs.readFileSync(VERDICTS, 'utf8')) : {};
const removedNames = registryEntries(profile).filter(r => r.verdict === 'remove').map(r => r.name);

const { entities } = collectEntities(path.join(ROOT, '.aswritten/tx'));
const queue = [];
for (const [iri, e] of entities) {
  const hash = hashOf(e);
  if ((profile.removeEntities || []).includes(iri)) continue;
  if (removedNames.some(n => e.literals.some(l => l.includes(n)))) continue;
  const v = verdicts[iri];
  if (v && v.hash === hash) continue;
  queue.push({ iri, hash, types: e.types, files: [...e.files], text: e.literals.join('\n').slice(0, 1500) });
}

fs.mkdirSync(OUT, { recursive: true });
const per = Math.ceil(queue.length / CHUNKS);
for (let i = 0; i < CHUNKS; i++) {
  const chunk = queue.slice(i * per, (i + 1) * per);
  if (!chunk.length) break;
  fs.writeFileSync(path.join(OUT, `chunk-${String(i).padStart(2, '0')}.json`), JSON.stringify(chunk, null, 1));
}
console.log(`${queue.length} pending entities -> ${Math.min(CHUNKS, Math.ceil(queue.length / per))} chunks in ${OUT}`);
