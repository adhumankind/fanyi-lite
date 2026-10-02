/**
 * 生成插件图标脚本：
 * 使用 Headless Chrome 将纯矢量 SVG 渲染为高清透明底 PNG
 * 生成 16, 32, 48, 128 尺寸的 active（琥珀暖金）和 inactive（优雅冷灰）两套图标
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const outDir = path.join(__dirname, "fanyi-lite", "icons");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function getSvg(isActive) {
  // 色彩配置
  const primaryStart = isActive ? "#f59e0b" : "#94a3b8";
  const primaryMid   = isActive ? "#d97706" : "#64748b";
  const primaryDark  = isActive ? "#b45309" : "#475569";
  const sparkColor   = isActive ? "#fbbf24" : "#cbd5e1";
  const ringGlow     = isActive ? "rgba(245, 158, 11, 0.4)" : "rgba(148, 163, 184, 0.25)";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
    <defs>
      <linearGradient id="mainGrad" x1="15%" y1="10%" x2="85%" y2="90%">
        <stop offset="0%" stop-color="${primaryStart}" />
        <stop offset="50%" stop-color="${primaryMid}" />
        <stop offset="100%" stop-color="${primaryDark}" />
      </linearGradient>
      <linearGradient id="secGrad" x1="85%" y1="15%" x2="15%" y2="85%">
        <stop offset="0%" stop-color="${sparkColor}" />
        <stop offset="100%" stop-color="${primaryDark}" />
      </linearGradient>
      <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- 外围呼吸光环 -->
    <circle cx="64" cy="64" r="54" fill="none" stroke="${ringGlow}" stroke-width="3" stroke-dasharray="8 6" />

    <!-- 左侧透镜环 (向右倾斜 30度) -->
    <ellipse cx="54" cy="64" rx="36" ry="24" transform="rotate(-28 54 64)"
             fill="none" stroke="url(#mainGrad)" stroke-width="7" stroke-linecap="round" />

    <!-- 右侧透镜环 (向左倾斜 30度，形成双环交织几何) -->
    <ellipse cx="74" cy="64" rx="36" ry="24" transform="rotate(28 74 64)"
             fill="none" stroke="url(#secGrad)" stroke-width="7" stroke-linecap="round" opacity="0.92" />

    <!-- 核心交汇处：语言灵犀八角星辉 (无需文字，纯图形元素) -->
    <g transform="translate(64, 64) scale(0.9)">
      <!-- 竖向菱形星芒 -->
      <path d="M 0 -18 Q 2 -4 14 0 Q 2 4 0 18 Q -2 4 -14 0 Q -2 -4 0 -18 Z" fill="url(#mainGrad)" />
      <!-- 斜向次级星芒 -->
      <path d="M 0 -11 Q 1 -2 9 0 Q 1 2 0 11 Q -1 2 -9 0 Q -1 -2 0 -11 Z"
            fill="${sparkColor}" transform="rotate(45)" opacity="0.85" />
      <!-- 中心聚焦晶核圆点 -->
      <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
    </g>
  </svg>`;
}

// 编写 HTML 模板供无头 Chrome 批量截取纯透明 PNG
const htmlPath = path.join(__dirname, "temp-icons.html");
const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background: transparent; }
  .grid { display: flex; flex-direction: column; }
  .icon-box { display: inline-block; background: transparent; }
</style>
</head>
<body>
  <div id="active-128" class="icon-box" style="width:128px;height:128px;">${getSvg(true)}</div>
  <div id="inactive-128" class="icon-box" style="width:128px;height:128px;">${getSvg(false)}</div>
</body>
</html>`;

fs.writeFileSync(htmlPath, htmlContent, "utf8");
console.log("HTML generator ready.");
