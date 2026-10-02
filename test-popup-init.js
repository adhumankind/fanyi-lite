/**
 * Popup 初始化冒烟测试：node test-popup-init.js
 * 真实执行 popup.js 的完整初始化流程（桩 DOM + 桩 chrome API）：
 * 场景1：industry=auto 正常初始化，无任何 ReferenceError
 * 场景2：industry=tech（手选行业，曾触发 LABELS TDZ 崩溃）初始化不中断
 * 场景3：模式单选 change → 正确写入 storage 并向内容脚本广播 set-mode
 * 场景4：popup.js 中不再引用已删除的 btnShortcuts（历史 ReferenceError 回归防线）
 */
const fs = require("fs");
const path = require("path");
const popupSrc = fs.readFileSync(path.join(__dirname, "fanyi-lite/popup.js"), "utf8");

let allPass = true;
function check(name, cond, detail = "") {
  if (!cond) allPass = false;
  console.log(name + ": " + (cond ? "PASS" : "FAIL") + (detail ? "  → " + detail : ""));
}

// ---------- 可复用桩工厂 ----------
function makeEnv({ industry = "auto", pageTranslated = false } = {}) {
  const el = (props = {}) => ({
    addEventListener() {},
    textContent: "",
    value: "",
    checked: false,
    hidden: false,
    ...props,
  });

  const modeRadios = ["follow", "replace", "invert"].map((v) => {
    const r = el({ value: v });
    r.closest = () => ({ classList: { toggle() {} } });
    r.handlers = {};
    r.addEventListener = (evt, fn) => { r.handlers[evt] = fn; };
    return r;
  });

  const storageWrites = [];
  const tabMessages = [];
  const chrome = {
    runtime: {
      getManifest: () => ({ version: "0.6.1" }),
      openOptionsPage: () => {},
      get lastError() { return undefined; },
    },
    tabs: {
      query: async () => [{ id: 42, url: "https://github.com/facebook/react" }],
      sendMessage(tabId, msg, cb) {
        tabMessages.push({ tabId, msg });
        if (typeof cb === "function") {
          cb(pageTranslated ? { translated: true, running: false, mode: "follow" } : undefined);
        }
        return undefined; // 模拟旧式无 Promise 返回
      },
      create: () => {},
    },
    storage: {
      local: {
        get: async (def) => ({ ...def, industry }),
        set: async (obj) => { storageWrites.push(obj); },
      },
    },
    commands: { getAll: async () => [{ name: "toggle-translate", shortcut: "Alt+1" }] },
  };

  const ids = {};
  for (const id of ["btnToggle", "btnToggleLabel", "hotkeyChip", "chkAutoTranslate",
    "btnOptions", "footerVersion", "selTargetLang", "selIndustry",
    "industryAutoBadge", "industryHint"]) {
    const node = el({ value: "" });
    node.classList = { toggle() {} };
    ids[id] = node;
  }
  ids.selTargetLang.value = "zh-CN";
  ids.selIndustry.value = industry;
  ids.chkAutoTranslate.addEventListener = () => {};

  let domReadyHandler = null;
  const document = {
    addEventListener: (evt, fn) => { if (evt === "DOMContentLoaded") domReadyHandler = fn; },
    getElementById: (id) => ids[id] || null,
    querySelectorAll: (sel) => (sel.includes("transMode") ? modeRadios : []),
  };

  return { chrome, document, modeRadios, storageWrites, tabMessages, ids, getHandler: () => domReadyHandler };
}

async function initPopup(env) {
  const window = { close: () => {} };
  const fn = new Function("document", "chrome", "window", "URL", popupSrc);
  fn(env.document, env.chrome, window, URL);
  await env.getHandler()(); // 触发并等待 async 初始化完成
}

async function run() {
  // ---------- 场景1：industry=auto 正常初始化 ----------
  {
    const env = makeEnv({ industry: "auto" });
    let threw = null;
    try { await initPopup(env); } catch (e) { threw = e; }
    check("场景1 industry=auto 初始化无异常", threw === null, threw && threw.message);
    check("场景1b footer 版本动态写入", env.ids.footerVersion.textContent.includes("0.6.1"),
      env.ids.footerVersion.textContent);
  }

  // ---------- 场景2：industry=tech（历史 TDZ 崩溃场景）----------
  {
    const env = makeEnv({ industry: "tech" });
    let threw = null;
    try { await initPopup(env); } catch (e) { threw = e; }
    check("场景2 手选行业初始化不再触发 TDZ 崩溃", threw === null,
      threw ? `${threw.message}` : "refreshIndustryBadge 正常完成");
    check("场景2b 行业提示文案正确", env.ids.industryHint.textContent.includes("技术"),
      env.ids.industryHint.textContent);
  }

  // ---------- 场景3：模式切换事件链路 ----------
  {
    const env = makeEnv({ industry: "auto" });
    await initPopup(env);
    const replaceRadio = env.modeRadios.find((r) => r.value === "replace");
    check("场景3a change 事件已绑定", typeof replaceRadio.handlers.change === "function");

    await replaceRadio.handlers.change({ target: { value: "replace" } });
    const modeWrite = env.storageWrites.find((w) => "transMode" in w);
    check("场景3b 切换 replace 已写入 storage", modeWrite?.transMode === "replace",
      JSON.stringify(modeWrite));
    const msg = env.tabMessages.find((m) => m.msg?.type === "set-mode");
    check("场景3c 已向内容脚本广播 set-mode", msg?.msg.mode === "replace",
      JSON.stringify(msg?.msg));
  }

  // ---------- 场景4：btnShortcuts 回归防线 ----------
  check("场景4 popup.js 无 btnShortcuts 残留引用", !popupSrc.includes("btnShortcuts"));

  console.log("\n" + (allPass ? "=== Popup 初始化冒烟 7 项全部通过 ===" : "=== 存在失败用例 ==="));
  process.exit(allPass ? 0 : 1);
}

run();
