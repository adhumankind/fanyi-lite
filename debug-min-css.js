/**
 * 最小复现：验证 invert .fanyi-lite-source 规则在本机 Chrome 下的真实计算值
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const css = fs.readFileSync(path.join(__dirname, "fanyi-lite/style.css"), "utf8");

const page = `<!DOCTYPE html>
<html data-fy-mode="invert">
<head><meta charset="utf-8"><style>${css}</style>
<style>
  body { background:#101322; }
  .host24 { font-size:24px; color:#ffffff; }
  .host34 { font-size:34px; color:#ffffff; }
</style></head>
<body>
  <h2 class="host24" id="h2">
    <span class="fanyi-lite-source fy-dark-ctx" id="s1" style="font-size: 14.72px;">Latest news</span>
  </h2>
  <h1 class="host34" id="h1">
    <span class="fanyi-lite-source" id="s2" style="font-size: 14.72px;">Plain source no dark ctx</span>
  </h1>
  <h1 class="host34" id="h1b">
    <span class="fanyi-lite-source fy-btn-src" id="s3">Button source excluded</span>
  </h1>
  <a class="host24" href="#" id="a1" style="display:inline-flex;color:#fff">
    <span class="fanyi-lite-source fy-btn-src" id="s4">Inside link</span>
  </a>
  <pre id="report" style="display:none"></pre>
<script>
  window.addEventListener("load", () => {
    setTimeout(() => {
      const rows = [];
      for (const id of ["s1", "s2", "s3", "s4"]) {
        const el = document.getElementById(id);
        const cs = getComputedStyle(el);
        rows.push(id + " [" + el.className + "] inline=[" + el.style.fontSize + "]"
          + " → fontSize=" + cs.fontSize + " color=" + cs.color + " opacity=" + cs.opacity
          + " display=" + cs.display + " borderLeft=" + cs.borderLeftWidth
          + " fontWeight=" + cs.fontWeight + " matchesBase=" + el.matches('html[data-fy-mode="invert"] .fanyi-lite-source:not(.fy-btn-src)')
          + " matchesDark=" + el.matches('html[data-fy-mode="invert"] .fanyi-lite-source.fy-dark-ctx:not(.fy-btn-src)'));
      }
      document.getElementById("report").textContent = rows.join("\\n");
    }, 400);
  });
<\/script>
</body></html>`;

const file = path.join(__dirname, "screenshots", "_min_css.html");
fs.writeFileSync(file, page);
const out = execSync(
  `"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --virtual-time-budget=3000 --window-size=800,600 --screenshot="${path.join(__dirname, "screenshots", "_min_css.png").replace(/\\/g, "/")}" --dump-dom "file:///${file.replace(/\\/g, "/")}" 2>nul`,
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
);
const m = out.match(/<pre id="report"[^>]*>([\s\S]*?)<\/pre>/);
console.log(m ? m[1] : "NO PAYLOAD");
fs.unlinkSync(file);
