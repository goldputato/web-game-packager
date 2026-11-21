/* 中文界面层（短标签专用）
 *
 * 只负责源码层不敢碰的短字符串：STEER / DRIFT / GEAR 这类既是按钮文案、
 * 又可能是输入动作内部键的标签。它只改渲染结果，不影响游戏逻辑。
 *
 * 用法：把本文件放到站点根目录，在 </body> 前加
 *   <script src="/zh-overlay.js"></script>
 *
 * 关键点：
 *   1. 打字机文本是"完整句子的前缀"，必须按比例输出中文前缀，否则永远匹配不上；
 *   2. 长段落每句可能各占一个节点，需要句子级对齐；
 *   3. 已含中文的节点直接跳过，避免反复处理。
 */
(function () {
  "use strict";

  /* 把 DICT 换成目标游戏的词表；键是界面上的英文原文 */
  var DICT = window.ZH_DICT || {
    "ENTER": "进入",
    "CONTINUE": "继续",
    "SKIP": "跳过",
    "BACK": "返回",
    "CLOSE": "关闭",
    "DRIVE": "驾驶",
    "WALK": "步行",
    "CAR": "车辆",
    "SETTINGS": "设置",
    "RADIO": "电台",
    "MAP": "地图",
    "MESSAGES": "消息",
    "ACHIEVEMENTS": "成就",
    "CAMERA": "视角",
    "GEARS": "挡位",
    "DRIFT": "漂移",
    "NITRO": "氮气",
    "STEER": "转向",
    "BRAKE": "刹车",
    "RESET": "重置",
    "ON": "开",
    "OFF": "关",
    "PLAY": "开始",
    "PAUSE": "暂停",
    "ONLINE": "在线"
  };

  /* 带数字的变体用规则处理 */
  var RULES = [
    [/^(\d+) M AWAY$/i, "距离 $1 米"],
    [/^([\d.]+) KM AWAY$/i, "距离 $1 公里"],
    [/^Music volume (\d+)%$/i, "音乐音量 $1%"],
    [/^(.+?) \((\d+)\)$/, "$1（$2）"],
    [/^(.+) · (\d+) unread$/i, "$1 · $2 条未读"]
  ];

  var CJK = /[\u4e00-\u9fa5]/;
  window.__miss = window.__miss || [];

  /* 长段落按句拆分，用于"每句一个节点"的对话面板 */
  var SENTENCES = [];
  (function () {
    function splitEn(x) { return x.split(/(?<=[.!?…])\s+/).filter(function (v) { return v.trim(); }); }
    function splitZh(x) { return x.split(/(?<=[。！？…])/).filter(function (v) { return v.trim(); }); }
    for (var k in DICT) {
      if (k.length < 40) continue;
      var en = splitEn(k), zh = splitZh(DICT[k]);
      if (en.length > 1 && en.length === zh.length) SENTENCES.push([en, zh]);
    }
  })();

  function translate(raw) {
    if (!raw) return null;
    var t = raw.replace(/\s+/g, " ").trim();
    if (t.length < 2 || CJK.test(t)) return null;

    if (Object.prototype.hasOwnProperty.call(DICT, t)) return DICT[t];

    for (var i = 0; i < SENTENCES.length; i++) {
      var en = SENTENCES[i][0], zh = SENTENCES[i][1];
      for (var j = 0; j < en.length; j++) {
        if (t === en[j]) return zh[j];
      }
    }

    /* 打字机：文本是某句的开头时，按比例给出中文前缀 */
    if (t.length >= 6) {
      var best = null;
      for (var k in DICT) {
        if (k.length > t.length && k.indexOf(t) === 0) {
          if (!best || k.length < best.length) best = k;
        }
      }
      if (best) {
        var full = DICT[best];
        var cut = Math.max(1, Math.round(full.length * (t.length / best.length)));
        return full.slice(0, cut);
      }
    }

    for (var r = 0; r < RULES.length; r++) {
      if (RULES[r][0].test(t)) return t.replace(RULES[r][0], RULES[r][1]);
    }

    if (/[A-Za-z]{3,}/.test(t) && window.__miss.length < 3000 && window.__miss.indexOf(t) < 0) {
      window.__miss.push(t);
    }
    return null;
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, CANVAS: 1, CODE: 1, PRE: 1 };

  function doText(node) {
    var v = node.nodeValue;
    if (!v || !v.trim()) return;
    var out = translate(v);
    if (out && out !== v) {
      var lead = v.match(/^\s*/)[0];
      var tail = v.match(/\s*$/)[0];
      node.nodeValue = lead + out + tail;
    }
  }

  function doAttrs(el) {
    ["aria-label", "title", "placeholder", "alt"].forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a);
      if (!v) return;
      var out = translate(v);
      if (out && out !== v) el.setAttribute(a, out);
    });
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    if (SKIP[root.tagName]) return;
    doAttrs(root);
    var c = root.firstChild;
    while (c) {
      var next = c.nextSibling;
      walk(c);
      c = next;
    }
  }

  var pending = null;
  function run() {
    walk(document.body);
  }
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = null; run(); }, 60);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      run();
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  } else {
    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  window.addEventListener("load", run);
})();
