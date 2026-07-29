#!/usr/bin/env node
// Build-time blog pre-renderer.
//
// Problem this solves: blog.html / blog-post.html originally rendered
// Opinly content entirely client-side via fetch(). That's invisible to any
// crawler that doesn't execute JavaScript, and even for ones that do, it
// means the article text isn't present in the initial HTML response.
//
// This script runs during `netlify build` (see netlify.toml), fetches every
// published post from Opinly's REST API, and writes a fully static HTML
// file per post to blog/<slug>.html — real, complete HTML, with the same
// header/nav/footer/CSS as the rest of the site, viewable with JavaScript
// off. It also bakes the first page of the post list into blog.html itself.
//
// It intentionally never fails the build: if OPINLY_API_KEY isn't set yet,
// or the API is unreachable, it logs why and exits 0, leaving the existing
// client-rendered blog.html/blog-post.html as a working fallback. Once
// posts ARE pre-rendered here, /blog/<slug> serves the static file directly
// (Netlify serves a matching real file before falling back to the
// /blog/* -> blog-post.html?slug= redirect in _redirects), and that
// redirect remains as a safety net for posts published after the last
// deploy.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const UPSTREAM = "https://sdk.opinly.ai";
const SITE_URL = "https://machinecanvas-wallandfloorprinting.com";
const CDN_NAMESPACE = "KqiIoHMurJs2rqWYYgJtL";
const MAX_POSTS = 300; // safety valve

async function main() {
  const apiKey = process.env.OPINLY_API_KEY;
  if (!apiKey) {
    console.warn("[build-blog] OPINLY_API_KEY not set — skipping blog pre-render, keeping client-rendered fallback.");
    return;
  }

  let posts;
  try {
    posts = await fetchAllPosts(apiKey);
  } catch (err) {
    console.warn("[build-blog] Could not reach Opinly API, skipping pre-render:", err.message);
    return;
  }

  if (!posts.length) {
    console.log("[build-blog] No published posts yet — nothing to pre-render.");
    return;
  }

  console.log(`[build-blog] Pre-rendering ${posts.length} post(s)...`);

  const postTemplate = fs.readFileSync(path.join(ROOT, "blog-post.html"), "utf8");
  const blogDir = path.join(ROOT, "blog");
  fs.mkdirSync(blogDir, { recursive: true });

  let built = 0;
  for (const summary of posts) {
    try {
      const full = await fetchJson(`${UPSTREAM}/v1/content/post?slug=${encodeURIComponent(summary.slug)}`, apiKey);
      const html = renderPostPage(postTemplate, full);
      fs.writeFileSync(path.join(blogDir, `${summary.slug}.html`), html, "utf8");
      built++;
    } catch (err) {
      console.warn(`[build-blog] Skipped "${summary.slug}":`, err.message);
    }
  }
  console.log(`[build-blog] Wrote ${built} static post page(s) to /blog/<slug>.html`);

  try {
    injectIndexCards(posts.slice(0, 9));
    console.log("[build-blog] Injected latest posts into blog.html for server-rendered discovery.");
  } catch (err) {
    console.warn("[build-blog] Could not inject index cards into blog.html:", err.message);
  }
}

// ---- Opinly fetch helpers -------------------------------------------------

