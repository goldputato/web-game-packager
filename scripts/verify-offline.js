"use strict";

/**
 * 离线验证：把镜像目录跑起来，看有没有资源缺失、控制台报错、画面是否正常。
 *
 * 用法:
 *   node verify-offline.js <dir> [--wait 45000] [--shot _offline]
 *
 * 判定标准:
 *   0 个失败请求 = 通过；
 *   只有字体 ERR_CACHE_MISS = 可接受（部分 PWA 用 only-if-cached 探测）；
 *   任何 .glb/.ktx2/.mp3/.wasm 的 404 = 失败。
 */

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { startStaticServer } = require(path.join(__dirname, "server-shim.js"));

const args = process.argv.slice(2).filter((a) => a !== ".");
const dir = path.resolve(args[0] || "site");
const getFlag = (n, d) => {
  const i = args.indexOf(n);
  return i < 0 ? d : args[i + 1];
};
const WAIT = parseInt(getFlag("--wait", "45000"), 10);
const SHOT = getFlag("--shot", "_offline");

app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");
app.commandLine.appendSwitch("enable-features", "Vulkan,WebGPU");

const failed = [];
const logs = [];

setTimeout(() => app.exit(2), WAIT + 90000);

app.whenReady().then(async () => {
  const srv = await startStaticServer(dir);
  const win = new BrowserWindow({
    width: 1600, height: 900, show: true, backgroundColor: "#000000",
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, autoplayPolicy: "no-user-gesture-required",
    },
  });

  win.webContents.session.webRequest.onErrorOccurred({ urls: ["*://*/*"] }, (d) => {
    if (d.url.startsWith(srv.url)) failed.push(`${d.error} ${d.url}`);
  });
  win.webContents.on("console-message", (...a) => {
    const e = a[0];
    const line = e && typeof e === "object" && "message" in e ? `${e.level}: ${e.message}` : `${a[1]}: ${a[2]}`;
    logs.push(line);
  });

  await win.loadURL(srv.url);
  win.show();
  win.focus();
  await new Promise((r) => setTimeout(r, WAIT));

  const shots = [];
  for (const tag of ["1", "2"]) {
    const img = await win.webContents.capturePage();
    const p = path.join(process.cwd(), `${SHOT}-${tag}.png`);
    fs.writeFileSync(p, img.toPNG());
    shots.push(p);
    if (tag === "1") {
      win.webContents.sendInputEvent({ type: "mouseDown", x: 800, y: 450, button: "left", clickCount: 1 });
      win.webContents.sendInputEvent({ type: "mouseUp", x: 800, y: 450, button: "left", clickCount: 1 });
      await new Promise((r) => setTimeout(r, 6000));
    }
  }

  const state = await win.webContents.executeJavaScript(
    `({ title: document.title, text: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,300),
        canvases: [...document.querySelectorAll('canvas')].map(c => c.width+'x'+c.height) })`,
    true
  ).catch((e) => ({ error: e.message }));

  console.log("=== STATE ===");
  console.log(JSON.stringify(state, null, 1));
  console.log(`=== FAILED (${failed.length}) ===`);
  console.log([...new Set(failed)].slice(0, 12).join("\n") || "(none)");
  const errs = logs.filter((l) => /error|fail|404|refus/i.test(l));
  console.log("=== CONSOLE ===");
  console.log(errs.slice(0, 8).join("\n") || "(none)");
  console.log("shots:", shots.join(", "));

  app.exit(failed.length ? 1 : 0);
});
