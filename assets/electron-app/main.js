"use strict";

/**
 *  Electron 外壳：内置静态服务器 + 单窗口 + 禁止外跳。
 *  产品名、标题、配色由 new-project.py 注入，改动请保持 __PLACEHOLDER__ 形式。
 */

const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("node:path");
const { startStaticServer } = require("./server.js");

const APP_TITLE = "__APP_TITLE__";
const APP_ID = "__APP_ID__";
const BG_COLOR = "__BG_COLOR__";

// WebGL / WebGPU 在虚拟机、无独显、远程桌面下会被默认黑名单挡住
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");
app.commandLine.appendSwitch("enable-features", "Vulkan,WebGPU");
app.commandLine.appendSwitch("enable-webgl");
app.disableHardwareAcceleration = app.disableHardwareAcceleration || false;

app.setAppUserModelId(APP_ID);

// 游戏目录：打包后位于 resources/game，开发时位于 ../site
const GAME_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "game")
  : path.join(__dirname, "..", "site");

let mainWindow = null;
let serverHandle = null;

async function createWindow() {
  serverHandle = await startStaticServer(GAME_DIR);

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    title: APP_TITLE,
    backgroundColor: BG_COLOR,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
      webgl: true,
      experimentalFeatures: true,
    },
  });

  Menu.setApplicationMenu(null);

  // 页面 <title> 会覆盖窗口标题，必须挡掉，否则任务栏显示网页标题
  mainWindow.on("page-title-updated", (e) => e.preventDefault());

  // 外部链接交给系统浏览器，不在游戏窗口里打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(serverHandle.url)) {
      event.preventDefault();
      if (/^https?:/i.test(target)) shell.openExternal(target);
    }
  });

  // F11 全屏、F12 开发者工具、Esc 退出全屏
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    } else if (input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  await mainWindow.loadURL(serverHandle.url);
  mainWindow.setTitle(APP_TITLE);
  mainWindow.focus();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (serverHandle) serverHandle.close();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
