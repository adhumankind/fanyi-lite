/**
 * 三大显示模式端到端生效验证（DeepMind 真实结构版）：node test-mode-e2e.js
 * 复刻 DeepMind About 页结构：flex 大标题 hero + 黑色胶囊按钮 + h2 章节 + 正文段落 + ul 列表。
 * 断言译文 = inline style 直拷宿主（而非 CSS inherit 的错误继承链）。
 * v0.8.3 增补：invert 原文注释按父级上下文字号（不再 0.85em 巨型注释）、按钮/独立链接全模式与原件同款排版。
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "fanyi-lite");
const css = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
const contentSrc = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");

// 提取 applyHostFontStyles / placeWrapper / isInteractiveUnitContext / applySourceAnnotationStyle 用于测试注入
const sFont = contentSrc.indexOf("function applyHostFontStyles");
const sPlace = contentSrc.indexOf("function placeWrapper(");
const ePlace = contentSrc.indexOf("\n  }\n", contentSrc.indexOf("insertAdjacentElement", sPlace)) + 4;
const fontFnSrc = contentSrc.slice(sFont, contentSrc.indexOf("function placeWrapper("));
const placeFnSrc = contentSrc.slice(sPlace, ePlace);
const sInteractive = contentSrc.indexOf("function isInteractiveUnitContext");
const interactiveFnSrc = contentSrc.slice(sInteractive, contentSrc.indexOf("\n  }\n", sInteractive) + 4);
const sAnnotation = contentSrc.indexOf("function applySourceAnnotationStyle");
const annotationFnSrc = contentSrc.slice(sAnnotation, contentSrc.indexOf("function clearSourceAnnotationStyle"));

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TMP = path.join(__dirname, "screenshots");

let allPass = true;
function check(name, cond, detail = "") {
  if (!cond) allPass = false;
  console.log(name + ": " + (cond ? "PASS" : "FAIL") + (detail ? "  → " + detail : ""));
}

// ================= 构建 DeepMind 结构测试页 =================
function buildPage(mode) {
  const cssText = css.replace(/<\/style>/g, "<\\/style>");
  return `<!DOCTYPE html>
<html lang="zh-CN" data-fy-mode="${mode}">
<head>
<style>${cssText}</style>
<style>
  /* 复刻 DeepMind 关键结构 */
  body { margin:0; font-family:"Google Sans", Roboto, Arial, sans-serif; background:#fff; color:#202124; }
  .hero { display:flex; flex-direction:column; align-items:center; padding:40px 20px; }
  .eyebrow { font-size:14px; color:#5f6368; }
  h1.hero-title {
    font-size:44px; font-weight:700; line-height:1.15; text-align:center;
    max-width:720px; margin:8px 0 0; color:#202124;
    display:flex; flex-wrap:wrap; justify-content:center; /* DeepMind 大标题就是 flex wrap */
  }
  .btn-row { display:flex; gap:12px; margin-top:28px; align-items:center; }
  .btn {
    display:flex; align-items:center; padding:10px 22px; border-radius:999px;
    font-size:14px; font-weight:500;
  }
  .btn-dark { background:#0b57d0; color:#ffffff; }
  .btn-light { background:#f0f4f9; color:#1f1f1f; }
  .chip { font-size:14px; color:#0b57d0; text-decoration:none; }
  section { max-width:800px; margin:40px auto; padding:0 20px; }
  h2 { font-size:28px; font-weight:500; }
  p.body, li.body { font-size:15px; line-height:1.7; color:#3c4043; }
</style>
</head>
<body>
  <div class="hero">
    <div class="eyebrow" data-fy-p="1" id="eyebrowHost">
      <span class="fanyi-lite-source" id="eyebrowSource">About Google DeepMind</span>
    </div>
    <h1 class="hero-title" data-fy-p="1" id="heroHost">
      <span class="fanyi-lite-source" id="heroSource">Our mission is to build AI responsibly to benefit humanity</span>
    </h1>
    <div class="btn-row">
      <button class="btn btn-dark" data-fy-p="1" id="btnHost">
        <span class="fanyi-lite-source" id="btnSource">Our vision</span>
      </button>
      <a class="chip" href="#" data-fy-p="1" id="chipHost">
        <span class="fanyi-lite-source" id="chipSource">Learn more</span>
      </a>
    </div>
  </div>
  <section>
    <h2 data-fy-p="1" id="h2Host">
      <span class="fanyi-lite-source" id="h2Source">Our vision</span>
    </h2>
    <p class="body" data-fy-p="1" id="pHost">
      <span class="fanyi-lite-source" id="pSource">We live in an exciting time when AI research and technology are delivering extraordinary advances.</span>
    </p>
    <ul>
      <li class="body" data-fy-p="1" id="liHost">
        <span class="fanyi-lite-source" id="liSource">We are a team of scientists, engineers, ethicists and more.</span>
      </li>
    </ul>
  </section>
  <div id="report" style="display:none"></div>
  <script>
    // ===== 内联：content.js 的 applyHostFontStyles 与 placeWrapper 逻辑 =====
    const TARGET_CLASS = "fanyi-lite-target";
    const SOURCE_CLASS = "fanyi-lite-source";
    ${fontFnSrc}
    ${placeFnSrc}
    ${interactiveFnSrc}
    ${annotationFnSrc}

    // 模拟 content.js render() 的译文创建流程（三种模式的插入位置）
    function renderInto(hostId, text, mode) {
      const el = document.getElementById(hostId);
      const wrapper = document.createElement("font");
      wrapper.className = TARGET_CLASS;
      // 交互单元判定与排版策略对齐 content.js render()：
      // 按钮/独立链接全模式与原件 100% 同款（不微缩、颜色 inline 直拷）
      const isBtn = isInteractiveUnitContext(el);
      if (isBtn) wrapper.classList.add("fy-btn-ctx");
      if (el.classList.contains("btn-dark")) wrapper.classList.add("fy-dark-ctx");
      applyHostFontStyles(el, wrapper, mode === "follow" && !isBtn ? 0.92 : 1);
      const inner = document.createElement("span");
      inner.className = "fanyi-lite-inner";
      inner.textContent = text;
      wrapper.appendChild(inner);
      // mode 感知插入（对齐 content.js placeWrapper 的语义）
      const sourceSpan = el.querySelector(":scope > ." + SOURCE_CLASS);
      const invert = mode === "invert";
      if (sourceSpan) {
        if (isBtn) sourceSpan.classList.add("fy-btn-src");
        // invert：非交互单元的原文按父级上下文字号穿注释样式（按钮内原文豁免）
        if (invert && !isBtn) applySourceAnnotationStyle(sourceSpan, el);
        if (invert) sourceSpan.before(wrapper); else sourceSpan.after(wrapper);
      } else {
        if (invert) el.before(wrapper); else el.insertAdjacentElement("afterend", wrapper);
      }
      return wrapper;
    }

    window.addEventListener("load", () => {
      setTimeout(() => {
        const mode = document.documentElement.dataset.fyMode;
        const targets = {};
        const makeTarget = (hostId, text) => {
          const w = renderInto(hostId, text, mode);
          targets[hostId] = w;
        };
        makeTarget("heroHost", "我们的使命是负责任地构建人工智能以造福人类");
        makeTarget("eyebrowHost", "关于谷歌DeepMind");
        makeTarget("btnHost", "我们的愿景");
        makeTarget("chipHost", "了解更多");
        makeTarget("h2Host", "我们的愿景");
        makeTarget("pHost", "我们生活在一个激动人心的时代，人工智能研究和技术正在取得非凡的进步。");
        makeTarget("liHost", "我们是一支由科学家、工程师、伦理学家等组成的团队。");

        const grab = (w) => {
          const cs = getComputedStyle(w);
          return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color };
        };
        const report = {};
        for (const [id, w] of Object.entries(targets)) {
          report[id] = {
            target: grab(w),
            inlineFontSize: w.style.fontSize,
            inlineColor: w.style.color,
            hostFontSize: getComputedStyle(document.getElementById(id)).fontSize,
            hostColor: getComputedStyle(document.getElementById(id)).color,
            btnCtx: w.classList.contains("fy-btn-ctx"),
            sourceDisplay: (() => { const s = document.querySelector("#" + id + " > .fanyi-lite-source"); return s ? getComputedStyle(s).display : "n/a"; })(),
            sourceFontSize: (() => { const s = document.querySelector("#" + id + " > .fanyi-lite-source"); return s ? getComputedStyle(s).fontSize : "0px"; })(),
            sourceColor: (() => { const s = document.querySelector("#" + id + " > .fanyi-lite-source"); return s ? getComputedStyle(s).color : "n/a"; })(),
            sourceBtnSrc: (() => { const s = document.querySelector("#" + id + " > .fanyi-lite-source"); return s ? s.classList.contains("fy-btn-src") : false; })()
          };
        }
        const div = document.getElementById("report");
        div.setAttribute("data-payload", encodeURIComponent(JSON.stringify(report)));
      }, 120);
    });
  <\/script>
</body>
</html>`;
}

function measure(mode) {
  const page = buildPage(mode);
  const file = path.join(TMP, `_e2e_${mode}.html`);
  fs.writeFileSync(file, page);
  const url = "file:///" + file.replace(/\\/g, "/");
  const out = execSync(
    `"${CHROME}" --headless --disable-gpu --virtual-time-budget=2500 --dump-dom "${url}" 2>nul`,
    { encoding: "utf8" }
  );
  try { fs.unlinkSync(file); } catch {}
  const m = out.match(/data-payload="([^"]*)"/);
  if (!m) throw new Error("payload missing for " + mode);
  return JSON.parse(decodeURIComponent(m[1]));
}
const { execSync } = require("child_process");

const follow = measure("follow");
const replace = measure("replace");
const invert = measure("invert");
const px = (v) => parseFloat(v);

// ================= 核心断言：DeepMind 场景 =================

// ---- 大标题 hero（44px flex 容器）----
check("follow·大标题译文≈0.92倍宿主(40.5px)且不抢层级",
  Math.abs(px(follow.heroHost.target.fontSize) - 44 * 0.92) < 1.5,
  `follow=${follow.heroHost.target.fontSize} (宿主44px)`);
check("replace·大标题译文=44px 100%克隆（DeepMind 事故修复核心）",
  px(replace.heroHost.target.fontSize) === 44 && px(replace.heroHost.inlineFontSize) === 44,
  `inline=${replace.heroHost.inlineFontSize} computed=${replace.heroHost.target.fontSize}`);
check("replace·大标题译文字重/颜色克隆",
  replace.heroHost.target.fontWeight === "700" && replace.heroHost.target.color === "rgb(32, 33, 36)",
  `weight=${replace.heroHost.target.fontWeight} color=${replace.heroHost.target.color}`);
check("replace·大标题内原文隐藏",
  replace.heroHost.sourceDisplay === "none");
check("invert·大标题译文=44px 主字号（译文当主角）",
  px(invert.heroHost.target.fontSize) === 44 && invert.heroHost.target.fontWeight === "700",
  `computed=${invert.heroHost.target.fontSize} weight=${invert.heroHost.target.fontWeight}`);
check("invert·大标题原文注释按父级上下文 0.92×16≈14.72px（不再 0.85em 巨型注释）",
  Math.abs(px(invert.heroHost.sourceFontSize) - 14.72) < 1,
  `sourceFontSize=${invert.heroHost.sourceFontSize}`);
check("invert·大标题原文注释为摩卡褐弱化色",
  invert.heroHost.sourceColor === "rgb(74, 52, 37)",
  `sourceColor=${invert.heroHost.sourceColor}`);

// ---- 章节标题 h2（28px）----
check("replace·h2 译文=28px 继承章节标题字号",
  px(replace.h2Host.target.fontSize) === 28,
  `inline=${replace.h2Host.inlineFontSize} computed=${replace.h2Host.target.fontSize}`);
check("invert·h2 译文=28px 主字号",
  px(invert.h2Host.target.fontSize) === 28);

// ---- 正文段落 p（15px）----
check("replace·正文译文=15px 与宿主一致",
  px(replace.pHost.target.fontSize) === 15 && replace.pHost.target.color === replace.pHost.hostColor,
  `computed=${replace.pHost.target.fontSize} color=${replace.pHost.target.color}`);
check("follow·正文译文=13.8px(0.92×15) 微缩但接近",
  Math.abs(px(follow.pHost.target.fontSize) - 13.8) < 0.6,
  `computed=${follow.pHost.target.fontSize}`);
check("follow·follow 模式译文无 inline 颜色（美拉德 CSS 注释色接管）",
  !follow.pHost.inlineColor, `inlineColor="${follow.pHost.inlineColor}"`);
check("replace·replace 模式译文带 inline 颜色（宿主直控）",
  !!replace.pHost.inlineColor, `inlineColor="${replace.pHost.inlineColor}"`);

// ---- 按钮与独立链接：全模式与原件 100% 同款排版 ----
check("follow·黑按钮译文=白色(与原件一致，inline 克隆优先于注释色)",
  follow.btnHost.target.color === "rgb(255, 255, 255)",
  `color=${follow.btnHost.target.color}`);
check("follow·黑按钮译文=14px 不微缩(按钮内中文与英文同字号)",
  px(follow.btnHost.target.fontSize) === 14,
  `fontSize=${follow.btnHost.target.fontSize}`);
check("replace·黑按钮译文=白色(按钮反色由 inline 克隆)",
  replace.btnHost.target.color === "rgb(255, 255, 255)",
  `color=${replace.btnHost.target.color}`);
check("invert·黑按钮译文=白色主显",
  invert.btnHost.target.color === "rgb(255, 255, 255)",
  `color=${invert.btnHost.target.color}`);
check("invert·按钮内英文原文保持原生可读(不被注释化)",
  invert.btnHost.sourceBtnSrc && px(invert.btnHost.sourceFontSize) === 14,
  `sourceFontSize=${invert.btnHost.sourceFontSize} btnSrc=${invert.btnHost.sourceBtnSrc}`);

// ---- 独立文字链 chip（a[href] 不在散文内 → 交互单元）----
check("follow·chip 译文命中交互单元排版(fy-btn-ctx)",
  follow.chipHost.btnCtx === true);
check("follow·chip 译文=14px 链接蓝(与原件一致，非美拉德注释色)",
  px(follow.chipHost.target.fontSize) === 14 && follow.chipHost.target.color === "rgb(11, 87, 208)",
  `fontSize=${follow.chipHost.target.fontSize} color=${follow.chipHost.target.color}`);
check("invert·chip 内英文保持链接蓝不被注释化",
  invert.chipHost.sourceBtnSrc && invert.chipHost.sourceColor === "rgb(11, 87, 208)",
  `sourceColor=${invert.chipHost.sourceColor}`);
check("replace·chip 译文=链接蓝 14px",
  px(replace.chipHost.target.fontSize) === 14 && replace.chipHost.target.color === "rgb(11, 87, 208)",
  `fontSize=${replace.chipHost.target.fontSize} color=${replace.chipHost.target.color}`);

// ---- 列表 li ----
check("replace·列表译文=15px 宿主一致",
  px(replace.liHost.target.fontSize) === 15);

// ---- DOM 结构：译文在宿主内部、紧跟 source（flex 容器不折行原文）----
const heroHostHtml = execSync(
  `"${CHROME}" --headless --disable-gpu --virtual-time-budget=2500 --dump-dom "${("file:///" + path.join(TMP, "_e2e_dom.html").replace(/\\/g, "/"))}" 2>nul`,
  { encoding: "utf8", input: "" }
).toString() || "";
{
  // 重新生成一个 invert 页检查 DOM 顺序
  const page = buildPage("invert");
  const file = path.join(TMP, "_e2e_dom.html");
  fs.writeFileSync(file, page);
  const out = execSync(
    `"${CHROME}" --headless --disable-gpu --virtual-time-budget=2500 --dump-dom "${("file:///" + file.replace(/\\/g, "/"))}" 2>nul`,
    { encoding: "utf8" }
  );
  try { fs.unlinkSync(file); } catch {}
  // hero h1 内：译文应在 source 之前（invert），且均仍在 h1 内部
  const h1Match = out.match(/<h1[^]*?<\/h1>/);
  const h1 = h1Match ? h1Match[0] : "";
  check("invert·hero 内译文在 source 之前（DOM 重排）",
    h1.indexOf("fanyi-lite-target") < h1.indexOf("fanyi-lite-source") && h1.includes("fanyi-lite-target"),
    "h1 内部顺序正确");
  check("invert·hero 译文仍在 h1 内部（不成为 section 兄弟）",
    h1.includes("fanyi-lite-inner"));
  // replace 时 source display:none 由 CSS 保证；确认 target 是 h1 的直接子元素
  const pMatch = out.match(/<p[^>]*data-fy-p="1"[^>]*>[\s\S]*?<\/p>/);
  check("invert·段落译文在 p 内部（字节上下文一致）",
    pMatch && pMatch[0].includes("fanyi-lite-inner"));
}

void heroHostHtml;

console.log("\n" + (allPass ? "=== DeepMind结构 E2E 26 项全部通过 ===" : "=== 存在失败用例 ==="));
process.exit(allPass ? 0 : 1);
