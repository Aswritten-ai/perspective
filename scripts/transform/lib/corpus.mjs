// Shared corpus collection for materialize.mjs and judge.mjs.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { splitStatements, parseInsertData, mentionedEntities, extractLiterals, maskLiterals } from './parse.mjs';

/** Walk every TX file: entities (iri -> {literals, types, files}) + all IRIs. */
export function collectEntities(txDir) {
  const files = fs.readdirSync(txDir).filter(f => f.endsWith('.sparql')).sort();
  const entities = new Map();
  const allIris = new Set();
  for (const f of files) {
    const text = fs.readFileSync(path.join(txDir, f), 'utf8');
    for (const stmt of splitStatements(text)) {
      for (const iri of mentionedEntities(stmt)) allIris.add(iri);
      const p = parseInsertData(stmt);
      if (p.kind !== 'insert-data') continue;
      for (const g of p.groups) {
        if (!g.subject || g.subject.startsWith('narr:Tx_')) continue;
        const e = entities.get(g.subject) || { literals: [], types: [], files: new Set() };
        e.literals.push(...extractLiterals(g.text).map(l => l.value));
        const { masked } = maskLiterals(g.text);
        const tm = masked.match(/\sa\s+((?:narr|prov|skos):[A-Za-z0-9_]+)/);
        if (tm && !e.types.includes(tm[1])) e.types.push(tm[1]);
        e.files.add(f);
        entities.set(g.subject, e);
      }
    }
  }
  return { files, entities, allIris };
}

export const hashOf = e => crypto.createHash('sha256')
  .update(e.types.join('|') + '\n' + e.literals.join('\n')).digest('hex').slice(0, 12);
