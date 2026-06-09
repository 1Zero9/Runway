# Runway Changelog

## Release Process
- Increment `package.json` and `src/app/Runway.tsx` for every shipped Runway change.
- Update this changelog in the same commit as the version bump.
- Use patch versions for UI polish and small fixes, minor versions for new user-facing features, and major versions only for breaking changes or large data model shifts.

## 0.1.1 - Runtime Share Pages
- Forced shared recommendation pages to render at request time so Vercel builds do not connect to Neon during `next build`.

## 0.1.0 - Standalone Extraction
- Extracted Media Guide from `1Zero9Studio` into a standalone Runway app.
- Moved the app to root routes: `/`, `/login`, and `/share/[slug]`.
- Renamed the app, manifest, service worker, and PWA metadata to Runway.
- Kept existing Neon tables and `/api/media-guide/*` API paths for a lower-risk first migration.
