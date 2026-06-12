# RUNWAY-RESET.md — Stabilise, Simplify, Verify

**Read this before anything else: this brief ADDS NOTHING. It removes, fixes, and verifies.** RUNWAY-BRIEF.md and RUNWAY-CONTROLS.md remain the long-term spec, but they are SUSPENDED until this brief completes. The app currently renders contradictory states, missing artwork, broken hero imagery, and stale progress — the gap is not features, it is that nothing has been verified end-to-end.

**The prod bar (apply to every screen, every phase):** would Steve show this screen to a stranger without explaining anything? If no, it does not ship.

## Non-negotiable working rules for this brief

1. **Verify, don't claim.** A phase is complete only when the acceptance evidence exists: a dated entry in UI-NOTES.md containing screenshots (Playwright or manual) at 1280px and 375px, plus the listed checks. "Done" without evidence is not done.
2. **Degrade to absence, never to broken.** If a module's data is missing or its imagery fails, the module renders NOTHING. No fallback initials in hero positions, no grey smudge where a backdrop should be, no empty-state card sitting above populated content. Absence is clean; brokenness is the yikes.
3. **One source of truth on screen.** Every dashboard module renders from the single aggregated dashboard query. Two modules may never disagree about whether shows exist.
4. **No new features, no new dependencies, no new modules** until Phase 5 explicitly re-admits them one at a time.

---

## Phase 0 — Diagnose the four visible failures (read-only, no fixes yet)

Produce `docs/RESET-FINDINGS.md` answering, with code references and logged evidence:

