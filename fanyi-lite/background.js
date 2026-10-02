// 宇宙无敌超级霹雳便捷的网页翻译工具 — Service Worker (v0.6.0)
// 作者：阿帝
// 双引擎互备：Google 免费接口（外网/代理首选） + 国内极速直连引擎（免翻墙100%直连），失败自动降级

// ================= 快捷键 =================

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "toggle-translate") return;
  sendToggleToTab(tab);
});

async function sendToggleToTab(tab) {
  let targetTabId = tab?.id;
  if (!targetTabId) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    targetTabId = activeTab?.id;
  }
  if (!targetTabId) return;
  try {
    await chrome.tabs.sendMessage(targetTabId, { type: "toggle-translate" });
  } catch {
    updateBadge(targetTabId, "OFF", "#94a3b8", 1500);
  }
}

// ================= 消息路由 =================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender?.tab?.id;

  // 1. 翻译请求（多服务商 + 自动降级）
  if (msg?.type === "fanyi_translate") {
    translateWithFallback(msg.texts, msg.targetLang)
      .then(({ data, provider }) => sendResponse({ success: true, data, provider }))
      .catch((err) => sendResponse({ success: false, error: diagnoseNetworkError(err) }));
    return true; // 保持异步消息通道
  }

  // 2. 状态机反馈：联动 Badge 与动态图标
  if (msg?.type === "fanyi_status" && tabId) {
    handleStatusMessage(tabId, msg);
    sendResponse({ ok: true });
    return false;
  }

  // 3. 服务连通性自测（Options 页面使用）
  if (msg?.type === "fanyi_test_providers") {
    runProviderSelfTest()
      .then((res) => sendResponse({ success: true, res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

function handleStatusMessage(tabId, msg) {
  switch (msg.state) {
    case "translating":
      updateBadge(tabId, "...", "#b45309");
      setExtensionIcon(tabId, true);
      break;
    case "progress":
      updateBadge(tabId, `${msg.percent}%`, "#b45309");
      break;
    case "translated":
      const text = msg.count ? `${msg.count}` : "OK";
      updateBadge(tabId, text, "#15803d", 3000);
      setExtensionIcon(tabId, true);
      break;
    case "error":
      updateBadge(tabId, "ERR", "#b91c1c", 4000);
      setExtensionIcon(tabId, false);
      break;
    case "idle":
    case "restored":
      clearBadge(tabId);
      setExtensionIcon(tabId, false);
      break;
  }
}

function setExtensionIcon(tabId, isActive) {
  const prefix = isActive ? "active" : "inactive";
  try {
    chrome.action.setIcon(
      {
        tabId,
        path: {
          "16": `icons/${prefix}-16.png`,
          "32": `icons/${prefix}-32.png`,
          "48": `icons/${prefix}-48.png`,
          "128": `icons/${prefix}-128.png`,
        },
      },
      () => {
        void chrome.runtime.lastError; // 安全消费，防止目标标签已关闭时抛出 Unchecked lastError
      }
    );
  } catch {}
}

function updateBadge(tabId, text, color, autoClearMs = 0) {
  try {
    chrome.action.setBadgeText({ tabId, text: text || "" }, () => {
      void chrome.runtime.lastError;
    });
    if (color) {
      chrome.action.setBadgeBackgroundColor({ tabId, color }, () => {
        void chrome.runtime.lastError;
      });
    }
    if (autoClearMs > 0) setTimeout(() => clearBadge(tabId), autoClearMs);
  } catch {}
}

function clearBadge(tabId) {
  try {
    chrome.action.setBadgeText({ tabId, text: "" }, () => {
      void chrome.runtime.lastError;
    });
  } catch {}
}

function diagnoseNetworkError(err) {
  const msg = err?.message || "";
  if (msg.includes("Failed to fetch") || msg.includes("aborted") || msg.includes("NetworkError")) {
    return "网络连接超时：所有翻译通道均不可达，请检查本地网络";
  }
  if (msg.includes("429")) {
    return "请求频率过高，触发临时频控，请稍后再试";
  }
  return msg || "翻译服务网络异常";
}

// ================= 多服务商引擎 =================

/**
 * 服务策略：auto（默认）= 按可用性链依次尝试并缓存最快可用的；
 * google = 只用 Google；domestic = 只用国内极速直连通道（免翻墙）。
 */
const PROVIDERS = [
  { id: "google", name: "Google 免费接口", fn: fetchGoogleTranslate },
  { id: "domestic", name: "国内极速直连通道", fn: fetchDomesticTranslate },
];

let lastWorkingProvider = null;

async function translateWithFallback(texts, targetLang) {
  let order;
  try {
    const cfg = await chrome.storage.local.get({ service: "auto" });
    if (cfg.service === "auto" || !PROVIDERS.some((p) => p.id === cfg.service)) {
      order = PROVIDERS.slice();
      if (lastWorkingProvider) {
        const idx = order.findIndex((p) => p.id === lastWorkingProvider);
        if (idx > 0) order.unshift(...order.splice(idx, 1));
      }
    } else {
      order = PROVIDERS.filter((p) => p.id === cfg.service);
    }
  } catch {
    order = PROVIDERS;
  }

  let lastErr = null;
  for (const p of order) {
    try {
      const data = await p.fn(texts, targetLang);
      lastWorkingProvider = p.id;
      return { data, provider: p.id };
    } catch (e) {
      lastErr = e;
      console.warn(`[fanyi-lite] ${p.name} 失败，自动尝试下一个:`, e.message);
    }
  }
  throw lastErr || new Error("所有翻译通道均不可用");
}

// ---------- 引擎一：Google 免费接口（外网/代理环境首选） ----------

async function fetchGoogleTranslate(texts, targetLang) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const url =
    "https://translate.googleapis.com/translate_a/t?" +
    new URLSearchParams({ client: "gtx", dt: "t", sl: "auto", tl: targetLang });

  const body = new URLSearchParams();
  for (const t of texts) body.append("q", t);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Google API HTTP ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error("Google API invalid response format");
    return json.map((item) => {
      const raw = Array.isArray(item) ? item[0] : item;
      return decodeHtmlEntities(typeof raw === "string" ? raw : "");
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 引擎二：国内极速直连通道（免翻墙、国内网络 100% 可达） ----------

/**
 * 启发式源语言检测（MyMemory 不支持 auto，必须显式传源语言码）：
 * 假名→ja、谚文→ko、西里尔→ru、希腊→el、阿拉伯→ar；拉丁字母默认 en。
 */
function detectSourceLang(texts) {
  const sample = texts.join(" ").slice(0, 2000);
  if (/[\u3040-\u30ff]/.test(sample)) return "ja";
  if (/[\uac00-\ud7af]/.test(sample)) return "ko";
  if (/[\u0400-\u04ff]/.test(sample)) return "ru";
  if (/[\u0370-\u03ff]/.test(sample)) return "el";
  if (/[\u0600-\u06ff]/.test(sample)) return "ar";
  if (/[a-zA-Z]/.test(sample)) return "en";
  return "en";
}

// 批内小并发池：避免一批 30 段同时齐发触发对方频控
async function pooledMap(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await mapper(items[i], i);
    }
  }
  const workers = [];
  const n = Math.min(limit, items.length);
  for (let i = 0; i < n; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

// MyMemory 单次查询硬限 500 字符（超限返回 QUERY LENGTH LIMIT EXCEEDED，实测按解码后字符数计，
// CJK 460 字符虽编码后 4000+ 也能过）。将超长段落按句子边界切成 ≤maxLen 的块；无标点长串做硬切兜底。
// sep：块间拼接分隔符——中文/日语/韩语目标语言传空串，避免译文段间冒出多余空格。
function splitLongText(text, maxLen = 460, sep = " ") {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  const sentences = text.split(/(?<=[.!?。！？；;\n])\s*/).filter(Boolean);
  let buf = "";
  for (const s of sentences) {
    if (s.length > maxLen) {
      // 无标点超长串：按 maxLen 硬切
      if (buf) { chunks.push(buf); buf = ""; }
      for (let i = 0; i < s.length; i += maxLen) chunks.push(s.slice(i, i + maxLen));
      continue;
    }
    const merged = buf ? buf + sep + s : s;
    if (merged.length > maxLen) {
      chunks.push(buf);
      buf = s;
    } else {
      buf = merged;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

// 限长自救用：在文本中部附近找句子边界作为切点，找不到就硬切
function findCutNearMiddle(text) {
  const mid = Math.floor(text.length / 2);
  const from = Math.max(0, mid - 40);
  const to = Math.min(text.length, mid + 40);
  const seg = text.slice(from, to);
  const m = seg.match(/[.!?。！？；;\n]\s*/);
  if (m && from + m.index + m[0].length < text.length && from + m.index > 0) {
    return from + m.index + m[0].length;
  }
  return mid;
}

async function fetchDomesticTranslate(texts, targetLang) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const src = detectSourceLang(texts);
  const pair = `${src}|${targetLang}`;
  // 中日韩目标语言：分块拼接不加空格，否则译文段间会冒出多余空格
  const cjkJoin = /^(zh|ja|ko)/.test(targetLang) ? "" : " ";

  let failCount = 0;
  let fatalError = null;

  // 单块（≤460字符）翻译。
  // 返回译文字符串；无警告的裸空响应返回 null（该段回退原文，不拖垮整批）。
  // depth 仅用于限长错误时的对半切分自救递归。
  async function translateDomesticChunk(chunk, depth = 0) {
    const url =
      "https://api.mymemory.translated.net/get?" +
      new URLSearchParams({ q: chunk, langpair: pair });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Domestic API HTTP ${res.status}`);
      const json = await res.json();
      const raw = json?.responseData?.translatedText;
      const details = String(json?.responseDetails || "");

      if (typeof raw !== "string" || raw.length === 0) {
        // 空响应：带配额/无效语言等通道级信号的才算致命；裸空响应当段落级偶发失败
        if (/QUOTA|WARNING|MYMEMORY|INVALID/i.test(details)) {
          fatalError = new Error(
            /INVALID/i.test(details)
              ? `Domestic API bad response: ${details.slice(0, 60)}`
              : "国内直连通道今日免费额度已用尽，请明天再试或切换 Google 引擎"
          );
          throw fatalError;
        }
        return null;
      }

      // 配额耗尽/无效源语言等通道级致命错误：立即熔断整批，触发上层降级
      if (/MYMEMORY WARNING|INVALID SOURCE LANGUAGE/i.test(raw)) {
        fatalError = new Error(
          /WARNING|QUOTA/i.test(raw + details)
            ? "国内直连通道今日免费额度已用尽，请明天再试或切换 Google 引擎"
            : `Domestic API bad response: ${raw.slice(0, 60)}`
        );
        throw fatalError;
      }

      // 限长错误：正常分块（≤460）绝不会触发；一旦漏网，立即对半切分逐块自救，
      // 绝不把单个长查询失败升级为整页翻译失败
      if (/QUERY LENGTH LIMIT/i.test(raw)) {
        if (depth < 2 && chunk.length > 80) {
          const cut = findCutNearMiddle(chunk);
          const head = await translateDomesticChunk(chunk.slice(0, cut), depth + 1);
          const tail = await translateDomesticChunk(chunk.slice(cut), depth + 1);
          if (head === null || tail === null) return null;
          return head + tail; // 应急路径：切点附近直接相接，宁缺毋滥保全文
        }
        fatalError = new Error(`Domestic API bad response: ${raw.slice(0, 60)}`);
        throw fatalError;
      }

      return decodeHtmlEntities(raw);
    } finally {
      clearTimeout(timer);
    }
  }

  // 单段翻译：1 次局部轻量重试；彻底失败计为偶发失败，超过半数才抛错触发降级链
  async function translateSegment(text) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await translateDomesticChunk(text, 0);
        if (out !== null) return out;
        failCount++; // 空响应：计一次偶发失败并重试
      } catch (e) {
        if (fatalError) throw fatalError;
        if (attempt === 1) {
          failCount++;
          // 若超过半数段落均失败，认为通道不可达，抛错触发上层降级链
          if (failCount > Math.max(2, Math.floor(texts.length / 2))) {
            throw e;
          }
          return null; // 个别段落偶发失败容错：回退为原文，保证整页大部分正常上屏
        }
      }
      if (failCount > Math.max(2, Math.floor(texts.length / 2))) {
        throw new Error("国内直连通道连续返回空结果，可能已被限流，请稍后再试或切换 Google 引擎");
      }
    }
    return null;
  }

  const results = await pooledMap(texts, 5, async (text) => {
    if (!text || text.trim().length === 0) return "";
    if (fatalError) throw fatalError;

    // MyMemory 单查询硬限 500 字符：超长段按句子边界切块，逐块翻译后按序拼接
    const chunks = splitLongText(text, 460, cjkJoin);
    if (chunks.length > 1) {
      const parts = [];
      for (const c of chunks) {
        if (fatalError) throw fatalError;
        const out = await translateSegment(c);
        parts.push(out === null ? c : out);
      }
      return parts.join(cjkJoin);
    }

    const out = await translateSegment(text);
    return out === null ? text : out;
  });

  return results;
}

// ---------- 连通性自测 ----------

async function runProviderSelfTest() {
  const sample = ["Hello world", "Translation engine connectivity test"];
  const res = { google: "unknown", domestic: "unknown" };
  for (const p of PROVIDERS) {
    try {
      const out = await p.fn(sample, "zh-CN");
      res[p.id] = out.every((t) => t && t.length > 0) ? "ok" : "empty";
    } catch (e) {
      res[p.id] = "fail: " + (e.message || "").slice(0, 60);
    }
  }
  res.lastWorking = lastWorkingProvider || "-";
  return res;
}

// ---------- HTML 实体解码 ----------

function decodeHtmlEntities(text) {
  if (!text || !text.includes("&")) return text;
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&#60;/g, "<")
    .replace(/&#62;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
