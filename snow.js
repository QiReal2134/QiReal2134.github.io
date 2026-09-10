// 雪花飘落动效（读取 config.js 的 snow 配置）
(function () {
  const cfg = (window.SITE_CONFIG || {}).snow || {};
  if (cfg.enabled === false) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const count = cfg.count || 70;

  const canvas = document.createElement("canvas");
  canvas.className = "snow-canvas";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0, running = true;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // 缩放防抖：避免拖动窗口时每帧重设画布尺寸
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  resize();

  const flakes = [];
  const n = Math.max(10, Math.min(count, Math.floor(window.innerWidth / 10)));
  for (let i = 0; i < n; i++) {
    flakes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2.2 + 0.8,
      speed: Math.random() * 0.7 + 0.35,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.02 + 0.008,
      alpha: Math.random() * 0.35 + 0.35,
    });
  }

  let colorCache = null;
  function snowColor() {
    if (colorCache) return colorCache;
    colorCache = document.documentElement.dataset.theme === "light"
      ? "rgba(90, 100, 125, 0.55)"
      : "rgba(255, 255, 255, 0.7)";
    return colorCache;
  }
  // 主题切换后让颜色缓存失效
  new MutationObserver(() => { colorCache = null; })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // 页面切到后台时暂停动画，省电省 CPU
  document.addEventListener("visibilitychange", () => {
    const wasRunning = running;
    running = !document.hidden;
    if (running && !wasRunning) requestAnimationFrame(tick);
  });

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = snowColor();
    for (const f of flakes) {
      f.y += f.speed;
      f.sway += f.swaySpeed;
      f.x += Math.sin(f.sway) * 0.4;
      if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; }
      if (f.x > W + 5) f.x = -5;
      if (f.x < -5) f.x = W + 5;
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }
  tick();
})();
