// Receives Opinly's "content.paths-invalidated" webhook, signed via Svix.
//
// Register this endpoint in the Opinly dashboard as:
//   https://<your-site>.netlify.app/.netlify/functions/opinly-webhook
// (or, once the redirect in _redirects is live, https://<your-site>/opinly-webhook)
//
// Set SVIX_WEBHOOK_SECRET in Netlify's environment variables — Opinly shows
// this secret (starts with "whsec_") next to the webhook endpoint in its
// dashboard. Verification is implemented by hand with node:crypto so this
// function has zero npm dependencies and needs no build step.

const crypto = require("crypto");

const TOLERANCE_SECONDS = 5 * 60; // reject messages older/newer than 5 min

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "method not allowed" };
  }

  const secret = process.env.SVIX_WEBHOOK_SECRET;
  if (!secret) {
    console.error("SVIX_WEBHOOK_SECRET is not set");
    return { statusCode: 500, body: "server misconfigured" };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";

  const headers = lowercaseKeys(event.headers || {});
  const svixId = headers["svix-id"];
  const svixTimestamp = headers["svix-timestamp"];
  const svixSignature = headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature) {
    return { statusCode: 400, body: "missing svix headers" };
  }

  // Reject stale/future timestamps to prevent replay.
  const ts = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_SECONDS) {
    return { statusCode: 400, body: "timestamp out of tolerance" };
  }

  if (!verifySvixSignature({ id: svixId, timestamp: svixTimestamp, body: rawBody, secret, signatureHeader: svixSignature })) {
    return { statusCode: 400, body: "invalid signature" };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: "invalid json" };
  }

  if (payload.type === "content.paths-invalidated") {
    const paths = (payload.data && payload.data.paths) || [];
    // This site fetches Opinly content live on every page load via
    // js/opinly-client.js -> opinly-proxy.js, and blog-sitemap.js /
    // blog-rss.js also generate fresh on every request, so there is no
    // server-side cache here that needs invalidating today.
    //
    // This handler is the hook point if that changes later — e.g. if you
    // add a Netlify Edge/CDN cache in front of the proxy function, or
    // switch to pre-rendering blog pages at build time. A common next step:
    // POST to a Netlify Build Hook URL (stored as BUILD_HOOK_URL) to
    // trigger a rebuild whenever paths change.
    console.log("Opinly content updated, paths:", paths);

    const buildHook = process.env.BUILD_HOOK_URL;
    if (buildHook) {
      try {
        await fetch(buildHook, { method: "POST" });
      } catch (err) {
        console.error("Failed to trigger build hook:", err);
      }
    }
  }

  return { statusCode: 200, body: "ok" };
};

function lowercaseKeys(obj) {
  const out = {};
  for (const key of Object.keys(obj)) out[key.toLowerCase()] = obj[key];
  return out;
}

function verifySvixSignature({ id, timestamp, body, secret, signatureHeader }) {
  const secretBytes = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const signedContent = `${id}.${timestamp}.${body}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  // svix-signature can contain multiple space-separated "v1,<sig>" values
  // (e.g. during secret rotation) — a match on any of them is valid.
  const candidates = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(",") ? part.split(",")[1] : part));

  const expectedBuf = Buffer.from(expected, "base64");
  return candidates.some((candidate) => {
    try {
      const candidateBuf = Buffer.from(candidate, "base64");
      return candidateBuf.length === expectedBuf.length && crypto.timingSafeEqual(candidateBuf, expectedBuf);
    } catch {
      return false;
    }
  });
}
