"use strict";

/**
 * 记录页面运行时发出的所有请求，输出 _urls.json。
 *
 * 用法:
 *   node collect-urls.js <url> [--wait 60000] [--out _urls.json] [--click]
 *
 * 说明:
 *   静态 HTML 不会列出真正的资源图（模型/贴图/音频多为运行时按需加载），
 *   必须真跑一遍才能拿全。
 */

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2).filter((a) => a !== ".");
const target = args[0];
if (!target) {
  console.error("usage: node collect-urls.js <url> [--wait ms] [--out file] [--click]");
  process.exit(1);
}

const getFlag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  return args[i + 1];
};

const WAIT = parseInt(getFlag("--wait", "60000"), 10);
const OUT = path.resolve(getFlag("--out", "_urls.json"));
const SHOULD_CLICK = args.includes("--click");

app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");
app.commandLine.appendSwitch("enable-features", "Vulkan,WebGPU");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const urls = new Set();
const failed = [];

setTimeout(() => {
  console.error("guard timeout");
  dump();
  app.exit(2);
}, WAIT + 90000);

function dump() {
  const payload = {
    target,
    capturedAt: new Date().toISOString(),
    urls: [...urls].sort(),
    failed,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 1), "utf8");
  console.log(`collected ${urls.size} urls, ${failed.length} failed -> ${OUT}`);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    show: true,
    backgroundColor: "#000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  const ses = win.webContents.session;

  ses.webRequest.onCompleted({ urls: ["*://*/*"] }, (d) => {
    urls.add(d.url.split("#")[0]);
  });
  ses.webRequest.onErrorOccurred({ urls: ["*://*/*"] }, (d) => {
    failed.push(`${d.error} ${d.url}`);
  });

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    failed.push(`did-fail-load ${code} ${desc} ${url}`);
  });

  try {
    await win.loadURL(target, { userAgent: undefined });
  } catch (e) {
    failed.push(`load-error ${e.message}`);
  }

  win.show();
  win.focus();

  // 有些站点需要一次真实点击才开始加载资源
  if (SHOULD_CLICK) {
    setTimeout(() => {
      win.webContents.sendInputEvent({ type: "mouseDown", x: 800, y: 450, button: "left", clickCount: 1 });
      win.webContents.sendInputEvent({ type: "mouseUp", x: 800, y: 450, button: "left", clickCount: 1 });
    }, 8000);
  }

  await new Promise((r) => setTimeout(r, WAIT));
  dump();
  app.exit(0);
});
