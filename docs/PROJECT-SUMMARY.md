# Runway Project Summary

## Overview

Runway is a private, personal media-planning app for Ireland. It helps answer the practical question: "What should I watch next?" across live TV, streaming services, cinema releases, tracked shows, and shared recommendations.

The app was extracted from the wider `1Zero9Studio` project into its own standalone repository and Vercel project. It is designed for one primary user now, with lightweight sharing for a small circle of people later.

Current version: `v0.1.11`.

## Core Goal

The product should feel like a personal media console for sitting down in the evening and quickly seeing:

- What is on TV now or later today.
- What is new across streaming platforms.
- What films are coming out.
- What shows are being watched and what episode is next.
- What has already been seen, favourited, recommended, or marked as not for me.
- What recommendations can be shared with other people.

The app is not intended to be a public streaming product. It is a private planner, tracker, and recommendation workspace.

## Current Product Areas

### Dashboard

The Dashboard is the first screen and should show the most useful personal context:

- Shortlist of what to watch next.
- Continue watching rail.
- Upcoming dates and new releases.
- Personal recommendations and tracked-show prompts.

Recent UI work moved this toward a more colourful media-console style using blue, slate, blush, and coral surfaces.

### Runway Discovery

The Runway tab is the discovery area for streaming and cinema content. It supports:

- Provider filtering.
- Movie / TV filtering.
- Category filtering.
- Poster-size scaling.
- Persistent action states for Track, Seen, Fav, Recommend, and Not for me.

Selected actions now stay visually active instead of only showing a temporary outline.

### Library

The Library is the user's personal watch state. It separates:

- Watching.
- Watchlist.
- History.
- Favourites.
- Recommended.
- Abandoned / dropped items.

Track actions now land in Watching. Watchlist actions land in Watchlist. When an item is added, the app opens the relevant Library filter so the saved item is visible immediately.

### TV Guide

The TV guide uses an Ireland-focused EPG source and supports:

- Date filtering.
- From-now / full-day viewing.
- Favourite Sky channel filtering.
- Sport filtering.
- Tracking shows or watchlisting films from programme rows.

The long-term goal is to keep the channel list manageable rather than expose hundreds of channels by default.

### Recommendations and Sharing

The app supports a recommendation inbox and custom lists. These are intended for:

- Personal recommendation tracking.
- Sharing curated watchlists with a small group.
- Moving recommended items into named lists.
- Future per-person notes, ratings, and feedback.

The expected scale is small: roughly up to 10 people.

## Data and Integrations

Runway currently depends on:

- Neon Postgres for persistent app data.
- TMDb for streaming/cinema discovery metadata.
- An Ireland EPG/XMLTV source for TV listings.
- Local password/session authentication for private access.

Required environment variables include:

```text
DATABASE_URL
MEDIA_GUIDE_PASSWORD
MEDIA_GUIDE_SESSION_SECRET
TMDB_API_KEY
EPG_SOURCE_URL
```

Internal API routes still use `/api/media-guide/*` for compatibility with the original Media Guide implementation.

## Deployment Context

The app lives in the standalone GitHub repository:

```text
1Zero9/Runway
```

It deploys through the Vercel project:

```text
runway
```

Current domain target:

```text
runway.1zero9.com
```

Cloudflare DNS should point the `runway` subdomain at the Vercel DNS target with DNS-only proxying unless Vercel recommends otherwise.

## UI Direction

The current design direction is a colourful personal media console:

- Compact poster rails.
- Clear selected states.
- Stronger colour surfaces, not just coloured button outlines.
- Blue / slate / blush / coral palette.
- Small cards and thumbnails rather than oversized marketing sections.
- Utility-first screen hierarchy: what to watch, what is next, what is saved.

Recent fixes addressed the issue where the page appeared almost entirely white because the main Dashboard surfaces were transparent. The Dashboard now uses visible colour surfaces and tinted content panels.

## Known Issues and Design Concerns

Current areas that still need attention:

- The user is specifically frustrated that the UI still feels too white, too plain, and not visually expressive enough despite several colour passes.
- Colour changes appear hard to control because older CSS decisions and later override layers are still influencing the final rendered result.
- There are likely stale design assumptions in `runway.css`, including transparent panels, white surfaces, reset layers, and repeated component rules that override newer colour choices.
- The current styling approach feels fragile: adding colour in one place can be cancelled elsewhere by older cascade rules.
- A future UI pass should audit and consolidate the CSS rather than keep adding final override layers.
- Placeholder poster cards look unfinished when artwork is missing.
- Some Dashboard panels can still feel sparse when there are only a few saved items.
- The visual system has accumulated several CSS override layers and should eventually be consolidated.
- The first-screen hierarchy should continue shifting toward immediate "what next?" decisions.
- Recommendation and list flows need to stay simple; the app should not become admin-heavy.
- Mobile PWA polish remains important because this is expected to be used from a phone.

## Suggested Next Priorities

1. Improve poster fallbacks so missing artwork becomes branded title cards instead of blank grey blocks.
2. Tighten Dashboard density so empty space is reduced when only a few shows are tracked.
3. Consolidate the CSS layers into a cleaner design-token and component structure.
4. Add a clearer "What now?" home module for evening use.
5. Improve recommendation-list management with simple move, rename, share, and per-person feedback flows.
6. Add optional reminders or calendar views for next episodes and releases.

## Current Engineering Notes

- Next.js app with routes rooted at `/`, `/login`, `/history`, and `/share/[slug]`.
- API routes are server-side and keep sensitive keys off the client.
- The app is private by default through password/session middleware.
- Tests currently cover core utility logic and should be run with:

```bash
npm test
```

- Production build should be checked with:

```bash
npm run build
```
