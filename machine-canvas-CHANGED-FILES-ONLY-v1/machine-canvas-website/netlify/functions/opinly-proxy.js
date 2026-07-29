// Opinly REST API proxy.
//
// Keeps OPINLY_API_KEY server-side (set it in Netlify: Site settings ->
// Environment variables -> OPINLY_API_KEY) instead of shipping it in the
// browser bundle. The site's front-end JS (js/opinly-client.js) calls this
// function instead of sdk.opinly.ai directly.
//
// Only whitelisted, read-only content endpoints are reachable through this
// proxy — arbitrary paths cannot be requested.

const UPSTREAM = "https://sdk.opinly.ai";

const ENDPOINTS = {
  posts: {
    path: "/v1/content/posts",
    allowedParams: ["limit", "cursor", "category", "author", "tag", "sort"],
  },
  post: {
    path: "/v1/content/post",
    allowedParams: ["slug"],
    required: ["slug"],
  },
  routes: {
    path: "/v1/content/routes",
    allowedParams: [],
  },
  categories: {
    path: "/v1/content/categories",
    allowedParams: [],
  },
  tags: {
    path: "/v1/content/tags",
    allowedParams: [],
  },
  authors: {
    path: "/v1/content/authors",
    allowedParams: [],
  },
  author: {
    // slug is part of the upstream path, not a query param
    path: (params) => `/v1/content/authors/${encodeURIComponent(params.slug || "")}`,
    allowedParams: ["slug"],
    required: ["slug"],
    stripFromQuery: ["slug"],
  },
  rss: {
    path: "/v1/content/rss",
    allowedParams: ["limit"],
  },
};

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { error: "method_not_allowed" });
  }

  const apiKey = process.env.OPINLY_API_KEY;
  if (!apiKey) {
    return json(500, {
      error: "server_misconfigured",
      detail: "OPINLY_API_KEY is not set in this site's environment variables.",
    });
  }

  const params = event.queryStringParameters || {};
  const endpointName = params.endpoint;
  const endpoint = ENDPOINTS[endpointName];

  if (!endpoint) {
    return json(400, {
      error: "unknown_endpoint",
      detail: `?endpoint= must be one of: ${Object.keys(ENDPOINTS).join(", ")}`,
    });
  }

  for (const req of endpoint.required || []) {
    if (!params[req]) {
      return json(400, { error: "missing_param", detail: `?${req}= is required` });
    }
  }

  const upstreamPath = typeof endpoint.path === "function" ? endpoint.path(params) : endpoint.path;
  const url = new URL(UPSTREAM + upstreamPath);
  const strip = new Set(endpoint.stripFromQuery || []);
  for (const key of endpoint.allowedParams) {
    if (strip.has(key)) continue;
    if (params[key] !== undefined && params[key] !== "") {
      url.searchParams.set(key, params[key]);
    }
  }

  try {
    const upstreamRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    const body = await upstreamRes.text();

    return {
      statusCode: upstreamRes.status,
      headers: {
        "Content-Type": upstreamRes.headers.get("content-type") || "application/json",
        // Short public cache — blog content changes infrequently; webhook
        // handler (opinly-webhook.js) is the hook point for smarter
        // invalidation later if this site grows a real cache layer.
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
      body,
    };
  } catch (err) {
    return json(502, { error: "upstream_fetch_failed", detail: String((err && err.message) || err) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(obj),
  };
}
