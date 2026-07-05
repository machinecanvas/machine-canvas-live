// Machine Canvas — small progressive-enhancement script.
// Nothing on this site depends on this file to function: forms are native
// HTML/Netlify Forms, nav is a CSS checkbox toggle, FAQ is <details>.
// This runs the before/after drag sliders and the hero print-reveal animation.
(function () {
  document.querySelectorAll(".ba-slider").forEach(function (slider) {
    var input = slider.querySelector("input[type=range]");
    var wrap = slider.querySelector(".ba-before-wrap");
    var line = slider.querySelector(".ba-handle-line");
    var dot = slider.querySelector(".ba-handle-dot");
    if (!input || !wrap) return;
    var update = function () {
      var v = input.value;
      wrap.style.clipPath = "inset(0 " + (100 - v) + "% 0 0)";
      if (line) line.style.left = v + "%";
      if (dot) dot.style.left = v + "%";
    };
    input.addEventListener("input", update);
    update();
  });
})();
(function () {
  var canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var raf, W = 0, H = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var img = new Image();
  img.crossOrigin = "anonymous";
  var imgLoaded = false;

  var tile = document.createElement("canvas");
  tile.width = 16; tile.height = 16;
  var tctx = tile.getContext("2d");
  tctx.fillStyle = "rgba(255,255,255,0.05)";
  tctx.beginPath(); tctx.arc(8, 8, 1.1, 0, Math.PI * 2); tctx.fill();
  var pattern = null;

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pattern = ctx.createPattern(tile, "repeat");
  }
  resize();
  window.addEventListener("resize", resize);

  function drawImageCover(clipX) {
    var ir = img.width / img.height, cr = W / H, dw, dh, dx, dy;
    if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
    else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, clipX, H); ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.fillStyle = "rgba(5,5,5,0.45)";
    ctx.fillRect(0, 0, clipX, H);
    ctx.restore();
  }

  function drawBlankWall(fromX) {
    ctx.fillStyle = "#070707";
    ctx.fillRect(fromX, 0, W - fromX, H);
    if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(fromX, 0, W - fromX, H); }
  }

  function drawHead(x) {
    if (x <= 0 || x >= W) return;
    var grad = ctx.createLinearGradient(x - 60, 0, x + 10, 0);
    grad.addColorStop(0, "rgba(0,229,255,0)");
    grad.addColorStop(1, "rgba(0,229,255,0.28)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - 60, 0, 60, H);
    ctx.fillStyle = "#00E5FF";
    ctx.fillRect(x - 1.5, 0, 3, H);
    var colors = ["#00E5FF", "#FF2BD6", "#FFE600"];
    for (var y = 14; y < H; y += 42) {
      ctx.fillStyle = colors[((y / 42) | 0) % 3];
      ctx.fillRect(x - 5, y, 10, 2);
    }
  }

  var start = null;
  var DURATION = 2200;

  function frame(t) {
    if (!imgLoaded) { raf = requestAnimationFrame(frame); return; }
    if (start === null) start = t;
    var p = Math.min(1, (t - start) / DURATION);
    var eased = 1 - Math.pow(1 - p, 3);
    var headX = eased * W;
    ctx.clearRect(0, 0, W, H);
    drawBlankWall(headX);
    drawImageCover(headX);
    drawHead(headX);
    if (p < 1) raf = requestAnimationFrame(frame);
    else { ctx.clearRect(0, 0, W, H); drawImageCover(W); }
  }

  function renderStatic() { ctx.clearRect(0, 0, W, H); drawImageCover(W); }

  img.onload = function () {
    imgLoaded = true;
    if (reduce) renderStatic(); else raf = requestAnimationFrame(frame);
  };
  img.src = "/brand/og-machine-canvas.jpg";
})();
