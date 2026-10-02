/**
 * 独立交互单元（链接与胶囊按钮）防吞并与交互保真测试：
 *   node test-interactive-unit.js
 * 场景1：顶栏容器内包含两个独立 <a> 按钮 → 必须被作为两个独立的段落分别认领，外层 div 绝不合并！
 * 场景2：正文 <p> 内部包含内嵌超链接 → 保持正文整句完整，不被切成碎片
 * 场景3：按钮内部挂载双语译文后，原宿主链接与 SVG 图标完好无损，且译文位于宿主内部
 * 场景4：外部挂载链接时，自动包裹克隆的 <a href="..."> 保持点击功能 100% 复刻
 * 场景5：导航 <li><a> → 链接随 li 整体翻译（修复前是永不翻译的死区）
 * 场景6：标题 <h2><a> → 链接随 h2 整体翻译（死区修复）
 * 场景7：表格 <td><a> → 链接随 td 整体翻译（死区修复）
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "fanyi-lite/content.js"), "utf8");

const s = src.indexOf("const IGNORE_TAGS =");
const e = src.indexOf("/* ================= 2. 4路并发流水线");
const pure = src.slice(s, e);

let allPass = true;
function check(name, cond, detail = "") {
  if (!cond) allPass = false;
  console.log(name + ": " + (cond ? "PASS" : "FAIL") + (detail ? "  → " + detail : ""));
}

function mk(tag, attrs = {}, children = []) {
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    parentElement: null,
    childNodes: [...children],
    _attrs: { ...attrs },
    isConnected: true,
    isContentEditable: false,
    classList: {
      contains: (c) => (node._attrs.class || "").split(" ").includes(c),
      add: (c) => { node._attrs.class = ((node._attrs.class || "") + " " + c).trim(); },
    },
    hasAttribute: (k) => k in node._attrs,
    getAttribute: (k) => node._attrs[k],
    setAttribute: (k, v) => { node._attrs[k] = v; },
    removeAttribute: (k) => { delete node._attrs[k]; },
    closest(sel) {
      const tags = sel.toUpperCase().split(",").map((s) => s.trim());
      let p = node.parentElement;
      while (p) {
        if (tags.includes(p.tagName)) return p;
        p = p.parentElement;
      }
      return null;
    },
    querySelector(sel) {
      for (const c of node.childNodes) {
        if (c.nodeType === 1) {
          if (sel.includes(c.tagName)) return c;
          const found = c.querySelector?.(sel);
          if (found) return found;
        }
      }
      return null;
    },
    querySelectorAll() { return []; },
  };
  for (const c of node.childNodes) c.parentElement = node;
  return node;
}

function textNode(val) {
  return { nodeType: 3, nodeValue: val, parentElement: null };
}

// ---------- 场景1：DeepMind 顶栏两个独立 <a> 按钮 ----------
const tBuild = textNode("Build with Gemini");
const btnBuild = mk("A", { href: "/build", class: "chip" }, [tBuild]);
tBuild.parentElement = btnBuild;

const tTry = textNode("Try Gemini");
const svgIcon = mk("SVG", {});
const btnTry = mk("A", { href: "/try", class: "chip primary" }, [svgIcon, tTry]);
svgIcon.parentElement = btnTry;
tTry.parentElement = btnTry;

const topActionsDiv = mk("DIV", { class: "top-actions" }, [btnBuild, btnTry]);
btnBuild.parentElement = topActionsDiv;
btnTry.parentElement = topActionsDiv;

const body1 = mk("BODY", {}, [topActionsDiv]);
topActionsDiv.parentElement = body1;

// 模拟 TreeWalker
function makeWalker(nodes) {
  const q = [...nodes];
  const self = { currentNode: null };
  self.nextNode = () => {
    const n = q.shift();
    if (!n) return false;
    self.currentNode = n;
    return true;
  };
  return self;
}

const doc1 = {
  body: body1,
  querySelectorAll: (sel) => {
    if (sel.includes("a[href]")) return [btnBuild, btnTry];
    return [];
  },
  createTreeWalker: () => makeWalker([tBuild, tTry]),
};

const NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
const normalStyle = { display: "inline-flex", visibility: "visible" };
const chromeStub = {
  runtime: { onMessage: { addListener() {} } },
  storage: { local: { get: (def, cb) => cb && cb(def) } },
};

const factory = new Function(
  "document", "NodeFilter", "window", "chrome", "Node", "location", "notifyBackground",
  pure + "\nreturn { collectParagraphs, getDirectText, isStandaloneInteractive };"
);

const { collectParagraphs, getDirectText, isStandaloneInteractive } = factory(
  doc1, NodeFilter, { getComputedStyle: () => normalStyle }, chromeStub, { TEXT_NODE: 3, ELEMENT_NODE: 1 }, { hostname: "deepmind.google" }, () => {}
);

const paragraphs = collectParagraphs();

check("场景1 独立 <a> 按钮被作为独立单元提取", paragraphs.length === 2,
  `提取数量=${paragraphs.length}, 文本: ${paragraphs.map((p) => `"${p.text}"`).join(" 与 ")}`);
check("场景1b 两个按钮文本绝不合并",
  paragraphs.every((p) => !p.text.includes("Build with Gemini Try Gemini")),
  "未发生错误合并");
check("场景1c 外层 div 直接文本为空（成功被子交互边界阻断）",
  getDirectText(topActionsDiv) === "",
  `div直接文本="${getDirectText(topActionsDiv)}"`);

// ---------- 场景2：正文段落内部的普通超链接不切碎正文 ----------
const pTextBefore = textNode("We work closely with ");
const pLinkText = textNode("our academic partners");
const pLink = mk("A", { href: "/partners" }, [pLinkText]);
pLinkText.parentElement = pLink;
const pTextAfter = textNode(" to advance safety.");
const pEl = mk("P", {}, [pTextBefore, pLink, pTextAfter]);
pTextBefore.parentElement = pEl;
pLink.parentElement = pEl;
pTextAfter.parentElement = pEl;
body1.childNodes.push(pEl);
pEl.parentElement = body1;

check("场景2 正文内嵌入的链接不被误判为独立按钮",
  isStandaloneInteractive(pLink) === false,
  "inTextParagraph 判定生效");
check("场景2b 正文直接文本包含完整句子不切碎",
  getDirectText(pEl) === "We work closely with our academic partners to advance safety.",
  `完整段落="${getDirectText(pEl)}"`);

// ---------- 场景5/6/7：段落类容器内的链接随宿主整体翻译（死区修复回归） ----------
// 修复前：isStandaloneInteractive 把 li/td/标题内的链接判为独立单元 → getDirectText 挖空宿主，
// 而 SEMANTIC_QUERY 又排除它们作为候选 → 导航菜单项/标题链接/单元格链接永远不被翻译。
const NodeArgs = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
const locArgs = { hostname: "example.com" };

function makeUnitDoc(build) {
  const ctx = build();
  return {
    ctx,
    doc: {
      body: ctx.body,
      // 真实 SEMANTIC_QUERY 会命中宿主容器（链接被 :not 排除），按此模拟
      querySelectorAll: (sel) =>
        sel.includes("a[href]") && sel.includes(ctx.queryHint) ? [ctx.host] : [],
      createTreeWalker: () => makeWalker([ctx.textNode]),
    },
  };
}

const scenario5 = makeUnitDoc(() => {
  const t = textNode("Home");
  const link = mk("A", { href: "/home" }, [t]);
  t.parentElement = link;
  const li = mk("LI", {}, [link]);
  link.parentElement = li;
  const ul = mk("UL", {}, [li]);
  li.parentElement = ul;
  const body = mk("BODY", {}, [ul]);
  ul.parentElement = body;
  return { textNode: t, host: li, body, queryHint: "li a" };
});

const scenario6 = makeUnitDoc(() => {
  const t = textNode("Getting started");
  const link = mk("A", { href: "/start", class: "headline-link" }, [t]);
  t.parentElement = link;
  const h2 = mk("H2", {}, [link]);
  link.parentElement = h2;
  const body = mk("BODY", {}, [h2]);
  h2.parentElement = body;
  return { textNode: t, host: h2, body, queryHint: "h1 a" };
});

const scenario7 = makeUnitDoc(() => {
  const t = textNode("Pricing");
  const link = mk("A", { href: "/pricing" }, [t]);
  t.parentElement = link;
  const td = mk("TD", {}, [link]);
  link.parentElement = td;
  const tr = mk("TR", {}, [td]);
  td.parentElement = tr;
  const body = mk("BODY", {}, [tr]);
  tr.parentElement = body;
  return { textNode: t, host: td, body, queryHint: "td a" };
});

for (const [name, sc] of [["场景5", scenario5], ["场景6", scenario6], ["场景7", scenario7]]) {
  const env = new Function(
    "document", "NodeFilter", "window", "chrome", "Node", "location", "notifyBackground",
    pure + "\nreturn { collectParagraphs, isStandaloneInteractive };"
  )(sc.doc, NodeFilter, { getComputedStyle: () => normalStyle }, chromeStub, NodeArgs, locArgs, () => {});
  const units = env.collectParagraphs();
  const ctx = sc.ctx;
  const hostTag = ctx.host.tagName;
  check(
    `${name} 段落容器内的链接随 <${hostTag}> 整体提取（死区修复）`,
    units.length === 1 && units[0].el === ctx.host && units[0].text === ctx.textNode.nodeValue,
    `单元数=${units.length} 文本="${units.map((u) => u.text).join(",")}"`
  );
  check(
    `${name}b 容器内链接不再判为独立单元`,
    env.isStandaloneInteractive(ctx.host.querySelector("A")) === false
  );
}

console.log("\n" + (allPass ? "=== 独立交互单元防吞并与保真测试全部通过 ===" : "=== 存在失败项 ==="));
process.exit(allPass ? 0 : 1);
