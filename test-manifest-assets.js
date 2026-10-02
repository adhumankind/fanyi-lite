/**
 * 项目级验收测试：node test-manifest-assets.js
 * 校验跨文件契约，防止多轮迭代后的静态漂移：
 *  1. manifest.json 引用的每个文件都真实存在（缺失会导致扩展无法加载）
 *  2. 版本号无硬编码漂移（popup footer 动态读取 manifest，源码中不得出现旧版本硬编码）
 *  3. 消息契约双向闭合（content/popup/options 发的每个 type 在接收方都有处理）
 *  4. storage key 契约闭合（读写的每个 key 在写入方/读取方都成对存在）
 *  5. CSS 类名契约（content.js 创建的类名在 style.css 中有定义）
 *  6. 图标资产完整性（双态 × 4 尺寸）
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "fanyi-lite");

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const manifest = JSON.parse(read("manifest.json"));
const contentJs = read("content.js");
const backgroundJs = read("background.js");
const popupJs = read("popup.js");
const optionsJs = read("options.js");
const popupHtml = read("popup.html");
const optionsHtml = read("options.html");
const styleCss = read("style.css");

let allPass = true;
function check(name, cond, detail = "") {
  if (!cond) allPass = false;
  console.log(name + ": " + (cond ? "PASS" : "FAIL") + (detail ? "  → " + detail : ""));
}

// ---------- 1. manifest 引用完整性 ----------
{
  const refs = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_page,
    ...Object.values(manifest.action.default_icon),
    ...Object.values(manifest.icons),
  ];
  manifest.content_scripts.forEach((cs) => refs.push(...cs.js, ...cs.css));
  const missing = refs.filter((r) => !fs.existsSync(path.join(ROOT, r)));
  check("1. manifest 引用文件完整性", missing.length === 0,
    missing.length ? "缺失: " + missing.join(",") : `共 ${refs.length} 个引用全部存在`);
}

// ---------- 2. 版本号一致性 ----------
{
  const v = manifest.version;
  const stale = [];
  for (const [name, text] of [["popup.html", popupHtml], ["content.js", contentJs]]) {
    const m = text.match(/v0\.\d+\.\d+/g) || [];
    m.filter((x) => x !== "v" + v).forEach((x) => stale.push(`${name}:${x}`));
  }
  const dynFooter = popupJs.includes("chrome.runtime.getManifest().version");
  check("2a. 源码无旧版本硬编码", stale.length === 0, stale.join(", ") || "干净");
  check("2b. popup footer 动态读取 manifest 版本", dynFooter);
}

// ---------- 3. 消息契约闭合 ----------
{
  const sends = {
    fanyi_translate: contentJs,
    fanyi_status: contentJs,
    fanyi_test_providers: optionsJs,
    "toggle-translate": popupJs,
    "set-mode": popupJs,
    "get-status": popupJs,
  };
  const handlers = {
    fanyi_translate: backgroundJs,
    fanyi_status: backgroundJs,
    fanyi_test_providers: backgroundJs,
    "toggle-translate": contentJs,
    "set-mode": contentJs,
    "get-status": contentJs,
  };
  const broken = Object.entries(sends)
    .filter(([type]) => !handlers[type].includes(`"${type}"`))
    .map(([type]) => type);
  check("3. 消息类型收发闭环", broken.length === 0, broken.join(",") || "6 条消息全部有接收方");

  // popup/options 的 DOM id 与 JS getElementById 对应
  const idsNeeded = [...popupJs.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  const missingIds = idsNeeded.filter((id) => !popupHtml.includes(`id="${id}"`));
  check("3b. popup DOM id 契约", missingIds.length === 0, missingIds.join(",") || `${idsNeeded.length} 个 id 全存在`);
  const idsNeededOpt = [...optionsJs.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  const missingIdsOpt = idsNeededOpt.filter((id) => !optionsHtml.includes(`id="${id}"`));
  check("3c. options DOM id 契约", missingIdsOpt.length === 0, missingIdsOpt.join(",") || `${idsNeededOpt.length} 个 id 全存在`);
}

// ---------- 4. storage key 契约 ----------
{
  const keys = ["transMode", "alwaysTranslate", "targetLang", "industry", "userGlossary", "service"];
  const writers = {
    transMode: popupJs, alwaysTranslate: popupJs, targetLang: popupJs,
    industry: popupJs, userGlossary: optionsJs, service: optionsJs,
  };
  const readers = {
    transMode: contentJs, alwaysTranslate: contentJs, targetLang: contentJs,
    industry: contentJs, userGlossary: contentJs, service: backgroundJs,
  };
  const broken = keys.filter((k) => {
    // 写入方支持两种形态：显式 "key" 或对象简写 { key: x } / { key }
    const wordRe = new RegExp("\\b" + k + "\\b");
    return !wordRe.test(writers[k]) || !readers[k].includes(k);
  });
  check("4. storage key 读写闭环", broken.length === 0, broken.join(",") || "6 个 key 全部成对");
}

// ---------- 5. CSS 类名契约 ----------
{
  const classes = ["fanyi-lite-target", "fanyi-lite-inner", "fanyi-lite-source", "fy-dark-ctx", "fy-btn-ctx", "fy-inline"];
  const missing = classes.filter((c) => !styleCss.includes(c));
  check("5. 动态类名在样式表中均有定义", missing.length === 0, missing.join(",") || `${classes.length} 个类名全存在`);
}

// ---------- 6. 图标资产完整性（3 套 × 4 尺寸） ----------
{
  const sizes = [16, 32, 48, 128];
  const missing = [];
  for (const prefix of ["active", "inactive", "icon"]) {
    for (const s of sizes) {
      const p = path.join(ROOT, "icons", `${prefix}-${s}.png`);
      if (!fs.existsSync(p)) missing.push(`${prefix}-${s}.png`);
    }
  }
  check("6. 双态图标资产完整（3套×4尺寸）", missing.length === 0, missing.join(",") || "12 个图标全存在");
}

console.log("\n" + (allPass ? "=== 项目级验收 6 组全部通过 ===" : "=== 存在失败项 ==="));
process.exit(allPass ? 0 : 1);
