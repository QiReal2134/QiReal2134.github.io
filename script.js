// 通用逻辑：配置填充 + 单页三屏滑动导航 + 主题切换
const cfg = window.SITE_CONFIG;

// ---------- 顶部导航 ----------
const logoText = document.getElementById("logoText");
if (logoText) logoText.textContent = cfg.logo;

const nav = document.getElementById("navLinks");
const pages = [...document.querySelectorAll(".page")];
const track = document.getElementById("pagesTrack");
const viewport = document.getElementById("pagesViewport");
const navButtons = [];

if (nav && track) {
  nav.innerHTML = "";
  cfg.navLinks.forEach((link, i) => {
    const a = document.createElement("a");
    a.className = "nav-link";
    a.href = "javascript:void(0)";
    a.textContent = link.label;
    a.dataset.page = link.page;
    a.addEventListener("click", () => goTo(i));
    nav.appendChild(a);
    navButtons.push(a);
  });
}

// ---------- 滑动导航 ----------
let current = 0;
let animating = false;

function pageIndex(name) {
  return cfg.navLinks.findIndex((l) => l.page === name);
}

function pageWidth() {
  return viewport ? viewport.clientWidth : window.innerWidth;
}

function applyTransform(offsetPx) {
  track.style.transform = `translate3d(${-current * pageWidth() + offsetPx}px, 0, 0)`;
}

function setActiveButton() {
  navButtons.forEach((b, i) => b.classList.toggle("active", i === current));
}

function goTo(i, animate = true) {
  if (!track) return;
  const changed = i !== current;
  current = Math.max(0, Math.min(i, pages.length - 1));
  track.classList.toggle("dragging", !animate);
  applyTransform(0);
  setActiveButton();
  // 切换页面时把纵向滚动位置重置到顶部
  if (changed) window.scrollTo(0, 0);
  // 通知其他模块（如作品页懒加载）
  document.dispatchEvent(new CustomEvent("pagechange", { detail: { index: current, page: cfg.navLinks[current].page } }));
}

window.addEventListener("resize", () => applyTransform(0));

// ---------- 左右滑动 / 拖拽手势 ----------
if (viewport && track) {
  let startX = 0, startY = 0, dx = 0, dragging = false, lockedAxis = null;

  viewport.addEventListener("pointerdown", (e) => {
    // 只在触摸/鼠标左键时启用，且不打断正在进行的动画
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    lockedAxis = null;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    track.classList.add("dragging");
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    // 判断主方向：纵向滚动优先，避免页面上下滚动被劫持
    if (lockedAxis === null) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      lockedAxis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (lockedAxis === "y") { dragging = false; track.classList.remove("dragging"); return; }
      viewport.setPointerCapture && viewport.setPointerCapture(e.pointerId);
    }
    dx = mx;
    // 首尾越界时加阻尼
    if ((current === 0 && dx > 0) || (current === pages.length - 1 && dx < 0)) dx *= 0.35;
    applyTransform(dx);
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("dragging");
    const threshold = Math.min(90, pageWidth() * 0.18);
    if (dx < -threshold && current < pages.length - 1) goTo(current + 1);
    else if (dx > threshold && current > 0) goTo(current - 1);
    else applyTransform(0);
    dx = 0;
  }

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("pointerleave", endDrag);

  // 键盘左右方向键
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goTo(current + 1);
    if (e.key === "ArrowLeft") goTo(current - 1);
  });
}

// 支持 index.html#works 这种直接定位
const hashPage = (location.hash || "").replace("#", "");
if (pages.length && track) {
  const startIdx = hashPage ? pageIndex(hashPage) : 0;
  goTo(startIdx >= 0 ? startIdx : 0, false);
  requestAnimationFrame(() => track.classList.remove("dragging"));
}

// ---------- 首页内容 ----------
const nameEl = document.getElementById("name");
if (nameEl) {
  document.getElementById("avatar").src = cfg.avatar;
  nameEl.textContent = cfg.name;
  document.getElementById("tagline").textContent = cfg.tagline;
  document.getElementById("bio").textContent = cfg.bio;
  document.getElementById("statusText").textContent = cfg.status;
}

// ---------- 关于页内容 ----------
const aboutBody = document.getElementById("aboutBody");
if (aboutBody && cfg.about) {
  document.getElementById("aboutTitle").textContent = cfg.about.title;
  for (const p of cfg.about.paragraphs) {
    const el = document.createElement("p");
    el.className = "about-p";
    el.textContent = p;
    aboutBody.appendChild(el);
  }
  const links = document.getElementById("aboutLinks");
  for (const l of cfg.about.links || []) {
    const a = document.createElement("a");
    a.className = "dl-btn";
    a.href = l.href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = l.label;
    links.appendChild(a);
  }
}

// ---------- 页脚 ----------
const footerText = document.getElementById("footerText");
if (footerText) footerText.textContent = cfg.footer;

// ---------- 深浅色切换（带加长的过渡动画） ----------
const root = document.documentElement;
const toggle = document.getElementById("themeToggle");
if (toggle) {
  toggle.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    localStorage.setItem("theme", next);
    root.classList.add("theme-animating");
    setTimeout(() => root.classList.remove("theme-animating"), 1200);
  });
}