1. **Why is no artwork rendering?** Trace one show (Severance) end to end: Is poster_path stored in the DB? Is the TMDB image URL constructed correctly? Is `image.tmdb.org` in next.config remotePatterns? Does the request 200 in the network tab? Is the TMDB API key present in the deployed Vercel env (not just local)? Identify the exact broken link in the chain.
2. **Why does the Shortlist show the first-run empty state while Continue Watching shows three shows?** Find the two data paths; document why they disagree. Expected root cause: Shortlist eligibility depends on fields that are null/never written, or it queries a different source than the rail.
3. **Why is everything S01E01?** Pull the watch_events table contents. Either writes are failing silently (check the actions layer for swallowed errors), or the derivation reads the wrong column/join. Document which, with the failing query.
4. **Why does the hero render as a grey band?** Confirm the backdrop image request fails (likely same root cause as #1) and that the wash renders regardless of image success — that's the degrade-to-broken bug.
5. List every module currently on the dashboard, in order, with its data dependency and current state (working / broken / empty).

**Acceptance:** RESET-FINDINGS.md exists; each of the four failures has a named root cause with file/line references; no code changed yet.

## Phase 1 — Artwork, end to end, proven

The single biggest styling lever. Fix the chain found in Phase 0:

1. Repair the broken link (env var, remotePatterns, path storage, URL construction — whatever Phase 0 found). Backfill poster_path/backdrop_path for every title already in the DB via a one-off script against TMDB; log any title that genuinely has no art.
2. Standard sizes per RUNWAY-BRIEF.md (`w342` cards, `w185` thumbs, `w780` backdrops). Fixed aspect-ratio boxes. Blur-up placeholder.
3. The initial-letter fallback is demoted to a last resort: it may appear only for titles TMDB has no art for, and never in the Shortlist or hero. If a Shortlist candidate lacks art, the engine skips it.
4. Add a startup-time health check (dev console + /settings footer): TMDB key valid, image fetch test passes. Silent config failure is what caused this; make it loud.

**Acceptance (evidence in UI-NOTES.md):** screenshot of Continue Watching showing real posters for all three current shows; network tab screenshot showing 200s from image.tmdb.org; deliberately break the API key locally and confirm the health check reports it.

## Phase 2 — Data truth

1. Build (or repair) the **one** aggregated dashboard query returning, per tracked title: relationship, next unwatched episode, watched/total, last_watched_at, poster/backdrop paths, provider. Every dashboard module renders from this result. Delete parallel data paths.
2. Fix the watch_events write/read fault from Phase 0 #3. Add the missing tests: marking S01E01 watched makes next = S01E02 (write → re-derive → read, against a real dev DB, not mocked).
3. Consistency invariants, asserted in code (dev) and tested: if Continue Watching has items, the Shortlist cannot render the first-run state; the reconciliation card may never list an episode that has a watch_event; next episode is never E00 and never earlier than the latest watched.
4. The first-run "Track your first show" card renders only when the library is truly empty — and then it is the ONLY module on the page.
5. Masthead line generator: titles must be quoted or the sentence restructured ("'One More Chance' is out today" or "New today: One More Chance"). If the generator can't produce a clean sentence, it outputs only the show count. Add 5 fixture tests with awkward titles (e.g. "One More Chance", "You", "It").

**Acceptance:** screenshot of the dashboard where Shortlist and Continue Watching agree; mark two episodes watched in the UI, refresh, screenshot showing advanced next-episodes; invariant tests green.

## Phase 3 — Strip the dashboard to three modules

Until quality is proven, the dashboard is ONLY:

1. **Masthead** — date + the (now safe) summary line + time-fit chips. On a flat `--bg` background: the ambient hero is REMOVED in this phase (it returns properly in Phase 6 or not at all). No grey band, no scrim, nothing.
2. **Shortlist** — up to 5 cards, only candidates with artwork and valid reasons. If fewer than 2 qualify, the section renders the cards it has with no padding-out; if zero qualify, the section is absent entirely (rule 2).
3. **Continue watching** — the rail, now with posters and true next-episodes.

Everything else — reconciliation card, Coming up, On TV tonight, Worth a look — is removed from the page behind a single `DASHBOARD_MODULES` flag map, all off. The code stays; the rendering stops. The reconciliation card especially: it returns in Phase 5 as a small dismissible strip, never a third of the viewport.

**Acceptance:** screenshots at 1280/375 of the three-module dashboard with real artwork and real progress — this is the screenshot pair that must pass the prod bar. Both go in UI-NOTES.md with a yes/no prod-bar verdict from Steve before Phase 4 begins.

## Phase 4 — Make the three modules genuinely stylish

Now, and only now, polish — on working foundations:

1. **Shortlist cards earn the "signature" label:** 2:3 poster filling the card top (no white border gap), title + provider + reason line in a compact footer, progress hairline, the single primary action on hover/tap. Cards ~260–300px wide desktop, scroll-snap mobile.
2. **Continue Watching cards get density:** poster thumb left, title + next-ep code + "32 min" right, progress hairline, one-tap watched per the toggle standard. No acres of white card around a lone chip.
3. **Type discipline pass:** Fraunces only for the masthead and the two section headers; metadata in the tabular-figure style; check against RUNWAY-BRIEF.md scale — the current build has stray sizes.
4. **Spacing pass:** the three modules on a consistent vertical rhythm; section header rules per the brief; nothing floats in unexplained whitespace.
5. Micro-motion: card hover lift + up-next crossfade only. Nothing else yet.

**Acceptance:** before/after screenshot pairs for both card types; prod-bar verdict recorded. The dashboard should now look designed — with just three modules.

## Phase 5 — Re-admit modules one at a time (quality gate each)

Strict order, one per session, each gated on the previous passing:

1. **Coming up** — only if ≥1 real countdown exists; absent otherwise.
2. **Reconciliation strip** — redesigned: single-line dismissible strip under Continue Watching ("Catch up: did you watch Severance S01E02? ✓ ✕"), max one title shown, only after a genuine 7+ day lapse, never on the same visit where the episode was just logged.
3. **On TV tonight** — only with confirmed EPG matches; absent otherwise.
4. **Worth a look** — only with artwork-complete recommendations; capped at 6.

Each re-admission requires: renders from the aggregated query (or its own single query), obeys degrade-to-absence, screenshot evidence, prod-bar verdict in UI-NOTES.md. If any module can't meet the bar, it stays off — the three-module dashboard is a complete product.

**Acceptance:** per module as above. No module ships in the same commit as another.

## Phase 6 — The hero, properly or not at all

The ambient hero returns only under these conditions:

1. It renders ONLY when the #1 Shortlist pick's backdrop has successfully loaded (image onload-gated; until then, flat `--bg` — never the wash alone).
2. Blur 40–60px, scale 1.1, washed to ~12–18% perceived strength, dissolving fully to `--bg` before the Shortlist cards begin — no hard edges anywhere (generous gradient overlap, test at multiple viewport heights).
3. Text over it passes AA at every breakpoint; automated contrast check in the phase evidence.
4. 400ms crossfade between picks; static under reduced motion.
5. If after honest assessment it still doesn't look premium, delete it permanently and record the decision — a flat editorial light dashboard with strong posters is a perfectly good end state. The Shortlist artwork is the wow; the hero is seasoning.

**Acceptance:** screenshots on two different top picks with no visible band edges; a screenshot with image loading blocked showing a clean flat masthead; Steve's keep/kill verdict recorded.

---

## Appendix — The regression checklist (run at the end of every phase)

- [ ] Dashboard shows no contradictory states (empty-state + populated rail = fail)
- [ ] No fallback initials visible for any mainstream title
- [ ] No E00 / no next-episode earlier than watched progress
- [ ] No partial visual elements (gradient bands, scrims without images, skeletons that never resolve)
- [ ] Mark an episode watched → refresh → state persisted and advanced
- [ ] 375px and 1280px both screenshotted and attached
- [ ] Prod bar: show it to a stranger, no explanation needed?
