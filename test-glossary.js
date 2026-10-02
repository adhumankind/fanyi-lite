/**
 * 术语保护/还原引擎单元测试（v0.5.0 单一合并正则版）：
 *   node test-glossary.js
 * 用例1：命中术语 → 占位替换，原词零泄漏
 * 用例2：长词优先（"AI assistant" 不被 "AI" 抢匹配）
 * 用例3：模拟过机透传 → 还原官方译名
 * 用例4：占位符形变容忍（空白/大小写）
 * 用例5：记号前缀本身作为词条也不自噬（ZGQ/GZQ 对抗测试）
 * 用例6：残留记号兜底清除（不泄漏内部记号）
 * 用例7：无命中零改动 + 术语表文本解析
 * 用例8：URL 行业识别
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "fanyi-lite/content.js"), "utf8");

const s = src.indexOf("/* ================= 行业识别与术语保护引擎");
const e = src.indexOf("async function toggle(");
const pure = src.slice(s, e);

const TEST_RULES = [
  { industry: "tech", hosts: ["github.com", "stackoverflow.com", "npmjs.com", "juejin.cn", "v2ex.com"] },
  { industry: "academic", hosts: ["arxiv.org", "ieee.org", "nature.com", "springer.com"] },
  { industry: "medical", hosts: ["webmd.com", "nih.gov", "mayoclinic.org"] },
  { industry: "legal", hosts: ["law.cornell.edu", "lexisnexis.com"] },
  { industry: "finance", hosts: ["reuters.com", "bloomberg.com", "wsj.com", "ft.com"] },
  { industry: "ecommerce", hosts: ["amazon.com", "ebay.com", "aliexpress.com"] },
  { industry: "gaming", hosts: ["store.steampowered.com", "epicgames.com", "ign.com"] },
  { industry: "industrial", hosts: ["siemens.com", "abb.com", "honeywell.com"] },
];

const factory = new Function(
  "const INDUSTRY_URL_RULES = " + JSON.stringify(TEST_RULES) + ";" +
  "const INDUSTRY_PRESETS = {};" +
  "let currentIndustry = 'general'; let userGlossary = []; let activeGlossary = []; let compiledGlossary = null;" +
  pure +
  "\nreturn { parseGlossaryText, detectIndustryByUrl, protectGlossaryTerms, restoreGlossaryTerms, escapeRegExp, buildActiveGlossary, setGlossary: (g) => { userGlossary = g; buildActiveGlossary(); } };"
);

const api = factory();
const { parseGlossaryText, detectIndustryByUrl, protectGlossaryTerms, restoreGlossaryTerms } = api;

// 含正则元字符、记号前缀词条、长短词嵌套的对抗性词表
const glossary = [
  { s: "AI", t: "人工智能" },
  { s: "AI assistant", t: "AI 智能助手" },   // 长词，不得被 AI 抢匹配
  { s: "API", t: "应用程序接口" },
  { s: "Kubernetes", t: "Kubernetes 容器编排平台" },
  { s: "side effect", t: "副作用" },
  { s: "C++", t: "C++ 编程语言" },            // 正则元字符
  { s: "ZGQ", t: "占位前缀对抗词" },          // 与记号前缀同名
  { s: "GZQ", t: "占位后缀对抗词" },
];
api.setGlossary(glossary); // 预编译合并正则（对齐生产 buildActiveGlossary 流程）

let allPass = true;
function check(name, cond, detail = "") {
  if (!cond) allPass = false;
  console.log(name + ": " + (cond ? "PASS" : "FAIL") + (detail ? "  → " + detail : ""));
}

// 用例1：命中词替换为记号，原词不出现在待译文本（该句命中 Kubernetes/API/side effect 三条）
{
  const input = "The Kubernetes API has no side effect. Deploy it.";
  const { text, map } = protectGlossaryTerms(input, glossary);
  check("用例1 命中词零泄漏", !text.includes("Kubernetes") && !text.includes("side effect") && !text.includes("API") && map.length === 3,
    `map=${map.length} text="${text}"`);
}

// 用例1b：词边界保护（"plain"/"email" 内的字母串不得被 AI 误伤）
{
  const input = "Please email the plain document about AI research.";
  const { text, map } = protectGlossaryTerms(input, glossary);
  check("用例1b 词边界（plain/email 不误伤，仅独立 AI 命中）",
    text.includes("plain") && text.includes("email") && map.length === 1 && map[0].src === "AI",
    `map=${map.map((m) => m.src).join(",")} text="${text}"`);
}

// 用例2：长词优先，AI assistant 整体为一个词条
{
  const input = "Our AI assistant is better than plain AI.";
  const { text, map } = protectGlossaryTerms(input, glossary);
  const hasLong = map.some((m) => m.src === "AI assistant");
  const onlyTwo = map.length === 2; // AI assistant + AI
  check("用例2 长词优先（AI assistant 不被 AI 抢匹配）", hasLong && onlyTwo && /ZGQ\w*\d+\w*GZQ ZGQ/.test(text) === false,
    `map=${map.map((m) => m.src).join(",")} text="${text}"`);
}

// 用例3：模拟过机透传 → 还原官方译名
{
  const input = "Kubernetes API deployment";
  const { map } = protectGlossaryTerms(input, glossary);
  const k8s = map.find((m) => m.src === "Kubernetes");
  const api = map.find((m) => m.src === "API");
  const fake = `${k8s.token} ${api.token} 部署`;
  const restored = restoreGlossaryTerms(fake, map);
  check("用例3 官方译名还原", restored.includes("Kubernetes 容器编排平台") && restored.includes("应用程序接口"),
    `restored="${restored}"`);
  check("用例3b 无记号泄漏", !/ZGQ|GZQ/.test(restored));
}

// 用例4：形变容忍（空白/大小写）
{
  const input = "Kubernetes API deployment";
  const { map } = protectGlossaryTerms(input, glossary);
  const k8s = map.find((m) => m.src === "Kubernetes");
  const spaced = k8s.token.split("").join(" ");          // 字符间全插空格
  const upper = k8s.token.toUpperCase();                 // 全大写
  const r1 = restoreGlossaryTerms(spaced + " 部署", map);
  const r2 = restoreGlossaryTerms(upper + " 部署", map);
  check("用例4 形变容忍（空白+大小写）",
    r1.includes("Kubernetes 容器编排平台") && r2.includes("Kubernetes 容器编排平台"),
    `"${r1}" | "${r2}"`);
}

// 用例5：记号前缀/后缀本身作为词条，也不得自噬
{
  const input = "ZGQ and GZQ appear as literal words";
  const { text, map } = protectGlossaryTerms(input, glossary);
  const zgq = map.find((m) => m.src === "ZGQ");
  const gzq = map.find((m) => m.src === "GZQ");
  const restored = restoreGlossaryTerms(`${zgq.token} 和 ${gzq.token} 作为普通单词出现`, map);
  check("用例5 前缀/后缀词条不自噬",
    !!zgq && !!gzq && restored.includes("占位前缀对抗词") && restored.includes("占位后缀对抗词") && !/ZGQ|GZQ/.test(restored),
    `map=${map.length} restored="${restored}"`);
}

// 用例6：残留记号兜底清除（译方把记号原样吐回但 map 丢失一半的场景）
{
  const input = "Kubernetes API deployment";
  const { text } = protectGlossaryTerms(input, glossary);
  // 取文本中生成的任意记号，用空 map 还原 → 必须被兜底清除
  const restored = restoreGlossaryTerms(text + " 部署", []);
  check("用例6 残留记号兜底清除", !/ZGQ[a-z0-9]*\d+[a-z0-9]*GZQ/i.test(restored),
    `restored="${restored}"`);
}

// 用例7：无命中零改动 + 文本解析
{
  const input = "Just a plain sentence without terms.";
  const r = protectGlossaryTerms(input, glossary);
  check("用例7a 无命中零改动", r.text === input && r.map.length === 0);
  const parsed = parseGlossaryText("# 注释\nOpenClash=OpenClash 代理\n\nWebRTC=WebRTC 实时通信\n坏行无等号\n= 空源词\n");
  check("用例7b 术语表文本解析", parsed.length === 2 && parsed[0].s === "OpenClash" && parsed[1].t === "WebRTC 实时通信",
    JSON.stringify(parsed));
}

// 用例8：URL 行业识别
{
  globalThis.location = { hostname: "www.github.com" };
  check("用例8a github → tech", detectIndustryByUrl() === "tech");
  globalThis.location = { hostname: "arxiv.org" };
  check("用例8b arxiv → academic", detectIndustryByUrl() === "academic");
  globalThis.location = { hostname: "unknown-site.example.com" };
  check("用例8c 未知站点 → general", detectIndustryByUrl() === "general");
}

console.log("\n" + (allPass ? "=== 术语表引擎 10 项断言全部通过 ===" : "=== 存在失败用例 ==="));
process.exit(allPass ? 0 : 1);
