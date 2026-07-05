#!/usr/bin/env node
// Build the public perspective navigator: a static, indexed, styled digest
// site generated from .aswritten/digests/*.trig + .aswritten/tx/*.sparql.
// Runs inside the PUBLIC repo (the materialized perspective); also runnable
// against any aswritten repo for preview.
//
//   node scripts/public-transform/navigator/build-site.mjs --out _site [--config site.json]
//
// site.json: { "title": "...", "shareId": "...", "origin": "https://..." }
//
// The browse surface is the DIGESTS: the index lists root digest areas
// (grouped substance vs voice/style, sorted), each hub page renders its
// narration plus its covered sub-areas and entities inline. The flat entity
// index is a reference appendix, grouped by type.

import fs from 'fs';
import path from 'path';
import { collectEntities } from '../lib/corpus.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const OUT = opt('--out', '_site');
const ROOT = process.cwd();
const cfgPath = opt('--config', path.join(ROOT, 'site.json'));
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
const TITLE = cfg.title || 'The aswritten perspective';
const SHARE_ID = cfg.shareId || null;

const DIGEST_DIR = path.join(ROOT, '.aswritten/digests');
const TX_DIR = path.join(ROOT, '.aswritten/tx');

// ── Parse digests ────────────────────────────────────────────────────────────
function parseDigest(text) {
  const d = {};
  const g = (re) => (text.match(re) || [])[1];
  d.digestOf = g(/narr:digestOf\s+<[^#>]*#([A-Za-z0-9_]+)>/) || g(/narr:digestOf\s+narr:([A-Za-z0-9_]+)/);
  d.childCount = +(g(/narr:childCount\s+"(\d+)"/) || 0);
  const narr = text.match(/narr:narration\s+"""([\s\S]*?)"""/);
  d.narration = narr ? narr[1] : '';
  d.covers = [...text.matchAll(/narr:covers\s+<[^#>]*#([A-Za-z0-9_]+)>/g)].map(m => m[1]);
  d.keyPhrases = [...text.matchAll(/narr:text\s+"((?:[^"\\]|\\.)*)"/g)].map(m => m[1].replace(/\\"/g, '"')).slice(0, 12);
  return d;
}

const digests = new Map();
if (fs.existsSync(DIGEST_DIR)) {
  for (const f of fs.readdirSync(DIGEST_DIR).filter(f => f.endsWith('.trig'))) {
    const d = parseDigest(fs.readFileSync(path.join(DIGEST_DIR, f), 'utf8'));
    if (d.digestOf) digests.set(d.digestOf, d);
  }
}

// ── Collect entities for the reference index ────────────────────────────────
const { entities } = fs.existsSync(TX_DIR) ? collectEntities(TX_DIR) : { entities: new Map() };

// ── Digest tree + grouping ───────────────────────────────────────────────────
// covers edges between digests form a (shallow) tree: only roots appear on
// the index; sub-digests render nested on their parent's hub page.
const parentOf = new Map();
for (const [local, d] of digests)
  for (const c of d.covers) if (digests.has(c) && !parentOf.has(c)) parentOf.set(c, local);
const roots = [...digests.keys()].filter(l => !parentOf.has(l));

// Voice/style rubric hubs (StyleObservation clusters) outnumber the
// substantive areas ~2:1 — split them into their own index section so
// positioning/architecture/strategy isn't buried under rhetoric taxonomy.
const STYLE_TYPES = new Set(['narr:StyleObservation', 'narr:StyleMetrics', 'narr:Sample', 'narr:RubricAssessment']);
function isStyleHub(local) {
  let style = 0, known = 0;
  for (const c of digests.get(local).covers) {
    if (digests.has(c)) continue;
    const e = entities.get('narr:' + c);
    if (!e) continue;
    known++;
    if (e.types.some(t => STYLE_TYPES.has(t))) style++;
  }
  return known > 0 && style / known > 0.5;
}

const disp = l => l.replace(/_/g, ' ');
const byName = (a, b) => disp(a).localeCompare(disp(b), 'en', { sensitivity: 'base' });

// ── Rendering helpers ────────────────────────────────────────────────────────
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hubHref = local => `hub-${local}.html`;
/** Plain-text excerpt: markdown links/bold/cite-refs stripped. */
const excerpt = (s, n) => s.replace(/\[([^\]]*)\]\((?:narr:)?[^)]*\)/g, '$1')
  .replace(/\*\*/g, '').replace(/\(narr:[A-Za-z0-9_]+\)/g, '').replace(/\^?narr:[A-Za-z0-9_]+/g, '')
  .replace(/\s+/g, ' ').trim().slice(0, n);

