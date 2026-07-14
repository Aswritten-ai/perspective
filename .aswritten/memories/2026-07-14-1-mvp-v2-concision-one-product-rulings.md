---
reviewers:
  - scarlet@aswritten.ai
  - +15044353923
---

# MVP v2 Concision: One Product, the Front End That Was Never Built — and the Six Rulings That Followed

**Date:** 2026-07-14
**Source:** Scarlet Dame — typed working notes ("MVP v2 concision", marked #sic) plus a 31-minute voice memo addendum ("MVP v2 shrinking.m4a") recorded on a walk the same day, plus the design working session (445-mvp-concision) that ran the same afternoon and evening, in which Scarlet made six rulings on the questions the memo raised. The memo was transcribed locally (whisper.cpp + prosody extraction); delivery annotations are speaker-relative to that recording's baseline (outdoor walking audio; SEPTA platform announcements at the tail are excluded). Transcription corrections are noted at the bottom.

## Context

With the live surface (feed + extraction theatre), transcription integrations, and comms experiments all sketched, Scarlet called the next phase: strip everything down to core moments and roadmap the rest. This is the second time she has made this exact move — the March 19 MVP redefinition (install–compile–cite–remember–review as core; Refraction, Registry, marketplace deferred) was MVP v1's version of it, and the July 11 MVP-cut decision record was its immediate predecessor. What distinguishes this day: the memo's questions did not stay open. By evening, the working session had produced rulings on the extraction architecture, the access model, the design-system discipline, and the demo scope — several of them amending the July 11 record.

The headline settlement: **the live surface is not a second product or an experiment — it is the MVP product's front end that was never built.** And the theatre's design question resolved into something she found genuinely elegant: **the theatre becomes the graph viewer**, with resolution layers (expressions → positions → narratives → strata) instead of a separate explore-graph feature.

## The typed notes (verbatim, #sic)

> The work now is to take all of the experimentation and features we've sketched and to strip things down to core moments and roadmap the rest.
>
> Metaphor: we're designing a new building and we don't need the whole thing designed to construction members in CAD, we need to create a set of renders that make the experience of the space vivid (and in those renders, there should be gorgeous lighting, ghosted artifacts of life, appliances, furniture, etc).
>
> We need to define the product value for our target actors (both archetypal and specific humans we're talking to) as well as the product strategy.
>
> We need to clearly unify this with the past mcp only product, these are not two products, they are two surfaces of one system.
>
> Same with the codebase (clj, n8n, sneaky python), the new transcription integration, extraction theatre, etc are not a separate codebase, they are extensions of a single product.
>
> The product does not need to be finished for demos. Both for YC (recorded and live) and sales. More important than finished is clear, smooth, functional, valuable.
>
> ---
>
> Simplify.
>
> --- beta
>
> Teams integration gates Escher, our actual paying client
>
> Zoom gates Taylor testing, our most active beta tester
>
> Google meet gates our org's secondary transcription path and the last org suite surface.
>
> Otter and other transcription tools gate individual developer/entrepreneur testing/adoption
>
> Generic webhook
>
> --- comms/notificiations
>
> All notifications and agent messages must be proxies through front.
>
> This is part of the enterprise sell - you have an immediate open channel to your meeting attendees where they clarify their intent and you can speak back and it'd all captured to the perspective
>
> One GitHub org = front inbox
> Repo is switchable. Not one repo per inbox (connected number/email/etc). Repo/ref is inferred from convo ie if you just received a notification about a call, your reply assumes that call's ref unless you say otherwise.
>
> Can we programmatically create frontapp inboxes? We can certainly have unique GitHub-org@aswritten.ai or maybe org+[org]@. Slack and other webhook channels are easy. SMS is an enterprise/premium and US only feature. Other channels possible.
>
> Step in/out flow
>
> --- MVP
>
> Feed is required. With what filters etc?
>
> Theatre must feel like a chat flow with annotations that if removed would not move the chat bubbles or leave empty space.
>
> To this end, is it correct that we're creating a "memory" from the transcript and extracting that or should we be extracting the entire transcript? What's the difference? Tradeoff? Value?
>
> Sending a message to the theatre is answered by an agent that authenticates your logged in user, checks if you can read from the perspective (collaborator) then loads perspective (navigate) at the ref for the memory then responds. Note this perspective read at the consistent prefix (focus is last) needs to cache across multiple replies. If you aren't a collaborator, loads a perspective that is just the memory. Orphaned nodes are a feature and their connections should be rendered as CTA placeholders that need design.
>
> For mvp, can we do collaborator only? Or did we already decide this? I thought I decided that either collaborator only or public/explicit share (email or public link). Does share get the full perspective?
>
> Drop explore graph?
>
> What value are the dimensional runs providing? Do they actually influence the position/narrative/strata extraction or the reader?
>
> --- access
>
> Biggest open user flow x value x complexity x mvp x roadmap question
>
> What does admin, collaborator, attendee (in org, out), public see when they:
> Message perspective backed agent (notification or in theatre)
> View feed
> View theatre
>
> What is actually required for demos and which phase of sales process.
>
> Only full perspective, collaborator only + explicit share would hugely simplify and also meet YC demo needs (give them a public link, note they can read our whole org's history which in that case should be fine? That's a feature, no? We want them to be able to see depth)
>
> Note the per authed actor perspective filter is also related to loading perspectives for a single actor/role in the org. If I wanted to do the long talked about subagent per advisor setup, I want them to load a perspective based on their input and what it's effected. Maybe as simple as the calls they've been on? But better would be the positions/narratives/strata their expressions have influenced. Plus enough connected baseline context? Also related to this is the voice profiles.
>
> --- feed QA
>
> --- theatre QA
>
> Can reactions and a/b questions feel like responses from a system actor with a design language? So it always feels like a conversation and we can display minimal dimensional annotations below (move to an icon language?) + on desktop pass results in the gutter (where does this go on mobile, maybe visible on select only? Could be icons on the gutter side? Need mocks for this)q
>
> Gaps between messages, doesn't read like a conversation. We need to move commentary, etc to the gutters.
>
> Ask/add note -> always just "send"
>
> --- theatre mobile QA
>
> Pass status is at the top, needs a designed home.
>
> Filters are hidden
>
> Big bags between messages, does read like a conversation
>
> --- personal workflow
>
> I really want to be able to message an agent somewhere (email is fine, discord would be convenient, sms is fine but I often have long notes) with written notes and voice memos (both at the same time)

## The voice memo addendum

### One product — the front end that was never built

She opens by settling the unification question the typed notes raised, slowly and deliberately:

> I think this is one product, it's not an experiment at the existing MVP product. This is the MVP product, this is the front end that was never built.
— [01:03–01:28 | delivery: slow, deliberate (1.0–1.35 w/s, energy −0.3 to −0.6σ) — laying a foundation, not exploring]

That immediately resolves an open question: can you start a new conversation in this web thing? "I'd say, arguably, no, right?"

> What we're doing is not providing a home for conversation with AI. We're providing a home for perspective and the integration feed for calls and conversations and notes and all of these things that change organizational and thus AI perspective.
— [02:11–02:45 | delivery: measured, settling into fluency]

The upload affordance narrows accordingly: upload conversations — a transcript, or notes atop a conversation — not generalized notes. "We're always expecting primary source quotes from a specific person, either with interspersed commentary or just a raw transcript."

### Memory vs. whole transcript — the argument that reframed the theatre

The typed notes asked whether extracting a framed "memory" is still right versus extracting the entire transcript. Walking, she argues both sides:

> I'd argue that there is value in the framed primary source material because it is a huge noise reduction. It also saves us a lot of tokens, but it saves a lot of noise for the org.
— [04:13–04:30 | delivery: fluent, building energy]

Then the counter, landing on the product's own core claim:

> Although at the danger that there is this initial single judgment of an LLM that does this filter and summary process, where we're also arguing that the entire value of the product is that it doesn't do summary until read time, right? So then why are we doing all this filter, this arbitrary filter set on our infrastructure?
— [04:31–05:03 | delivery: energy peaking at +0.9σ on "the entire value of the product"]

Her resolution distinguishes venue: a memory written interactively with Claude, where the user approves the summary, is in essence first primary source material, and captures interstitial decisions that wouldn't survive as quotes. But the logic turned structural:

> That AI summary is really a position where we've now dropped at least potentially some of the statements that support it.
— [06:02–06:14 | delivery: fluent — the pivot sentence of the memo]

### The theatre becomes the graph viewer: resolution layers

Messages in the theatre have **resolution layers**: at first resolution, every single quote from the call, no summary, no filter. At second resolution, only positions — each expandable to the expressions that support it, footnotes beneath. Then a narrative layer where positions are the footnotes, and strata above.

> While looking at the expressions layer, drop all expressions that don't support a position. That's basically the filter that we want. And in that summary layer, that's the correct fidelity. That is what we would mean by "this isn't important."
— [07:47–08:16 | delivery: pitch rising to +0.9σ on the fidelity claim]

The UI becomes layer navigation — an icon that steps an expression up a layer, collapsing siblings under their position, repeating up to strata, so different parts of the graph sit expanded at different levels. And the prosodic peak of the entire memo:

> And then the actual theater becomes the graph viewer like that. I think that's a really elegant way to do that. I like that a lot.
— [11:35–11:44 | delivery: the memo's peak — fast (5.6 w/s), energized (+1.0σ), pitch +1.6σ; the only sustained arousal spike in 31 minutes that isn't a train announcement]

This answers the typed notes' "Drop explore graph?" — yes, structurally:

> I like this message-based graph browser. I think it's much more effective and much more in line with what the digest really is. Right. That if you click up to position, you see the digest for that position with its footnoted children that we already have in that context, rendered in that context.
— [14:01–14:14 | delivery: the standalone "Right." lands emphatic (energy +1.2σ)]

### What gets cut: flocking viewer and voice profiles → demo artifact

> That leaves, I think, one big simplification for MVP: the flocking graph viewer and voice profiles are not included. Not included in the product itself. But we can include them in a one-off produced and brand-styled artifact slash fully comped and live page that I can show as the demo.
— [12:09–12:52 | delivery: steady planning register]

The demo page shows the arc of narrative change, actor conviction, sentiment and conceptual narrative analysis over time — "and in there we can show the flocking cause it's fun" — the typed notes' architectural-renders metaphor executed: vivid renders, not CAD.

### MVP surface, integrations, and the cost pressure

The MVP UI surface is the feed — viewing calls, connecting integrations — plus the theatre, no overlay, with reactions, A/B-style clarifications, and response commentary. Demo shows email and text for real; Teams/Slack as a this-is-possible button. "Those integrations are required for MVP, but not for demo." [16:25]

The cost pressure, named as product-shaping:

> So there's a pressure we keep coming back to around cost. This product changes a lot if we can get extraction costs down enough. If we can get extraction costs down enough that you can actually converse with the thing and we can do every-message extraction, right? But for that to happen, you know, we need to be in the cents or tens of cents per message.
— [17:42–19:05 | delivery: subdued, slowing — the worry register of the memo; ~30s silence before "This product changes a lot"]

Levers: bring extraction cost down, control the number of extractions, and change whose keys it runs on:

> If we move our org's extraction into our subscription keys, that changes our cost profile hugely. Maybe that means we can eat user cost as a loss leader in a way that is significant and very different than what we have been doing.
— [19:48–20:09 | delivery: quiet, thinking-through; long pauses]

Two chat experiences share one backend: the theatre reply (loads the perspective, navigates from the ref of the extractor call, responds with message history; prompt caching must hold across replies; "probably doesn't need to be a frontier model, it should be fast. Maybe Luna?" — confirmed in-session as GPT-5.6 Luna, OpenAI's fast tier) and the post-extraction notification to all participants carrying the clarification questions.

### Access: the edge case is the common case

> If you are an admin, collaborator, obviously you can see the whole experience and the perspective. But if you are a new participant who is not a repo collaborator, which is a common situation — what do you receive? And what do you ever see? How much is it going to be?
— [24:25–25:07]

On the just-the-memory fallback her typed notes sketched, she pushed back on her own sketch — "I just don't think that a single memory is good" — and landed on collapsing the fork into one code path:

> Maybe that actually does become a single path, right? Where it now is: resolve the branch, and then return the memories that that user has access to, and then compile. And, however, does that work in the world of digest? You know, when we were doing the compile every time, you could rebuild a different view.
— [25:47–26:26 | delivery: fluent through the single-path formulation; the digest question is the residue]

For the demo: one access level; Wizard-of-Oz or talk-tracked versions for the rest. "What's required for MVP that our actual clients, i.e. Escher, could use." [26:52]

## The same-day rulings (working session, 2026-07-14 afternoon/evening)

The memo's questions went to a design working session the same day. Scarlet ruled:

**1. The extraction fork — extract the whole transcript; the memory becomes a generated view.** Her words: "If a memory becomes a generated view, which is already what it is anyway, I'm pretty sure about this: we want to extract the whole transcript, but then we want to display something that is often more intelligent than just the transcript as the starting point. We may start with the positions that show the transcript as the footnotes, the expressions pulled from the transcript as the footnotes, with a timeline scrubber like ticks visible in the gutter (so that you have that feeling of what things are spanning)." The transcript is the committed source; extraction reads all of it; the PR review surface is the generated view (positions + claimed expressions, composed at read time); the default display is the positions layer with a timeline scrubber in the gutter. The venue distinction stands: interactive user-approved memories remain committed sources.

**2. Access falls out of navigation semantics — attendance grants the page.** Reacting to the proposal that following a cross-memory link opens that node's home memory's theatre: "that's hot. yes, that. And this is actually the solution to the access problem we've been trying to figure out. The answer is: if you were in the call, you can see the page, and if you click on a node that is linking out beyond the call, you can see it if you have access to that call. All the digest narrations that your current call connects to: this is the real question — that should be okay, right, because they are not actually showing the source? They're showing the summary of what is abstracted from the source that this is also supporting — which, to me, means that's a big question that we need to consider through a bunch of different surfaces in the task about access. For now, we're going to say it's fine." Attendance is the membership primitive; cross-links resolve only with access to the target call; digest narrations of connected nodes are provisionally visible because the digest is the abstraction, not the source. The flagged counterpoint for the deeper pass: digest narrations embed verbatim witness excerpts, which weakens "not showing the source."

**3. Styleguide-first component discipline.** "The wireframes page should be built with the styleguide components, and if you need missing components or layouts, they should be added and reviewed in the styleguide first and then reused." The pipeline for design work is: artifact mock (fast iteration) → styleguide component (reviewed) → wireframes/product.

**4. Two amendments to the July 11 MVP-cut record.** Voice profiles and the flocking viewer move out of the product: "profiles + flocking + arc as wizard of oz static but interactive page in product skin for demo. v2 roadmapped in product" — superseding the July 11 "voice-profile fullscreen IN, v1-thin" ruling. And demo-era explicit shares are full depth, not stripped: "full depth for now, it's explicit share and this is a demo. only send it to people i want to see full depth" — stripped/anonymized/actor-scoped/tiered shares become v2 work.

**5. Teams jumps the integration queue.** "Teams does need to jump the queue, for sure. I'd like to get that done before Fable moves off subscription, so this week." Teams gates Escher, the actual paying client; the July 11 record had only named Zoom+Meet as the post-window integrations.

**6. The conversation surface's design language.** Expressions must carry actors; the viewer's messages sit right, everyone else left; dimensional annotations collapse behind a glyph so the theatre still feels like a conversation ("annotations that if removed would not move the chat bubbles"); and for how narratives claim interspersed statements, gutter rails — solid where a narrative claims a statement, dotted where it passes through an interruption, parallel rails for overlap, bubbles never colored — reusing the same color vocabulary as the timeline ticks. On seeing the everything-interspersed comp built from the session's own conversation, and the narrated digest under each position title with node-links: the direction ratified; comps are the next step.

**One empirical finding grounded the design:** analysis of the newest multipass extractions (offsets content-verified) showed positions are 100% contiguous blocks — but by construction, not by nature: the extractor gives each expression exactly one position in document order. The genuine interleaving lives at the narrative grain (~32% of narratives split and resume across a document). The whole-transcript ruling will likely loosen position contiguity, so the rails design supports spread and overlap anyway — exactly Scarlet's instinct: "we definitely want and need to support things spread out over the document."

## Connections to existing knowledge

- Second run of the Mar 19 MVP scope decision, amending the Jul 11 MVP-cut record — the strip-down move is becoming aswritten's recurring discipline.
- The resolution-layers theatre is the digest made visible: consistent with digest-as-recognition-aid and navigation-replaces-embedded-snapshot.
- The extraction ruling resolves the memory-vs-transcript tension by venue: user-approved summaries on their infrastructure are primary source; unilateral filtering on ours is replaced by read-time layers — "no summary until read time" applied to the pipeline itself.
- The cents-per-message target extends the Jul 12 extraction-cost policy from debugging guardrail to product-shaping constraint.
- The beta gating list operationalizes the Jun 9 ingestion-protocol finding (the user's own access is the access; Otter's API is enterprise-gated).
- Front as the notification proxy extends the Org-tier three-capabilities position into the MVP notification path.
- The attendance-based access ruling ratifies the attended-projection convergence from the clearance design work — attendance-scoped visibility is append-only-safe.

## Open questions carried forward

Feed filters for MVP; the digest-excerpt-leak question across access surfaces; whether the layer toggle is a zoom preset over an always-grouped everything-view; dimensional runs' measurable value (extraction vs reader); the loss-leader pricing analysis with real cost numbers; programmatic Front inbox creation; the personal capture channel (notes + voice memos to an agent — "I do that all the time").

## Transcription corrections applied

Local pipeline (whisper.cpp + parselmouth prosody); three repetition loops broken by re-chunking at 18:16 and 25:05 — the loop failure mode itself is now build input for the transcription-surface hardening work. Notable normalizations: "eat user cost of a wassiller" → "as a loss leader" (p=0.15); "not a reasonable collaborator" → "not a repo collaborator" (p=0.22); "AV style clarifications" → "A/B-style clarifications" (typed notes say "a/b questions"); "Maybe Luna?" resolved in-session to GPT-5.6 Luna. SEPTA platform announcements excluded; the prosody baseline is outdoor-walk audio, so delivery annotations are relative to an elevated noise floor.

<details>
<summary>Signal sidecar (quoted spans only; baseline f0 130.5 Hz / 59.5 dB part 1, 126.5 Hz / 59.2 dB parts 2–3)</summary>

```json
{"baseline_part1": {"f0_mean": 130.46, "f0_sd": 26.92, "db_mean": 59.50, "db_sd": 7.83},
 "baseline_parts2_3": {"f0_mean": 126.47, "f0_sd": 28.13, "db_mean": 59.24, "db_sd": 8.47},
 "quoted_spans": [
  {"t": "01:03", "text": "I think this is one product...", "wps": 1.35, "pitch_z": 0.1, "energy_z": -0.6, "conf": 0.795},
  {"t": "01:15", "text": "This is the MVP product, this is the front end that was never built.", "wps": 1.01, "pitch_z": 0.0, "energy_z": -0.3, "conf": 0.814},
  {"t": "02:11", "text": "not providing a home for conversation with AI", "wps": 1.57, "pitch_z": -0.2, "energy_z": -0.3, "conf": 0.848},
  {"t": "04:43", "text": "the entire value of the product is that it doesn't do summary until read time", "wps": 2.33, "pitch_z": 0.0, "energy_z": 0.9, "conf": 0.866},
  {"t": "06:02", "text": "that AI summary is really a position where we've now dropped... statements that support it", "wps": 1.71, "pitch_z": 0.1, "energy_z": 0.0, "conf": 0.937},
  {"t": "08:06", "text": "in that summary layer, that's the correct fidelity", "wps": 1.27, "pitch_z": 0.9, "energy_z": 0.0, "conf": 0.841},
  {"t": "11:39", "text": "I think that's a really elegant way to do that.", "wps": 5.64, "pitch_z": 1.6, "energy_z": 1.0, "conf": 0.993},
  {"t": "12:09", "text": "flocking graph viewer and voice profiles are not included", "wps": 1.46, "pitch_z": -0.1, "energy_z": 0.4, "conf": 0.941},
  {"t": "14:13", "text": "Right.", "wps": 1.12, "pitch_z": 0.9, "energy_z": 1.2, "conf": 0.938},
  {"t": "18:10", "text": "This product changes a lot if we can get extraction costs down enough.", "wps": 1.31, "pitch_z": -0.2, "energy_z": -0.6, "conf": 0.884, "pause_before_s": 28},
  {"t": "18:58", "text": "we need to be in the cents or tens of cents per message", "wps": 1.8, "pitch_z": -0.4, "energy_z": -0.2, "conf": 0.838},
  {"t": "20:00", "text": "eat user cost as a loss leader", "wps": 2.52, "pitch_z": -0.1, "energy_z": -0.3, "conf": 0.811},
  {"t": "24:35", "text": "a new participant who is not a repo collaborator, which is a common situation — what do you receive?", "wps": 3.67, "pitch_z": -0.2, "energy_z": 0.4, "conf": 0.74},
  {"t": "26:02", "text": "resolve the branch, and then return the memories that that user has access to, and then compile", "wps": 2.0, "pitch_z": -0.3, "energy_z": -0.3, "conf": 0.873}
]}
```
</details>