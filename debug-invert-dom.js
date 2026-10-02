/**
 * invert 模式 DOM 细节调试：node debug-invert-dom.js
 * 打印每个宿主的 outerHTML 与 source span 的 className/inlineStyle/computed。
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "fanyi-lite");
const css = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
const contentSrc = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");

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

const page = `<!DOCTYPE html>
<html lang="en" data-fy-mode="invert">
<head>
<meta charset="utf-8">
<style>${css.replace(/<\/style>/g, "<\\/style>")}</style>
<style>
  body { margin:0; background:#101322; color:#e8eaed; font-family:sans-serif; }
  .wrap { max-width:1080px; margin:0 auto; padding:48px 24px; }
  h2.sec { font-size:24px; font-weight:500; color:#ffffff; margin:0 0 4px; }
  .card { background:#191d33; border-radius:16px; padding:28px; margin-top:20px; }
  h1.card-title { font-size:34px; line-height:1.2; font-weight:500; color:#ffffff; margin:0 0 14px; max-width:640px; }
  .row { display:flex; gap:14px; margin-top:18px; align-items:center; flex-wrap:wrap; }
  a.pill { display:inline-flex; align-items:center; padding:9px 20px; border-radius:999px; font-size:14px; font-weight:500; text-decoration:none; }
  a.pill-white { background:#f0f4f9; color:#1f1f1f; }
  a.pill-black { background:#050505; color:#ffffff; }
  p.body { font-size:15px; line-height:1.7; color:#c7c9d1; max-width:640px; }
</style>
</head>
<body>
<div class="wrap">
  <h2 class="sec" data-key="sec">Latest news</h2>
  <div class="card">
    <h1 class="card-title" data-key="card-title">Gemini 4 Argon: our next era of frontier intelligence</h1>
    <div class="row">
      <a class="pill pill-white" href="#" data-key="pill-white"><span class="label">Learn more</span></a>
      <a class="pill pill-black" href="#" data-key="pill-black"><span class="label">Learn more</span></a>
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
  let currentMode = "invert";
  ${fnSrc}

  const TRANS = {
    "sec": "最新消息",
    "card-title": "Gemini 4 Argon：我们的下一个前沿情报时代",
    "pill-white": "了解更多",
    "pill-black": "了解更多",
    "body": "我们正在推出 SynthID Bio，一种用于检测 AI 生成生物序列的新方法。",
  };
  window.addEventListener("load", () => {
    setTimeout(() => {
      const els = {};
      document.querySelectorAll("[data-key]").forEach((el) => {
        const key = el.dataset.key;
        render({ el, text: el.textContent.trim(), rawText: el.textContent.trim() }, TRANS[key]);
        els[key] = el;
      });
      // 关键：.fanyi-lite-source 带 transition:all 0.2s——同步修改后立即读
      // getComputedStyle 会拿到过渡前值。推迟到过渡结束后再采集。
      setTimeout(() => {
        const lines = [];
        for (const [key, el] of Object.entries(els)) {
          const src = el.querySelector(":scope > ." + SOURCE_CLASS);
          lines.push("### " + key);
          lines.push("HTML: " + el.innerHTML);
          if (src) {
            const cs = getComputedStyle(src);
            lines.push("  src.className = [" + src.className + "]  inline.fontSize=[" + src.style.fontSize + "]");
            lines.push("  matchesBase=" + src.matches('html[data-fy-mode="invert"] .fanyi-lite-source:not(.fy-btn-src)')
              + " matchesDark=" + src.matches('html[data-fy-mode="invert"] .fanyi-lite-source.fy-dark-ctx:not(.fy-btn-src)')
              + " htmlMode=" + document.documentElement.dataset.fyMode
              + " parentTag=" + src.parentElement.tagName + " parentClass=" + src.parentElement.className);
            lines.push("  computed: fontSize=" + cs.fontSize + " color=" + cs.color + " opacity=" + cs.opacity + " display=" + cs.display + " borderLeft=" + cs.borderLeftWidth + " " + cs.borderLeftColor);
          } else {
            lines.push("  src = NULL");
          }
        }
        document.getElementById("report").textContent = lines.join("\\n");
      }, 600);
    }, 150);
  });
<\/script>
</body>
</html>`;

const file = path.join(__dirname, "screenshots", "_dbg_invert.html");
fs.writeFileSync(file, page);
const out = execSync(
  `"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --virtual-time-budget=3000 --window-size=1100,900 --screenshot="${path.join(__dirname, "screenshots", "_dbg_invert.png").replace(/\\/g, "/")}" --dump-dom "file:///${file.replace(/\\/g, "/")}" 2>nul`,
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
);
const m = out.match(/<pre id="report"[^>]*>([\s\S]*?)<\/pre>/);
if (!m) {
  console.log("=== NO PAYLOAD，原始 DOM 尾部 ===");
  console.log(out.slice(-2500));
} else {
  console.log(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
}
console.log("(页面已保留:", file, ")");
