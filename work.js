// 单个作品页：读取 ?repo= 参数 → 仓库信息 + Release 更新日志 + 下载按钮
// 缓存策略：首次加载后整体缓存，下次先渲染缓存再后台刷新
(function () {
  const cfg = (window.SITE_CONFIG || {}).works || {};
  const user = cfg.githubUser;
  const imgNames = cfg.cardImageNames || ["background.png"];
  const fallbackImg = cfg.cardFallbackImage || "avatar.jpg";

  const params = new URLSearchParams(location.search);
  const repo = params.get("repo");
  const nameEl = document.getElementById("workName");
  const CACHE_KEY = "work_page_" + repo;
  if (!repo) {
    nameEl.textContent = "未指定作品";
    document.getElementById("changelog").innerHTML =
      '<div class="release-empty">请从作品列表进入。</div>';
    return;
  }

  function imageExists(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  // 带一次重试的 fetch(应对 GitHub 突发限流 403)
  async function fetchRetry(url) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    if (r.status === 403 || r.status === 429 || r.status >= 500) {
      await new Promise((res) => setTimeout(res, 1500));
      const r2 = await fetch(url);
      if (r2.ok) return r2.json();
      throw new Error("HTTP " + r2.status);
    }
    throw new Error("HTTP " + r.status);
  }

  async function findBackground(branch, cache) {
    const key = repo + "@" + branch;
    if (cache.bg) return cache.bg;
    for (const name of imgNames) {
      const url = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/png/${name}`;
      if (await imageExists(url)) {
        cache.bg = url;
        return url;
      }
    }
    cache.bg = fallbackImg;
    return fallbackImg;
  }

  function fmtDate(iso) {
    return (iso || "").slice(0, 10) || "未知日期";
  }

  // 极简 Markdown：链接 / 加粗 / 行内代码，其余按纯文本+换行保留
  function renderMarkdown(text) {
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
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

  function renderAll(data) {
    const info = data.info;
    document.title = `${info.name} · Qireal`;
    nameEl.textContent = info.name;
    document.getElementById("workDesc").textContent = info.description || "暂无描述";
    document.getElementById("workBg").src = data.bg;

    const meta = document.getElementById("workMeta");
    meta.innerHTML = "";
    const chips = [
      info.language && "语言：" + info.language,
      "★ " + info.stars,
      info.pushed_at && "更新于 " + info.pushed_at,
    ].filter(Boolean);
    for (const c of chips) {
      const s = document.createElement("span");
      s.className = "meta-chip";
      s.textContent = c;
      meta.appendChild(s);
    }

    const dlArea = document.getElementById("dlButtons");
    dlArea.innerHTML = "";
    const log = document.getElementById("changelog");
    log.innerHTML = "";

    const releases = data.releases || [];
    if (!releases.length) {
      dlArea.appendChild(
        downloadButton("前往 GitHub 下载", info.html_url + "/releases", true)
      );
      log.innerHTML =
        '<div class="release-empty">该仓库还没有发布过 Release。</div>';
      return;
    }

    const latest = releases[0];
    dlArea.appendChild(
      downloadButton(
        latest.assets.length
          ? `下载最新版 ${latest.tag}`
          : `最新版 ${latest.tag}（无附件，去 Releases 页）`,
        latest.assets.length ? latest.assets[0].url : info.html_url + "/releases",
        true
      )
    );
    for (const asset of latest.assets.slice(1)) {
      dlArea.appendChild(downloadButton(asset.name, asset.url, false));
    }
    dlArea.appendChild(
      downloadButton("源码 zip", `https://github.com/${user}/${repo}/archive/refs/heads/${info.branch}.zip`, false)
    );
    dlArea.appendChild(downloadButton("全部 Release", info.html_url + "/releases", false));

    for (const rel of releases) {
      const item = document.createElement("div");
      item.className = "release";
      item.innerHTML = `
        <div class="release-head">
          <span class="release-name">${rel.name || rel.tag}</span>
          <span class="release-date">${rel.date}</span>
        </div>
        <div class="release-body">${renderMarkdown(rel.body || "（无更新说明）")}</div>`;
      log.appendChild(item);
    }
  }

  async function load() {
    // 1. 有缓存先渲染
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch (e) { /* 缓存损坏则忽略 */ }
    if (data) renderAll(data);
    else nameEl.textContent = repo;

    try {
      // 2. 后台刷新
      const info = await fetchRetry(`https://api.github.com/repos/${user}/${repo}`);
      const releasesRaw = await fetchRetry(
        `https://api.github.com/repos/${user}/${repo}/releases?per_page=20`
      );
      const bg = await findBackground(info.default_branch, data || {});

      const fresh = {
        info: {
          name: info.name,
          description: info.description || "",
          language: info.language || "",
          stars: info.stargazers_count,
          pushed_at: (info.pushed_at || "").slice(0, 10),
          default_branch: info.default_branch,
          branch: info.default_branch,
          html_url: info.html_url,
        },
        bg,
        releases: releasesRaw.map((r) => ({
          tag: r.tag_name,
          name: r.name,
          date: fmtDate(r.published_at),
          body: r.body || "",
          assets: (r.assets || []).map((a) => ({ name: a.name, url: a.browser_download_url })),
        })),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      renderAll(fresh);
    } catch (err) {
      if (!data) {
        document.getElementById("changelog").innerHTML =
          '<div class="release-empty">加载失败：' + err.message + "，请稍后刷新重试。</div>";
      }
      // 有缓存时静默失败，保持缓存内容
    }
  }

  load();
})();
