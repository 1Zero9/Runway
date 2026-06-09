# Runway

Private Ireland watch planner for TV, streaming, cinema releases, tracked shows, and shared recommendations.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the same Neon, auth, TMDb, and EPG values used by the existing Media Guide deployment.
3. Install dependencies and run the app:

```bash
npm install
npm run dev
```

The app runs at `/`, login is `/login`, shared recommendation lists are `/share/[slug]`, and internal API routes remain under `/api/media-guide/*` for the first extraction.

## Deploy

Vercel project: `runway`

Recommended domain:

```text
media.1zero9.com
```

Cloudflare DNS:

```text
Type: CNAME
Name: media
Target: cname.vercel-dns.com
Proxy: DNS only
```

Required Vercel environment variables:

```text
DATABASE_URL
MEDIA_GUIDE_PASSWORD
MEDIA_GUIDE_SESSION_SECRET
TMDB_API_KEY
EPG_SOURCE_URL
```
