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
  const CACHE_VERSION = cfg.cacheVersion || 1;
  // 缓存 key 带上配置版本与账号：换账号/换配置后不会先渲染出上一个账号的缓存
  const CACHE_KEY =
    "works_json_cache_v" + CACHE_VERSION + "_" + user + "_" + (showCardImage ? "img" : "noimg");
  // 缓存新鲜期：这段时间内直接吃缓存，不再请求 GitHub（匿名 API 每小时只有 60 次）
  const FRESH_MS = 5 * 60 * 1000;
  // 背景图「没找到」的负缓存时长：过期后允许重新探测，仓库后补图片也能被发现
  const MISS_MS = 24 * 60 * 60 * 1000;

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

  // 读背景图缓存：命中 { url } 返回绝对 URL；{ miss } 未超 24 小时返回默认图；
  // 无记录或负缓存已过期返回 undefined，表示需要重新探测
  // 注意：另一份实现在 work.js 的 findBackground/readBgCache，改这里要同步改那边
  function readBgCache(cache, key) {
    const rec = cache[key];
    // 旧版本缓存里可能是字符串形状，类型对不上就当没有记录
    if (!rec || typeof rec !== "object") return undefined;
    if (rec.url) return rec.url;
    if (rec.miss && Date.now() - rec.miss < MISS_MS) return fallbackImg;
    return undefined;
  }

  async function findBackground(repo, branch, cache) {
    // 分支为空时用 main 兜底，缓存 key 用 仓库名@分支
    const br = branch || "main";
    const key = repo + "@" + br;
    const hit = readBgCache(cache, key);
    if (hit !== undefined) return hit;
    for (const name of imgNames) {
      const url = `https://raw.githubusercontent.com/${user}/${repo}/${br}/png/${name}`;
      if (await imageExists(url)) {
        cache[key] = { url: url };
        return url;
      }
    }
    // 全部失败：写负缓存（而不是把默认图当成命中，否则永远不再探测）
    cache[key] = { miss: Date.now() };
    return fallbackImg;
  }

  // 缓存是否仍在新鲜期内（updated_at 缺失或非法一律视为不新鲜）
  function isFresh(data) {
    const ts = Date.parse((data && data.updated_at) || "");
    if (!Number.isFinite(ts)) return false;
    const age = Date.now() - ts;
    return age >= 0 && age < FRESH_MS;
  }

  async function loadWorks() {
    // 先取本地缓存的 JSON：形状不对（旧版本残留/被改坏）一律丢弃，否则渲染时会崩
    let data = null;
    try {
      const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (raw && Array.isArray(raw.repos)) data = raw;
    } catch (e) { /* 缓存损坏则忽略 */ }

    if (data) {
      render(data);
      // 新鲜期内直接用缓存，不再请求 GitHub（省匿名配额的关键）
      if (isFresh(data)) return;
    }

    try {
      // 后台刷新：拉取全部公开仓库
      const repos = await fetch(
        `https://api.github.com/users/${user}/repos?per_page=100&sort=updated`
      ).then((r) => {
        if (!r.ok) throw new Error("GitHub API " + r.status);
        return r.json();
      });
      if (!Array.isArray(repos)) throw new Error("GitHub API 返回格式异常");

      // 短路顺序：先判断是否需要过滤，再判断是否在排除名单里
      const picked = repos.filter(
        (r) => showForks || !r.fork
      ).filter(
        (r) => !exclude.includes(r.name)
      );

      // 并发探测所有卡片的背景图（不需要图片时完全跳过，省流量省请求）
      const imgCache =
        data && data.images && typeof data.images === "object" ? data.images : {};
      if (showCardImage) {
        await Promise.all(
          picked.map(async (r) => {
            r.cardImage = await findBackground(r.name, r.default_branch, imgCache);
          })
        );
      }

      // 组装 JSON 并缓存
      const fresh = {
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
      data = fresh;
      // 写缓存单独包 try/catch：配额超限或隐私模式不该影响已经取回的数据
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      } catch (e) { /* 写入失败忽略 */ }
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
    const repos = (data && data.repos) || [];
    if (!repos.length) {
      grid.innerHTML = '<div class="works-loading">还没有公开仓库。</div>';
      return;
    }
    grid.innerHTML = "";
    for (const r of repos) {
      const a = document.createElement("a");
      a.className = "work-card" + (showCardImage ? "" : " no-image");
      a.href = "work.html?repo=" + encodeURIComponent(r.name);
      // 用 DOM API 构建卡片：仓库名/描述是外部文本，只能走 textContent，
      // 属性也用赋值（不经过 HTML 解析），彻底消除注入面
      if (showCardImage) {
        const imgWrap = document.createElement("div");
        imgWrap.className = "work-card-img";
        const img = document.createElement("img");
        img.src = r.cardImage || fallbackImg;
        img.alt = r.name + " 背景图";
        img.loading = "lazy";
        imgWrap.appendChild(img);
        a.appendChild(imgWrap);
      }
      const body = document.createElement("div");
      body.className = "work-card-body";
      const nameDiv = document.createElement("div");
      nameDiv.className = "work-card-name";
      nameDiv.textContent = r.name;
      const descDiv = document.createElement("div");
      descDiv.className = "work-card-desc";
      descDiv.textContent = r.description || "暂无描述";
      body.appendChild(nameDiv);
      body.appendChild(descDiv);
      a.appendChild(body);
      grid.appendChild(a);
    }
  }

  // 首次切到作品屏时才加载（加快首屏）
  function startOnce() {
    if (started) return;
    started = true;
    loadWorks().catch(() => {
      grid.innerHTML =
        '<div class="works-loading">GitHub 加载失败，请稍后刷新重试。</div>';
    });
  }

  document.addEventListener("pagechange", (e) => {
    if (e.detail && e.detail.page === "works") startOnce();
  });

  // 如果打开时就直接落在作品屏，立即加载
  if ((location.hash || "").replace("#", "") === "works") startOnce();
  // 兜底：3 秒后事件若仍未到，且当前确实在作品屏才加载
  // （不要在首页就无条件请求 GitHub，那会击穿懒加载并白耗匿名配额）
  setTimeout(() => {
    if ((location.hash || "").replace("#", "") === "works") startOnce();
  }, 3000);
})();
