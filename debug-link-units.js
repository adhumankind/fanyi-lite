/**
 * 链接单元死区修复 真实 DOM 验收：node debug-link-units.js
 * 真实 Chrome 中运行 collectParagraphs + render 生产管线，覆盖：
 *   导航 <li><a> / 标题 <h2><a> / 表格 <td><a> / 正文内嵌链接 / 独立胶囊按钮
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

// 段落提取+渲染区（IGNORE_TAGS → sleep 之前，含 collectParagraphs/render/placeWrapper 全套）
const sPure = contentSrc.indexOf("const IGNORE_TAGS =");
const ePure = contentSrc.indexOf("const sleep = (ms)");
const pureSrc = contentSrc.slice(sPure, ePure);

const page = `<!DOCTYPE html>
<html lang="en" data-fy-mode="follow">
<head><meta charset="utf-8"><style>${css.replace(/<\/style>/g, "<\\/style>")}</style>
<style>
  body { font-family: sans-serif; margin: 24px; background: #f6f7f9; }
  .nav { display: flex; gap: 18px; list-style: none; padding: 0; }
  table { border-collapse: collapse; margin: 12px 0; }
  td { border: 1px solid #ccc; padding: 6px 12px; }
  .chip { display: inline-flex; padding: 6px 16px; border-radius: 999px; background: #0b57d0; color: #fff; text-decoration: none; margin-right: 8px; }
</style></head>
<body>
  <ul class="nav">
    <li><a href="/home">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
  <h2><a href="/start">Getting started</a></h2>
  <table><tr><td><a href="/pricing">Pricing</a></td></tr></table>
  <p id="prose">We work closely with <a href="/partners">our partners</a> to advance safety.</p>
  <div class="actions">
    <a class="chip" href="/build">Build</a>
    <a class="chip" href="/try">Try</a>
  </div>
  <pre id="report" style="display:none"></pre>
<script>
  // 页面级 chrome 桩（pure 切片顶层会注册消息监听/读取存储）
  const chrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() {},
    },
    storage: {
      local: { get(def, cb) { if (cb) cb(def); } },
      onChanged: { addListener() {} },
    },
  };
  ${pureSrc}

  const TRANS = {
    "Home": "首页", "About": "关于", "Getting started": "快速上手", "Pricing": "价格",
    "We work closely with our partners to advance safety.": "我们与合作伙伴紧密协作以推进安全。",
    "Build": "构建", "Try": "试用",
  };
  window.addEventListener("load", () => {
    setTimeout(() => {
      const lines = [];
      const units = collectParagraphs();
      lines.push("units=" + units.length);
      for (const u of units) {
        lines.push("unit <" + u.el.tagName + "> text=\\"" + u.text + "\\"");
        const t = TRANS[u.text] || "【" + u.text + "】";
        render(u, t);
      }
      // 验收点
      const navLi = document.querySelector(".nav li");
      const h2 = document.querySelector("h2");
      const td = document.querySelector("td");
      const prose = document.getElementById("prose");
      const chips = document.querySelectorAll(".chip");
      const cloneIn = (host) => {
        const c = host.querySelector(":scope > a.fanyi-lite-cloned-link");
        return c ? c.getAttribute("href") + "|" + (c.querySelector("font.fanyi-lite-target") ? "有译文" : "无译文") : "无克隆";
      };
      lines.push("li克隆=" + cloneIn(navLi));
      lines.push("h2克隆=" + cloneIn(h2));
      lines.push("td克隆=" + cloneIn(td));
      lines.push("p克隆=" + (prose.querySelector("a.fanyi-lite-cloned-link") ? "有(不应有)" : "无") +
        " p内原文链接保留=" + !!prose.querySelector(".fanyi-lite-source a[href='/partners']") +
        " p内译文=" + !!prose.querySelector("font.fanyi-lite-target"));
      lines.push("chip1译文在A内=" + !!chips[0].querySelector("font.fanyi-lite-target") +
        " chip1克隆=" + (chips[0].querySelector("a.fanyi-lite-cloned-link") ? "有" : "无"));
      document.getElementById("report").textContent = lines.join("\\n");
    }, 150);
  });
<\/script>
</body></html>`;

const file = path.join(__dirname, "screenshots", "_dbg_links.html");
fs.writeFileSync(file, page);
const out = execSync(
  `"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --virtual-time-budget=3000 --window-size=900,600 --screenshot="${path.join(__dirname, "screenshots", "_dbg_links.png").replace(/\\/g, "/")}" --dump-dom "file:///${file.replace(/\\/g, "/")}" 2>nul`,
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
);
const m = out.match(/<pre id="report"[^>]*>([\s\S]*?)<\/pre>/);
console.log(m ? m[1] : "NO PAYLOAD\n" + out.slice(-1200));
fs.unlinkSync(file);
