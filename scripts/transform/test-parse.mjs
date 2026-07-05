// Round-trip + structural sanity for lib/parse.mjs against every real TX file.
// Run: node scripts/public-transform/test-parse.mjs
import fs from 'fs';
import path from 'path';
import { splitStatements, parseInsertData, mentionedEntities, extractLiterals, mapLiterals } from './lib/parse.mjs';

const TX_DIR = path.resolve(process.cwd(), '.aswritten/tx');
const files = fs.readdirSync(TX_DIR).filter(f => f.endsWith('.sparql'));
let fails = 0, stmts = 0, groups = 0, entities = new Set(), literals = 0;

for (const f of files) {
  const text = fs.readFileSync(path.join(TX_DIR, f), 'utf8');
  // 1. statement split round-trip
  const parts = splitStatements(text);
  const rejoined = parts.join(';');
  if (rejoined !== text && rejoined + ';' !== text && rejoined !== text.replace(/;\s*$/, '')) {
    // rejoin with ';' loses a possible trailing ';' — normalize both
    const norm = s => s.replace(/\s+$/, '');
    if (norm(parts.join(';')) !== norm(text) && norm(parts.join(';') + ';') !== norm(text)) {
      console.error(`ROUNDTRIP FAIL (statements): ${f}`);
      fails++;
      continue;
    }
  }
  stmts += parts.length;
  for (const stmt of parts) {
    const p = parseInsertData(stmt);
    if (p.kind === 'insert-data') {
      // 2. head + groups + tail reassembly must equal the original statement
      const re = p.head + p.groups.map(g => g.text).join('') + p.tail;
      if (re !== stmt) {
        console.error(`ROUNDTRIP FAIL (groups): ${f}\n  head=${JSON.stringify(p.head.slice(0, 60))}`);
        fails++;
        break;
      }
      groups += p.groups.length;
      for (const g of p.groups) if (g.subject) entities.add(g.subject);
    }
    // 3. literal mapping identity round-trip
    const id = mapLiterals(stmt, x => x);
    if (id !== stmt) {
      console.error(`ROUNDTRIP FAIL (literals): ${f}`);
      fails++;
      break;
    }
    literals += extractLiterals(stmt).length;
    mentionedEntities(stmt);
  }
}

console.log(`${files.length} files, ${stmts} statements, ${groups} triple groups, ${entities.size} unique subjects, ${literals} literals`);
console.log(fails === 0 ? 'ALL ROUND-TRIPS PASS' : `${fails} FAILURES`);
process.exit(fails ? 1 : 0);
