#!/usr/bin/env node
// Leak sweep over an arbitrary directory tree — the LAST gate before anything
// reaches the public repo. The materialize gate only sees the corpus it
// writes; the workflow also rsyncs the transform scripts (and anything else
// staged) into the public repo, and a registered private name once shipped
// PUBLIC inside a code comment that no corpus sweep could see. This walks the
// full staged tree: file names AND content, case-insensitive, every file.
//
//   node scripts/public-transform/sweep.mjs --dir <staged-public-tree> \
//     [--profile .aswritten/public/profile.json]
//
// Exits 1 on any hit. Prints matches to stderr (private CI logs only —
// never runs on the public repo's own Actions).

import fs from 'fs';
import path from 'path';
import { loadProfile, sweepRegex } from './lib/mechanical.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const DIR = opt('--dir', null);
const PROFILE = opt('--profile', '.aswritten/public/profile.json');
if (!DIR) { console.error('usage: sweep.mjs --dir <tree> [--profile <profile.json>]'); process.exit(2); }

const re = sweepRegex(loadProfile(PROFILE));
const leaks = [];
let checked = 0;

(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git') continue;
    const p = path.join(dir, name);
    const st = fs.lstatSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!st.isFile()) continue;
    checked++;
    const rel = path.relative(DIR, p);
    const nm = rel.match(re);
    if (nm) leaks.push(`${rel} (filename: ${nm[1]})`);
    const cm = fs.readFileSync(p, 'utf8').match(re);
    if (cm) leaks.push(`${rel} (content: ${cm[1]})`);
  }
})(DIR);

if (leaks.length) {
  console.error(`LEAK SWEEP FAILED — registered private names in staged public tree:\n  ${leaks.slice(0, 40).join('\n  ')}`);
  process.exit(1);
}
console.log(`leak sweep: ${checked} files clean`);
