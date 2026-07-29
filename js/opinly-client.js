// Opinly blog integration — shared client.
// Talks to /.netlify/functions/opinly-proxy (server holds the API key),
// renders Opinly's rich-text content tree to HTML, and builds CDN image URLs.
//
// Exposes window.Opinly = { fetchList, fetchPost, fetchRoutes, imageUrl,
// renderContent, formatDate, escapeHtml }

(function () {
  var CDN_NAMESPACE = "KqiIoHMurJs2rqWYYgJtL";
  var PROXY = "/.netlify/functions/opinly-proxy";

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
    return "https://cdn.opinly.ai/" + CDN_NAMESPACE + "/" + fileKey.replace(/^\/+/, "");
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return iso;
    }
  }

  async function request(endpoint, params) {
    var url = new URL(PROXY, window.location.origin);
    url.searchParams.set("endpoint", endpoint);
    Object.keys(params || {}).forEach(function (key) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
        url.searchParams.set(key, params[key]);
      }
    });
    var res = await fetch(url.toString());
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) {
      var err = new Error((data && (data.detail || data.title)) || "Request failed (" + res.status + ")");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function fetchList(params) {
    return request("posts", params);
  }

  function fetchPost(slug) {
    return request("post", { slug: slug });
  }

  function fetchRoutes() {
    return request("routes", {});
  }

  function fetchCategories() {
    return request("categories", {});
  }

  function fetchAuthor(slug) {
    return request("author", { slug: slug });
  }

  // ---- Content tree renderer -------------------------------------------
  // Opinly's FullPost.content is a ProseMirror/Tiptap-style node tree:
  // { type, attrs, marks, text, content: [...] }. We don't have Opinly's
  // official renderer package on this static site, so this is a small,
  // defensive renderer covering the common node/mark types. Unknown node
  // types fall back to rendering their children so nothing crashes if
  // Opinly's schema grows.

  var MARK_TAGS = {
    bold: "strong",
    strong: "strong",
    italic: "em",
    em: "em",
    code: "code",
    strike: "s",
    strikethrough: "s",
    underline: "u",
  };

  function renderMarks(text, marks) {
    var html = escapeHtml(text);
    (marks || []).forEach(function (mark) {
      if (mark.type === "link") {
        var href = escapeHtml((mark.attrs && mark.attrs.href) || "#");
        html = '<a href="' + href + '" target="_blank" rel="noopener noreferrer nofollow">' + html + "</a>";
        return;
      }
      var tag = MARK_TAGS[mark.type];
      if (tag) html = "<" + tag + ">" + html + "</" + tag + ">";
    });
    return html;
  }

  function renderChildren(node) {
    return (node.content || []).map(renderNode).join("");
  }

  function renderNode(node) {
    if (!node || typeof node !== "object") return "";

    if (node.type === "text") {
      return renderMarks(node.text || "", node.marks);
    }

    var attrs = node.attrs || {};

    switch (node.type) {
      case "doc":
        return renderChildren(node);
      case "paragraph":
        return "<p>" + renderChildren(node) + "</p>";
      case "heading": {
        var level = Math.min(Math.max(parseInt(attrs.level, 10) || 2, 2), 4); // clamp to h2-h4 to keep post-title (h1) unique
        return "<h" + level + ">" + renderChildren(node) + "</h" + level + ">";
      }
      case "bulletList":
        return "<ul>" + renderChildren(node) + "</ul>";
      case "orderedList":
        return "<ol>" + renderChildren(node) + "</ol>";
      case "listItem":
        return "<li>" + renderChildren(node) + "</li>";
      case "blockquote":
        return "<blockquote>" + renderChildren(node) + "</blockquote>";
      case "codeBlock":
        return "<pre><code>" + escapeHtml(collectText(node)) + "</code></pre>";
      case "horizontalRule":
        return "<hr/>";
      case "hardBreak":
        return "<br/>";
      case "image": {
        var src = attrs.src || (attrs.fileKey ? imageUrl(attrs.fileKey) : "");
        if (!src) return "";
        var alt = escapeHtml(attrs.alt || attrs.altText || "");
        return '<img src="' + escapeHtml(src) + '" alt="' + alt + '" loading="lazy" />';
      }
      default:
        // Unknown wrapper type — render children so content still shows.
        return renderChildren(node);
    }
  }

  function collectText(node) {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    return (node.content || []).map(collectText).join("");
  }

  function renderContent(root) {
    try {
      return renderNode(root);
    } catch (err) {
      console.error("Opinly content render failed", err);
      return "<p>" + escapeHtml(collectText(root)) + "</p>";
    }
  }

  window.Opinly = {
    fetchList: fetchList,
    fetchPost: fetchPost,
    fetchRoutes: fetchRoutes,
    fetchCategories: fetchCategories,
    fetchAuthor: fetchAuthor,
    imageUrl: imageUrl,
    renderContent: renderContent,
    formatDate: formatDate,
    escapeHtml: escapeHtml,
  };
})();
