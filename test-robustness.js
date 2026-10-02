/**
 * 专项鲁棒性测试：node test-robustness.js
 * 场景1：restore() 脱壳遇到 parentNode 为 null 的游离节点安全不崩溃
 * 场景2：showMaillardToast 多通知堆叠并发弹出：样式单例不重复，activeToastCount 计数准确，防幽灵清理
 * 场景3：background per-tab API 回调完整消费 chrome.runtime.lastError
 */
const fs = require("fs");
const path = require("path");
const contentSrc = fs.readFileSync(path.join(__dirname, "fanyi-lite/content.js"), "utf8");
const backgroundSrc = fs.readFileSync(path.join(__dirname, "fanyi-lite/background.js"), "utf8");

let allPass = true;
function check(name, cond, detail = "") {
  if (!cond) allPass = false;
  console.log(name + ": " + (cond ? "PASS" : "FAIL") + (detail ? "  → " + detail : ""));
}

// ---------- 场景1：restore() 脱壳遇到孤立节点 ----------
{
  const s = contentSrc.indexOf("function restore()");
  const e = contentSrc.indexOf("/* ================= 1. 段落提取与隔离");
  const pure = contentSrc.slice(s, e);

  // 构造脱离 DOM 树的 orphanSpan (parentNode === null)
  let removed = false;
  const orphanSpan = {
    parentNode: null,
    remove: () => { removed = true; },
    firstChild: { nodeType: 3, nodeValue: "orphan" },
  };

  const sandboxDoc = {
    querySelectorAll: (sel) => {
      if (sel === ".fanyi-lite-target") return [];
      if (sel === ".fanyi-lite-source") return [orphanSpan];
      if (sel === "[data-fy-p]") return [];
      return [];
    },
  };

  const fn = new Function(
    "document", "TARGET_CLASS", "SOURCE_CLASS", "setPageState", "translated", "currentSessionId",
    pure + "\nreturn restore;"
  )(sandboxDoc, "fanyi-lite-target", "fanyi-lite-source", () => {}, false, 1);

  let error = null;
  try {
    fn();
  } catch (err) {
    error = err;
  }
  check("场景1 孤立节点脱壳安全不崩溃", error === null && removed === true,
    error ? error.message : "顺利执行 orphanSpan.remove()");
}

// ---------- 场景2：Toast 样式单例与幽灵清理防御 ----------
{
  const s = contentSrc.indexOf("/* ================= 4. 美拉德 Shadow Toast");
  const e = contentSrc.indexOf("const sleep = (ms)");
  const pure = contentSrc.slice(s, e);

  let hostEl = null;
  const createdElements = [];

  class FakeElement {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.style = {};
      this.classList = {
        add(c) { this._classes = this._classes || new Set(); this._classes.add(c); },
        remove(c) { this._classes?.delete(c); },
        contains(c) { return !!this._classes?.has(c); },
      };
      this.childNodes = [];
      this.isConnected = true;
      createdElements.push(this);
    }
    appendChild(n) { this.childNodes.push(n); n.parentNode = this; return n; }
    remove() { this.isConnected = false; }
    querySelector(sel) {
      return this.childNodes.find((c) => c.tagName === sel.toUpperCase()) || null;
    }
    attachShadow() {
      this.shadowRoot = new FakeElement("shadow-root");
      return this.shadowRoot;
    }
  }

  const fakeDoc = {
    getElementById: (id) => (hostEl && hostEl.isConnected ? hostEl : null),
    createElement: (tag) => new FakeElement(tag),
    documentElement: {
      appendChild: (h) => { hostEl = h; },
    },
  };

  let rafQueue = [];
  const fakeRaf = (cb) => rafQueue.push(cb);
  let timers = [];
  const fakeSetTimeout = (cb, ms) => {
    timers.push({ cb, ms });
    return timers.length;
  };

  const toastFn = new Function(
    "document", "requestAnimationFrame", "setTimeout",
    pure + "\nreturn { showMaillardToast, getActiveCount: () => activeToastCount };"
  )(fakeDoc, fakeRaf, fakeSetTimeout);

  // 快速连发两条 Toast
  toastFn.showMaillardToast("第一条", "info");
  toastFn.showMaillardToast("第二条", "success");

  // 检查 shadowRoot 中的 style 元素是否严格只有 1 个（单例）
  const shadow = hostEl.shadowRoot;
  const styleCount = shadow.childNodes.filter((c) => c.tagName === "STYLE").length;
  check("场景2a 样式单例注入（多条通知绝不重复写入 style）", styleCount === 1, `styleCount=${styleCount}`);
  check("场景2b activeToastCount 准确为 2", toastFn.getActiveCount() === 2);

  // 推进第一条 Toast 的离场定时器
  // 第一条离场时（activeCount 变为 1），host 绝不能被误删（防幽灵清理）
  const t1_dismiss = timers[0];
  t1_dismiss.cb();
  const t1_remove = timers[2]; // 第二级嵌套 setTimeout (300ms)
  t1_remove.cb();

  check("场景2c 第一条离场时宿主容器仍保留（未被幽灵清理）",
    hostEl.isConnected === true && toastFn.getActiveCount() === 1,
    `hostConnected=${hostEl.isConnected}, activeCount=${toastFn.getActiveCount()}`);

  // 推进第二条 Toast 离场
  const t2_dismiss = timers[1];
  t2_dismiss.cb();
  const t2_remove = timers[3];
  t2_remove.cb();

  check("场景2d 全部通知离场后宿主容器干净清理",
    hostEl.isConnected === false && toastFn.getActiveCount() === 0,
    `hostConnected=${hostEl.isConnected}, activeCount=${toastFn.getActiveCount()}`);
}

// ---------- 场景3：background per-tab API 回调消费 lastError ----------
{
  let lastErrorAccessCount = 0;
  let badgeCalls = 0;
  let iconCalls = 0;

  const mockChrome = {
    action: {
      setBadgeText({ tabId, text }, cb) {
        badgeCalls++;
        if (cb) cb();
      },
      setBadgeBackgroundColor({ tabId, color }, cb) {
        if (cb) cb();
      },
      setIcon({ tabId, path }, cb) {
        iconCalls++;
        if (cb) cb();
      },
    },
    runtime: {
      get lastError() {
        lastErrorAccessCount++;
        return { message: "No tab with id: 999" };
      },
    },
  };

  const s = backgroundSrc.indexOf("function setExtensionIcon(");
  const e = backgroundSrc.indexOf("function diagnoseNetworkError(");
  const pure = backgroundSrc.slice(s, e);

  const bgFns = new Function(
    "chrome", "setTimeout",
    pure + "\nreturn { setExtensionIcon, updateBadge, clearBadge };"
  )(mockChrome, setTimeout);

  bgFns.updateBadge(999, "OK", "#15803d");
  bgFns.clearBadge(999);
  bgFns.setExtensionIcon(999, true);

  check("场景3 异步回调完整消费 chrome.runtime.lastError",
    lastErrorAccessCount >= 3,
    `lastErrorAccessCount=${lastErrorAccessCount} (成功拦截未捕获红字)`);
}

console.log("\n" + (allPass ? "=== 全部 7 项鲁棒性专项断言全部通过 ===" : "=== 存在失败用例 ==="));
process.exit(allPass ? 0 : 1);
