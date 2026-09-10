// 雪花飘落动效（读取 config.js 的 snow 配置）
(function () {
  const cfg = (window.SITE_CONFIG || {}).snow || {};
  if (cfg.enabled === false) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // 雪花片数下限：低于这个数看着就不像在下雪了
  const MIN_FLAKES = 10;
  // 密度除数：每多少 CSS 像素宽度放一片雪花（屏幕越宽雪花越多）
  const DENSITY_DIVISOR = 10;
  // count 是「上限」而不是实际片数，所以 0 这类 falsy 值不能直接当默认值用
  const maxCount = Number.isFinite(cfg.count) ? cfg.count : 70;

  const canvas = document.createElement("canvas");
  canvas.className = "snow-canvas";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  // W / H 是「CSS 像素」的逻辑尺寸：位图按 devicePixelRatio 放大，
  // 但绘制与碰撞计算继续用这两个值，坐标系始终是 CSS 像素
  let W = 0, H = 0, running = true;
  // flakes 必须在第一次 resize() 之前就存在，因为 resize() 会往里面补雪花
  const flakes = [];

  // 当前视口宽度下应该有多少片雪花
  function targetCount() {
    return Math.max(MIN_FLAKES, Math.min(maxCount, Math.floor(W / DENSITY_DIVISOR)));
  }

  function makeFlake() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2.2 + 0.8,
      speed: Math.random() * 0.7 + 0.35,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.02 + 0.008,
      alpha: Math.random() * 0.35 + 0.35,
    };
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    // 位图按 DPR 放大，否则高分屏上直径不到 3px 的圆点被合成器放大后会发虚、闪烁
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // 关键顺序：给 canvas.width/height 赋值会重置 2D 上下文，
    // 所以 setTransform 必须放在赋值之后；之后仍按 CSS 像素绘制
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 视口尺寸变了要同步雪花数量与坐标，否则拉宽窗口后新增的区域几十秒内没有雪花
    const n = targetCount();
    while (flakes.length < n) flakes.push(makeFlake());
    flakes.length = n;
    for (const f of flakes) {
      // 越界的重新撒回新范围内（直接钉在边缘会在边框上码成一条线）
      if (f.x < 0 || f.x > W) f.x = Math.random() * W;
      if (f.y < 0 || f.y > H) f.y = Math.random() * H;
    }
  }

  // 缩放防抖：避免拖动窗口时每帧重设画布尺寸
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  resize();

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

  // 单一句柄防重入：同一帧内重复 schedule 也只会排一次帧，避免出现两个动画循环
  let rafId = 0;
  function schedule() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  // 页面切到后台时暂停动画，省电省 CPU
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) schedule();
  });

  function tick() {
    rafId = 0;
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
    schedule();
  }
  schedule();
})();
