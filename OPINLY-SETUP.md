# Opinly blog integration — setup

What was added:

- `blog.html` — blog index (grid of posts, pagination)
- `blog-post.html` — single post template (renders via `?slug=`, or pretty
  URL `/blog/<slug>` through the redirect below)
- `js/opinly-client.js` — shared fetch client + rich-text renderer + CDN
  image URL helper
- `js/opinly-blog-index.js`, `js/opinly-blog-post.js` — page logic
- `netlify/functions/opinly-proxy.js` — proxies content requests to Opinly,
  keeps your API key server-side
- `netlify/functions/opinly-webhook.js` — verifies Opinly's Svix-signed
  webhook (no npm dependency — signature check is done by hand)
- `netlify/functions/blog-sitemap.js`, `blog-rss.js` — server-rendered
  sitemap/RSS for the blog (since this site has no build step, these can't
  be static files — they're generated fresh on each request)
- `_redirects` — pretty URLs (`/blog/:slug`) and routes for the functions
  above
- `netlify.toml` — tells Netlify where the functions live
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
deploy). No build command is needed — `netlify.toml` sets `publish = "."`
and `functions = "netlify/functions"`. Netlify installs no dependencies for
the functions since they're written with zero npm packages.

## 4. Test locally (optional)

The functions won't run under a plain static server. Use the Netlify CLI:

```
npm install -g netlify-cli
netlify dev
```

Then visit `http://localhost:8888/blog`.

## Known trade-off

This is a plain static site with no build step, so blog pages are rendered
client-side (JS fetches Opinly content after the page loads) rather than
server-rendered. SEO tags and JSON-LD are injected via JS — fine for Google,
which executes JS, but `blog-sitemap.xml` and `blog-rss.xml` exist
specifically to give crawlers that don't a fully server-rendered fallback.
