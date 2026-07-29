// Dynamic sitemap covering Opinly blog content (posts, categories, authors).
// Kept separate from the site's existing static /sitemap.xml (which lists
// the hand-built pages) — both are declared in robots.txt as a small
// sitemap index, which is a well-supported convention.
//
// Served at /blog-sitemap.xml via the redirect in _redirects.

const SITE_URL = "https://machinecanvas-wallandfloorprinting.com";
const UPSTREAM = "https://sdk.opinly.ai";

exports.handler = async () => {
  const apiKey = process.env.OPINLY_API_KEY;
  let routes = [];

  // Degrade gracefully rather than 500: search engines that fetch this URL
  // should always get a valid (if possibly empty) sitemap, never an error
  // response — a 500 here can get the URL flagged as broken in Search
  // Console / Bing Webmaster Tools. If the key isn't configured yet, or the
  // upstream call fails, we still return 200 with whatever routes we have
  // (i.e. none), and log the real reason server-side.
  if (!apiKey) {
    console.error("blog-sitemap: OPINLY_API_KEY is not set — returning sitemap with no blog routes");
  } else {
    try {
      const res = await fetch(`${UPSTREAM}/v1/content/routes`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });
      if (res.ok) {
        routes = await res.json();
      } else {
        console.error("blog-sitemap: upstream returned", res.status);
      }
    } catch (err) {
      console.error("blog-sitemap: failed to fetch routes", err);
    }
  }

  const urlFor = (route) => {
    switch (route.type) {
      case "home":
        return `${SITE_URL}/blog`;
      case "post":
        return `${SITE_URL}/blog/${route.slug}`;
      case "category":
        return `${SITE_URL}/blog/category/${route.slug}`;
      case "author":
        return `${SITE_URL}/blog/author/${route.slug}`;
      case "tag":
        return `${SITE_URL}/blog/tag/${route.slug}`;
      default:
        return null;
    }
  };

  const entries = routes
    .map((route) => {
      const loc = urlFor(route);
      if (!loc) return "";
      const lastmod = route.lastModified ? `<lastmod>${escapeXml(route.lastModified)}</lastmod>` : "";
      return `  <url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`;
    })
    .filter(Boolean)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=1800",
    },
    body: xml,
  };
};

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
