// 作品列表：自动拉取 GitHub 公开仓库 → 组装 JSON（含卡片背景图探测）→ 渲染
// 缓存策略：先渲染缓存，再后台刷新；首次进入作品屏时才发起请求
(function () {
  const cfg = (window.SITE_CONFIG || {}).works || {};
  const user = cfg.githubUser;
  const grid = document.getElementById("worksGrid");
  if (!grid || !user) return;

  const exclude = cfg.excludeRepos || [];
  const showForks = !!cfg.showForks;
  const showCardImage = cfg.showCardImage !== false;
  const imgNames = cfg.cardImageNames || ["background.png"];
  const fallbackImg = cfg.cardFallbackImage || "avatar.jpg";
  const CACHE_KEY = "works_json_cache_" + (showCardImage ? "img" : "noimg");

  let started = false;

  // 从仓库 /png 目录探测卡片背景图
  function imageExists(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  async function findBackground(repo, branch, cache) {
    const key = repo + "@" + branch;
    if (cache[key]) return cache[key];
    for (const name of imgNames) {
      const url = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/png/${name}`;
      if (await imageExists(url)) {
        cache[key] = url;
        return url;
      }
    }
    cache[key] = fallbackImg;
    return fallbackImg;
  }

  async function loadWorks() {
    // 先取本地缓存的 JSON，有就立即渲染
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch (e) { /* 缓存损坏则忽略 */ }
    if (data) render(data);

    try {
      // 后台刷新：拉取全部公开仓库
      const repos = await fetch(
        `https://api.github.com/users/${user}/repos?per_page=100&sort=updated`
      ).then((r) => {
        if (!r.ok) throw new Error("GitHub API " + r.status);
        return r.json();
      });

      const picked = repos.filter(
        (r) => !r.fork || showForks
      ).filter(
        (r) => !exclude.includes(r.name)
      );

      // 并发探测所有卡片的背景图（不需要图片时完全跳过，省流量省请求）
      const imgCache = (data && data.images) || {};
      if (showCardImage) {
        await Promise.all(
          picked.map(async (r) => {
            r.cardImage = await findBackground(r.name, r.default_branch, imgCache);
          })
        );
      }

      // 组装 JSON 并缓存
      data = {
        updated_at: new Date().toISOString(),
        images: imgCache,
        repos: picked.map((r) => ({
          name: r.name,
          description: r.description || "",
          url: r.html_url,
          homepage: r.homepage || "",
          language: r.language || "",
          stars: r.stargazers_count,
          pushed_at: (r.pushed_at || "").slice(0, 10),
          cardImage: r.cardImage,
        })),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      if (!data) {
        grid.innerHTML =
          '<div class="works-loading">GitHub 加载失败，请稍后刷新重试。</div>';
        return;
      }
      // 网络失败时已有缓存展示，不打扰用户
    }
    render(data);
  }

  function render(data) {
    if (!data.repos.length) {
      grid.innerHTML = '<div class="works-loading">还没有公开仓库。</div>';
      return;
    }
    grid.innerHTML = "";
    for (const r of data.repos) {
      const a = document.createElement("a");
      a.className = "work-card" + (showCardImage ? "" : " no-image");
      a.href = "work.html?repo=" + encodeURIComponent(r.name);
      a.innerHTML = `
        ${showCardImage ? `<div class="work-card-img"><img src="${r.cardImage}" alt="${r.name} 背景图" loading="lazy"></div>` : ""}
        <div class="work-card-body">
          <div class="work-card-name">${r.name}</div>
          <div class="work-card-desc">${r.description || "暂无描述"}</div>
        </div>`;
      grid.appendChild(a);
    }
  }

  // 首次切到作品屏时才加载（加快首屏）
  function startOnce() {
    if (started) return;
    started = true;
    loadWorks();
  }

  document.addEventListener("pagechange", (e) => {
    if (e.detail && e.detail.page === "works") startOnce();
  });

  // 如果打开时就直接落在作品屏，立即加载
  if ((location.hash || "").replace("#", "") === "works") startOnce();
  // 兜底：3 秒后仍未加载则直接加载（避免事件时序问题）
  setTimeout(startOnce, 3000);
})();
