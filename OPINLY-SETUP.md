# Opinly blog integration — setup

What was added:

- `blog.html` — blog index (grid of posts, pagination; latest posts are also
  pre-rendered into the static HTML by the build script below)
- `blog-post.html` — single post **template**. At build time,
  `scripts/build-blog.js` fills this template in for every published post
  and writes a real, complete HTML file to `blog/<slug>.html` — full title,
  meta tags, JSON-LD and article body baked in, no JavaScript required to
  read it. The client-rendered `?slug=` version stays as a fallback for any
  post published after the last deploy.
- `scripts/build-blog.js` — the pre-renderer described above. Runs via
  `netlify.toml`'s build command. Never fails the build: if
  `OPINLY_API_KEY` isn't set yet, or Opinly is unreachable, it logs why and
  skips pre-rendering, leaving the site to deploy normally.
- `js/opinly-client.js` — shared fetch client + rich-text renderer + CDN
  image URL helper (used client-side as the fallback path)
- `js/opinly-blog-index.js`, `js/opinly-blog-post.js` — client-side page
  logic (fallback for posts not yet pre-rendered)
- `netlify/functions/opinly-proxy.js` — proxies content requests to Opinly,
  keeps your API key server-side
- `netlify/functions/opinly-webhook.js` — verifies Opinly's Svix-signed
  webhook (no npm dependency — signature check is done by hand)
- `netlify/functions/blog-sitemap.js`, `blog-rss.js` — server-rendered
  sitemap/RSS for the blog, generated fresh on each request. Both return a
  valid (if empty) response with a `200` even if `OPINLY_API_KEY` isn't set,
  rather than erroring — a sitemap/RSS URL should never 500 for a crawler.
- `_redirects` — pretty URLs (`/blog/:slug` fallback, plus 301s from every
  `.html` page to its canonical extensionless URL) and routes for the
  functions above
- `netlify.toml` — build command, and tells Netlify where the functions live
- `sitemap.xml` — rewritten to canonical extensionless URLs with `lastmod`
  dates; broken `/locations/*` entries with no matching page were removed
- `robots.txt` — now also points at `/blog-sitemap.xml`
- "Blog" added to nav + footer across all existing pages

## 1. Set environment variables in Netlify

**Do not put the API key or webhook secret in any file in this repo.**
In the Netlify dashboard: Site settings → Environment variables, add:

| Key | Value |
|---|---|
| `OPINLY_API_KEY` | your Opinly API key (`sk-...`) |
| `SVIX_WEBHOOK_SECRET` | the `whsec_...` secret shown next to your webhook endpoint in the Opinly dashboard |
| `BUILD_HOOK_URL` *(optional)* | a Netlify build hook URL, only if you later want new posts to trigger a rebuild |

⚠️ **About the key pasted earlier in this chat:** since it was shared in
plain text, treat it as potentially exposed. Generate a fresh key in the
Opinly dashboard and use that one here instead of the one from the chat log.

## 2. Register the webhook in Opinly

Point Opinly's webhook at:

```
https://<your-site>.netlify.app/opinly-webhook
```

(or your custom domain, once DNS is live). Opinly will show you the
`whsec_...` secret to put in `SVIX_WEBHOOK_SECRET`.

## 3. Deploy

Push this repo to GitHub and connect it to Netlify as usual (or drag-and-drop
deploy). `netlify.toml` sets `publish = "."`, `functions = "netlify/functions"`,
and a build `command` that runs `scripts/build-blog.js` to pre-render blog
posts. No npm install step is needed — the functions and the build script
are both written with zero npm packages, using Node's built-in `fetch`.

## 4. Test locally (optional)

The functions won't run under a plain static server. Use the Netlify CLI:

```
npm install -g netlify-cli
netlify dev
```

Then visit `http://localhost:8888/blog`.

## Known trade-off

Blog posts are now pre-rendered to real static HTML at build time (see
above), so this no longer relies on JavaScript for search engines to read
article content. The one gap: a post published in Opinly *between* deploys
won't have a static file yet, so it falls back to the client-rendered
`?slug=` version until the next deploy or webhook-triggered rebuild (set
`BUILD_HOOK_URL` if you want that to happen automatically).
