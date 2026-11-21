"use strict";

/**
 * 采集界面上的全部可见文案，产出 _texts.json，作为翻译词表的底稿。
 *
 * 用法:
 *   node dump-strings.js <dir> [--wait 30000] [--advance 45] [--out _texts.json]
 *
 * 要点:
 *   - 会尝试点击"进入/Enter/Play"类按钮并持续推进（Space/点击），
 *     以便把剧情、任务面板等后续文本也抓出来；
 *   - 同时抓 aria-label / title / placeholder / alt，这些常是按钮文字的唯一来源。
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

const WAIT = parseInt(getFlag("--wait", "28000"), 10);
const ADVANCE = parseInt(getFlag("--advance", "45"), 10);
const OUT = path.resolve(getFlag("--out", "_texts.json"));

app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");
app.commandLine.appendSwitch("enable-features", "Vulkan,WebGPU");

const seen = new Set();

const HARVEST = `(() => {
  const out = [];
  const walk = (node) => {
    if (node.nodeType === 3) {
      const t = node.nodeValue.replace(/\\s+/g, ' ').trim();
      if (t.length > 1) out.push(t);
    } else if (node.nodeType === 1) {
      for (const a of ['aria-label','title','placeholder','alt']) {
        const v = node.getAttribute && node.getAttribute(a);
        if (v && v.trim().length > 1) out.push('@' + a + ':' + v.trim());
      }
      for (const c of node.childNodes) walk(c);
    }
  };
  walk(document.body);
  return out;
})()`;

async function harvest(win) {
  const items = await win.webContents.executeJavaScript(HARVEST, true).catch(() => []);
  for (const t of items) seen.add(t);
}

function advance(win) {
  win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Space" });
  setTimeout(() => {
    try { win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Space" }); } catch {}
  }, 70);
  win.webContents.sendInputEvent({ type: "mouseDown", x: 800, y: 620, button: "left", clickCount: 1 });
  win.webContents.sendInputEvent({ type: "mouseUp", x: 800, y: 620, button: "left", clickCount: 1 });
}

setTimeout(() => app.exit(2), WAIT + ADVANCE * 2200 + 60000);

app.whenReady().then(async () => {
  const srv = await startStaticServer(dir);
  const win = new BrowserWindow({
    width: 1600, height: 900, show: true, backgroundColor: "#000",
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, autoplayPolicy: "no-user-gesture-required",
    },
  });

  await win.loadURL(srv.url);
  win.show();
  win.focus();
  await new Promise((r) => setTimeout(r, WAIT));

  // 点掉开头页
  await win.webContents.executeJavaScript(
    `(() => {
       const b = [...document.querySelectorAll('button,[role=button],a')]
         .find(e => /^(enter|play|start|进入|开始)$/i.test((e.textContent||'').trim()));
       if (b) { b.click(); return b.textContent.trim(); }
       return '';
     })()`, true
  ).catch(() => "");

  for (let i = 0; i < ADVANCE; i++) {
    await harvest(win);
    advance(win);
    await new Promise((r) => setTimeout(r, 2000));
  }
  await harvest(win);

  const arr = [...seen].sort();
  fs.writeFileSync(OUT, JSON.stringify(arr, null, 1), "utf8");
  console.log(`unique strings: ${arr.length} -> ${OUT}`);
  console.log(arr.slice(0, 30).join(" | "));
  app.exit(0);
});
