const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 5599;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

http
  .createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const target = path.join(root, rel === "/" ? "index.html" : rel);
    if (!target.startsWith(root)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, () => console.log(`serving on http://localhost:${port}`));
