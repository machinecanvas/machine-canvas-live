// Wraps Opinly's /v1/content/rss (which returns a JSON array of items) into
// a proper RSS 2.0 XML feed. Served at /blog-rss.xml via _redirects.

const SITE_URL = "https://machinecanvas-wallandfloorprinting.com";
const UPSTREAM = "https://sdk.opinly.ai";

exports.handler = async (event) => {
  const apiKey = process.env.OPINLY_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: "OPINLY_API_KEY not set" };
  }

  const limit = (event.queryStringParameters && event.queryStringParameters.limit) || "20";

  let items = [];
  try {
    const res = await fetch(`${UPSTREAM}/v1/content/rss?limit=${encodeURIComponent(limit)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (res.ok) items = await res.json();
  } catch (err) {
    console.error("blog-rss: failed to fetch rss items", err);
  }

  const itemsXml = items
    .map((item) => {
      const link = `${SITE_URL}/blog/${item.slug}`;
      const pubDate = item.date ? new Date(item.date).toUTCString() : "";
      const categories = (item.categories || [])
        .map((c) => `      <category>${escapeXml(c)}</category>`)
        .join("\n");
      return `    <item>
      <title>${escapeXml(item.title || "")}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ""}
      <description>${escapeXml(item.description || "")}</description>
${categories}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Machine Canvas Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>News, guides and inspiration from Machine Canvas — UK wall &amp; floor printing.</description>
    <language>en-gb</language>
${itemsXml}
  </channel>
</rss>
`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
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