async function fetchJson(url, apiKey) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchAllPosts(apiKey) {
  const all = [];
  let cursor = null;
  do {
    const url = new URL(`${UPSTREAM}/v1/content/posts`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("sort", "newest");
    if (cursor) url.searchParams.set("cursor", cursor);
    const page = await fetchJson(url.toString(), apiKey);
    all.push(...(page.data || []));
    cursor = page.next_cursor;
  } while (cursor && all.length < MAX_POSTS);
  return all;
}

// ---- Rich-text content renderer (mirrors js/opinly-client.js) -----------

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function imageUrl(fileKey) {
  if (!fileKey) return "";
  return `https://cdn.opinly.ai/${CDN_NAMESPACE}/${String(fileKey).replace(/^\/+/, "")}`;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

const MARK_TAGS = { bold: "strong", strong: "strong", italic: "em", em: "em", code: "code", strike: "s", strikethrough: "s", underline: "u" };

function renderMarks(text, marks) {
  let html = escapeHtml(text);
  (marks || []).forEach((mark) => {
    if (mark.type === "link") {
      const href = escapeHtml((mark.attrs && mark.attrs.href) || "#");
      html = `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${html}</a>`;
      return;
    }
    const tag = MARK_TAGS[mark.type];
    if (tag) html = `<${tag}>${html}</${tag}>`;
  });
  return html;
}

function renderChildren(node) {
  return (node.content || []).map(renderNode).join("");
}

function collectText(node) {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  return (node.content || []).map(collectText).join("");
}

function renderNode(node) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "text") return renderMarks(node.text || "", node.marks);

  const attrs = node.attrs || {};
  switch (node.type) {
    case "doc":
      return renderChildren(node);
    case "paragraph":
      return `<p>${renderChildren(node)}</p>`;
    case "heading": {
      const level = Math.min(Math.max(parseInt(attrs.level, 10) || 2, 2), 4);
      return `<h${level}>${renderChildren(node)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${renderChildren(node)}</ul>`;
    case "orderedList":
      return `<ol>${renderChildren(node)}</ol>`;
    case "listItem":
      return `<li>${renderChildren(node)}</li>`;
    case "blockquote":
      return `<blockquote>${renderChildren(node)}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${escapeHtml(collectText(node))}</code></pre>`;
    case "horizontalRule":
      return "<hr/>";
    case "hardBreak":
      return "<br/>";
    case "image": {
      const src = attrs.src || (attrs.fileKey ? imageUrl(attrs.fileKey) : "");
      if (!src) return "";
      const alt = escapeHtml(attrs.alt || attrs.altText || "");
      return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" />`;
    }
    default:
      return renderChildren(node);
  }
}

function renderContent(root) {
  try {
    return renderNode(root);
  } catch (err) {
    return `<p>${escapeHtml(collectText(root))}</p>`;
  }
}

// ---- Page assembly --------------------------------------------------------

function replaceAttr(html, id, attr, value) {
  const re = new RegExp(`(id="${id}"[^>]*\\s${attr}=")[^"]*(")`);
  return html.replace(re, `$1${value.replace(/\$/g, "$$$$")}$2`);
}

function replaceTagContent(html, id, tagName, value) {
  const re = new RegExp(`(<${tagName}[^>]*id="${id}"[^>]*>)([\\s\\S]*?)(</${tagName}>)`);
  return html.replace(re, (m, open, _old, close) => open + value.replace(/\$/g, "$$$$") + close);
}

function renderFaqsHtml(faqs) {
  if (!faqs || !faqs.length) return "";
  return (
    `<h2 style="color:#fff;font-family:'Cabinet Grotesk',sans-serif;">FAQs</h2>` +
    faqs.map((faq) => `<details><summary>${escapeHtml(faq.question)}</summary><p>${escapeHtml(faq.answer)}</p></details>`).join("")
  );
}

function buildJsonLd(post, canonicalUrl, imgUrl) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription || post.description,
    ...(imgUrl ? { image: imgUrl } : {}),
    datePublished: post.firstPublishedAt,
    dateModified: post.modifiedAt || post.firstPublishedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    ...(post.author ? { author: { "@type": "Person", name: post.author.name } } : {}),
    publisher: {
      "@type": "Organization",
      name: "Machine Canvas",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/brand/machine-canvas-logo-neon.webp` },
    },
  };

  if (post.faqs && post.faqs.length) {
    return JSON.stringify([
      jsonLd,
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ]);
  }
  return JSON.stringify(jsonLd);
}

function renderPostPage(template, post) {
  const heroFileKey = post.titleFile && post.titleFile.fileKey;
  const heroUrl = heroFileKey ? imageUrl(heroFileKey) : "";
  const canonicalUrl = `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`;
  const pageTitle = `${escapeHtml(post.metaTitle || post.title)} | Machine Canvas Blog`;
  const metaDescription = escapeHtml(post.metaDescription || post.description || "");

  const metaParts = [];
  if (post.author && post.author.name) metaParts.push(`By ${post.author.name}`);
  if (post.firstPublishedAt) metaParts.push(formatDate(post.firstPublishedAt));

  let html = template;
  html = replaceTagContent(html, "post-title-tag", "title", pageTitle);
  html = replaceAttr(html, "post-description-tag", "content", metaDescription);
  html = replaceAttr(html, "post-canonical-tag", "href", canonicalUrl);
  html = replaceAttr(html, "post-og-title-tag", "content", escapeHtml(post.title));
  html = replaceAttr(html, "post-og-description-tag", "content", metaDescription);
  html = replaceAttr(html, "post-og-url-tag", "content", canonicalUrl);
  if (heroUrl) html = replaceAttr(html, "post-og-image-tag", "content", heroUrl);

  html = html.replace(
    /<script id="post-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script id="post-jsonld" type="application/ld+json">${buildJsonLd(post, canonicalUrl, heroUrl)}</script>`
  );

  html = replaceTagContent(html, "post-category", "span", escapeHtml((post.category && post.category.name) || ""));
  html = replaceTagContent(html, "post-title", "h1", escapeHtml(post.title));
  html = replaceTagContent(html, "post-meta", "p", escapeHtml(metaParts.join(" · ")));

  if (heroUrl) {
    html = html.replace(
      /<img id="post-hero-image"[^>]*\/>/,
      `<img id="post-hero-image" class="post-hero-image" src="${escapeHtml(heroUrl)}" alt="${escapeHtml((post.titleFile && post.titleFile.altText) || post.title)}" />`
    );
  }

  html = replaceTagContent(html, "post-body", "div", renderContent(post.content));
  html = replaceTagContent(html, "post-faqs", "div", renderFaqsHtml(post.faqs));

  // Article no longer starts hidden — content is already server-rendered.
  html = html.replace('<article id="post-article" hidden>', '<article id="post-article">');
  html = replaceTagContent(html, "post-status", "div", "");

  // Drop the client-side fetch/render scripts — this page is fully static.
  html = html.replace(/\s*<script src="\/js\/opinly-client\.js" defer><\/script>\n/, "\n");
  html = html.replace(/\s*<script src="\/js\/opinly-blog-post\.js" defer><\/script>\n/, "\n");

  return html;
}

