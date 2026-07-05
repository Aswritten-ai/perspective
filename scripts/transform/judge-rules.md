# Public-perspective classification rules

You are classifying entities from aswritten's organizational knowledge graph for
publication on the public web. Each entity is a discourse act (claim, narrative,
observation, style note) with its literals. For each entity return a verdict:

- `public` — safe to publish after mechanical anonymization (names are already
  replaced by a separate deterministic pass; assume that pass runs).
- `private` — withhold from the public perspective.

Return JSON only: `{ "<iri>": { "verdict": "public"|"private", "reason": "<one line>" }, ... }`

## PRIVATE (withhold)

- Personal financial detail: salary, founder compensation, runway, equity splits,
  specific raise mechanics (SAFE caps, SEL terms, tranche structures, check sizes,
  investor-by-investor state).
- Revenue projections, financial scenarios, internal pricing math, unit economics.
- Family members in personal or financial context.
- Internal capacity constraints framed as vulnerability (burnout, bandwidth,
  solo-founder fragility, health).
- Accelerator/grant application tactics and internal readings of them.
- Internal tooling and infrastructure choices (n8n internals, migration plans,
  deploy mechanics, database choices) — the plumbing, not the architecture.
- IP-sensitive mechanism detail: prompt-engineering recipes, extraction pipeline
  internals, eval methodology specifics, anything that reads as the secret sauce
  recipe rather than the dish.
- Customer-internal specifics beyond what the public case studies already carry
  (internal politics, individual performance, unreleased plans).
- Sales-pipeline state about named or identifiable prospects (who is close,
  who went cold, negotiation posture).
- Session-process noise: retro mechanics, backlog hygiene, tool-usage feedback
  that only matters to the dev process.

## PUBLIC (keep)

- Mission, vision, taglines, positioning, category definitions and their history
  (superseded positions included — the trajectory is the product's own story).
- Product behavior and methodology: how capture, extraction, perspectives,
  citation, conviction levels, review, and deployment work — at the level the
  published white paper and anatomy post already describe.
- Architecture at the published level: discourse-act ontology, git-native
  ownership, zero-retention model, MCP surface, deployment options.
- Market analysis, competitive positioning, why-now argument.
- The founding story, career arc, and the flocking/narrative-steering thesis.
- Customer archetypes and anonymized case-study material (the anonymization
  pass handles the names; you judge whether the CONTENT would still be
  sensitive with names replaced).
- Style/voice observations about published writing.

## Judgment calls

- If an entity mixes both, judge by what remains after anonymization: would a
  careful competitor or a customer's counsel learn something we'd regret? Then
  `private`.
- Bias: strategy and thinking are public (this is a company that publishes its
  reasoning); numbers, mechanics-of-money, pipeline state, and secret-sauce
  recipes are private.
- When genuinely uncertain, return `private` — a human reviews every promotion
  in a PR, and under-publishing is recoverable.
