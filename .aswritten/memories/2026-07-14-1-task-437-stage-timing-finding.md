---
reviewers:
  - scarlet@aswritten.ai
  - +15044353923
---

# The extraction engine's inter-stage dead time and the self-invalidating graph cache

Finding recorded 2026-07-14 while instrumenting the multipass extraction engine (task-437). On a measured dev run, 57% of the wall clock (575 of 1,002 seconds) was time with no LLM call in flight — the judgment chain sat idle between passes. The three inter-stage gaps were navigate-to-resolve at 336 seconds, resolve-to-position at 109 seconds, and position-to-narrative at 130 seconds.

The largest contributor identified and reproduced: a self-invalidating graph cache. The engine's graph service keys its corpus cache on owner, repo, ref, and the .aswritten tree sha. Both the consult prefetch and the navigator's post-agent reads were building the graph against the run's own work branch. But the source-spur step commits the document and its source transaction to that same work branch mid-run, moving the tree sha — so the navigator's read missed the warm cache and rebuilt the entire 64,000-quad corpus for exactly the one transaction the run had just written.

Scarlet's ruling: "the base ref is correct." The consult and navigate reads now read the base ref the run was cut from, not the run's own freshly-committed work branch. The navigator consults the prior perspective; the document under extraction reaches the engine through pass one, never through these reads. Both reads now share one warm graph and the run's own commit can no longer invalidate it.

The dead time is also coupled to the prompt cache. Anthropic's default ephemeral cache lives five minutes, and the 336-second gap already exceeds it — so a slightly slower document would let the cached prefix evaporate between passes and silently revert the cost with no error. Scarlet approved the one-hour cache TTL to decouple the cache win from the dead time. The remaining inter-stage time is GitHub-IO and n8n-navigator-round-trip bound.