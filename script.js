// 根据站点配置填充页面内容
const cfg = window.SITE_CONFIG;

document.title = cfg.title;
document.getElementById("logoText").textContent = cfg.logo;
document.getElementById("avatar").src = cfg.avatar;
document.getElementById("name").textContent = cfg.name;
document.getElementById("tagline").textContent = cfg.tagline;
document.getElementById("bio").textContent = cfg.bio;
document.getElementById("statusText").textContent = cfg.status;
document.getElementById("footerText").textContent = cfg.footer;

// 导航链接
const nav = document.getElementById("navLinks");
nav.innerHTML = "";
for (const link of cfg.navLinks) {
  const a = document.createElement("a");
  a.className = "nav-link";
  a.href = link.href;
  a.textContent = link.label;
  nav.appendChild(a);
}

// 深浅色切换
const root = document.documentElement;
const toggle = document.getElementById("themeToggle");

toggle.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  localStorage.setItem("theme", next);
});
