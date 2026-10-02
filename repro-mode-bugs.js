/**
 * 模式视觉 Bug 复现与验收：node repro-mode-bugs.js [follow|replace|invert|all]
 * 复刻 DeepMind 深色卡片 + 三种胶囊按钮 + 文字链 + 大标题结构，
 * 调用 content.js 生产渲染路径（render/wrapDirectContentForMode/applyHostFontStyles/placeWrapper），
 * 输出三种模式的截图（screenshots/_bug_{mode}.png）与计算样式 payload，用于：
 *   ① 修复前：亲眼确认「invert 原文注释过大/深底隐身」「按钮内译文样式不跟原件」两个 Bug
 *   ② 修复后：同页面对比验证修复效果
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "fanyi-lite");
const css = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
const contentSrc = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TMP = path.join(__dirname, "screenshots");

function extract(startMarker, endMarker) {
  const s = contentSrc.indexOf(startMarker);
  if (s < 0) throw new Error("marker not found: " + startMarker);
  const e = endMarker ? contentSrc.indexOf(endMarker, s) : contentSrc.indexOf("\n  }\n", s) + 4;
  return contentSrc.slice(s, e);
}

const fnSrc = [
  extract("  function render(paragraph, translation)"),
  extract("  function wrapDirectContentForMode(el)"),
  extract("  function isInteractiveUnitContext(el)"),
  extract("  function applySourceAnnotationStyle(sourceSpan, hostEl)"),
  extract("  function clearSourceAnnotationStyle(sourceSpan)"),
  extract("  function isDarkContainer(el)", "  function formatTypographySpacing"),
  extract("  function applyHostFontStyles(el, wrapper, scale)", "  function placeWrapper("),
  extract("  function placeWrapper(wrapper, el)"),
  extract("  function formatTypographySpacing(text)"),
].join("\n\n");

function buildPage(mode) {
  const cssText = css.replace(/<\/style>/g, "<\\/style>");
  return `<!DOCTYPE html>
<html lang="en" data-fy-mode="${mode}">
<head>
<meta charset="utf-8">
<style>${cssText}</style>
<style>
  body { margin:0; background:#101322; color:#e8eaed; font-family:"Google Sans", Roboto, Arial, sans-serif; }
  .wrap { max-width:1080px; margin:0 auto; padding:48px 24px; }
  h2.sec { font-size:24px; font-weight:500; color:#ffffff; margin:0 0 4px; }
  .card { background:#191d33; border-radius:16px; padding:28px; margin-top:20px; }
  h1.card-title { font-size:34px; line-height:1.2; font-weight:500; color:#ffffff; margin:0 0 14px; max-width:640px; }
  .meta { font-size:13px; color:#9aa0a6; }
  .row { display:flex; gap:14px; margin-top:18px; align-items:center; flex-wrap:wrap; }
  a.pill { display:inline-flex; align-items:center; padding:9px 20px; border-radius:999px; font-size:14px; font-weight:500; text-decoration:none; }
  a.pill-white { background:#f0f4f9; color:#1f1f1f; }
  a.pill-black { background:#050505; color:#ffffff; }
  a.pill-blue  { background:#0b57d0; color:#ffffff; }
  a.chip { display:inline-flex; align-items:center; gap:6px; font-size:14px; color:#a8c7fa; text-decoration:none; }
  p.body { font-size:15px; line-height:1.7; color:#c7c9d1; max-width:640px; }
</style>
</head>
<body>
<div class="wrap">
  <h2 class="sec" data-key="sec">Latest news</h2>
  <div class="card">
    <h1 class="card-title" data-key="card-title">Gemini 4 Argon: our next era of frontier intelligence</h1>
    <div class="meta" data-key="meta">September 2026</div>
    <div class="row">
      <a class="pill pill-white" href="#" data-key="pill-white"><span class="label">Learn more</span></a>
      <a class="pill pill-black" href="#" data-key="pill-black"><span class="label">Learn more</span></a>
      <a class="pill pill-blue" href="#" data-key="pill-blue"><span class="label">Try</span></a>
      <a class="chip" href="#" data-key="chip"><span class="label">Learn more</span><svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" stroke="#a8c7fa" stroke-width="1.6" fill="none"/></svg></a>
    </div>
  </div>
  <p class="body" data-key="body">We are introducing SynthID Bio, a new method for detecting AI-generated biological sequences.</p>
</div>
<pre id="report" style="display:none"></pre>
<script>
  const TARGET_CLASS = "fanyi-lite-target";
  const TARGET_INNER_CLASS = "fanyi-lite-inner";
  const SOURCE_CLASS = "fanyi-lite-source";
  const BLOCK_BOUNDARY_TAGS = new Set(["P","H1","H2","H3","H4","H5","H6","LI","DT","DD","BLOCKQUOTE","FIGCAPTION","TD","TH","CAPTION","SUMMARY","BUTTON","UL","OL","TABLE","TR","THEAD","TBODY","TFOOT","DIV","SECTION","ARTICLE","HEADER","FOOTER","NAV","ASIDE","MAIN"]);
  const IGNORE_SELECTORS = "[contenteditable='true'], [contenteditable=''], code, pre, kbd, samp, svg, math, canvas, ." + TARGET_CLASS + ", [data-fy-p]";
  let currentMode = document.documentElement.dataset.fyMode;
  ${fnSrc}

  const TRANS = {
    "sec": "最新消息",
    "card-title": "Gemini 4 Argon：我们的下一个前沿情报时代",
    "meta": "2026年9月",
    "pill-white": "了解更多",
    "pill-black": "了解更多",
    "pill-blue": "尝试",
    "chip": "了解更多",
    "body": "我们正在推出 SynthID Bio，一种用于检测 AI 生成生物序列的新方法。",
  };
  window.addEventListener("load", () => {
    setTimeout(() => {
      const report = {};
      document.querySelectorAll("[data-key]").forEach((el) => {
        const key = el.dataset.key;
        const orig = el.textContent.trim();
        const ok = render({ el, text: orig, rawText: orig }, TRANS[key]);
        const w = el.querySelector(":scope > ." + TARGET_CLASS);
        const src = el.querySelector(":scope > ." + SOURCE_CLASS);
        report[key] = { rendered: !!ok };
        if (w) {
          const cs = getComputedStyle(w);
          const scs = src ? getComputedStyle(src) : null;
          const label = el.querySelector(".label");
          const lcs = label ? getComputedStyle(label) : null;
          report[key] = {
            rendered: true,
            target: { fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color },
            inlineFontSize: w.style.fontSize, inlineColor: w.style.color,
            label: lcs ? { fontSize: lcs.fontSize, fontWeight: lcs.fontWeight, color: lcs.color } : null,
            source: scs ? { fontSize: scs.fontSize, color: scs.color, opacity: scs.opacity } : null,
            darkCtx: w.classList.contains("fy-dark-ctx"),
            btnCtx: w.classList.contains("fy-btn-ctx"),
            svgInsideSource: src ? !!src.querySelector("svg") : null,
          };
        }
      });
      document.getElementById("report").textContent = "PAYLOAD:" + JSON.stringify(report);
    }, 150);
  });
<\/script>
</body>
</html>`;
}

const modes = process.argv[2] && process.argv[2] !== "all"
  ? [process.argv[2]]
  : ["follow", "replace", "invert"];

for (const mode of modes) {
  const file = path.join(TMP, `_bug_${mode}.html`);
  fs.writeFileSync(file, buildPage(mode));
  const url = "file:///" + file.replace(/\\/g, "/");
  const png = path.join(TMP, `_bug_${mode}.png`);
  const out = execSync(
    `"${CHROME}" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1100,900 --screenshot="${png.replace(/\\/g, "/")}" --dump-dom "${url}" 2>nul`,
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  const m = out.match(/PAYLOAD:([^<]*)</);
  console.log(`===== ${mode} =====`);
  if (m) {
    const p = JSON.parse(m[1]);
    for (const [k, v] of Object.entries(p)) {
      console.log(k.padEnd(12), JSON.stringify(v));
    }
  } else {
    console.log("(payload 缺失)");
  }
  console.log("截图:", png);
}
for (const mode of modes) {
  try { fs.unlinkSync(path.join(TMP, `_bug_${mode}.html`)); } catch {}
}
