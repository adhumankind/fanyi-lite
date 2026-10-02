/**
 * 商店上架截图生成：node store-shot.js
 * 用真实渲染管线（collectParagraphs + render）在 DeepMind 风格页面上渲染三种模式，
 * 输出 1280x800 截图到 dist/store-{mode}.png（Chrome 应用商店要求 1280x800 或 640x400）。
 * 同时输出逐单元渲染结果用于诊断。
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "fanyi-lite");
const css = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
const contentSrc = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DIST = path.join(__dirname, "dist");

const sPure = contentSrc.indexOf("const IGNORE_TAGS =");
const ePure = contentSrc.indexOf("const sleep = (ms)");
const pureSrc = contentSrc.slice(sPure, ePure);

function buildPage(mode) {
  return `<!DOCTYPE html>
<html lang="en" data-fy-mode="${mode}">
<head><meta charset="utf-8"><style>${css.replace(/<\/style>/g, "<\\/style>")}</style>
<style>
  * { box-sizing: border-box; }
  body { margin:0; background:#101322; color:#e8eaed; font-family:"Google Sans", "Segoe UI", Roboto, Arial, sans-serif; }
  .topbar { display:flex; align-items:center; justify-content:space-between; padding:18px 48px; border-bottom:1px solid rgba(255,255,255,.08); }
  .brand { font-size:18px; font-weight:700; color:#fff; letter-spacing:.5px; }
  .nav { display:flex; gap:26px; }
  .nav a { color:#a8c7fa; text-decoration:none; font-size:14px; }
  .hero { padding:56px 48px 40px; max-width:1080px; margin:0 auto; }
  h1.hero-title { font-size:42px; line-height:1.18; font-weight:700; color:#fff; margin:0 0 14px; }
  p.sub { font-size:17px; color:#c7c9d1; margin:0 0 24px; max-width:760px; }
  .row { display:flex; gap:14px; }
  a.chip { display:inline-flex; align-items:center; padding:10px 22px; border-radius:999px; font-size:14px; font-weight:500; text-decoration:none; }
  a.chip-solid { background:#0b57d0; color:#fff; }
  a.chip-ghost { background:#f0f4f9; color:#1f1f1f; }
  section { max-width:1080px; margin:0 auto; padding:28px 48px 60px; }
  h2 { font-size:26px; font-weight:600; color:#fff; margin:0 0 14px; }
  p.body { font-size:15px; line-height:1.75; color:#c7c9d1; margin:0 0 14px; }
  ul.body { font-size:15px; line-height:1.8; color:#c7c9d1; margin:0; padding-left:22px; }
</style></head>
<body>
  <div class="topbar">
    <div class="brand">Nebula Research</div>
    <nav class="nav">
      <a href="/home">Home</a><a href="/research">Research</a><a href="/blog">Blog</a><a href="/about">About</a>
    </nav>
  </div>
  <div class="hero">
    <h1 class="hero-title">Responsible AI: building the next era of intelligence</h1>
    <p class="sub">Our mission is to build AI responsibly to benefit humanity, with safety at the core of every model we ship.</p>
    <div class="row">
      <a class="chip chip-solid" href="/build">Build with Gemini</a>
      <a class="chip chip-ghost" href="/try">Try in Studio</a>
    </div>
  </div>
  <section>
    <h2>Latest news</h2>
    <p class="body" id="prose">We are introducing <a href="/synthid">SynthID</a>, a new method for detecting AI-generated content across text, images and audio.</p>
    <ul class="body">
      <li>Frontier safety evaluations for next-generation models.</li>
      <li>Multimodal reasoning with long-context memory.</li>
      <li>Open datasets and benchmarks for the research community.</li>
    </ul>
  </section>
  <pre id="report" style="display:none"></pre>
<script>
  const chrome = {
    runtime: { onMessage: { addListener() {} }, sendMessage() {} },
    storage: { local: { get(def, cb) { if (cb) cb(def); } }, onChanged: { addListener() {} } },
  };
  const __INTENDED_MODE = document.documentElement.dataset.fyMode;
  ${pureSrc}
  // pure 切片的初始化会把 currentMode 重置为默认 follow，这里恢复为本截图应展示的模式
  currentMode = __INTENDED_MODE;
  document.documentElement.dataset.fyMode = __INTENDED_MODE;

  const TRANS = {
    "Home": "首页", "Research": "研究", "Blog": "博客", "About": "关于",
    "Responsible AI: building the next era of intelligence": "负责任的 AI：构建下一个智能时代",
    "Our mission is to build AI responsibly to benefit humanity, with safety at the core of every model we ship.":
      "我们的使命是负责任地构建人工智能以造福人类，让安全成为每一款模型的核心。",
    "Build with Gemini": "使用 Gemini 构建", "Try in Studio": "在 Studio 中试用",
    "Latest news": "最新消息",
    // 注意：getDirectText 会在链接文本前拼一个空格 → "SynthID , a new method"
    "We are introducing SynthID , a new method for detecting AI-generated content across text, images and audio.":
      "我们正在推出 SynthID——一种可检测文本、图像与音频中 AI 生成内容的新方法。",
    "Frontier safety evaluations for next-generation models.": "面向下一代模型的前沿安全评估。",
    "Multimodal reasoning with long-context memory.": "具备长上下文记忆的多模态推理。",
    "Open datasets and benchmarks for the research community.": "面向研究社区的开源数据集与基准。",
  };
  window.addEventListener("load", () => {
    setTimeout(() => {
      const units = collectParagraphs();
      const results = [];
      let n = 0;
      for (const u of units) {
        const t = TRANS[u.rawText] || TRANS[u.text];
        const ok = t ? render(u, t) : "no-trans";
        results.push(u.el.tagName + "=" + ok);
        if (ok === true) n++;
      }
      const pEl = document.getElementById("prose");
      document.getElementById("report").textContent =
        "MODE:" + currentMode + " RENDERED:" + n + "/" + units.length +
        " | " + results.join(";") +
        " || P_HAS_TARGET:" + !!pEl.querySelector("font.fanyi-lite-target") +
        " P_HAS_SOURCE:" + !!pEl.querySelector(".fanyi-lite-source") +
        " || P_HTML:" + pEl.innerHTML.slice(0, 300);
    }, 200);
  });
<\/script>
</body></html>`;
}

const modes = ["follow", "replace", "invert"];
fs.mkdirSync(DIST, { recursive: true });
for (const mode of modes) {
  const file = path.join(DIST, `_shot_${mode}.html`);
  fs.writeFileSync(file, buildPage(mode));
  const url = "file:///" + file.replace(/\\/g, "/");
  const dom = execSync(
    `"${CHROME}" --headless --disable-gpu --virtual-time-budget=4000 --window-size=1280,800 --screenshot="${path.join(DIST, `store-${mode}.png`).replace(/\\/g, "/")}" --dump-dom "${url}" 2>nul`,
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  const report = dom.match(/MODE:[^<]*/);
  console.log(`[${mode}]`, report ? report[0] : "NO REPORT");
  fs.unlinkSync(file);
}
