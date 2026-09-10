// 单个作品页：读取 ?repo= 参数 → 仓库信息 + Release 更新日志 + 下载按钮
// 缓存策略：首次加载后整体缓存，下次先渲染缓存再后台刷新
(function () {
  const siteCfg = window.SITE_CONFIG || {};
  const cfg = siteCfg.works || {};
  const user = cfg.githubUser;
  const imgNames = cfg.cardImageNames || ["background.png"];
  const fallbackImg = cfg.cardFallbackImage || "avatar.jpg";
  const showDetailImage = cfg.showDetailImage !== false;
  const CACHE_VERSION = cfg.cacheVersion || 1;
  // 背景图探测失败后的负缓存时长：24 小时内不再重复探测
  const MISS_MS = 24 * 60 * 60 * 1000;
  // ?repo= 会被拼进 API 路径，用白名单限制字符集（防路径改写与注入）
  const REPO_RE = /^[A-Za-z0-9._-]+$/;

  // DOM 引用统一放在文件顶部：下面的参数校验分支会提前 return，
  // 引用若放在后面会踩到 const 的 TDZ
  const nameEl = document.getElementById("workName");
  const descEl = document.getElementById("workDesc");
  const metaEl = document.getElementById("workMeta");
  const dlEl = document.getElementById("dlButtons");
  const logEl = document.getElementById("changelog");
  const bgEl = document.getElementById("workBg");

  const params = new URLSearchParams(location.search);
  const repo = params.get("repo");

  // 隐藏顶部大图（未指定作品/参数不合法/请求失败时都要隐藏，避免留一个空盒子）
  function hideHero() {
    const hero = document.querySelector(".work-hero");
    if (hero) hero.style.display = "none";
  }

  // 错误提示：err.message 属于外部文本，必须用 textContent 赋值
  function showError(msg) {
    logEl.innerHTML = "";
    const box = document.createElement("div");
    box.className = "release-empty";
    box.textContent = msg;
    logEl.appendChild(box);
  }

  // 参数校验：不合法就直接退出，绝不拿它去拼 API 路径
  if (!repo || !REPO_RE.test(repo)) {
    nameEl.textContent = "未指定作品";
    descEl.textContent = "请从作品列表进入。";
    hideHero();
    showError("请从作品列表进入，查看作品的更新日志与下载。");
    return;
  }

  const CACHE_KEY = "work_page_v" + CACHE_VERSION + "_" + user + "_" + repo;

  // 不展示大图时提前隐藏，成功路径之外（无缓存且请求失败）也能生效
  if (!showDetailImage) hideHero();

  function imageExists(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  // GitHub 匿名接口的限流响应头 → 可读中文提示
  function rateLimitMessage(r) {
    const reset = Number(r.headers.get("X-RateLimit-Reset"));
    if (Number.isFinite(reset) && reset > 0) {
      const mins = Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000));
      return "GitHub 接口次数已用完，约 " + mins + " 分钟后再试。";
    }
    return "GitHub 接口次数已用完，请稍后再试。";
  }

  // 403/429 且配额已耗尽：重试必然失败
  function isRateLimited(r) {
    return (
      (r.status === 403 || r.status === 429) &&
      r.headers.get("X-RateLimit-Remaining") === "0"
    );
  }

  // 带一次重试的 fetch(应对 GitHub 突发限流 403)
  async function fetchRetry(url) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    // 限流耗尽时直接给出「还要等多久」，不做无意义的 1.5 秒重试
    if (isRateLimited(r)) throw new Error(rateLimitMessage(r));
    if (r.status === 403 || r.status === 429 || r.status >= 500) {
      await new Promise((res) => setTimeout(res, 1500));
      const r2 = await fetch(url);
      if (r2.ok) return r2.json();
      if (isRateLimited(r2)) throw new Error(rateLimitMessage(r2));
      throw new Error("HTTP " + r2.status);
    }
    throw new Error("HTTP " + r.status);
  }

  // 读取背景图缓存（字段：cache.bg = 绝对 URL 或 ""，cache.bgMiss = 探测失败时间戳）
  // 返回 undefined 表示需要重新探测
  function readBgCache(cache) {
    if (!cache || typeof cache !== "object") return undefined;
    // 24 小时内的负缓存命中：直接用默认图
    if (cache.bgMiss && Date.now() - cache.bgMiss < MISS_MS) return fallbackImg;
    // 正向缓存命中（旧缓存可能把默认图当命中存过，这种不算数，允许重新探测）
    if (typeof cache.bg === "string" && cache.bg && cache.bg !== fallbackImg) return cache.bg;
    return undefined;
  }

  // 注意：另一份实现在 works.js 的 findBackground，改这里要同步改那边
  async function findBackground(branch, cache) {
    const br = branch || "main";
    const store = cache && typeof cache === "object" ? cache : {};
    const hit = readBgCache(store);
    if (hit !== undefined) return hit;
    for (const name of imgNames) {
      const url = `https://raw.githubusercontent.com/${user}/${repo}/${br}/png/${name}`;
      if (await imageExists(url)) {
        store.bg = url;
        store.bgMiss = 0;
        return url;
      }
    }
    // 全部失败：写负缓存（24 小时后允许重新探测，仓库后补图片也能被发现）
    store.bg = "";
    store.bgMiss = Date.now();
    return fallbackImg;
  }

  function fmtDate(iso) {
    return (iso || "").slice(0, 10) || "未知日期";
  }

  // 极简 Markdown：链接 / 加粗 / 行内代码，其余按纯文本+换行保留
  // 只有本函数的输出才允许赋给 innerHTML：
  // URL 字符类排除引号/尖括号/反斜杠，防止 [x](https://a"onmouseover="...) 逃逸出属性
  function renderMarkdown(text) {
    return String(text || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\[([^\]]+)\]\((https?:[^)\s"'<>\\]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function downloadButton(label, url, primary) {
    const a = document.createElement("a");
    a.className = "dl-btn" + (primary ? " primary" : "");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = label;
    return a;
  }

  // 用 DOM API 构建 Release 卡片：Release 名/tag/日期都是 GitHub 原样返回的自由文本，
  // 只有 renderMarkdown 的受控输出可以进 innerHTML，其余一律 textContent
  function releaseCard(rel) {
    const item = document.createElement("div");
    item.className = "release";

    const head = document.createElement("div");
    head.className = "release-head";
    const nameSpan = document.createElement("span");
    nameSpan.className = "release-name";
    nameSpan.textContent = rel.name || rel.tag;
    const dateSpan = document.createElement("span");
    dateSpan.className = "release-date";
    dateSpan.textContent = rel.date;
    head.appendChild(nameSpan);
    head.appendChild(dateSpan);

    const body = document.createElement("div");
    body.className = "release-body";
    body.innerHTML = renderMarkdown(rel.body || "（无更新说明）");

    item.appendChild(head);
    item.appendChild(body);
    return item;
  }

  function renderAll(data) {
    const info = (data && data.info) || {};
    const repoName = info.name || repo;
    // 站点名从 config 读，空的话只显示仓库名
    document.title = siteCfg.name ? repoName + " · " + siteCfg.name : repoName;
    nameEl.textContent = repoName;
    descEl.textContent = info.description || "暂无描述";
    if (showDetailImage && bgEl) {
      bgEl.src = data.bg || fallbackImg;
    } else {
      hideHero();
    }

    metaEl.innerHTML = "";
    const chips = [
      info.language && "语言：" + info.language,
      info.stars != null && "★ " + info.stars,
      info.pushed_at && "更新于 " + info.pushed_at,
    ].filter(Boolean);
    for (const c of chips) {
      const s = document.createElement("span");
      s.className = "meta-chip";
      s.textContent = c;
      metaEl.appendChild(s);
    }

    dlEl.innerHTML = "";
    logEl.innerHTML = "";

    const releases = (data && data.releases) || [];
    if (!releases.length) {
      dlEl.appendChild(
        downloadButton("前往 GitHub 下载", info.html_url + "/releases", true)
      );
      const empty = document.createElement("div");
      empty.className = "release-empty";
      empty.textContent = "该仓库还没有发布过 Release。";
      logEl.appendChild(empty);
      return;
    }

    const latest = releases[0];
    const assets = latest.assets || [];
    dlEl.appendChild(
      downloadButton(
        assets.length
          ? `下载最新版 ${latest.tag}`
          : `最新版 ${latest.tag}（无附件，去 Releases 页）`,
        assets.length ? assets[0].url : info.html_url + "/releases",
        true
      )
    );
    for (const asset of assets.slice(1)) {
      dlEl.appendChild(downloadButton(asset.name, asset.url, false));
    }
    // 旧缓存只有 default_branch 字段，这里做兼容读取，避免拼出 heads/undefined.zip
    const branch = info.branch || info.default_branch || "main";
    dlEl.appendChild(
      downloadButton("源码 zip", `https://github.com/${user}/${repo}/archive/refs/heads/${branch}.zip`, false)
    );
    dlEl.appendChild(downloadButton("全部 Release", info.html_url + "/releases", false));

    for (const rel of releases) {
      logEl.appendChild(releaseCard(rel));
    }
  }

  async function load() {
    // 1. 缓存形状正常才先渲染（形状不对直接丢弃，否则会崩在渲染里、坏缓存永久留存）
    let data = null;
    try {
      const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (raw && raw.info && Array.isArray(raw.releases)) data = raw;
    } catch (e) { /* 缓存损坏则忽略 */ }
    if (data) renderAll(data);
    else nameEl.textContent = repo;

    try {
      // 2. 后台刷新：仓库信息与 Release 列表互不依赖，并发请求省一次往返
      const repoUrl = `https://api.github.com/repos/${user}/${repo}`;
      const releasesUrl = `https://api.github.com/repos/${user}/${repo}/releases?per_page=20`;
      const [info, releasesRaw] = await Promise.all([
        fetchRetry(repoUrl),
        fetchRetry(releasesUrl),
      ]);
      const relList = Array.isArray(releasesRaw) ? releasesRaw : [];

      // 3. 图片探测依赖 default_branch，只能放在仓库信息之后；不显示大图时完全跳过
      const store = data && typeof data === "object" ? data : {};
      if (showDetailImage) await findBackground(info.default_branch, store);

      const fresh = {
        info: {
          name: info.name,
          description: info.description || "",
          language: info.language || "",
          stars: info.stargazers_count,
          pushed_at: (info.pushed_at || "").slice(0, 10),
          // 只写 branch 一个字段，避免与 default_branch 双写后取值不一致
          branch: info.default_branch,
          html_url: info.html_url,
        },
        // bg 存绝对 URL（没找到为 ""），bgMiss 存探测失败时间戳，两者配套使用
        bg: showDetailImage ? store.bg || "" : "",
        bgMiss: showDetailImage ? store.bgMiss || 0 : 0,
        // /releases 按创建时间倒序，先按 published_at 降序排一次，
        // 这样「先创建后发布」的 Release 也不会错位，releases[0] 才是最新版
        releases: relList
          .slice()
          .sort(
            (a, b) =>
              (Date.parse(b.published_at || "") || 0) -
              (Date.parse(a.published_at || "") || 0)
          )
          .map((r) => ({
            tag: r.tag_name,
            name: r.name,
            date: fmtDate(r.published_at),
            body: r.body || "",
            assets: (r.assets || []).map((a) => ({ name: a.name, url: a.browser_download_url })),
          })),
      };
      // setItem 单独包 try/catch：配额超限时新数据照样要渲染出来
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      } catch (e) { /* 写入失败忽略 */ }
      renderAll(fresh);
    } catch (err) {
      if (!data) {
        hideHero();
        showError(
          "加载失败：" + ((err && err.message) || "未知错误") + "，请稍后刷新重试。"
        );
      }
      // 有缓存时静默失败，保持缓存内容
    }
  }

  load();
})();
