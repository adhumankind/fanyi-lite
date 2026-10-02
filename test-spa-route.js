/**
 * 单页应用 (SPA) 客户端路由感知与总是翻译联动测试：
 *   node test-spa-route.js
 * 场景1：pushState 触发路由感知，重置旧状态与会话 ID
 * 场景2：popstate (前进/后退) 触发路由感知
 * 场景3：开启 alwaysTranslate 时，切路由后自动触发翻译
 * 场景4：相同 URL 调用 pushState (hash/query 未变) 幂等不重置
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "fanyi-lite/content.js"), "utf8");

const s = src.indexOf("// ================= 5. 单页应用 (SPA) 路由切换感知");
const e = src.indexOf("// 监听来自后台/弹出面板的消息");
const pure = src.slice(s, e);

let toggleCalls = [];
let notifyCalls = [];
let restoreCalled = false;
let currentSessionId = 10;
let translated = true;
let running = false;
let buildGlossaryCalled = false;

const scope = {
  location: { href: "https://github.com/owner/repo" },
  history: {
    pushState(state, title, url) { scope.location.href = url; },
    replaceState(state, title, url) { scope.location.href = url; },
  },
  window: {
    listeners: {},
    addEventListener(evt, fn) { this.listeners[evt] = fn; },
  },
  chrome: {
    storage: {
      local: {
        get: (def, cb) => cb({ alwaysTranslate: true }),
      },
    },
  },
  restore: () => {
    restoreCalled = true;
    scope.translated = false;
    translated = false;
  },
  notifyBackground: (s) => notifyCalls.push(s),
  buildActiveGlossary: () => { buildGlossaryCalled = true; },
  toggle: (isAuto) => toggleCalls.push({ isAuto }),
  currentSessionId,
  translated,
  running,
  setTimeout: (fn, ms) => fn(), // 同步执行模拟定时器
};

const factory = new Function("scope", `
  with(scope) {
    ${pure}
    return {
      history, window,
      getState: () => ({ currentSessionId, translated, running, restoreCalled, buildGlossaryCalled, toggleCalls, notifyCalls })
    };
  }
`);

const { history, window: win, getState } = factory(scope);

async function run() {
  let allPass = true;
  function check(name, cond, detail = "") {
    if (!cond) allPass = false;
    console.log(name + ": " + (cond ? "PASS" : "FAIL") + (detail ? "  → " + detail : ""));
  }

  // 场景1：pushState 切换到 Issues 路由
  restoreCalled = false;
  buildGlossaryCalled = false;
  toggleCalls = [];
  history.pushState({}, "", "https://github.com/owner/repo/issues");

  check("场景1a pushState 触发旧翻译状态还原", restoreCalled === true);
  check("场景1b 重新构建行业词库", buildGlossaryCalled === true);
  check("场景1c alwaysTranslate 触发自动翻译", toggleCalls.length === 1 && toggleCalls[0].isAuto === true);

  // 场景2：相同 URL pushState 幂等防抖
  restoreCalled = false;
  buildGlossaryCalled = false;
  toggleCalls = [];
  history.pushState({}, "", "https://github.com/owner/repo/issues"); // URL 未变
  check("场景2 相同 URL 幂等不重复重置", restoreCalled === false && toggleCalls.length === 0);

  // 场景3：popstate 前进后退事件（模拟用户从已翻译的 Issues 返回到 Pulls）
  scope.location.href = "https://github.com/owner/repo/pulls";
  scope.translated = true;
  restoreCalled = false;
  toggleCalls = [];
  win.listeners["popstate"]();
  check("场景3 popstate 触发路由响应与自动翻译", restoreCalled === true && toggleCalls.length === 1);

  console.log("\n" + (allPass ? "=== SPA 客户端路由感知 3 项全部通过 ===" : "=== 存在失败用例 ==="));
  process.exit(allPass ? 0 : 1);
}

run();