/** Minimal markdown: paragraphs, **bold**, `code`, > quotes, narr: cite links. */
function md(text) {
  const linkify = s => s
    .replace(/\(narr:([A-Za-z0-9_]+)\)/g, (_, l) =>
      digests.has(l) ? ` (<a class="cite" href="${hubHref(l)}">${l}</a>)` : ` (<a class="cite" href="entities.html#${l}">${l}</a>)`)
    .replace(/\^?narr:([A-Za-z0-9_]+)/g, (_, l) =>
      digests.has(l) ? `<a class="cite" href="${hubHref(l)}">${l}</a>` : `<a class="cite" href="entities.html#${l}">${l}</a>`);
  return text.split(/\n\n+/).map(p => {
    p = esc(p.trim());
    if (!p) return '';
    if (p.startsWith('&gt;')) return `<blockquote>${linkify(p.replace(/^&gt;\s?/gm, ''))}</blockquote>`;
    p = p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
    return `<p>${linkify(p)}</p>`;
  }).join('\n');
}

const CSS = `
:root { --gold: #b8963e; --ink: #1c1c1c; --paper: #fdfcf9; --muted: #6b6b6b; --card: #f6f1e6; }
@media (prefers-color-scheme: dark) { :root { --ink: #e8e5df; --paper: #16150f; --muted: #a09a8c; --card: #221f16; } }
* { box-sizing: border-box; }
body { font-family: Georgia, 'Times New Roman', serif; color: var(--ink); background: var(--paper);
  max-width: 46em; margin: 0 auto; padding: 2rem 1.2rem 4rem; line-height: 1.65; }
header.mast { border-bottom: 3px solid var(--gold); padding-bottom: 1rem; margin-bottom: 2rem; }
.brand { font-family: Helvetica, Arial, sans-serif; font-size: .75rem; letter-spacing: .18em;
  text-transform: uppercase; color: var(--gold); margin: 0 0 .5rem; }
.brand a { color: inherit; text-decoration: none; }
h1 { font-size: 1.7rem; line-height: 1.25; margin: 0 0 .4rem; }
h2 { font-size: 1.15rem; margin: 2rem 0 .6rem; }
.sub { color: var(--muted); font-size: .95rem; margin: 0; }
.crumb { font-family: Helvetica, Arial, sans-serif; font-size: .8rem; margin: 0 0 .8rem; }
.crumb a { color: var(--gold); text-decoration: none; }
a { color: inherit; }
a.cite { color: var(--gold); text-decoration: none; font-family: Helvetica, Arial, sans-serif; font-size: .85em; }
a.cite:hover { text-decoration: underline; }
blockquote { border-left: 3px solid var(--gold); margin: 1em 0; padding: .1em 0 .1em 1em; color: var(--muted); }
.card { border: 1px solid var(--card); border-left: 3px solid var(--gold); border-radius: 6px;
  background: var(--card); padding: .7rem 1rem; margin: .6rem 0; }
.card .k { font-family: Helvetica, Arial, sans-serif; font-size: .75rem; color: var(--gold);
  text-transform: uppercase; letter-spacing: .1em; }
.hublist { list-style: none; padding: 0; }
.hublist li { margin: .9rem 0; }
.hublist .n { color: var(--muted); font-size: .85rem; font-family: Helvetica, Arial, sans-serif; }
.install { border: 1px solid var(--gold); border-radius: 8px; padding: 1rem 1.2rem; margin: 1.4rem 0; background: var(--card); }
.install code { display: block; background: transparent; border-left: 3px solid var(--gold);
  padding: .4rem .8rem; margin-top: .6rem; font-size: .85rem; overflow-x: auto; white-space: pre; }
code { font-family: ui-monospace, Menlo, monospace; font-size: .9em; }
footer { margin-top: 3rem; border-top: 1px solid var(--card); padding-top: 1rem;
  color: var(--muted); font-size: .85rem; }
.entity { padding: .5rem 0; border-bottom: 1px solid var(--card); font-size: .92rem; }
.entity .t { font-family: Helvetica, Arial, sans-serif; font-size: .75rem; color: var(--gold); }
`;

