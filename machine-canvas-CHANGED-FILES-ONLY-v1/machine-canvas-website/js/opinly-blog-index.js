// Blog index page (blog.html) — lists Opinly posts with cursor pagination.
(function () {
  var grid = document.getElementById("blog-grid");
  var statusEl = document.getElementById("blog-status");
  var loadMoreBtn = document.getElementById("blog-load-more");
  if (!grid) return;

  var nextCursor = null;
  var loading = false;

  function skeletonCard() {
    var el = document.createElement("div");
    el.className = "card blog-skeleton";
    el.innerHTML = '<div class="thumb"></div><div style="height:14px;width:40%;background:var(--zinc-800);margin-bottom:10px;"></div><div style="height:20px;width:80%;background:var(--zinc-800);"></div>';
    return el;
  }

  function showSkeletons(count) {
    grid.innerHTML = "";
    for (var i = 0; i < count; i++) grid.appendChild(skeletonCard());
  }

  function renderPosts(posts, append) {
    if (!append) grid.innerHTML = "";
    if (!posts.length && !append) {
      statusEl.innerHTML = '<p class="blog-empty">No posts published yet — check back soon.</p>';
      return;
    }
    posts.forEach(function (post) {
      var card = document.createElement("a");
      card.className = "card blog-card";
      card.href = "/blog/" + encodeURIComponent(post.slug);

      var imgSrc = post.image && post.image.fileKey ? Opinly.imageUrl(post.image.fileKey) : "";
      var imgAlt = (post.image && post.image.alt) || post.title;
      var catName = post.category && post.category.name;
      var dateStr = Opinly.formatDate(post.firstPublishedAt);

      card.innerHTML =
        (imgSrc ? '<img class="thumb" src="' + Opinly.escapeHtml(imgSrc) + '" alt="' + Opinly.escapeHtml(imgAlt) + '" loading="lazy" />' : "") +
        '<p class="mono-label text-cyan">' + Opinly.escapeHtml([catName, dateStr].filter(Boolean).join(" · ")) + "</p>" +
        "<h3>" + Opinly.escapeHtml(post.title) + "</h3>" +
        '<p class="text-zinc-400">' + Opinly.escapeHtml(post.description || "") + "</p>";

      grid.appendChild(card);
    });
  }

  async function loadPage(cursor) {
    if (loading) return;
    loading = true;
    if (!cursor) showSkeletons(6);
    statusEl.innerHTML = "";
    loadMoreBtn.disabled = true;

    try {
      var result = await Opinly.fetchList({ limit: 9, cursor: cursor, sort: "newest" });
      renderPosts(result.data || [], !!cursor);
      nextCursor = result.next_cursor;
      loadMoreBtn.hidden = !nextCursor;
      loadMoreBtn.disabled = false;
    } catch (err) {
      console.error("Failed to load blog posts", err);
      grid.innerHTML = "";
      statusEl.innerHTML =
        '<p class="blog-error">Couldn\'t load blog posts right now' +
        (err && err.status === 500 ? " (the Opinly API key isn't configured on this site yet)" : "") +
        ". Please try again shortly.</p>";
      loadMoreBtn.hidden = true;
    } finally {
      loading = false;
    }
  }

  loadMoreBtn.addEventListener("click", function () {
    if (nextCursor) loadPage(nextCursor);
  });

  loadPage(null);
})();
