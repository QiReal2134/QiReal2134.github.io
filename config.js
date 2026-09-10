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

  // 顶部导航（三屏对应三个 page，左右滑动切换）
  navLinks: [
    { label: "首页", page: "home" },
    { label: "作品", page: "works" },
    { label: "关于", page: "about" },
  ],

  // 关于页内容
  about: {
    title: "关于我",
    paragraphs: [
      "你好，我是 Qireal，一名喜欢折腾技术的开发者。平时喜欢研究各种工具、写点小项目，也喜欢把过程中踩过的坑和学到的东西记下来。",
      "这个站点是我自己手写的一个纯静态页面，没有用任何框架。它自动同步我的 GitHub 公开仓库，所以你在「作品」里看到的内容都是实时更新的。",
      "如果你对我的项目感兴趣，或者想交流点什么，欢迎通过下面的方式找到我。",
    ],
    // 关于页的链接按钮（可增删改）
    links: [
      { label: "GitHub", href: "https://github.com/QiReal2134" },
      { label: "给我发邮件", href: "mailto:qireal2134@gmail.com" },
    ],
  },

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

    // 是否展示卡片背景图（false = 只显示仓库名和描述，不请求任何图片）
    showCardImage: false,

    // 是否展示作品详情页顶部的大图
    showDetailImage: false,

    // 仓库卡片背景图：自动在仓库的 /png 目录下按顺序找这些文件名
    // （仅在 showCardImage 为 true 时生效）
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
