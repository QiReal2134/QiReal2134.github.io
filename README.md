# HumanBlog

一个纯静态的个人主页：灵动岛导航、深浅色主题切换、黑灰渐变背景。无任何框架和构建工具。

**在线访问**：https://qireal2134.github.io/ （GitHub Pages 个人主页，main 分支推送后自动部署）

## 自定义

所有可修改的内容都集中在 [config.js](config.js) 一个文件里：站点标题、Logo、头像路径、名字、介绍、状态、导航链接、页脚、默认主题。改完保存刷新即可，不需要动其他文件。

换头像：把自己的图片放进项目目录，然后修改 config.js 里的 `avatar` 路径。

## 本地预览

任选其一：

- 直接双击打开 `index.html`
- 或在项目目录运行 `node serve.js`，然后访问 http://localhost:8642

## 文件结构

```
index.html   页面结构
style.css    样式（含深浅两套主题变量）
config.js    ★ 所有可自定义内容
script.js    填充配置 + 主题切换逻辑
avatar.jpg   头像图片
serve.js     本地预览小服务器（可选）
```