const page = (title, body, { desc = '' } = {}) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>${desc ? `\n<meta name="description" content="${esc(desc)}">` : ''}
<style>${CSS}</style></head><body>
<header class="mast"><p class="brand"><a href="index.html">aswritten.ai · public perspective</a></p></header>
${body}
<footer>Materialized from aswritten's own knowledge graph — every page is generated from witnessed, dated,
attributed organizational discourse. Names of customers and collaborators are anonymized; the reasoning is real.
${SHARE_ID ? `Install it in your own AI: perspective id <code>${SHARE_ID}</code>.` : ''}
<br><a href="https://aswritten.ai">aswritten.ai</a> · <a href="https://docs.aswritten.ai">docs</a> · <a href="llms.txt">llms.txt</a></footer>
</body></html>`;

/** One-line entity reference row (used on hub pages and the entity index). */
const entityRow = (local, e, { anchor = true } = {}) => {
  const first = (e.literals.find(l => l.length > 20) || e.literals[0] || '').slice(0, 240);
  return `<div class="entity"${anchor ? ` id="${local}"` : ''}><span class="t">${esc((e.types[0] || '').replace('narr:', ''))}</span> <strong>${esc(local)}</strong><br>${esc(first)}</div>`;
};

const hubLi = local => {
  const d = digests.get(local);
  const subs = d.covers.filter(c => digests.has(c)).length;
  return `<li><a href="${hubHref(local)}"><strong>${esc(disp(local))}</strong></a> <span class="n">${d.childCount} nodes${subs ? `, ${subs} sub-areas` : ''}</span><br>${esc(excerpt(d.narration, 180))}…</li>`;
};

// ── Emit ─────────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true });

// hub pages: narration first, then sub-areas, then covered entities inline —
// the digest IS the browse surface; the entity index is only an appendix.
for (const [local, d] of digests) {
  const subHubs = d.covers.filter(c => digests.has(c)).sort(byName);
  const covered = d.covers.filter(c => !digests.has(c));
  const published = covered.filter(c => entities.has('narr:' + c)).sort(byName);
  const withheld = covered.length - published.length;
  const parent = parentOf.get(local);
  const body = `
<p class="crumb"><a href="index.html">Perspective</a>${parent ? ` › <a href="${hubHref(parent)}">${esc(disp(parent))}</a>` : ''} › ${esc(disp(local))}</p>
<h1>${esc(disp(local))}</h1>
<p class="sub">${d.childCount} nodes in this area of the perspective</p>
${md(d.narration)}
${subHubs.length ? `<h2>Sub-areas</h2><ul class="hublist">` + subHubs.map(hubLi).join('\n') + `</ul>` : ''}
${d.keyPhrases.length ? `<h2>Witness phrases</h2>` + d.keyPhrases.map(k => `<div class="card"><span class="k">verbatim</span><br>${esc(k)}</div>`).join('') : ''}
${published.length ? `<h2>In this area</h2>` + published.map(c => entityRow(c, entities.get('narr:' + c), { anchor: false })).join('\n')
    + `<p class="sub">${withheld ? `${withheld} further node${withheld === 1 ? ' is' : 's are'} not published in the public projection. ` : ''}Each node links from the <a href="entities.html">entity index</a>.</p>` : ''}
