// 通用逻辑：根据站点配置填充页面公共部分 + 深浅色切换
const cfg = window.SITE_CONFIG;

// Logo（各页面都有）
const logoText = document.getElementById("logoText");
if (logoText) logoText.textContent = cfg.logo;

// 导航链接
const nav = document.getElementById("navLinks");
if (nav) {
  nav.innerHTML = "";
  for (const link of cfg.navLinks) {
    const a = document.createElement("a");
    a.className = "nav-link";
    a.href = link.href;
    a.textContent = link.label;
    nav.appendChild(a);
  }
}

// 页脚（各页面都有）
const footerText = document.getElementById("footerText");
if (footerText) footerText.textContent = cfg.footer;

// 首页专属内容
const nameEl = document.getElementById("name");
if (nameEl) {
  document.getElementById("avatar").src = cfg.avatar;
  nameEl.textContent = cfg.name;
  document.getElementById("tagline").textContent = cfg.tagline;
  document.getElementById("bio").textContent = cfg.bio;
  document.getElementById("statusText").textContent = cfg.status;
}

// 深浅色切换（带加长的过渡动画）
const root = document.documentElement;
const toggle = document.getElementById("themeToggle");
if (toggle) {
  toggle.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    localStorage.setItem("theme", next);

    // 给 1.2 秒的全局颜色过渡窗口，让切换更柔和
    root.classList.add("theme-animating");
    setTimeout(() => root.classList.remove("theme-animating"), 1200);
  });
}