function injectIndexCards(posts) {
  const indexPath = path.join(ROOT, "blog.html");
  let html = fs.readFileSync(indexPath, "utf8");

  const cardsHtml = posts
    .map((post) => {
      const imgSrc = post.image && post.image.fileKey ? imageUrl(post.image.fileKey) : "";
      const imgAlt = escapeHtml((post.image && post.image.alt) || post.title);
      const catName = post.category && post.category.name;
      const dateStr = formatDate(post.firstPublishedAt);
      const metaLine = escapeHtml([catName, dateStr].filter(Boolean).join(" · "));
      return (
        `<a class="card blog-card" href="/blog/${encodeURIComponent(post.slug)}">` +
        (imgSrc ? `<img class="thumb" src="${escapeHtml(imgSrc)}" alt="${imgAlt}" loading="lazy" />` : "") +
        `<p class="mono-label text-cyan">${metaLine}</p>` +
        `<h3>${escapeHtml(post.title)}</h3>` +
        `<p class="text-zinc-400">${escapeHtml(post.description || "")}</p>` +
        `</a>`
      );
    })
    .join("");

  html = html.replace(
    /<div id="blog-grid" class="container grid grid-3" style="padding:0;">[\s\S]*?<\/div>/,
    `<div id="blog-grid" class="container grid grid-3" style="padding:0;">${cardsHtml}</div>`
  );

  fs.writeFileSync(indexPath, html, "utf8");
}

main().catch((err) => {
  console.error("[build-blog] Unexpected error (continuing build anyway):", err);
});
