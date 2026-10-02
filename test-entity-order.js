// 从 background.js 提取真实的 decodeHtmlEntities 并验证解码正确性
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "fanyi-lite/background.js"), "utf8");

const s = src.indexOf("function decodeHtmlEntities");
const pure = src.slice(s, src.indexOf("}", src.indexOf("&amp;")) + 1);
eval(pure);

const cases = [
  // [输入, 期望]
  ["Tom &amp; Jerry", "Tom & Jerry"],                     // 普通转义
  ["It&#39;s ok &quot;quoted&quot;", "It's ok \"quoted\""], // 数字/引号实体
  ["Use &amp;lt;code&amp;gt;", "Use &lt;code&gt;"],       // 字面实体不能被双重解码
  ["A &amp;amp; B", "A &amp; B"],                          // 双重转义只解一层
  ["no entities here", "no entities here"],                // 无实体直通
  ["a&nbsp;b", "a b"],                                     // nbsp 转空格
];

let pass = 0;
for (const [input, expected] of cases) {
  const got = decodeHtmlEntities(input);
  const ok = got === expected;
  if (ok) pass++;
  console.log((ok ? "PASS" : "FAIL") + " | " + input + "  →  " + got + (ok ? "" : "  (期望: " + expected + ")"));
}
console.log("\n" + (pass === cases.length ? "=== 全部通过 ===" : "=== 有失败用例 ==="));
process.exit(pass === cases.length ? 0 : 1);