`;
  fs.writeFileSync(path.join(OUT, hubHref(local)), page(`${disp(local)} — ${TITLE}`, body, { desc: excerpt(d.narration, 150) }));
}

// entity reference index — appendix, grouped by type, alphabetical within
const byType = new Map();
for (const [iri, e] of entities) {
  const t = (e.types[0] || 'Other').replace('narr:', '');
  (byType.get(t) || byType.set(t, []).get(t)).push([iri.replace(/^narr:/, ''), e]);
}
const typeSections = [...byType.entries()].sort((a, b) => b[1].length - a[1].length).map(([t, rows]) =>
  `<h2 id="type-${esc(t)}">${esc(t)} <span class="n" style="font-weight:normal;color:var(--muted);font-size:.8em">(${rows.length})</span></h2>\n`
  + rows.sort((a, b) => byName(a[0], b[0])).map(([l, e]) => entityRow(l, e)).join('\n'));
fs.writeFileSync(path.join(OUT, 'entities.html'),
  page(`Entity index — ${TITLE}`, `<h1>Entity index</h1><p class="sub">${entities.size} published nodes, each attributed and dated in the graph — grouped by type. Browse by area from the <a href="index.html">perspective index</a>.</p>\n${typeSections.join('\n')}`));

// index — root digests only, substance first, voice/style rubrics second
const areaRoots = roots.filter(l => !isStyleHub(l)).sort(byName);
const styleRoots = roots.filter(l => isStyleHub(l)).sort(byName);

const install = SHARE_ID ? `
<div class="install"><strong>Install this perspective in your AI.</strong>
<p>Any MCP-capable AI (Claude, Copilot, Cursor) can load this perspective live — grounded answers with citations into everything on this site.</p>
<code>aswritten_perspective(id="${SHARE_ID}")</code>
<p class="sub">Full instructions at <a href="https://docs.aswritten.ai">docs.aswritten.ai</a>.</p></div>` : `
<div class="install"><strong>Install this perspective in your AI.</strong>
<p>See <a href="https://docs.aswritten.ai">docs.aswritten.ai</a> for the live share ID and setup.</p></div>`;

const indexBody = `
<h1>${esc(TITLE)}</h1>
<p class="sub">The public projection of aswritten's own organizational knowledge graph: positioning, product
thinking, architecture, and the reasoning behind them — who said what, and what they made of it.</p>
${install}
<h2>Areas of the perspective</h2>
<ul class="hublist">
${areaRoots.map(hubLi).join('\n')}
</ul>
<h2>Voice &amp; style</h2>
<p class="sub">How aswritten writes and speaks — rhetorical devices, tone, and style rubrics observed across the org's own content.</p>
<ul class="hublist">
${styleRoots.map(hubLi).join('\n')}
</ul>
<p><a href="entities.html">Full entity index →</a></p>`;
fs.writeFileSync(path.join(OUT, 'index.html'), page(TITLE, indexBody, { desc: 'The public projection of aswritten\'s organizational knowledge graph.' }));

// llms.txt
const llms = `# ${TITLE}

> The machine-readable public perspective of aswritten.ai: an organizational
> knowledge graph of discourse acts — who said what, when, and what they made
> of it — materialized from the company's own use of its product.

${SHARE_ID ? `Live install for MCP-capable agents: call aswritten_perspective with id "${SHARE_ID}" against https://aswritten.ai's MCP endpoint — see https://docs.aswritten.ai for setup.\n` : 'See https://docs.aswritten.ai for the live perspective share ID.\n'}
## Areas
${areaRoots.map(l => `- [${l}](${hubHref(l)}): ${excerpt(digests.get(l).narration, 120)}`).join('\n')}

## Voice & style
${styleRoots.map(l => `- [${l}](${hubHref(l)}): ${excerpt(digests.get(l).narration, 120)}`).join('\n')}

## Reference
- [Entity index](entities.html): every published node with attribution
- [aswritten.ai](https://aswritten.ai): the product
- [docs.aswritten.ai](https://docs.aswritten.ai): protocol and setup
`;
fs.writeFileSync(path.join(OUT, 'llms.txt'), llms);

console.log(`navigator: ${digests.size} hub pages (${areaRoots.length} area roots, ${styleRoots.length} style roots), ${entities.size} entities, index + llms.txt -> ${OUT}`);
