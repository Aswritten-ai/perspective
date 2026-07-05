#!/usr/bin/env node
// Sticky LLM classification for the public perspective (layer 2 of task-316).
//
//   ANTHROPIC_API_KEY=... node scripts/public-transform/judge.mjs [--limit N]
//
// Judges every entity that lacks a fresh verdict (hash-matched) and isn't
// already private by mechanical rule. Verdicts persist per-entity in
// .aswritten/public/verdicts.json — future runs only judge new/changed nodes.
// Writes incrementally after every batch, so an interrupted run resumes.

import fs from 'fs';
import path from 'path';
import { collectEntities, hashOf } from './lib/corpus.mjs';
import { loadProfile, registryEntries } from './lib/mechanical.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const LIMIT = +opt('--limit', Infinity);
const BATCH = +opt('--batch', 25);
// Anthropic direct or OpenRouter — whichever key is present (Anthropic wins).
const OR_KEY = process.env.OPENROUTER_API_KEY;
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY && !OR_KEY) { console.error('ANTHROPIC_API_KEY or OPENROUTER_API_KEY required'); process.exit(2); }
const MODEL = process.env.JUDGE_MODEL || (KEY ? 'claude-sonnet-5' : 'anthropic/claude-sonnet-4.5');
const API_URL = KEY ? 'https://api.anthropic.com/v1/messages' : 'https://openrouter.ai/api/v1/chat/completions';

const ROOT = process.cwd();
const PROFILE = path.join(ROOT, '.aswritten/public/profile.json');
const VERDICTS = path.join(ROOT, '.aswritten/public/verdicts.json');
const RULES = fs.readFileSync(path.join(ROOT, 'scripts/public-transform/judge-rules.md'), 'utf8');

const profile = loadProfile(PROFILE);
const verdicts = fs.existsSync(VERDICTS) ? JSON.parse(fs.readFileSync(VERDICTS, 'utf8')) : {};
const removedNames = registryEntries(profile).filter(r => r.verdict === 'remove').map(r => r.name);

const { entities } = collectEntities(path.join(ROOT, '.aswritten/tx'));

const queue = [];
for (const [iri, e] of entities) {
  const hash = hashOf(e);
  if ((profile.removeEntities || []).includes(iri)) continue;
  if (removedNames.some(n => e.literals.some(l => l.includes(n)))) continue; // mechanically private
  const v = verdicts[iri];
  if (v && v.hash === hash) continue; // fresh
  queue.push({ iri, hash, types: e.types, literals: e.literals });
}
console.error(`${queue.length} entities to judge (of ${entities.size})`);

const toJudge = queue.slice(0, LIMIT);
const save = () => fs.writeFileSync(VERDICTS, JSON.stringify(verdicts, null, 2));

async function judgeBatch(batch) {
  const payload = batch.map(b => ({
    iri: b.iri,
    types: b.types,
    text: b.literals.join('\n').slice(0, 1500),
  }));
  const body = {
    model: MODEL,
    max_tokens: 4000,
    system: RULES,
    messages: [{
      role: 'user',
      content: 'Classify these entities. Return ONLY a JSON object keyed by iri.\n\n' + JSON.stringify(payload, null, 1),
    }],
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const req = KEY
      ? { headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body }
      : { headers: { authorization: `Bearer ${OR_KEY}`, 'content-type': 'application/json' },
          body: { model: MODEL, max_tokens: body.max_tokens, messages: [{ role: 'system', content: body.system }, ...body.messages] } };
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(req.body),
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, attempt * 5000));
        continue;
      }
      throw new Error(`API ${res.status}: ${errText.slice(0, 300)}`);
    }
    const json = await res.json();
    const text = (KEY ? json.content?.[0]?.text : json.choices?.[0]?.message?.content) || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no JSON in response: ' + text.slice(0, 200));
    return JSON.parse(m[0]);
  }
  throw new Error('exhausted retries');
}

let done = 0, failures = 0;
const CONCURRENCY = 4;
const batches = [];
for (let i = 0; i < toJudge.length; i += BATCH) batches.push(toJudge.slice(i, i + BATCH));

async function worker() {
  while (batches.length) {
    const batch = batches.shift();
    try {
      const result = await judgeBatch(batch);
      for (const b of batch) {
        const r = result[b.iri];
        if (!r || !['public', 'private'].includes(r.verdict)) {
          failures++;
          continue; // stays pending — withheld by default
        }
        verdicts[b.iri] = {
          verdict: r.verdict, reason: (r.reason || '').slice(0, 200),
          hash: b.hash, by: MODEL, at: new Date().toISOString().slice(0, 10),
        };
      }
      done += batch.length;
      save();
      console.error(`judged ${done}/${toJudge.length}`);
    } catch (e) {
      failures += batch.length;
      console.error(`batch failed (${batch.length} entities stay pending): ${e.message}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
save();
const counts = Object.values(verdicts).reduce((a, v) => (a[v.verdict] = (a[v.verdict] || 0) + 1, a), {});
console.error(`done. verdicts: ${JSON.stringify(counts)}, failures/pending: ${failures}`);
