/**
 * 生成「美拉德纯色块 + 译字」双态图标（当前图标方案）：
 *   1. headless Chrome 运行 process-flat-icon.html（纯 canvas 绘制，无需注入素材）
 *   2. dump-dom 抓取 payload 并落盘 16/32/48/128 双态图标
 *   状态语义：inactive/icon = 纯色块（未翻译）；active = 色块 + 多彩外描边（翻译中/已翻译）
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ICONS_DIR = path.join(__dirname, "fanyi-lite", "icons");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const htmlPath = path.join(__dirname, "process-flat-icon.html");

if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

const url = "file:///" + htmlPath.replace(/\\/g, "/");
const dom = execSync(
  `"${CHROME}" --headless --disable-gpu --virtual-time-budget=5000 --dump-dom "${url}" 2>nul`,
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
);

const m = dom.match(/id="payload"[^>]*>([^<]+)</);
if (!m) {
  console.error("未抓取到 payload");
  process.exit(1);
}
const payloadRaw = m[1];
if (payloadRaw.startsWith("ERROR")) {
  console.error("处理失败:", payloadRaw);
  process.exit(1);
}
const payload = JSON.parse(payloadRaw.replace(/^DATA:/, ""));

const sizes = [128, 48, 32, 16];
const decode = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");
for (const size of sizes) {
  const active = payload["active-" + size];
  const inactive = payload["inactive-" + size];
  if (!active || !inactive) {
    console.error("缺少尺寸:", size);
    process.exit(1);
  }
  fs.writeFileSync(path.join(ICONS_DIR, `active-${size}.png`), decode(active));
  fs.writeFileSync(path.join(ICONS_DIR, `inactive-${size}.png`), decode(inactive));
  fs.writeFileSync(path.join(ICONS_DIR, `icon-${size}.png`), decode(inactive)); // 默认未启用态
  console.log(`✓ ${size}x${size} 双态图标已生成`);
}
console.log("\n美拉德「译」字纯色块图标生成完成！");
