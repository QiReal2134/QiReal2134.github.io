// 临时静态文件服务器，仅用于本地预览
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    // 整个请求处理体包一层 try/catch：fs.readFile 的参数校验异常是同步抛的，
    // 光靠回调里的 err 分支拦不住，会直接把进程带走
    try {
      let urlPath;
      try {
        urlPath = decodeURIComponent(req.url.split("?")[0]);
      } catch (err) {
        // 畸形百分号编码（如 /%E0%A4%A）会让 decodeURIComponent 抛 URIError
        res.writeHead(400);
        return res.end("Bad Request");
      }
      // NUL 字节会让 fs.readFile 同步抛 ERR_INVALID_ARG_VALUE
      if (urlPath.includes("\0")) {
        res.writeHead(400);
        return res.end("Bad Request");
      }
      const filePath = path.join(root, urlPath === "/" ? "index.html" : urlPath);
      // 用相对路径判定越界：字符串前缀比较会被 HumanBlog-backup / HumanBlog.old
      // 这类同前缀的兄弟目录绕过
      const rel = path.relative(root, filePath);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end("Not Found");
        }
        res.writeHead(200, {
          "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
          "Content-Length": data.length,
          "Cache-Control": "no-cache",
        });
        res.end(data);
      });
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    }
  })
  .listen(8642, () => console.log("Serving on http://localhost:8642"));
