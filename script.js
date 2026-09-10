// 通用逻辑：配置填充 + 单页三屏滑动导航 + 主题切换
if (!window.SITE_CONFIG) console.warn("[script.js] config.js 未加载");
const cfg = window.SITE_CONFIG || {};

// 取元素 / 写文本的小工具：每项独立判空，避免某个字段缺失时整段逻辑中断
const $ = (id) => document.getElementById(id);
const setText = (id, v) => {
  const el = $(id);
  if (el && v != null) el.textContent = v;
};

// ---------- 顶部导航 ----------
setText("logoText", cfg.logo);

const nav = $("navLinks");
const pages = [...document.querySelectorAll(".page")];
const track = $("pagesTrack");
const viewport = $("pagesViewport");
const navButtons = [];

// 导航项条数与 DOM 屏数可能不一致，取较小值钳位，避免读到 undefined
const navLinks = cfg.navLinks || [];
const pageCount = Math.min(pages.length, navLinks.length);

if (nav) {
  nav.innerHTML = "";
  navLinks.forEach((link, i) => {
    const a = document.createElement("a");
    a.className = "nav-link";
    a.textContent = link.label;
    a.dataset.page = link.page;
    // 单页模式：真锚点，浏览器天然产生 hash 与历史记录；独立页面：跳回首页对应屏
    a.href = track ? "#" + link.page : "index.html#" + link.page;
    // 独立页面（详情页等）上，判断当前该高亮哪一项
    if (!track && link.page === currentPageOnStandalonePage()) a.classList.add("active");
    nav.appendChild(a);
    navButtons.push(a);
  });
}

// 独立页面（详情页等）上，判断当前该高亮哪一项
function currentPageOnStandalonePage() {
  return "works";
}

// ---------- 滑动导航 ----------
let current = 0;
// 过渡动画期间禁止拖拽，否则轨道会被直接瞬移
let animating = false;
let animationTimer = 0;

function pageIndex(name) {
  return navLinks.findIndex((l) => l.page === name);
}

function pageWidth() {
  return viewport ? viewport.clientWidth : window.innerWidth;
}

function applyTransform(offsetPx) {
  if (!track) return;
  track.style.transform = `translate3d(${-current * pageWidth() + offsetPx}px, 0, 0)`;
}

function setActiveButton() {
  navButtons.forEach((b, i) => {
    const on = i === current;
    b.classList.toggle("active", on);
    // 无障碍：标记当前页
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

// 非当前屏设为 inert，避免 Tab 焦点走进屏幕外的作品卡片链接
function setInertPages() {
  pages.forEach((p, i) => {
    if (i === current) p.removeAttribute("inert");
    else p.setAttribute("inert", "");
  });
}

// 过渡结束（或超时兜底）后解除动画锁
function endAnimating(e) {
  // transitionend 会从子元素冒泡上来，这里只认轨道自身的 transform
  if (e && (e.target !== track || e.propertyName !== "transform")) return;
  if (animationTimer) clearTimeout(animationTimer);
  animationTimer = 0;
  if (track) track.removeEventListener("transitionend", endAnimating);
  animating = false;
}

function goTo(i, animate = true) {
  if (!track) return;
  const prev = current;
  current = Math.max(0, Math.min(i, pageCount - 1));
  const changed = current !== prev;
  if (!animate) {
    // 初始定位：临时关掉过渡 → 写 transform → 强制重排 → 交还给样式表，
    // 这样不会先播放一次滑入动画（比拖拽类切换更确定）
    track.style.transition = "none";
    applyTransform(0);
    void track.offsetWidth;
    track.style.transition = "";
    animating = false;
  } else {
    applyTransform(0);
    // 加动画锁：动画期间不接受新手势；位置没变化时不会有过渡，不必上锁
    if (changed) {
      animating = true;
      clearTimeout(animationTimer);
      track.addEventListener("transitionend", endAnimating);
      animationTimer = setTimeout(endAnimating, 750);
    }
  }
  setActiveButton();
  setInertPages();
  if (changed) {
    // 切换页面时把纵向滚动位置重置到顶部
    window.scrollTo(0, 0);
    // 旧浏览器上 .pages-viewport 会变成纵向滚动容器，那时 window.scrollTo 是空操作
    if (viewport) viewport.scrollTop = 0;
  }
  // 通知其他模块（如作品页懒加载）
  document.dispatchEvent(
    new CustomEvent("pagechange", { detail: { index: current, page: (navLinks[current] || {}).page } })
  );
}

// resize 加防抖，避免拖动窗口时反复重排
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => applyTransform(0), 120);
});

// ---------- hash 路由：锚点点击 / 前进后退 / 分享链接 ----------
function pageFromHash() {
  const name = (location.hash || "").replace("#", "");
  // hash 为空时落到第一屏（从 #works 后退回无 hash 的 index.html 时也会走这里）
  if (!name) return 0;
  return pageIndex(name);
}

window.addEventListener("hashchange", () => {
  const i = pageFromHash();
  // 索引越界（或未知 page）时忽略本次事件
  if (i < 0 || i >= pageCount) return;
  // 这里不写 hash：锚点与浏览器历史已经记录了，重复写会破坏后退语义
  goTo(i);
});

