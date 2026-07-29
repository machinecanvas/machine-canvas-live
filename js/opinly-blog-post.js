// Single blog post page (blog-post.html) — reads ?slug=, fetches the post,
// renders it, and wires up SEO tags + JSON-LD client-side.
//
// Note: because this is a plain static site with no server render step,
// title/meta/JSON-LD are injected via JS after the page loads. Search
// engines that execute JS (Google) will still see them; for crawlers that
// don't, blog-sitemap.xml and blog-rss.xml (both generated server-side by
// Netlify Functions) give a fully server-rendered discovery path.
(function () {
  var SITE_URL = "https://machinecanvas-wallandfloorprinting.com";

  var statusEl = document.getElementById("post-status");
  var articleEl = document.getElementById("post-article");
  if (!statusEl || !articleEl) return;

  function getSlug() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("slug")) return params.get("slug");
    // Fallback if someone links straight to /blog-post.html/<slug>
    var parts = window.location.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] !== "blog-post.html" ? parts[parts.length - 1] : null;
  }

  function setMeta(id, attr, value) {
    var el = document.getElementById(id);
    if (!el) return;
    if (attr === "text") el.textContent = value;
    else el.setAttribute(attr, value);
  }

  function renderFaqs(faqs) {
    var el = document.getElementById("post-faqs");
    if (!faqs || !faqs.length) return;
    el.innerHTML =
      '<h2 style="color:#fff;font-family:\'Cabinet Grotesk\',sans-serif;">FAQs</h2>' +
      faqs
        .map(function (faq) {
          return (
            "<details><summary>" +
            Opinly.escapeHtml(faq.question) +
            "</summary><p>" +
            Opinly.escapeHtml(faq.answer) +
            "</p></details>"
          );
        })
        .join("");
  }

  function injectJsonLd(post, url, imageUrl) {
    var jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.metaDescription || post.description,
      image: imageUrl || undefined,
      datePublished: post.firstPublishedAt,
      dateModified: post.modifiedAt || post.firstPublishedAt,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      author: post.author ? { "@type": "Person", name: post.author.name } : undefined,
      publisher: {
        "@type": "Organization",
        name: "Machine Canvas",
        logo: { "@type": "ImageObject", url: SITE_URL + "/brand/machine-canvas-logo-neon.webp" },
      },
    };

    var nodes = [jsonLd];

    if (post.faqs && post.faqs.length) {
      nodes.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faqs.map(function (faq) {
          return {
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          };
        }),
      });
    }

    document.getElementById("post-jsonld").textContent = JSON.stringify(nodes.length === 1 ? nodes[0] : nodes);
  }

  async function init() {
    var slug = getSlug();
    if (!slug) {
      statusEl.innerHTML = '<p class="blog-error">No post specified. <a href="/blog.html" class="text-cyan">Back to blog</a>.</p>';
      return;
    }

    try {
      var post = await Opinly.fetchPost(slug);

      var heroFileKey = post.titleFile && post.titleFile.fileKey;
      var heroUrl = heroFileKey ? Opinly.imageUrl(heroFileKey) : "";
      var canonicalUrl = SITE_URL + "/blog/" + encodeURIComponent(slug);

      document.title = (post.metaTitle || post.title) + " | Machine Canvas Blog";
      setMeta("post-title-tag", "text", (post.metaTitle || post.title) + " | Machine Canvas Blog");
      setMeta("post-description-tag", "content", post.metaDescription || post.description || "");
      setMeta("post-canonical-tag", "href", canonicalUrl);
      setMeta("post-og-title-tag", "content", post.title);
      setMeta("post-og-description-tag", "content", post.metaDescription || post.description || "");
      setMeta("post-og-url-tag", "content", canonicalUrl);
      if (heroUrl) setMeta("post-og-image-tag", "content", heroUrl);

      document.getElementById("post-category").textContent = (post.category && post.category.name) || "";
      document.getElementById("post-title").textContent = post.title;

      var metaParts = [];
      if (post.author && post.author.name) metaParts.push("By " + post.author.name);
      if (post.firstPublishedAt) metaParts.push(Opinly.formatDate(post.firstPublishedAt));
      document.getElementById("post-meta").textContent = metaParts.join(" · ");

      var heroImgEl = document.getElementById("post-hero-image");
      if (heroUrl) {
        heroImgEl.src = heroUrl;
        heroImgEl.alt = (post.titleFile && post.titleFile.altText) || post.title;
        heroImgEl.hidden = false;
      }

      document.getElementById("post-body").innerHTML = Opinly.renderContent(post.content);
      renderFaqs(post.faqs);
      injectJsonLd(post, canonicalUrl, heroUrl);

      articleEl.hidden = false;
      statusEl.innerHTML = "";
    } catch (err) {
      console.error("Failed to load blog post", err);
      if (err && err.status === 404) {
        statusEl.innerHTML = '<p class="blog-error">This post couldn\'t be found. <a href="/blog.html" class="text-cyan">Back to blog</a>.</p>';
      } else {
        statusEl.innerHTML =
          '<p class="blog-error">Couldn\'t load this post right now' +
          (err && err.status === 500 ? " (the Opinly API key isn't configured on this site yet)" : "") +
          '. <a href="/blog.html" class="text-cyan">Back to blog</a>.</p>';
      }
    }
  }

  init();
})();
