# The aswritten perspective

This repository is the **public projection of aswritten's own organizational
knowledge graph** — the company's positioning, product thinking, architecture,
and the reasoning behind them, modeled the way aswritten models everything:
as discourse. Who said what, when, and what they made of it.

aswritten ([aswritten.ai](https://aswritten.ai)) runs on its own product. This
repo is materialized automatically from the private graph on every merge to
the company's main branch: names of customers and collaborators are anonymized
mechanically, sensitive entities are withheld by a sticky classification layer,
and every release is reviewed by a human before merge. What remains is real —
the actual recorded decisions, with their dates, conviction levels, and
supersession lineage intact.

## Three ways to read it

1. **Browse** — the [perspective navigator](https://aswritten-ai.github.io/perspective/)
   renders every area of the graph as a page, with verbatim witness phrases
   and cite links. Machine index at
   [llms.txt](https://aswritten-ai.github.io/perspective/llms.txt).

2. **Install** — any MCP-capable AI (Claude, Copilot, Cursor) can load this
   perspective live and answer questions about aswritten grounded in the
   graph, with citations. Setup at [docs.aswritten.ai](https://docs.aswritten.ai).

3. **Clone** — the graph itself is here: `.aswritten/tx/*.sparql` are the
   transactions (append-only, provenance-carrying), `.aswritten/digests/*.trig`
   the compiled area digests. It is an ordinary aswritten repo; point the
   tools at it.

## Layout

- `.aswritten/tx/` — SPARQL transactions: the discourse acts
- `.aswritten/digests/` — TriG digests: narrated summaries per area
- `.aswritten/materialization-report.json` — what the last materialization kept and withheld
- `scripts/transform/` — the transform + navigator toolchain (synced from the
  [main repo](https://github.com/Aswritten-ai/aswritten); edit there, not here)
- `site.json` — navigator config (title, share ID)

Materialization PRs are opened by CI and merged by a human. If you spot
something that looks like it shouldn't be public, open an issue —
that's the review gate working.
