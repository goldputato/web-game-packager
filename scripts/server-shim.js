"use strict";

/**
 * 让验证脚本复用工程里的 app/server.js；没有工程时退回 skill 自带副本。
 */

const fs = require("node:fs");
const path = require("node:path");

function resolveServer() {
  const candidates = [
    path.join(process.cwd(), "app", "server.js"),
    path.join(__dirname, "..", "assets", "electron-app", "server.js"),
    path.join(__dirname, "..", "..", "app", "server.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error("server.js not found; run new-project.py first");
}

module.exports = require(resolveServer());
