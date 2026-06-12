# RUNWAY-POP.md — Design Change Order: Dense, Colourful, Alive

**This is a DESIGN PIVOT, authorised by Steve.** The restrained-editorial direction (sparse layout, scarce red, serif headers, oversized cards) is retired — it shipped correctly and proved too flat. The new direction is **dense, information-rich, and colourful**, modelled on the best of consumer media web (Google's What-to-watch grids, Rotten Tomatoes' score-and-provider density), with a clean light base so the colour pops.

**What survives from previous briefs (still binding):**
- All engineering rules: data truth, the single aggregated query, degrade-to-absence, the toggle/undo standard (RUNWAY-CONTROLS.md Phase 2), verify-don't-claim with screenshots (RUNWAY-RESET.md).
- STYLE-RULES.md sections 1.2 (surface stack), 3.4–3.6 (button semantics), 4.4 (sizes from scale), 5.2–5.3 (no visible gradient edges, image-gated decoration), 6.4–6.5 (nav naming/loudness), 7 (spacing/gutter).

**What this file explicitly OVERRIDES:**
- STYLE-RULES 2.1/2.2 (red-only colour budget) → replaced by the functional colour system below.
- STYLE-RULES 4.1 (Fraunces) → Fraunces is removed from the app entirely.
- RUNWAY-BRIEF Shortlist card sizing (~280px) and "whitespace is the luxury signal" → replaced by density rules below.
- The card-wrapper pattern for posters → posters are naked tiles, never boxed in white cards.

---

## 1. The new visual language

### 1.1 Base
Background `#FFFFFF` (pure white, like the references — the previous grey `--bg` becomes `--well: #F2F4F7` for inputs/inactive chips only). Ink `#101319`, soft `#525A66`, faint `#98A0AB`. Hairlines `#E6E9EE`. The page is white so the posters and colour chips carry everything.

### 1.2 Functional colour system (replaces red-only)
Every colour means one thing, applied as chips/badges/fills — never as decoration:

| Token | Value | Meaning |
|---|---|---|
| `--brand` | `#E0342B` | Runway red: wordmark accent, primary buttons, active nav underline, progress fills |
| `--new` | `#0B8A47` | New episode/season available, "On now" |
| `--soon` | `#E8830C` | Countdowns ≤14 days |
| `--leaving` | `#C2362B` | Leaving-soon deadlines (red family, filled chip) |
| `--list` | `#1D5FD6` | Watchlist state, informational chips |
| `--score-hi/mid/lo` | `#0B8A47` / `#E8830C` / `#98A0AB` | Rating chip ≥75 / 50–74 / <50 |

Chips: 12px bold, white text on the colour (filled) for urgent states; tinted background + coloured text for passive states. Provider logos render in **full brand colour** (small round badges, assets bundled locally — Netflix red, Disney+ blue, Apple TV black, NOW green, RTÉ Player). A screen with many coloured chips is correct now — what's banned is coloured *decoration* (random tinted panels, gradient flourishes).

### 1.3 Type
Fraunces is out. New pairing, via next/font:
- **Display: Space Grotesk** — wordmark, masthead, section headers. Weight 700, tight tracking (-0.02em), set BIG: section headers 24–28px, masthead 40–48px. This is where the personality now lives; headers should feel like a confident magazine, not a default template.
- **UI/body: Inter** — unchanged. Metadata style unchanged (12px caps, tabular, +0.05em) but now often inside coloured chips.

### 1.4 The tile (replaces the poster card)
Posters are naked: rounded 8px, subtle 1px inset hairline, hover = scale 1.03 + shadow, NO white card wrapper. Beneath each tile, on the page itself:
- Title — Inter semibold 14px, single line, ellipsis
- Meta line — provider badge (16px, colour) · score chip · context (e.g. "Next S02E05", "Jun 20", "Ep Jun 10")
- Optional status chip overlaid on the poster's top-left corner (NEW, 6 DAYS, LEAVING) — one max.

