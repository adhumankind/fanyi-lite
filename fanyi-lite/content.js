/**
 * 宇宙无敌超级霹雳便捷的网页翻译工具 — 内容脚本 (v0.8.7)
 * 作者：阿帝
 * 核心特性：
 * 多语种互译 + 行业术语保护引擎 + URL行业自动识别 + Google/国内直连双引擎自动降级
 * + 4路并发流水线 + 美拉德排版 + 三大显示模式 + SPA路由感知 + 深色按钮/Flex自适应
 */
(() => {
  if (window.__fanyiLite) return;
  window.__fanyiLite = true;

  const IGNORE_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "OBJECT", "EMBED",
    "SVG", "CANVAS", "AUDIO", "VIDEO", "MATH",
    "CODE", "PRE", "KBD", "SAMP", "VAR",
    "TEXTAREA", "INPUT", "SELECT", "OPTION",
  ]);

  const TARGET_CLASS = "fanyi-lite-target";
  const TARGET_INNER_CLASS = "fanyi-lite-inner";
  const SOURCE_CLASS = "fanyi-lite-source";

  const IGNORE_SELECTORS =
    "[contenteditable='true'], [contenteditable=''], code, pre, kbd, samp, svg, math, canvas," +
    " ." + TARGET_CLASS + ", [data-fy-p]";

  const PARAGRAPH_TAGS = new Set([
    "P", "H1", "H2", "H3", "H4", "H5", "H6",
    "LI", "DT", "DD", "BLOCKQUOTE", "FIGCAPTION",
    "TD", "TH", "CAPTION", "SUMMARY", "BUTTON",
  ]);

  const BLOCK_BOUNDARY_TAGS = new Set([
    ...PARAGRAPH_TAGS,
    "UL", "OL", "TABLE", "TR", "THEAD", "TBODY", "TFOOT",
    "DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "NAV", "ASIDE", "MAIN",
  ]);

  // 语义待翻译元素查询（包含独立导航/按钮链接，防止父级 div 强行合体多个独立按钮）。
  // 段落类容器（p/li/td/标题等）内部的链接排除在独立单元之外（CSS4 :not 复杂选择器，Chrome 88+），
  // 它们随宿主整句翻译——否则宿主与链接各成单元造成重复翻译/挖空死区。
  const SEMANTIC_QUERY =
    "p, h1, h2, h3, h4, h5, h6, li, dt, dd, blockquote, figcaption, td, th, caption, summary, button, [role='button'], [role='link']," +
    " a[href]:not(p a, li a, td a, th a, blockquote a, dt a, dd a, figcaption a, caption a, summary a, h1 a, h2 a, h3 a, h4 a, h5 a, h6 a)";

  const MAX_PARAGRAPH_CHARS = 2500;
  const BATCH_TEXTS = 30;
  const BATCH_CHARS = 1200;
  const MAX_CONCURRENCY = 4;

  /* ================= 行业术语表（专业翻译增强） ================= */

  const INDUSTRY_PRESETS = {
    auto: { label: "自动识别", terms: [] },
    general: { label: "通用场景", terms: [] },
    tech: {
      label: "互联网/软件开发",
      terms: [
        { s: "API", t: "应用程序接口" }, { s: "SDK", t: "软件开发工具包" },
        { s: "Kubernetes", t: "Kubernetes 容器编排平台" }, { s: "Docker", t: "Docker 容器引擎" },
        { s: "token", t: "令牌" }, { s: "bucket", t: "存储桶" },
        { s: "endpoint", t: "端点" }, { s: "deploy", t: "部署" },
        { s: "deployment", t: "部署" }, { s: "repository", t: "代码仓库" },
        { s: "commit", t: "提交" }, { s: "branch", t: "分支" },
        { s: "middleware", t: "中间件" }, { s: "runtime", t: "运行时" },
        { s: "framework", t: "框架" }, { s: "latency", t: "延迟" },
        { s: "throughput", t: "吞吐量" }, { s: "redundancy", t: "冗余" },
        { s: "authentication", t: "身份认证" }, { s: "authorization", t: "授权" },
      ],
    },
    academic: {
      label: "学术/科研论文",
      terms: [
        { s: "abstract", t: "摘要" }, { s: "hypothesis", t: "假设" },
        { s: "methodology", t: "研究方法论" }, { s: "literature review", t: "文献综述" },
        { s: "baseline", t: "基线" }, { s: "benchmark", t: "基准测试" },
        { s: "correlation", t: "相关性" }, { s: "statistically significant", t: "具有统计学显著性" },
        { s: "longitudinal", t: "纵向的" }, { s: "empirical", t: "实证的" },
        { s: "peer review", t: "同行评审" }, { s: "dataset", t: "数据集" },
        { s: "ablation", t: "消融" }, { s: "state-of-the-art", t: "最先进的" },
        { s: "robustness", t: "鲁棒性" }, { s: "generalization", t: "泛化能力" },
      ],
    },
    medical: {
      label: "医疗/生物医药",
      terms: [
        { s: "clinical trial", t: "临床试验" }, { s: "placebo", t: "安慰剂" },
        { s: "double-blind", t: "双盲" }, { s: "dosage", t: "剂量" },
        { s: "adverse event", t: "不良事件" }, { s: "side effect", t: "副作用" },
        { s: "diagnosis", t: "诊断" }, { s: "prognosis", t: "预后" },
        { s: "pathology", t: "病理学" }, { s: "etiology", t: "病因学" },
        { s: "symptom", t: "症状" }, { s: "contraindication", t: "禁忌症" },
        { s: "efficacy", t: "疗效" }, { s: "morbidity", t: "发病率" },
      ],
    },
    legal: {
      label: "法律/合规",
      terms: [
        { s: "plaintiff", t: "原告" }, { s: "defendant", t: "被告" },
        { s: "jurisdiction", t: "管辖权" }, { s: "litigation", t: "诉讼" },
        { s: "arbitration", t: "仲裁" }, { s: "liability", t: "责任/负债" },
        { s: "indemnify", t: "赔偿/保障" }, { s: "tort", t: "侵权" },
        { s: "statute", t: "成文法" }, { s: "breach of contract", t: "违约" },
        { s: "intellectual property", t: "知识产权" }, { s: "compliance", t: "合规" },
        { s: "due diligence", t: "尽职调查" },
      ],
    },
    finance: {
      label: "金融/财经",
      terms: [
        { s: "liquidity", t: "流动性" }, { s: "volatility", t: "波动率" },
        { s: "hedge", t: "对冲" }, { s: "arbitrage", t: "套利" },
        { s: "equity", t: "股权/股本" }, { s: "derivative", t: "衍生品" },
        { s: "dividend", t: "股息" }, { s: "valuation", t: "估值" },
        { s: "quarterly earnings", t: "季度财报" }, { s: "fiscal year", t: "财年" },
        { s: "inflation", t: "通货膨胀" }, { s: "leverage", t: "杠杆" },
        { s: "underwriting", t: "承保/承销" },
      ],
    },
    ecommerce: {
      label: "电商/市场营销",
      terms: [
        { s: "SKU", t: "库存单位" }, { s: "conversion rate", t: "转化率" },
        { s: "checkout", t: "结账" }, { s: "coupon", t: "优惠券" },
        { s: "cart abandonment", t: "购物车弃单" }, { s: "customer retention", t: "客户留存" },
        { s: "backorder", t: "缺货预订" }, { s: "subscription", t: "订阅" },
        { s: "loyalty program", t: "会员忠诚计划" }, { s: "flash sale", t: "限时抢购" },
      ],
    },
    gaming: {
      label: "游戏/ACG",
      terms: [
        { s: "hitbox", t: "判定框" }, { s: "cooldown", t: "冷却时间" },
        { s: "buff", t: "增益效果" }, { s: "nerf", t: "削弱" },
        { s: "DLC", t: "可下载内容" }, { s: "respawn", t: "重生" },
        { s: "loot box", t: "战利品箱" }, { s: "matchmaking", t: "匹配机制" },
      ],
    },
    industrial: {
      label: "机械/工业制造",
      terms: [
        { s: "tolerance", t: "公差" }, { s: "machining", t: "机械加工" },
        { s: "spindle", t: "主轴" }, { s: "forging", t: "锻造" },
        { s: "casting", t: "铸造" }, { s: "assembly line", t: "装配线" },
        { s: "maintenance", t: "维护保养" }, { s: "throughput rate", t: "产能/吞吐速率" },
      ],
    },
  };

  // URL → 行业自动识别规则（按 hostname 后缀匹配）
  const INDUSTRY_URL_RULES = [
    { industry: "tech", hosts: ["github.com", "stackoverflow.com", "npmjs.com", "news.ycombinator.com", "v2ex.com", "juejin.cn", "segmentfault.com", "developer.mozilla.org", "cloudflare.com", "docker.com", "kubernetes.io"] },
    { industry: "academic", hosts: ["arxiv.org", "ieee.org", "nature.com", "sciencedirect.com", "springer.com", "pubmed.ncbi.nlm.nih.gov", "scholar.google.com", "dl.acm.org"] },
    { industry: "medical", hosts: ["webmd.com", "nih.gov", "thelancet.com", "mayoclinic.org", "who.int", "dxy.com"] },
    { industry: "legal", hosts: ["law.cornell.edu", "lexisnexis.com", "courtlistener.com", "law.com"] },
    { industry: "finance", hosts: ["reuters.com", "bloomberg.com", "wsj.com", "ft.com", "finance.sina.com.cn", "eastmoney.com", "xueqiu.com", "cnbc.com"] },
    { industry: "ecommerce", hosts: ["amazon.com", "ebay.com", "aliexpress.com", "taobao.com", "shopify.com", "etsy.com"] },
    { industry: "gaming", hosts: ["store.steampowered.com", "epicgames.com", "ign.com", "gamespot.com", "playstation.com", "nintendo.com"] },
    { industry: "industrial", hosts: ["siemens.com", "abb.com", "schneider-electric.com", "honeywell.com", "machinetools.com"] },
  ];

  let running = false;
  let translated = false;
  let currentSessionId = 0;
  let currentMode = "follow"; // "follow" | "replace" | "invert"
  let currentTargetLang = "zh-CN";
  let currentIndustry = "auto";
  let userGlossary = [];   // 用户自定义术语 [{s,t}]
  let activeGlossary = []; // 行业预设 + 用户术语合并
  let compiledGlossary = null; // 预编译的合并正则 + 词源快照（buildActiveGlossary 时生成）
  let queuedRetranslate = false; // 翻译中切换目标语言 → 完成后整页重翻

  const setPageState = (s) => {
    if (s) document.documentElement.dataset.fyState = s;
    else delete document.documentElement.dataset.fyState;
  };

  const setPageMode = (m) => {
    currentMode = m || "follow";
    document.documentElement.dataset.fyMode = currentMode;
    // 若页面已翻译，模式切换需即时在 DOM 层重排双语先后（invert = 译文在前）。
    // 重排期间挂 .fy-rearranging 抑制入场动画重放（元素摘除再插入会重播动画，
    // 否则全页译文会集体闪动，观感廉价）；下一帧后移除。
    if (translated) {
      document.documentElement.classList.add("fy-rearranging");
      // 模式切换后重排双语顺序 + 重新应用字体策略（follow↔replace/invert 的 scale 不同）
      reapplyModeFontStyles(currentMode);
      rearrangeBilingualOrder(currentMode);
      requestAnimationFrame(() => {
        requestAnimationFrame(() =>
          document.documentElement.classList.remove("fy-rearranging")
        );
      });
    }
  };

  // 初始化：读取用户偏好（模式/语言/行业/术语/总是翻译）
  try {
    chrome.storage?.local?.get(
      { transMode: "follow", alwaysTranslate: false, targetLang: "zh-CN", industry: "auto", userGlossary: "" },
      (cfg) => {
        if (chrome.runtime?.lastError || !cfg) return;
        setPageMode(cfg.transMode);
        currentTargetLang = cfg.targetLang || "zh-CN";
        currentIndustry = cfg.industry || "auto";
        userGlossary = parseGlossaryText(cfg.userGlossary);
        buildActiveGlossary();
        if (cfg.alwaysTranslate) {
          // 总是翻译开启：自动启动翻译
          setTimeout(() => {
            if (!translated && !running) toggle(true);
          }, 500);
        }
      }
    );
  } catch {}

  // 配置热更新：Popup/Options 修改存储后即时生效（语言变更会触发整页重翻）
  try {
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.transMode) setPageMode(changes.transMode.newValue);
      if (changes.targetLang) {
        const next = changes.targetLang.newValue;
        if (next !== currentTargetLang) {
          currentTargetLang = next;
          if (translated && !running) {
            // 目标语言改变且页面已翻译：还原并用新语言重翻
            restore();
            setTimeout(() => toggle(false), 60);
          } else if (running) {
            // 翻译进行中切语言：已完成批次用旧语言、未开始用新语言，
            // 置排队标志，本次完成后立即整页用新语言重翻，消除混排
            queuedRetranslate = true;
          }
        }
      }
      if (changes.industry) {
        currentIndustry = changes.industry.newValue || "auto";
        buildActiveGlossary();
        // 行业变更且页面已翻译：立即用新行业术语库平滑重翻，所见即所得
        if (translated && !running) {
          restore();
          setTimeout(() => toggle(false), 60);
        }
      }
      if (changes.userGlossary) {
        userGlossary = parseGlossaryText(changes.userGlossary.newValue);
        buildActiveGlossary();
        if (translated && !running) {
          restore();
          setTimeout(() => toggle(false), 60);
        }
      }
    });
  } catch {}

  // 页面（重）加载即重置扩展图标为灰色未启用态：
  notifyBackground("restored");

  // ================= 5. 单页应用 (SPA) 路由切换感知 =================
  const getPageUrl = () => {
    try {
      return (typeof location !== "undefined" ? location.href : "") || "";
    } catch {
      return "";
    }
  };

  let lastUrl = getPageUrl();
  function handleUrlChange() {
    const cur = getPageUrl();
    if (!cur || cur === lastUrl) return;
    lastUrl = cur;
    // SPA 路由变化：还原旧翻译状态并重构行业词库（URL 可能带来新行业）
    if (translated || running) {
      currentSessionId += 1;
      restore();
      running = false;
      queuedRetranslate = false; // 旧页面的排队重翻对新路由无意义，直接清除
      notifyBackground("restored");
    }
    buildActiveGlossary();

    // 总是翻译开启时：等待 SPA 新路由 DOM 就绪后自动触发翻译
    chrome.storage?.local?.get({ alwaysTranslate: false }, (cfg) => {
      if (cfg?.alwaysTranslate && !translated && !running) {
        setTimeout(() => {
          if (!translated && !running) toggle(true);
        }, 600);
      }
    });
  }

  // 监听浏览器前进/后退（可选链防护测试沙箱）
  window.addEventListener?.("popstate", handleUrlChange);
  window.addEventListener?.("hashchange", handleUrlChange);

  // Hook pushState 与 replaceState 感知客户端路由
  try {
    if (typeof history !== "undefined" && history.pushState && history.replaceState) {
      const origPush = history.pushState;
      const origReplace = history.replaceState;
      history.pushState = function (...args) {
        const res = origPush.apply(this, args);
        handleUrlChange();
        return res;
      };
      history.replaceState = function (...args) {
        const res = origReplace.apply(this, args);
        handleUrlChange();
        return res;
      };
    }
  } catch {}

  // 监听来自后台/弹出面板的消息
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "toggle-translate") {
      toggle(false);
    } else if (msg?.type === "set-mode") {
      setPageMode(msg.mode);
    } else if (msg?.type === "get-status") {
      // popup 面板查询当前页面翻译状态（同步回复）
      sendResponse?.({
        translated,
        running,
        mode: currentMode,
        targetLang: currentTargetLang,
        industry: currentIndustry,
      });
      return false;
    }
  });

  /* ================= 行业识别与术语保护引擎 ================= */

  function parseGlossaryText(text) {
    if (!text || typeof text !== "string") return [];
    const list = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      // 智能识别分隔符：支持中文冒号（：）、英文冒号（:）及等号（=）
      let sepIdx = -1;
      let sepLen = 1;
      for (const sep of ["：", ":", "="]) {
        const i = trimmed.indexOf(sep);
        if (i > 0 && (sepIdx === -1 || i < sepIdx)) {
          sepIdx = i;
          sepLen = sep.length;
        }
      }
      if (sepIdx <= 0) continue;

      const s = trimmed.slice(0, sepIdx).trim();
      const t = trimmed.slice(sepIdx + sepLen).trim();
      if (s && t) list.push({ s, t });
    }
    return list.slice(0, 200); // 上限保护：单页术语过多会拖慢保护替换
  }

  function detectIndustryByUrl() {
    const h = (location.hostname || "").replace(/^www\./, "").toLowerCase();
    for (const rule of INDUSTRY_URL_RULES) {
      for (const host of rule.hosts) {
        if (h === host || h.endsWith("." + host)) return rule.industry;
      }
    }
    return "general";
  }

  function getResolvedIndustry() {
    if (currentIndustry !== "auto") return currentIndustry;
    return detectIndustryByUrl();
  }

  function buildActiveGlossary() {
    const preset = INDUSTRY_PRESETS[getResolvedIndustry()]?.terms || [];
    // 用户自定义术语优先级高于预设（同词覆盖）
    const userMap = new Map(userGlossary.map((g) => [g.s.toLowerCase(), g]));
    const merged = preset.filter((g) => !userMap.has(g.s.toLowerCase()));
    activeGlossary = [...merged, ...userGlossary];
    // 合并正则在此一次性编译缓存（ protectGlossaryTerms 逐段复用，
    // 避免大页面上千次重复编译浪费主线程）
    const sorted = [...activeGlossary].sort((a, b) => b.s.length - a.s.length);
    const sources = [];
    for (const g of sorted) {
      if (!g.s || !g.t) continue;
      try {
        buildTermPattern(g.s);
        sources.push(g);
      } catch {
        // 非法正则源词跳过
      }
    }
    compiledGlossary = sources.length
      ? {
          sources,
          combined: new RegExp(sources.map((g) => buildTermPattern(g.s)).join("|"), "gi"),
        }
      : null;
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 术语保护：把命中术语表的原文替换为内部占位记号（含随机盐，形如 ZGQ3f9k0k3f9GZQ）。
   *
   * 两个关键设计（均有测试背书）：
   * 1. 单一合并正则 + 单次扫描：String.replace 不会重新扫描替换输出，
   *    从根上杜绝"占位记号被后续词条二次匹配"的自噬问题；
   *    合并前按词长降序排列（alternation 首位优先），保证 "AI assistant"
   *    这类长词优先于 "AI" 命中，消除词条顺序依赖。
   * 2. 随机盐记号：即使词条本身就是记号前缀（如 "ZGQ"）也无法匹配令牌。
   */
  function protectGlossaryTerms(text, glossary) {
    if (!glossary || glossary.length === 0 || !compiledGlossary) return { text, map: [] };

    const { sources, combined } = compiledGlossary;
    const nonce = Math.random().toString(36).slice(2, 6);
    const map = [];
    const lookup = new Map(); // 小写源词 → 记号条目（同段重复词共用一个记号）
    let seq = 0;

    const out = text.replace(combined, (matched) => {
      const key = matched.toLowerCase();
      let entry = lookup.get(key);
      if (!entry) {
        const g = sources.find((x) => x.s.toLowerCase() === key) || { s: matched, t: matched };
        const token = `ZGQ${nonce}${seq++}${nonce}GZQ`;
        entry = { token, t: g.t, src: g.s };
        lookup.set(key, entry);
        map.push(entry);
      }
      return entry.token;
    });

    return { text: out, map };
  }

  /**
   * 为源词构建正则片段：
   * 西文单词首尾自动加 \b 词边界，防止 "AI" 误伤 "plain"/"email" 内的字母串；
   * 中文或以符号开头的词不加边界，保证 "C++" / "副作用" 正常匹配。
   */
  function buildTermPattern(src) {
    const escaped = escapeRegExp(src);
    const startWord = /^[a-zA-Z0-9_]/.test(src);
    const endWord = /[a-zA-Z0-9_]$/.test(src);
    return (startWord ? "\\b" : "") + escaped + (endWord ? "\\b" : "");
  }

  /**
   * 术语还原：容忍译方对占位记号的形变（字符间插入空白、大小写变化）。
   * 未配对的残留记号先按已知记号清除，再按盐记号通用形态兜底清除，
   * 绝不把内部记号泄漏给用户。
   */
  function restoreGlossaryTerms(text, map) {
    let out = text;
    if (map && map.length > 0) {
      for (const m of map) {
        // 逐字符匹配并容许字符间夹杂空白，兼容 "ZGQ ab 0 ab GZQ" 等形变
        const flex = m.token
          .split("")
          .map((ch) => escapeRegExp(ch))
          .join("[\\s\\u00A0]*");
        out = out.replace(new RegExp(flex, "gi"), m.t.replace(/\$/g, "$$$$"));
      }
    }
    // 兜底：无论 map 是否为空，都清除仍残留的盐记号形态（防止泄漏内部记号）
    out = out.replace(/ZGQ[a-z0-9]{1,8}\d+[a-z0-9]{1,8}GZQ/gi, " ");
    return out.replace(/[ \t]{2,}/g, " ").trim();
  }

  async function toggle(isAuto = false) {
    if (running) {
      currentSessionId += 1;
      restore();
      running = false;
      queuedRetranslate = false; // 中断即放弃排队重翻，防止残留标志引发幽灵重翻
      notifyBackground("restored");
      if (!isAuto) showMaillardToast("已中断翻译并恢复原文", "info");
      return;
    }

    if (translated) {
      restore();
      notifyBackground("restored");
      if (!isAuto) showMaillardToast("已恢复原文排版", "info");
      return;
    }

    running = true;
    currentSessionId += 1;
    const sessionId = currentSessionId;
    setPageState("translating");
    notifyBackground("translating");

    try {
      const paragraphs = collectParagraphs();
      if (!paragraphs.length) {
        setPageState(null);
        notifyBackground("idle");
        if (!isAuto) showMaillardToast("当前页面暂未发现需要翻译的外文段落", "info");
        return;
      }

      const renderedCount = await translateAllConcurrent(paragraphs, sessionId);

      if (sessionId !== currentSessionId) return;

      if (renderedCount > 0) {
        translated = true;
        setPageState("translated");
        // 兜底归一化：翻译过程中若用户切换过模式，早期段落已按旧序渲染，
        // 最后统一按当前模式重排一次，消除新旧混合序
        rearrangeBilingualOrder(currentMode);
        notifyBackground("translated", { count: renderedCount });
        if (!isAuto) showMaillardToast(`✨ 全文翻译完成 (共 ${renderedCount} 段)`, "success");
      } else {
        setPageState("error");
        notifyBackground("error");
        if (!isAuto) showMaillardToast("⚠️ 翻译服务连接受阻，请检查网络或代理", "error");
      }
    } catch (e) {
      console.error("[fanyi-lite] 翻译异常:", e);
      if (sessionId === currentSessionId) {
        setPageState("error");
        notifyBackground("error");
        if (!isAuto) showMaillardToast("⚠️ 翻译服务异常，请重试", "error");
      }
    } finally {
      if (sessionId === currentSessionId) {
        running = false;
        // 消费排队重翻：仅在本次成功翻译后，立即整页用新目标语言重翻；
        // 失败路径清标志（用户手动重试时已使用新语言，无需幽灵重翻）
        if (queuedRetranslate) {
          queuedRetranslate = false;
          if (translated) {
            restore();
            setTimeout(() => toggle(false), 60);
          }
        }
      }
    }
  }

  function restore() {
    currentSessionId += 1;
    // 移除译文节点及克隆的外挂交互链接
    document.querySelectorAll("." + TARGET_CLASS).forEach((n) => n.remove());
    document.querySelectorAll(".fanyi-lite-cloned-link").forEach((n) => n.remove());
    // 还原原文包装脱壳（增加 parentNode 空指针安全防御）
    document.querySelectorAll("." + SOURCE_CLASS).forEach((span) => {
      const parent = span.parentNode;
      if (!parent) {
        span.remove();
        return;
      }
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      span.remove();
    });
    // 移除段落标记
    document.querySelectorAll("[data-fy-p]").forEach((n) => n.removeAttribute("data-fy-p"));
    setPageState(null);
    translated = false;
  }

  /* ================= 1. 段落提取与隔离 ================= */

  function collectParagraphs() {
    const candidates = new Set();

    const semanticBlocks = document.querySelectorAll(SEMANTIC_QUERY);
    for (const el of semanticBlocks) {
      if (isValidBlock(el)) candidates.add(el);
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const el = node.parentElement;
        if (!el || IGNORE_TAGS.has(el.tagName) || el.closest(IGNORE_SELECTORS)) {
          return NodeFilter.FILTER_REJECT;
        }
        const text = node.nodeValue.trim();
        if (text.length < 2 || !hasTranslatableChars(text)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    while (walker.nextNode()) {
      const leaf = findLeafBlock(walker.currentNode.parentElement);
      if (leaf && isValidBlock(leaf)) {
        candidates.add(leaf);
      }
    }

    const finalElements = [];

    for (const el of candidates) {
      const text = getDirectText(el);
      if (isTranslatableText(text)) {
        // 术语保护：命中行业术语表的词替换为占位记号再过机，译文回来后还原
        const { text: protectedText, map: restoreMap } = protectGlossaryTerms(text, activeGlossary);
        finalElements.push({ el, text: protectedText, rawText: text, restoreMap });
      }
    }

    return finalElements;
  }

  function getDirectText(el) {
    let text = "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += " " + (node.nodeValue || "");
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.classList?.contains(TARGET_CLASS) || node.hasAttribute?.("data-fy-p")) {
          continue;
        }
        if (IGNORE_TAGS.has(node.tagName) || node.matches?.(IGNORE_SELECTORS)) {
          continue;
        }
        // 关键防护：如果子节点是独立交互单元（如顶栏的单个 <a> 按钮），绝对禁止被外层父级贪婪吞并不成句！
        if (isStandaloneInteractive(node)) {
          continue;
        }
        if (!BLOCK_BOUNDARY_TAGS.has(node.tagName)) {
          text += " " + getDirectText(node);
        }
      }
    }
    return text.replace(/\s+/g, " ").trim();
  }

  function isStandaloneInteractive(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toUpperCase();
    if (tag === "BUTTON") return true;
    if (el.getAttribute?.("role") === "button" || el.getAttribute?.("role") === "link") return true;
    if (tag === "A" && el.hasAttribute?.("href")) {
      // 处于段落类容器（p/li/td/标题等）内部的链接属于行内散文，随宿主整句翻译——
      // 若在此处判为独立单元，getDirectText 会把宿主文本挖空，导致导航菜单项、
      // 标题链接、表格单元格链接成为永不翻译的"死区"；
      // 只有独立存在于导航栏/动作条/卡片按钮组（div 等非段落容器）的链接才是独立交互单元！
      const inTextParagraph = el.closest?.(
        "p, blockquote, dt, dd, li, td, th, caption, summary, figcaption, h1, h2, h3, h4, h5, h6"
      );
      return !inTextParagraph;
    }
    return false;
  }

  /**
   * 渲染期交互 chrome 判定（比 isStandaloneInteractive 更宽，用于按钮排版策略）：
   * 宿主是 button / role=button|link / 不在散文上下文中的 a[href]。
   * 命中的单元：译文与原件 100% 同款排版 + 紧凑中线；其中的原文不参与 invert 注释化。
   */
  function isInteractiveUnitContext(el) {
    if (!el || typeof el.closest !== "function") return false;
    if (el.tagName === "BUTTON") return true;
    const host = el.closest("button, [role='button'], [role='link'], a[href]");
    if (!host) return false;
    // 正文段落/列表/表格/标题内的行内链接属于散文，按普通文本处理
    if (host.closest("p, blockquote, dt, dd, li, td, th, caption, summary, figcaption, h1, h2, h3, h4, h5, h6")) return false;
    return true;
  }

  function isValidBlock(el) {
    if (!el || !el.isConnected) return false;
    if (IGNORE_TAGS.has(el.tagName)) return false;
    if (el.closest(IGNORE_SELECTORS)) return false;
    if (el.isContentEditable) return false;

    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  }

  function findLeafBlock(startEl) {
    let el = startEl;
    while (el && el !== document.body) {
      if (PARAGRAPH_TAGS.has(el.tagName)) return el;
      if (el.tagName === "DIV" || el.tagName === "SECTION" || el.tagName === "ARTICLE") {
        const hasBlockChild = el.querySelector(SEMANTIC_QUERY);
        if (!hasBlockChild) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function hasTranslatableChars(text) {
    // 全语种覆盖：拉丁/西里尔/希腊/希伯来/阿拉伯/天城文(印地等)/泰文/假名/谚文
    return /[a-zA-Z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\uAC00-\uD7AF]/.test(text);
  }

  function isTranslatableText(text) {
    if (!text || text.length < 2 || text.length > MAX_PARAGRAPH_CHARS) return false;
    if (!hasTranslatableChars(text)) return false;
    if (/^[\d\s\p{P}\p{S}]+$/u.test(text)) return false;
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text)) return false;
    if (/^(https?:\/\/|\/[\w\-./]+\S*)$/i.test(text)) return false;
    return true;
  }

  /* ================= 2. 4路并发流水线 ================= */

  async function translateAllConcurrent(paragraphs, sessionId) {
    const batches = makeBatches(paragraphs);
    const totalBatches = batches.length;
    let completedBatches = 0;
    let renderedCount = 0;
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < totalBatches) {
        if (sessionId !== currentSessionId) return;
        const index = nextIndex++;
        const batch = batches[index];

        let translations = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            translations = await requestBatchThroughBackground(
              batch.map((p) => p.text),
              currentTargetLang
            );
            if (translations && translations.length === batch.length) break;
          } catch (e) {
            if (attempt === 1) console.warn("[fanyi-lite] 批次重试失败:", e);
            else await sleep(400);
          }
        }

        if (sessionId !== currentSessionId) return;

        if (translations && translations.length === batch.length) {
          for (let i = 0; i < batch.length; i++) {
            // 译文回来后按段落还原术语占位符为官方译名
            const restored = restoreGlossaryTerms(translations[i], batch[i].restoreMap || []);
            if (render(batch[i], restored)) renderedCount++;
          }
        }

        completedBatches++;
        const percent = Math.round((completedBatches / totalBatches) * 100);
        notifyBackground("progress", { percent });
      }
    }

    const workers = [];
    const poolSize = Math.min(MAX_CONCURRENCY, totalBatches);
    for (let i = 0; i < poolSize; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    return renderedCount;
  }

  function makeBatches(paragraphs) {
    const batches = [];
    let cur = [];
    let curChars = 0;

    for (const p of paragraphs) {
      const len = p.text.length;
      if (cur.length > 0 && (cur.length >= BATCH_TEXTS || curChars + len > BATCH_CHARS)) {
        batches.push(cur);
        cur = [];
        curChars = 0;
      }
      cur.push(p);
      curChars += len;
    }
    if (cur.length > 0) batches.push(cur);
    return batches;
  }

  function requestBatchThroughBackground(texts, targetLang) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: "fanyi_translate", texts, targetLang },
        (res) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (!res || !res.success) {
            return reject(new Error(res?.error || "Background fetch failed"));
          }
          resolve(res.data);
        }
      );
    });
  }

  function notifyBackground(state, payload = {}) {
    try {
      chrome.runtime.sendMessage({ type: "fanyi_status", state, ...payload });
    } catch {}
  }

  /* ================= 3. 双语渲染与自适应排版 ================= */

  function render(paragraph, translation) {
    if (!translation) return false;
    const rawTrimmed = translation.trim();
    // 同语言跳过：需同时比对还原后译文与【原始未保护文本】——
    // 有术语保护时 paragraph.text 含内部记号，不能作为同文判定基准
    if (!rawTrimmed || rawTrimmed === paragraph.text || rawTrimmed === paragraph.rawText) return false;

    const formatted = formatTypographySpacing(rawTrimmed);
    const el = paragraph.el;
    if (!el.isConnected || el.hasAttribute("data-fy-p")) return false;

    try {
      el.setAttribute("data-fy-p", "1");

      // 为支持“译文替换”与“原文跟随”模式：将当前段落的直接文本节点包裹在 .fanyi-lite-source 中
      wrapDirectContentForMode(el);
      const sourceSpan = el.querySelector(":scope > ." + SOURCE_CLASS);

      const wrapper = document.createElement("font");
      wrapper.className = TARGET_CLASS;
      wrapper.setAttribute("translate", "no");
      wrapper.setAttribute("data-fanyi-managed", "1");

      // 【关键排版修复 1】：深色胶囊按钮及深色背景文字自适应反转为暖奶白
      if (isDarkContainer(el)) {
        wrapper.classList.add("fy-dark-ctx");
        // invert 模式下原文退居注释位：深底上下文中的原文同步反转为暖奶白，
        // 杜绝深色页面上 mocha 注释直接隐身（DeepMind 深色卡片实测）
        if (sourceSpan) sourceSpan.classList.add("fy-dark-ctx");
      }

      // 【关键排版修复 2】：交互单元（按钮/胶囊/独立链接）三件套：
      // ① 译文容器走紧凑中线（fy-btn-ctx）；② 译文与原件 100% 同款排版——
      //    字号/颜色/字重全部 inline 直拷宿主，不走美拉德注释色也不微缩；
      // ③ 其中的原文不参与 invert 注释化（fy-btn-src）——按钮里的英文必须保持原生可读
      const isBtn = isInteractiveUnitContext(el);
      if (isBtn) {
        wrapper.classList.add("fy-btn-ctx");
        if (sourceSpan) sourceSpan.classList.add("fy-btn-src");
      }

      const inner = document.createElement("span");
      inner.className = TARGET_INNER_CLASS;
      inner.lang = "zh-CN";
      inner.textContent = formatted;
      wrapper.appendChild(inner);

      // 行内容器适配
      const display = window.getComputedStyle(el).display;
      if (display.startsWith("inline") && display !== "inline-block") {
        wrapper.classList.add("fy-inline");
      }

      // 【美拉德排版核心】复制宿主文字计算样式到译文容器（inline style，优先级最高）。
      // CSS inherit 继承的是 target 的父级而非原文元素——afterend 场景下大标题译文
      // 会继承 section/div 的小字号（DeepMind 实测事故），故必须用 JS 直拷：
      // follow 普通段落按宿主字号微缩 8% 保持层级；交互单元与 replace/invert 一律 100% 复制。
      applyHostFontStyles(el, wrapper, currentMode === "follow" && !isBtn ? 0.92 : 1);

      // invert（原文跟随）：原文立即穿上注释样式——字号按【父级上下文】计算，
      // 而不是相对宿主自身（否则 34px 大标题里的原文注释会变成 28.9px 的巨型注释）
      if (currentMode === "invert" && sourceSpan && !isBtn) {
        applySourceAnnotationStyle(sourceSpan, el);
      }

      const tag = el.tagName;
      if (tag === "TR") {
        // 避免向 table/tbody 直接插 font 导致 foster parenting
        const lastCell = el.lastElementChild;
        if (lastCell) lastCell.appendChild(wrapper);
        else el.appendChild(wrapper);
      } else {
        placeWrapper(wrapper, el);
      }
      return true;
    } catch (e) {
      console.warn("[fanyi-lite] 单节点渲染异常:", e);
      return false;
    }
  }

  /**
   * 复制宿主的文字计算样式到译文容器：
   * - scale=1（replace/invert）：字号/字重/斜体/行高/字距/颜色/修饰 100% 复制；
   * - scale<1（follow）：保留宿主字体形态、字号按比例微缩，颜色清除（交还 CSS 美拉德注释色）。
   */
  function applyHostFontStyles(el, wrapper, scale) {
    try {
      const cs = getComputedStyle(el);
      const s = wrapper.style;
      const basePx = parseFloat(cs.fontSize) || 16;
      s.fontSize = (scale === 1 ? basePx : Math.max(12, basePx * scale)).toFixed(2) + "px";
      s.fontFamily = cs.fontFamily;
      s.fontWeight = cs.fontWeight;
      s.fontStyle = cs.fontStyle;
      s.lineHeight = cs.lineHeight;
      s.letterSpacing = cs.letterSpacing;
      s.textAlign = cs.textAlign;
      s.textTransform = cs.textTransform;
      if (scale === 1) {
        s.color = cs.color;
        s.textDecorationLine = cs.textDecorationLine;
        s.textDecorationStyle = cs.textDecorationStyle;
        s.textDecorationColor = cs.textDecorationColor;
      } else {
        s.color = "";
        s.textDecorationLine = "";
        s.textDecorationStyle = "";
        s.textDecorationColor = "";
      }
    } catch {}
  }

  /**
   * 统一双语插入策略与交互功能保真：
   * - 容器内部插入（首选）：只要宿主存在 sourceSpan（包含按钮、独立链接、块级段落），
   *   译文直接插入宿主【内部】、紧贴 sourceSpan（或在 invert 模式下紧邻其前）。
   *   ★ 关键优势：原按钮/链接内部的 SVG 图标、背景色、圆角、hover 动效 100% 天然保留；
   *   ★ 点击功能保真：用户点击中文译文，事件直接冒泡触发原 <a> 链接跳转或原按钮的点击逻辑！
   * - 兄弟节点插入（备选）：若因特殊上下文需作为兄弟节点外挂，若宿主是 <a> 链接，
   *   自动克隆一份同 href、同 class 的配套 <a> 链接包裹译文，使用户点击中文链接 100% 正常跳转！
   */
  function placeWrapper(wrapper, el) {
    const sourceSpan = el.querySelector(":scope > ." + SOURCE_CLASS);
    const invert = currentMode === "invert";

    // 优先在宿主容器内部呈现：保留所有原宿主的结构、图标与原生点击跳转
    if (sourceSpan) {
      // 原文整体就是单个链接（如 <h2><a>标题</a></h2>、导航 <li><a>首页</a></li>）：
      // 译文套上同款克隆 <a> 再挂到原文旁——否则"译文替换"模式隐藏原文后，链接功能随之丢失
      const soleLink = getSoleLinkChild(sourceSpan);
      if (soleLink) {
        const cloneLink = soleLink.cloneNode(false);
        cloneLink.removeAttribute("id");
        cloneLink.classList.add("fanyi-lite-cloned-link");
        cloneLink.appendChild(wrapper);
        if (invert) sourceSpan.before(cloneLink);
        else sourceSpan.after(cloneLink);
        return;
      }
      if (invert) sourceSpan.before(wrapper);
      else sourceSpan.after(wrapper);
      return;
    }

    // 外部挂载场景：若宿主是链接，将译文包裹进克隆链接中，实现点击功能 100% 配套复刻
    let mountNode = wrapper;
    if (el.tagName === "A" && el.hasAttribute("href")) {
      const cloneLink = el.cloneNode(false);
      cloneLink.removeAttribute("id");
      cloneLink.classList.add("fanyi-lite-cloned-link");
      cloneLink.appendChild(wrapper);
      mountNode = cloneLink;
    }

    if (invert) {
      el.before(mountNode);
    } else {
      el.insertAdjacentElement("afterend", mountNode);
    }
  }

  /**
   * 判断原文 span 的有效内容是否仅为单个超链接（允许夹杂空白文本/注释节点）。
   * nodeType 用数字面量（3=文本 1=元素），保证测试桩的最小环境中也可安全调用。
   */
  function getSoleLinkChild(sourceSpan) {
    let sole = null;
    for (const node of sourceSpan.childNodes || []) {
      if (node.nodeType === 3) {
        if (node.nodeValue && node.nodeValue.trim()) return null;
        continue;
      }
      if (node.nodeType !== 1) continue;
      if (sole) return null;
      if (node.tagName === "A" && node.hasAttribute?.("href")) sole = node;
      else return null;
    }
    return sole;
  }

  /**
   * 模式切换时的双语顺序重排（纯 DOM 移动，不重新请求网络）：
   * - invert：译文移到原文之前；
   * - follow/replace：译文恢复到原文之后。
   * 内部挂载以 source 为基准；兄弟挂载（行内宿主）以宿主元素为基准。
   */
  function rearrangeBilingualOrder(mode) {
    const invert = mode === "invert";
    document.querySelectorAll("." + TARGET_CLASS).forEach((t) => {
      // 克隆链接挂载（sole-link / 外挂链接场景）：以整个克隆 <a> 为单元参与重排
      const mount = typeof t.closest === "function" && t.closest(".fanyi-lite-cloned-link");
      const node = mount || t;
      const parent = node.parentElement;
      if (!parent) return;

      // 内部挂载：source 与 target（或其克隆链接）同父
      const source = parent.querySelector(":scope > ." + SOURCE_CLASS);
      if (source && source.parentElement === parent && parent.hasAttribute("data-fy-p")) {
        if (invert) {
          if (source.previousElementSibling !== node) source.before(node);
        } else {
          if (source.nextElementSibling !== node) source.after(node);
        }
        return;
      }

      // 兄弟挂载（行内宿主译文挂在宿主元素两侧）
      const host =
        node.previousElementSibling?.hasAttribute?.("data-fy-p")
          ? node.previousElementSibling
          : node.nextElementSibling?.hasAttribute?.("data-fy-p")
            ? node.nextElementSibling
            : null;
      if (!host) return;
      if (invert) {
        if (host.previousElementSibling !== node) host.before(node);
      } else {
        if (host.nextElementSibling !== node) host.after(node);
      }
    });
  }

  /**
   * 模式切换时对已渲染译文重新应用字体策略（follow↔replace/invert 的 scale 不同），
   * 并同步处理 invert 模式原文注释的穿/脱（字号按父级上下文计算）。
   */
  function reapplyModeFontStyles(mode) {
    const invert = mode === "invert";
    document.querySelectorAll("." + TARGET_CLASS).forEach((t) => {
      // 克隆链接挂载（sole-link / 外挂链接场景）：字体策略以宿主为准，重排以克隆为单元
      const mount = typeof t.closest === "function" && t.closest(".fanyi-lite-cloned-link");
      const node = mount || t;
      const parent = node.parentElement;
      if (!parent) return;
      // 交互单元（按钮/独立链接）：全模式与原件 100% 同款排版，不随 follow 微缩
      const isBtn = t.classList.contains("fy-btn-ctx");
      const scale = mode === "follow" && !isBtn ? 0.92 : 1;
      let el = null;
      let source = parent.querySelector(":scope > ." + SOURCE_CLASS);
      if (source && source.parentElement === parent && parent.hasAttribute("data-fy-p")) {
        el = parent; // 内部挂载：宿主即父级容器
      } else {
        const host =
          node.previousElementSibling?.hasAttribute?.("data-fy-p")
            ? node.previousElementSibling
            : node.nextElementSibling?.hasAttribute?.("data-fy-p")
              ? node.nextElementSibling
              : null;
        el = host || (node.closest?.("[data-fy-p]") ?? null);
        if (!source && el?.querySelector) {
          source = el.querySelector(":scope > ." + SOURCE_CLASS);
        }
      }
      if (el && el.tagName) applyHostFontStyles(el, t, scale);

      // invert：原文按父级上下文字号穿上注释样式；离开 invert 立即还原原生字号
      if (source && !source.classList.contains("fy-btn-src")) {
        if (invert) applySourceAnnotationStyle(source, el || parent);
        else clearSourceAnnotationStyle(source);
      }
    });
  }

  /**
   * invert（原文跟随）模式下原文注释字号计算：
   * 以【宿主父级上下文】字号为基准（而非宿主自身）——否则 44px 大标题里的原文
   * 会按 0.85em 变成 37px 的巨型注释（DeepMind 深色卡片实测事故）；同时钳制在
   * [12, 17]px 且永不超过宿主自身字号，保证任何宿主下注释都是优雅的次级尺寸。
   * 颜色/字重/边框由 CSS 负责（深底反色靠渲染时添加的 fy-dark-ctx 类）。
   */
  function applySourceAnnotationStyle(sourceSpan, hostEl) {
    try {
      const parentCs = getComputedStyle(hostEl.parentElement || document.body);
      const hostCs = getComputedStyle(hostEl);
      const parentPx = parseFloat(parentCs.fontSize) || 16;
      const hostPx = parseFloat(hostCs.fontSize) || 16;
      const annotationPx = Math.min(17, Math.max(12, Math.min(hostPx, parentPx) * 0.92));
      sourceSpan.style.fontSize = annotationPx.toFixed(2) + "px";
    } catch {}
  }

  function clearSourceAnnotationStyle(sourceSpan) {
    try {
      sourceSpan.style.fontSize = "";
    } catch {}
  }

  /**
   * 将当前容器直接拥有的内容包裹在 <span class="fanyi-lite-source"> 中
   * 以实现“译文替换”模式下对原文的独立隐藏，与“原文跟随”模式下的独立弱化
   */
  function wrapDirectContentForMode(el) {
    if (el.querySelector("." + SOURCE_CLASS)) return;

    // 找到所有直接文本节点和属于直接内容的行内节点
    const nodesToWrap = [];
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim().length > 0) {
        nodesToWrap.push(child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        // 装饰性图标（svg 箭头等）不包进原文 span：replace 模式下原文整体隐藏时
        // 图标必须保留可见，且图标应留在译文之后（如胶囊按钮尾部的箭头）
        if (child.matches?.(IGNORE_SELECTORS)) continue;
        if (!BLOCK_BOUNDARY_TAGS.has(child.tagName) && !child.classList?.contains(TARGET_CLASS)) {
          nodesToWrap.push(child);
        }
      }
    }

    if (nodesToWrap.length > 0) {
      const sourceSpan = document.createElement("span");
      sourceSpan.className = SOURCE_CLASS;
      nodesToWrap[0].before(sourceSpan);
      nodesToWrap.forEach((n) => sourceSpan.appendChild(n));
    }
  }

  /**
   * 智能判定容器背景是否偏深色（例如黑色胶囊按钮 Apply now）
   * 检查计算样式 color 的明度，若文字为高亮度浅色（白/米白/亮色），则背景为深色
   */
  function isDarkContainer(el) {
    try {
      const style = window.getComputedStyle(el);
      const color = style.color; // 形如 rgb(255, 255, 255)
      const m = color.match(/\d+/g);
      if (m && m.length >= 3) {
        const r = Number(m[0]), g = Number(m[1]), b = Number(m[2]);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        if (brightness > 165) return true; // 原文为浅色字，宿主为深底
      }
      // 检查背景色是否为显式暗色
      const bg = style.backgroundColor;
      const m2 = bg.match(/\d+/g);
      if (m2 && m2.length >= 3) {
        const r = Number(m2[0]), g = Number(m2[1]), b = Number(m2[2]);
        const a = m2[3] !== undefined ? Number(m2[3]) : 1;
        if (a > 0.5) {
          const bgBrightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (bgBrightness < 95) return true;
        }
      }
    } catch {}
    return false;
  }



  function formatTypographySpacing(text) {
    if (!text || !/[a-zA-Z0-9]/.test(text)) return text;
    return text
      .replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, "$1 $2")
      .replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, "$1 $2");
  }

  /* ================= 4. 美拉德 Shadow Toast 优雅提示系统 ================= */

  let activeToastCount = 0; // 活跃通知引用计数，消除幽灵清理竞态

  function showMaillardToast(message, type = "info") {
    try {
      let host = document.getElementById("fanyi-lite-toast-host");
      if (!host) {
        host = document.createElement("div");
        host.id = "fanyi-lite-toast-host";
        host.style.all = "initial";
        host.style.position = "fixed";
        host.style.top = "20px";
        host.style.left = "50%";
        host.style.transform = "translateX(-50%)";
        host.style.zIndex = "2147483647";
        host.style.pointerEvents = "none";
        document.documentElement.appendChild(host);
      }

      const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });

      // 样式单例注入：已注入则不重复重写，杜绝抹除正在展示中的上一条 Toast
      if (!shadow.querySelector("style")) {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
          :host {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .toast {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
            font-size: 13.5px;
            font-weight: 500;
            line-height: 1.5;
            letter-spacing: 0.02em;
            padding: 10px 18px;
            border-radius: 999px;
            background: rgba(253, 248, 242, 0.96);
            color: #2e1d13;
            border: 1px solid rgba(180, 83, 9, 0.22);
            box-shadow: 0 8px 24px rgba(46, 29, 19, 0.12), 0 2px 6px rgba(46, 29, 19, 0.06);
            backdrop-filter: blur(8px);
            opacity: 0;
            transform: translateY(-8px);
            transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: auto;
            white-space: nowrap;
          }
          .toast.show {
            opacity: 1;
            transform: translateY(0);
          }
          .toast-error {
            border-color: rgba(185, 28, 28, 0.3);
            color: #7f1d1d;
            background: rgba(254, 242, 242, 0.96);
          }
          .toast-success {
            border-color: rgba(21, 128, 61, 0.25);
            color: #14532d;
          }
          @media (prefers-color-scheme: dark) {
            .toast {
              background: rgba(38, 24, 16, 0.96);
              color: #fdf8f2;
              border-color: rgba(245, 158, 11, 0.35);
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
            }
            .toast-error {
              background: rgba(69, 10, 10, 0.96);
              color: #fecaca;
              border-color: rgba(239, 68, 68, 0.4);
            }
            .toast-success {
              background: rgba(5, 46, 22, 0.96);
              color: #bbf7d0;
              border-color: rgba(34, 197, 94, 0.35);
            }
          }
        `;
        shadow.appendChild(styleEl);
      }

      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      const icon = type === "success" ? "✨" : type === "error" ? "🍂" : "💡";
      toast.textContent = `${icon}  ${message}`;
      shadow.appendChild(toast);
      activeToastCount++;

      requestAnimationFrame(() => toast.classList.add("show"));

      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
          toast.remove();
          activeToastCount = Math.max(0, activeToastCount - 1);
          // 仅当所有并发 Toast 全部淡出离场后，才彻底销毁宿主容器
          if (activeToastCount === 0 && host.isConnected) {
            host.remove();
          }
        }, 300);
      }, 2800);
    } catch {}
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
})();
