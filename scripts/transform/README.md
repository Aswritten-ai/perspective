# public-transform — the public perspective pipeline (task-316)

Materializes the public projection of this repo's perspective into the public
repo [Aswritten-ai/perspective](https://github.com/Aswritten-ai/perspective),
where it is served three ways: a browsable static navigator (GitHub Pages),
`llms.txt` for machine readers, and a live perspective share ID any
MCP-capable AI can install.

## The three layers

1. **Mechanical** (`materialize.mjs` + `lib/mechanical.mjs`) — deterministic,
   no LLM. The actor registry in `.aswritten/public/profile.json` maps every
   person and org to keep/anonymize/remove; names are replaced in string
   literals only, dollar figures / phones / emails are pattern-redacted, and
   IRI local names containing private-name tokens are renamed consistently
   (`narr:Obs_JaneSkepticismQuote` → `narr:Obs_AdvisorSkepticismQuote`).
   Entity URIs are otherwise never modified — see the SPARQL-integrity rules
   in `.claude/commands/transform.md`, all learned from real compile failures.

2. **Sticky verdicts** (`judge.mjs`) — an LLM classifies each entity
   public/private against `judge-rules.md`. Verdicts persist per entity (with
   a content hash) in `.aswritten/public/verdicts.json`; re-runs only judge
   new or changed entities. **Entities without a fresh verdict are withheld** —
   a failed judge run can never leak anything.

3. **Human gate** — the CI workflow (`.github/workflows/public-perspective.yml`)
   opens a PR on the public repo. Nothing publishes until a human merges it.

## Commands

```bash
# see what would happen (report only)
node scripts/public-transform/materialize.mjs --dry-run

# judge unclassified entities (sticky; resumable; needs a key)
ANTHROPIC_API_KEY=... node scripts/public-transform/judge.mjs [--limit 100]

# write the transformed corpus + report + PR body
node scripts/public-transform/materialize.mjs --out /tmp/public-out

# build the navigator site (also runs inside the public repo as scripts/transform/)
node scripts/public-transform/navigator/build-site.mjs --out _site
```

## Registry rules

- Every `Actor_*` entity must resolve against `profile.json` (by name or
  `actorIriPatterns`); unmatched actors are withheld and flagged in the PR.
- The registry decides **naming** (keep the name vs. replace it). Whether the
  actor's entity *content* publishes is still the judge's call — bios
  accumulate personal detail.
- The same registry is the anonymization source for the cite tool's public
  output mode (task-315). Change it here; both consume it.

## Shared with the public repo

`navigator/` (and `lib/`) are synced verbatim into the public repo as
`scripts/transform/` on every materialization PR — the public repo's Pages
workflow runs the navigator from there. Edit them here, never there.