**Sizing — the density correction:** grid/rail posters are 150–170px wide desktop (6–8 visible per row at 1200px container), 104–120px on mobile (3 per row). Nothing on the dashboard exceeds 200px wide except nothing — the hero IS density, not size.

### 1.5 Scores
TMDB vote average shown as a percentage chip ("87%") coloured by the score bands above, on every tile where a rating exists. This single addition supplies more colour and information energy than any decoration could. (It's TMDB's score — do not imitate Rotten Tomatoes' tomato/popcorn iconography; a simple ● dot + number in the band colour.)

---

## 2. The dashboard, re-laid-out for abundance

Order on `/`:

1. **Slim masthead** — one line: "Friday 12 June" (Space Grotesk 40px) with the summary sentence beside/below in soft ink, time-fit chips right-aligned on the same band. Half the vertical space it takes today. Flat white background (hero atmospherics remain retired unless re-earned via RUNWAY-RESET Phase 6).
2. **Shortlist** — becomes a dense row of up to 6 tiles (170px) with reason lines replacing the standard meta line, in the reason's status colour where applicable ("3 episodes left" in `--new` green, "Leaving in 6 days" in `--leaving`). No giant cards.
3. **Continue watching** — tile rail, progress hairline in `--brand` under each poster, one-tap mark-watched on hover/tap.
4. **New for you** — discovery rail: TMDB discover, filtered to Steve's providers (`region=IE`), released/aired in the last 30 days, excluding library titles. 10–12 tiles. THIS is what fixes the empty-library sparseness: the dashboard is full and colourful from day one, even with two tracked shows.
5. **Coming up** — countdown rail (tracked premieres + IE cinema + leaving deadlines), `--soon`/`--leaving` chips.
6. **Trending this week** — TMDB trending, same filters, 10–12 tiles. Capped here: two discovery rails maximum, ever (this is still a personal tool, not a Netflix clone).
7. **On TV tonight** — matched EPG entries only, per existing rules.

Rails: horizontal scroll with snap, 16px gaps, section header + "See all" link on the shared gutter. Personal rails (2,3,5,7) render from the aggregated query; discovery rails (4,6) from cached TMDB calls (revalidate daily) and degrade to absence on failure.

---

## 3. Migration phases

**Phase A — Re-skin:** swap fonts (Fraunces→Space Grotesk), backgrounds (grey→white), implement the chip/colour token system, restyle existing components in place. No layout changes yet. *Evidence: before/after screenshots.*

**Phase B — The tile:** build the naked-poster tile component (sizes, meta line, status chip, hover) and replace every poster card with it — Shortlist, Continue watching, Library, search results. *Evidence: dashboard screenshot showing 6+ tiles per row width.*

**Phase C — Scores & providers:** TMDB score chips on all tiles; colour provider badge assets bundled and rendered on tiles and detail pages. *Evidence: tile close-up screenshots.*

**Phase D — Discovery rails:** "New for you" and "Trending this week" with provider/region filtering, library exclusion, daily revalidation, absence on failure. *Evidence: full-dashboard screenshot — the page must look FULL with only 2 tracked shows.*

**Phase E — Density audit:** masthead slimmed, vertical rhythm tightened (section gap one value, ~40px), every view checked at 1280/375 for the new bar below. *Evidence: full-page screenshots both widths + Steve's verdict.*

## 4. The new bar (replaces the old prod-bar phrasing)

A screen passes when a stranger would say it looks like a **real consumer media product** — full, colourful, scannable — AND every colour on it means something. The two failure modes to check every time:
- *Too empty:* any viewport-height with fewer than ~8 titles visible on the dashboard (when data exists) fails.
- *Too noisy:* any colour that doesn't map to the table in 1.2 fails; more than one status chip per tile fails; tinted decorative panels fail.

Dense and meaningful. That's the whole direction.
