# Runway Changelog

## Release Process
- Increment `package.json` and `src/app/Runway.tsx` for every shipped Runway change.
- Update this changelog in the same commit as the version bump.
- Use patch versions for UI polish and small fixes, minor versions for new user-facing features, and major versions only for breaking changes or large data model shifts.

## 0.1.7 - Visual Personality Pass
- Added a richer light visual system with a sticky glass topbar, stronger Runway wordmark treatment, and darker cinematic dashboard masthead.
- Gave poster rails, the Runway tab stage, countdowns, providers, filters, and discovery cards more depth, contrast, and motion without changing app data behavior.
- Improved mobile visual hierarchy with compact topbar behavior and always-visible discovery actions.

## 0.1.6 - UI Styling Foundation Stabilization
- Fixed the global body typography baseline so Runway no longer falls back to browser serif defaults outside app wrappers.
- Replaced self-referential font tokens with stable font stack fallbacks and added missing shared CSS token aliases.
- Scoped generic button hover and active rules to known control primitives so unrelated buttons stop inheriting accidental interaction styling.

## 0.1.4 - TMDb Error Visibility
- Added detailed TMDb server error messages to the Streaming and Cinema views so missing, invalid, or mis-scoped API keys are visible in production.

## 0.1.3 - Vercel Install Compatibility
- Switched Vercel installs from `npm ci` to `npm install` to avoid optional native dependency lockfile mismatches across local macOS and Vercel Linux builds.

## 0.1.2 - Vercel Build Config
- Added an explicit Vercel config so the standalone Runway project installs with `npm ci` and builds with `npm run build`.

## 0.1.1 - Runtime Share Pages
- Forced shared recommendation pages to render at request time so Vercel builds do not connect to Neon during `next build`.

## 0.1.0 - Standalone Extraction
- Extracted Media Guide from `1Zero9Studio` into a standalone Runway app.
- Moved the app to root routes: `/`, `/login`, and `/share/[slug]`.
- Renamed the app, manifest, service worker, and PWA metadata to Runway.
- Kept existing Neon tables and `/api/media-guide/*` API paths for a lower-risk first migration.
