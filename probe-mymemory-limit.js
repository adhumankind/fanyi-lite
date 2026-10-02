/**
 * MyMemory 500 字符限长口径实测：node probe-mymemory-limit.js
 * 分别探测 ASCII / CJK / 重音字符在不同长度下是否触发 QUERY LENGTH LIMIT EXCEEDED，
 * 用于确定 background.js 分块预算应按“解码字符数 / UTF-8 字节数 / URL 编码长度”哪一种计算。
 */
const LANGS = "en|zh-CN";

async function probe(name, q) {
  const url =
    "https://api.mymemory.translated.net/get?" +
    new URLSearchParams({ q, langpair: LANGS });
  try {
    const res = await fetch(url);
    const json = await res.json();
    const t = String(json?.responseData?.translatedText || "").slice(0, 55);
    const d = String(json?.responseDetails || "").slice(0, 60);
    const limited = /QUERY LENGTH LIMIT/i.test(t + d);
    console.log(
      `${limited ? "限长" : "通过"}  ${name.padEnd(12)} 解码字符=${String(q.length).padStart(4)} UTF8字节=${String(new TextEncoder().encode(q).length).padStart(4)} 编码长度=${String(encodeURIComponent(q).length).padStart(4)}  → ${t}${d ? " | " + d : ""}`
    );
    return limited;
  } catch (e) {
    console.log(`请求失败 ${name}: ${e.message}`);
    return null;
  }
}

async function main() {
  await probe("ascii460", "a".repeat(460));
  await probe("ascii490", "a".repeat(490));
  await probe("ascii499", "a".repeat(499));
  await probe("ascii500", "a".repeat(500));
  await probe("ascii501", "a".repeat(501));
  await probe("cjk160", "日".repeat(160));
  await probe("cjk200", "日".repeat(200));
  await probe("cjk460", "日".repeat(460));
  await probe("accent400", "é".repeat(400));
  await probe("words460", ("word ").repeat(92));
}

main();
