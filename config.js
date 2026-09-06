// ===== 站点配置 =====
// 所有可自定义的内容都在这里改，改完保存刷新页面即可生效
window.SITE_CONFIG = {
  // 浏览器标签页标题
  title: "Qireal · 个人主页",

  // 左上角 Logo 文字
  logo: "HumanBlog",

  // 头像图片路径（换成自己的图片时，把图片放进项目目录再改这里）
  avatar: "avatar.jpg",

  // 名字
  name: "Qireal",

  // 一句话介绍
  tagline: "一名喜欢折腾技术的开发者。",

  // 详细简介
  bio: "这里是我的个人小站，记录学习笔记、项目与生活中的碎碎念。",

  // 状态行文字
  status: "当前状态：正在构建新东西…",

  // 导航链接（可增删改）
  navLinks: [
    { label: "首页", href: "index.html" },
    { label: "作品", href: "works.html" },
    { label: "关于", href: "#about" },
  ],

  // 页脚文字
  footer: "© 2026 Qireal · HumanBlog",

  // 默认主题："dark" 或 "light"（用户切换后会记住用户的选择）
  defaultTheme: "dark",

  // ===== 作品页设置 =====
  works: {
    // 自动拉取这个 GitHub 账号的所有公开仓库
    githubUser: "QiReal2134",

    // 不想展示的仓库（比如主页仓库本身）
    excludeRepos: ["QiReal2134.github.io"],

    // 是否展示 fork 来的仓库
    showForks: false,

    // 仓库卡片背景图：自动在仓库的 /png 目录下按顺序找这些文件名
    cardImageNames: ["background.png", "background.jpg", "background.jpeg", "background.webp"],

    // 仓库里没有背景图时显示的默认图
    cardFallbackImage: "avatar.jpg",
  },

  // ===== 雪花飘落动效 =====
  snow: {
    enabled: true,   // 改成 false 关闭雪花
    count: 70,       // 雪花数量
  },
};
