/**
 * 奥利猫爪图标生成器 (v0.6.2)
 * 设计来源：奥利（灰色虎斑猫，白爪、粉肉垫）的照片
 * 构图：经典猫爪印 —— 4 颗趾豆 + 1 大掌垫，铺满整个画布（约为旧版尺寸的 2 倍）
 * 双态：
 *   启用态  active   → 灰色虎斑毛色 + 粉嫩肉垫（全彩，暖润可爱）
 *   未启用态 inactive → 去饱和石板灰（保持"未启用=灰"约定），对比度依然强烈
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ICONS_DIR = path.join(__dirname, "fanyi-lite", "icons");
if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

function buildSvg(isActive, size) {
  // ---- 色板（取自奥利照片：灰虎斑 + 白爪尖 + 粉肉垫）----
  const padTop    = isActive ? "#aab0b9" : "#5b6675";  // 掌垫毛色（上）
  const padBottom = isActive ? "#767d87" : "#37404e";  // 掌垫毛色（下）
  const beanTop    = isActive ? "#f7b8c8" : "#94a3b8"; // 趾豆（上）
  const beanBottom = isActive ? "#e87fa0" : "#64748b"; // 趾豆（下）
  const outline    = isActive ? "#4b5563" : "#111827"; // 描边（浅色工具栏上的硬轮廓）
  const highlight  = isActive ? "#ffffff" : "#e2e8f0"; // 高光
  const beanRing   = isActive ? "#c96a86" : "#3f4a5a"; // 趾豆描边

  // ---- 趾豆：4 颗，沿弧线排布、向两侧展开，铺满画布（画布 128，爪印范围约 4~125）----
  const toes = [
    { cx: 22,  cy: 48, rx: 15.5, ry: 19.5, rot: -22 },
    { cx: 50,  cy: 26, rx: 15,   ry: 20,   rot: -8 },
    { cx: 78,  cy: 26, rx: 15,   ry: 20,   rot: 8 },
    { cx: 106, cy: 48, rx: 15.5, ry: 19.5, rot: 22 },
  ];
  const toeSvg = toes.map((t, i) => `
    <!-- 趾豆 ${i + 1} -->
    <ellipse cx="${t.cx}" cy="${t.cy}" rx="${t.rx}" ry="${t.ry}"
             transform="rotate(${t.rot} ${t.cx} ${t.cy})"
             fill="url(#beanGrad_${isActive})"
             stroke="${beanRing}" stroke-width="3.5" />
    <!-- 趾豆高光 -->
    <ellipse cx="${t.cx - t.rx * 0.28}" cy="${t.cy - t.ry * 0.32}" rx="${t.rx * 0.34}" ry="${t.ry * 0.24}"
             transform="rotate(${t.rot} ${t.cx} ${t.cy})"
             fill="${highlight}" opacity="${isActive ? 0.55 : 0.4}" />`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}">
    <defs>
      <linearGradient id="padGrad_${isActive}" x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stop-color="${padTop}" />
        <stop offset="100%" stop-color="${padBottom}" />
      </linearGradient>
      <linearGradient id="beanGrad_${isActive}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${beanTop}" />
        <stop offset="100%" stop-color="${beanBottom}" />
      </linearGradient>
    </defs>

    <!-- 大掌垫：宽大心形掌面，顶满画布下缘 -->
    <path d="M 64 56
             C 80 50 100 52 110 62
             C 122 74 123 92 115 106
             C 106 122 87 127 64 127
             C 41 127 22 122 13 106
             C 5 92 6 74 18 62
             C 28 52 48 50 64 56 Z"
          fill="url(#padGrad_${isActive})"
          stroke="${outline}" stroke-width="4" stroke-linejoin="round" />

    <!-- 掌垫顶部双圆弧凹陷（猫掌中沟） -->
    <path d="M 44 66 Q 54 75 64 66 Q 74 75 84 66"
          fill="none" stroke="${outline}" stroke-width="3" stroke-linecap="round" opacity="0.35" />

    <!-- 掌垫高光 -->
    <ellipse cx="42" cy="86" rx="17" ry="11" transform="rotate(-18 42 86)"
             fill="${highlight}" opacity="${isActive ? 0.28 : 0.18}" />

    <!-- 四颗趾豆 -->
    ${toeSvg}
  </svg>`;
}

const sizes = [16, 32, 48, 128];
const states = [
  { name: "active", isActive: true },
  { name: "inactive", isActive: false },
];

for (const s of states) {
  for (const size of sizes) {
    const svg = buildSvg(s.isActive, size);
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;overflow:hidden;width:${size}px;height:${size}px;">${svg}</body></html>`;
    const tempHtml = path.join(__dirname, `temp_paw_${s.name}_${size}.html`);
    fs.writeFileSync(tempHtml, html, "utf8");

    const outPng = path.join(ICONS_DIR, `${s.name}-${size}.png`);
    const winHtmlPath = "file:///" + tempHtml.replace(/\\/g, "/");
    const winPngPath = outPng.replace(/\//g, "\\");

    try {
      execSync(
        `"${CHROME}" --headless --disable-gpu --default-background-color=00000000 --screenshot="${winPngPath}" --window-size=${size},${size} "${winHtmlPath}"`,
        { stdio: "ignore" }
      );
      console.log(`Generated: ${s.name}-${size}.png`);
    } catch (e) {
      console.error(`Failed ${s.name}-${size}:`, e.message);
    } finally {
      if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
    }
  }
}

// 默认初始图标 = 未启用态（灰爪）
for (const size of sizes) {
  fs.copyFileSync(
    path.join(ICONS_DIR, `inactive-${size}.png`),
    path.join(ICONS_DIR, `icon-${size}.png`)
  );
}

console.log("Oli paw icons generated!");
