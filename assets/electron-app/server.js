"use strict";

/**
 * 极简静态服务器：只服务本地镜像目录，带正确 MIME 与 Range 支持。
 * 端口随机，监听 127.0.0.1，避免和用户其他程序冲突。
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".ktx2": "image/ktx2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".hdr": "image/vnd.radiance",
  ".exr": "image/aces",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".bin": "application/octet-stream",
  ".data": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  if (body) res.end(body);
  else res.end();
}

function startStaticServer(rootDir, port = 0) {
  const root = path.resolve(rootDir);

  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let filePath = path.join(root, urlPath);

      // 防目录穿越
      if (!filePath.startsWith(root)) return send(res, 403, {}, "forbidden");

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      if (!fs.existsSync(filePath)) {
        // 单页应用回退：找不到就交给 index.html
        const fallback = path.join(root, "index.html");
        if (fs.existsSync(fallback)) filePath = fallback;
        else return send(res, 404, { "Content-Type": "text/plain" }, "not found");
      }

      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const headers = {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      };

      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m) {
          const start = m[1] ? parseInt(m[1], 10) : 0;
          const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
          headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
          headers["Content-Length"] = end - start + 1;
          res.writeHead(206, headers);
          return fs.createReadStream(filePath, { start, end }).pipe(res);
        }
      }

      headers["Content-Length"] = stat.size;
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      send(res, 500, { "Content-Type": "text/plain" }, String(err && err.message));
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const actual = server.address().port;
      resolve({
        url: `http://127.0.0.1:${actual}/`,
        port: actual,
        close: () => new Promise((r) => server.close(r)),
        server,
      });
    });
  });
}

module.exports = { startStaticServer };

// 允许直接 node server.js <dir> 预览
if (require.main === module) {
  const dir = process.argv[2] || ".";
  startStaticServer(dir).then((s) => console.log("serving", s.url));
}