// 支持 index.html#works 这种直接定位
if (track && pageCount) {
  const startIdx = pageFromHash();
  goTo(startIdx >= 0 ? startIdx : 0, false);
}

// ---------- 左右滑动 / 拖拽手势 ----------
if (viewport && track) {
  let activeId = null, startX = 0, startY = 0, dx = 0, dragging = false, lockedAxis = null;

  viewport.addEventListener("pointerdown", (e) => {
    // 只在触摸/鼠标左键时启用，且不打断正在进行的动画
    if (e.button !== undefined && e.button !== 0) return;
    if (animating) return;
    // 已有手指按下时忽略第二根
    if (activeId !== null) return;
    activeId = e.pointerId;
    lockedAxis = null;
    dragging = false;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    // 立刻捕获指针：捕获期间 pointerleave 不会误触发，手势不会「刚移出元素就被静默吃掉」
    try {
      viewport.setPointerCapture(e.pointerId);
    } catch (err) { /* 个别浏览器不支持时忽略 */ }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (activeId === null || e.pointerId !== activeId) return;
    const mx = e.clientX - startX;
    const my = e.clientY - startY;
    // 判断主方向：纵向滚动优先，避免页面上下滚动被劫持
    if (lockedAxis === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      lockedAxis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
    }
    // 先判为纵向，但随后出现明显横向位移时重新接管为横向
    if (lockedAxis === "y" && Math.abs(mx) > Math.abs(my) * 1.5 && Math.abs(mx) > 16) lockedAxis = "x";
    if (lockedAxis === "y") return;
    // 只有进入横向拖拽才挂 .dragging（跟手，去掉过渡动画）
    if (!dragging) {
      dragging = true;
      track.classList.add("dragging");
    }
    dx = mx;
    // 首尾越界时加阻尼
    if ((current === 0 && dx > 0) || (current === pageCount - 1 && dx < 0)) dx *= 0.35;
    applyTransform(dx);
  });

  function endDrag(e) {
    // 其它指针（如已结束的第二根手指）的事件直接忽略
    if (e && e.pointerId !== activeId) return;
    if (activeId === null) return;
    activeId = null;
    // 还没真正拖动（可能是纵向滚动/点按）时，不改动位置
    if (!dragging) return;
    dragging = false;
    track.classList.remove("dragging");
    const moved = dx;
    dx = 0;
    const threshold = Math.min(90, pageWidth() * 0.18);
    if (moved < -threshold && current < pageCount - 1) goTo(current + 1);
    else if (moved > threshold && current > 0) goTo(current - 1);
    else applyTransform(0);
  }

  viewport.addEventListener("pointerleave", (e) => {
    // 还在跟手时指针移出元素：交给捕获的 pointermove 继续处理
    if (!dragging) return;
    endDrag(e);
  });
  // pointerup / pointercancel 挂在 window 上做兜底，即使捕获失败也能正确收尾
  window.addEventListener("pointerup", (e) => {
    if (e.pointerId === activeId) endDrag(e);
  });
  window.addEventListener("pointercancel", (e) => {
    if (e.pointerId === activeId) endDrag(e);
  });

  // 键盘左右方向键
  window.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    // 焦点在输入控件内时不接管方向键
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    goTo(e.key === "ArrowRight" ? current + 1 : current - 1);
  });
}

// ---------- 首页内容 ----------
const avatar = $("avatar");
if (avatar && cfg.avatar) avatar.src = cfg.avatar;
setText("name", cfg.name);
setText("tagline", cfg.tagline);
setText("bio", cfg.bio);
setText("statusText", cfg.status);

// favicon 跟随配置里的头像
const favicon = $("favicon");
if (favicon && cfg.avatar) favicon.href = cfg.avatar;

// ---------- 关于页内容 ----------
const about = cfg.about || {};
const aboutBody = $("aboutBody");
if (aboutBody) {
  setText("aboutTitle", about.title);
  for (const p of about.paragraphs || []) {
    const el = document.createElement("p");
    el.className = "about-p";
    el.textContent = p;
    aboutBody.appendChild(el);
  }
  const links = $("aboutLinks");
  if (links) {
    for (const l of about.links || []) {
      const a = document.createElement("a");
      a.className = "dl-btn";
      a.href = l.href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = l.label;
      links.appendChild(a);
    }
  }
}

// ---------- 页脚 ----------
setText("footerText", cfg.footer);

// ---------- 深浅色切换（带加长的过渡动画） ----------
const root = document.documentElement;
const toggle = $("themeToggle");
let themeTimer = 0;
if (toggle) {
  toggle.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    // 隐私模式下 setItem 会抛错，不能让它拦住换肤
    try {
      localStorage.setItem("theme", next);
    } catch (e) { /* 记不住就记不住 */ }
    // 快速连点时先清掉上一次的定时器，避免第二次过渡被提前截断
    clearTimeout(themeTimer);
    root.classList.add("theme-animating");
    themeTimer = setTimeout(() => root.classList.remove("theme-animating"), 1200);
  });
}
