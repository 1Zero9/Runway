# STYLE-RULES.md — The Runway Visual Constitution

**Status: permanent addendum. Applies to every UI change in every brief (RUNWAY-BRIEF.md, RUNWAY-CONTROLS.md, RUNWAY-RESET.md and anything after).** Before committing any change that touches rendering or CSS, re-read this file and run the checklist at the bottom. If a change violates a rule, the change is wrong — not the rule. Rule changes require Steve's sign-off recorded in UI-NOTES.md.

These rules exist because specific failures shipped: nested box-in-box chrome, red spent on navigation, identical grey pills for every action, serif leaking into avatars, grey-on-grey washes with hard edges, and giant cards wrapping tiny content. Each rule below blocks a failure that actually happened.

---

## 1. Surfaces & boxes

1.1 **Content first, containers on sufferance.** A container (card, panel, bordered group) exists only when separation is impossible with spacing and a hairline rule. Default to no box. Lists of rows (reconciliation, settings, guide entries) are heading + hairline-divided rows on the page background — not cards.

1.2 **Maximum surface stack: three.** `--bg` page → white `--surface` card → `--surface-sunken` well *inside* a white card. Never sunken-on-bg, never card-in-card-in-card, never a bordered group inside a card inside a bar.

1.3 **Cards are sized by their content.** Poster + text + action, edge to edge with standard padding. If a card is more than ~30% empty white space, the card is wrong — shrink it or unbox it.

1.4 **Empty states are small and centred.** Max-width ~480px, centred icon, centred text, secondary (not red) action. Never a full-width slab with stranded elements.

1.5 **One border OR one fill per element, not both.** A chip is either sunken-filled with no border, or white with a 1px border. Double-stating separation is noise.

## 2. Colour

2.1 **Red is content, never chrome.** Red may appear only as: (a) the single primary action of a region, (b) progress fills/hairlines, (c) urgent countdown or leaving-soon chips, (d) the active-state accent on a toggle that is ON. Red never appears in: the wordmark, navigation, headers, empty states, search, settings, or any icon button.

2.2 **Red budget: if a screen shows more than ~4 red elements, demote until it doesn't.** Adding a red element means finding one to remove.

2.3 **Greys are the three surfaces plus the three inks. No other greys.** Any new grey value is a bug.

2.4 **Posters supply all decorative colour.** No tinted panels, coloured section backgrounds, or gradient accents invented in CSS.

## 3. Buttons & controls — the three tiers

3.1 **Primary** — filled `--accent`, white text. At most ONE per region of the screen. Reserved for the action the user came to do: "Mark watched", "Start", "Track". Never navigation, never search, never empty-state CTAs.

3.2 **Secondary** — white fill, 1px `--line` border, ink text. Real actions that aren't the main one ("Watchlist", "Watched up to here", confirm chips).

3.3 **Tertiary/chips** — `--surface-sunken` fill, NO border, `--ink-soft` text. Filters, time-fit chips, dismissals. Active chip state: `--accent-soft` fill, `--accent` text (rule 2.1d).

3.4 **Buttons are verbs in future tense; states are past tense.** "Mark watched" (button) flips to "✓ Watched" (state) after. A checkmark + past tense must never appear on something not yet done.

3.5 **Every stateful control visibly reflects its state and reverses on second activation** (per RUNWAY-CONTROLS.md Phase 2). `aria-pressed` on all toggles.

3.6 **Icon buttons are ghosts.** No resting box or border; `--surface-sunken` circle on hover/focus only.

## 4. Typography

4.1 **Fraunces appears in exactly three roles:** the masthead line, section headers, and show/film titles on detail pages. Nowhere else — not sublines, not avatars, not buttons, not metadata, not initials. (Exception: the wordmark, rule 6.1.)

4.2 **One metadata style, everywhere:** Inter, 12px, uppercase, +0.05em tracking, tabular figures, `--ink-soft`, format `S01E01` (no internal space). Times, runtimes, countdowns, episode codes all use it. Minimum contrast: never lighter than `--ink-soft` on white.

4.3 **Titles in lists and cards are title case.** Official all-caps stylisation (MINDHUNTER) is honoured only on that title's detail page.

4.4 **Type sizes come from the scale** (12/13/14/16/18/22/28/36). A size not on the scale is a bug.

## 5. Backgrounds & gradients

5.1 **No neutral grey washes, ever.** Atmospheric backgrounds must derive their tint from artwork. A grey gradient on a light page reads as a disabled overlay.

5.2 **A gradient may not have a perceivable edge.** If its end is visible as a line at any viewport size, remove the gradient.

5.3 **Image-dependent decoration is gated on the image** (RUNWAY-RESET.md rule): wash/scrim renders only after the backdrop has loaded. Until then, flat `--bg`. Flat and clean beats atmospheric and broken.

5.4 **Default state of every page is flat `--bg`.** Atmosphere is earned per-element through the reset brief's Phase 6 gate, never assumed.

## 6. Header & navigation

6.1 **Wordmark:** Fraunces, `--ink`, never red, never the UI sans. The brand is the typeface.

6.2 **The header is flat on `--bg`.** No outer pill bar, no bordered nav group, no boxed segments. One hairline rule beneath it at most.

6.3 **Nav items are plain ink text.** Active state: heavier weight plus a short `--accent` underline (the one sanctioned red-adjacent chrome, 2px, text-width). Never a filled block.

6.4 **No word appears twice in the header meaning two things.** The wordmark and a tab may not share a name.

6.5 **Navigation may never be the visually loudest element on a screen.** Chrome whispers; content shouts.

## 7. Spacing & alignment

7.1 **One left gutter.** Masthead, section headers, rails, and cards all start on the same vertical line. Chips and sublines do not get their own indent.

7.2 **Vertical rhythm from the 4px scale;** section gaps are consistent (one value desktop, one mobile). No module floats in unexplained whitespace and no two dense modules touch.

7.3 **Low-priority prompts are strips, not slabs.** Housekeeping (reconciliation, tips, notices) gets a single-line dismissible strip; it never exceeds ~10% of viewport height.

---

## Pre-commit checklist (run on every UI change)

- [ ] Did I add a container? Could spacing + a hairline do it? (1.1)
- [ ] Surface stack ≤ 3, no sunken-on-bg? (1.2)
- [ ] Any card >30% empty? (1.3)
- [ ] Count the reds on the affected screen: ≤4, all content-roles, none in chrome? (2.1–2.2)
- [ ] Every new button assigned a tier; exactly ≤1 primary per region? (3.1–3.3)
- [ ] Buttons read as future-tense verbs; states as past? (3.4)
- [ ] Fraunces only in its three roles? Metadata in the one style? (4.1–4.2)
- [ ] Any gradient: artwork-tinted, edge-free, image-gated? (5.1–5.3)
- [ ] Header still flat, nav still quiet? (6.2–6.5)
- [ ] Everything on the single left gutter? (7.1)
- [ ] Screenshot at 1280 and 375 attached to UI-NOTES.md entry?
