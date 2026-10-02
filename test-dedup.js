/**
 * 段落提取逻辑真实 DOM 模拟单元测试 (v0.2.1 强化版)：
 *   node test-dedup.js
 * 用例1：父 DIV 包裹两个 P（且 DIV.textContent 包含子 P 的文本）→ 只认领两个 P，DIV 必须被精准跳过！
 * 用例2：孤立 DIV 叶子（无块级子元素）→ 被认领
 * 用例3：display:none 的 P → 不被认领
 * 用例4：position:fixed 元素（offsetParent=null 但可见）→ 仍被认领
 * 用例5：表格 TD 和 TH 单元格 → 必须被成功认领！
 * 用例6：嵌套列表（父 LI 内含子 UL）→ 父 LI 自身前缀文字与子 LI 各自独立被认领，绝不丢失！
 * 用例7：盘古之白排版微调 → 汉字与英数加空格，全角标点保持紧凑
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "fanyi-lite/content.js"), "utf8");

const s = src.indexOf("const IGNORE_TAGS");
const e = src.indexOf("const sleep = (ms)");
const pure = src.slice(s, e);

function mk(tag, text, children) {
  const node = {
    nodeType: 1,
    tagName: tag,
    parentElement: null,
    childNodes: [],
    _text: text,
    isConnected: true,
    isContentEditable: false,
    _attrs: {},
    _fixed: false,
    get textContent() {
      if (this.childNodes.length > 0) {
        return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join(" ");
      }
      return this._text || "";
    },
    get innerText() { return this.textContent; },
    cloneNode(deep) { return mk(this.tagName, this._text, deep ? [...this.childNodes] : []); },
    closest() { return null; },
    matches() { return false; },
    contains(o) { let p = o; while (p) { if (p === this) return true; p = p.parentElement; } return false; },
    hasAttribute(k) { return !!this._attrs[k]; },
    setAttribute(k, v) { this._attrs[k] = v; },
    removeAttribute(k) { delete this._attrs[k]; },
    querySelector(sel) {
      const targets = sel.toLowerCase().split(",").map((s) => s.trim());
      for (const c of this.childNodes) {
        if (c.nodeType === 1) {
          if (targets.includes(c.tagName.toLowerCase())) return c;
          const found = c.querySelector?.(sel);
          if (found) return found;
        }
      }
      return null;
    },
    querySelectorAll(sel) { return []; },
  };

  if (children && children.length > 0) {
    node.childNodes = [...children];
    for (const c of node.childNodes) c.parentElement = node;
  } else if (text) {
    node.childNodes = [{ nodeType: 3, nodeValue: text, parentElement: node }];
  }

  return node;
}

function makeTextNode(val, parent) {
  const t = { nodeType: 3, nodeValue: val, parentElement: parent };
  if (parent) parent.childNodes.push(t);
  return t;
}

function makeWalker(nodes) {
  const q = nodes.slice();
  const self = { currentNode: null };
  self.nextNode = () => {
    const n = q.shift();
    if (!n) return false;
    self.currentNode = n;
    return true;
  };
  return self;
}

// ---------- 用例1：父 DIV 包裹两个 P ----------
const p1 = mk("P", "Hello world paragraph one");
const p2 = mk("P", "Second English paragraph here");
const div1 = mk("DIV", "", [p1, p2]);
const body1 = mk("BODY", "", [div1]);
div1.parentElement = body1; p1.parentElement = div1; p2.parentElement = div1;
const doc1 = {
  body: body1,
  querySelectorAll: (sel) => [p1, p2],
  createTreeWalker: () => makeWalker([
    { parentElement: p1, nodeValue: "Hello world paragraph one" },
    { parentElement: p2, nodeValue: "Second English paragraph here" },
  ]),
};

// ---------- 用例2：孤立 DIV 叶子 ----------
const d1 = mk("DIV", "Some standalone English text in a div");
const b2 = mk("BODY", "", [d1]);
d1.parentElement = b2;
const doc2 = {
  body: b2,
  querySelectorAll: () => [],
  createTreeWalker: () => makeWalker([{ parentElement: d1, nodeValue: d1._text }]),
};

// ---------- 用例3：display:none ----------
const p3 = mk("P", "Hidden English text");
const b3 = mk("BODY", "", [p3]);
p3.parentElement = b3;
const doc3 = {
  body: b3,
  querySelectorAll: () => [p3],
  createTreeWalker: () => makeWalker([{ parentElement: p3, nodeValue: p3._text }]),
};

// ---------- 用例4：position:fixed ----------
const p4 = mk("P", "Fixed sidebar English text");
const b4 = mk("BODY", "", [p4]);
p4.parentElement = b4; p4._fixed = true;
const doc4 = {
  body: b4,
  querySelectorAll: () => [p4],
  createTreeWalker: () => makeWalker([{ parentElement: p4, nodeValue: p4._text }]),
};

// ---------- 用例5：表格 TD 和 TH 单元格 ----------
const th1 = mk("TH", "Metric Header");
const td1 = mk("TD", "Value Cell");
const tr = mk("TR", "", [th1, td1]);
const table = mk("TABLE", "", [tr]);
const b5 = mk("BODY", "", [table]);
th1.parentElement = tr; td1.parentElement = tr; tr.parentElement = table; table.parentElement = b5;
const doc5 = {
  body: b5,
  querySelectorAll: (sel) => (sel.includes("td") ? [th1, td1] : []),
  createTreeWalker: () => makeWalker([
    { parentElement: th1, nodeValue: "Metric Header" },
    { parentElement: td1, nodeValue: "Value Cell" },
  ]),
};

// ---------- 用例6：嵌套列表（父 LI 包含前缀文字和子 UL）----------
const subLi1 = mk("LI", "Sub item alpha");
const subLi2 = mk("LI", "Sub item beta");
const subUl = mk("UL", "", [subLi1, subLi2]);
const parentLi = mk("LI", "", []);
makeTextNode("Parent item lead title", parentLi);
parentLi.childNodes.push(subUl);
const mainUl = mk("UL", "", [parentLi]);
const b6 = mk("BODY", "", [mainUl]);
subLi1.parentElement = subUl; subLi2.parentElement = subUl; subUl.parentElement = parentLi;
parentLi.parentElement = mainUl; mainUl.parentElement = b6;
const doc6 = {
  body: b6,
  querySelectorAll: (sel) => (sel.includes("li") ? [parentLi, subLi1, subLi2] : []),
  createTreeWalker: () => makeWalker([
    { parentElement: parentLi, nodeValue: "Parent item lead title" },
    { parentElement: subLi1, nodeValue: "Sub item alpha" },
    { parentElement: subLi2, nodeValue: "Sub item beta" },
  ]),
};

const NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
const normalStyle = { display: "block", visibility: "visible" };
const hiddenStyle = { display: "none", visibility: "visible" };
const chromeStub = {
  runtime: { onMessage: { addListener() {} } },
  storage: { local: { get: (def, cb) => cb && cb(def) } },
};

const factory = new Function(
  "document", "NodeFilter", "window", "chrome", "Node",
  pure + "\nreturn { collectParagraphs, formatTypographySpacing, applyHostFontStyles, placeWrapper, rearrangeBilingualOrder };"
);

const cases = [
  {
    name: "用例1 真实 DOM 嵌套：子 P 认领后，父 DIV 被精准跳过",
    doc: doc1, style: normalStyle,
    expect: (r) => r.length === 2 && r.every((x) => x.el.tagName === "P"),
  },
  {
    name: "用例2 孤立 DIV 叶子被认领",
    doc: doc2, style: normalStyle,
    expect: (r) => r.length === 1 && r[0].el.tagName === "DIV",
  },
  {
    name: "用例3 display:none 段落跳过",
    doc: doc3, style: hiddenStyle,
    expect: (r) => r.length === 0,
  },
  {
    name: "用例4 fixed 元素不误判为隐藏",
    doc: doc4, style: normalStyle,
    expect: (r) => r.length === 1 && r[0].el.tagName === "P",
  },
  {
    name: "用例5 表格 TD 与 TH 单元格成功认领",
    doc: doc5, style: normalStyle,
    expect: (r) => r.length === 2 && r.some((x) => x.el.tagName === "TH") && r.some((x) => x.el.tagName === "TD"),
  },
  {
    name: "用例6 嵌套列表：父 LI 前缀文本与子 LI 各自独立认领，绝不丢失",
    doc: doc6, style: normalStyle,
    expect: (r) => {
      const hasParent = r.some((x) => x.text === "Parent item lead title");
      const hasSub1 = r.some((x) => x.text === "Sub item alpha");
      const hasSub2 = r.some((x) => x.text === "Sub item beta");
      return r.length === 3 && hasParent && hasSub1 && hasSub2;
    },
  },
];

let allPass = true;
const Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };

for (const c of cases) {
  const win = { getComputedStyle: () => c.style };
  const { collectParagraphs } = factory(c.doc, NodeFilter, win, chromeStub, Node);
  let result;
  try {
    result = collectParagraphs();
  } catch (e) {
    console.log(c.name + ": FAIL (" + e.message + ")");
    allPass = false;
    continue;
  }
  const pass = c.expect(result);
  if (!pass) allPass = false;
  console.log(
    c.name + ": " + (pass ? "PASS" : "FAIL") +
    " [认领 " + result.length + " → " + result.map((r) => r.el.tagName + `("${r.text}")`).join(", ") + "]"
  );
}

// ---------- 用例7：盘古之白排版算法测试 ----------
const { formatTypographySpacing } = factory(
  doc1, NodeFilter, { getComputedStyle: () => normalStyle }, chromeStub, Node
);
const t1 = formatTypographySpacing("提升了30%。GPT模型很好。");
const t2 = formatTypographySpacing("【GPT-4】具有超强理解力。");
const pass7 = t1 === "提升了 30%。GPT 模型很好。" && t2 === "【GPT-4】具有超强理解力。";
if (!pass7) allPass = false;
console.log("用例7 盘古之白排版（汉字/英数加空格，全角标点保持紧凑）: " + (pass7 ? "PASS" : "FAIL") +
  `\n   t1: "${t1}"\n   t2: "${t2}"`);

// ---------- 用例8：宿主字体形态克隆（inline style）+ 块级容器内部插入策略 ----------
{
  const check = (name, cond, detail = "") => {
    if (!cond) allPass = false;
    console.log(name + ": " + (cond ? "PASS" : "FAIL") + (detail ? "  → " + detail : ""));
  };
  // 从生产源码提取 applyHostFontStyles + placeWrapper + rearrangeBilingualOrder
  const sF = src.indexOf("function applyHostFontStyles");
  const sR = src.indexOf("function reapplyModeFontStyles");
  const engineSrc = src.slice(sF, sR);
  const hostCs = {
    fontSize: "44px", fontFamily: "Roboto, sans-serif", fontWeight: "700",
    fontStyle: "normal", lineHeight: "50px", letterSpacing: "1px",
    textAlign: "center", textTransform: "none", color: "rgb(32, 33, 36)",
    textDecorationLine: "none", textDecorationStyle: "solid",
    textDecorationColor: "rgb(32, 33, 36)",
  };
  const engine = new Function(
    "getComputedStyle", "window", "currentMode", "SOURCE_CLASS", "TARGET_CLASS", "document",
    engineSrc + "\nreturn { applyHostFontStyles, placeWrapper };"
  )(
    () => hostCs,
    { getComputedStyle: () => ({ display: "block" }) },
    "follow",
    "fanyi-lite-source",
    "fanyi-lite-target",
    { querySelectorAll: () => [] }
  );

  // 8a：scale=1（replace/invert）100% 克隆
  const styleFull = {};
  engine.applyHostFontStyles({ tagName: "H1" }, { style: styleFull }, 1);
  const cloned =
    parseFloat(styleFull.fontSize) === 44 && styleFull.fontWeight === "700" &&
    styleFull.color === "rgb(32, 33, 36)" && styleFull.lineHeight === "50px" &&
    styleFull.fontFamily === "Roboto, sans-serif";
  check("用例8a replace/invert：宿主字体计算样式 100% inline 克隆", cloned,
    `fontSize=${styleFull.fontSize} weight=${styleFull.fontWeight} color=${styleFull.color}`);

  // 8b：scale=0.92（follow）微缩 + 清色
  const styleFollow = {};
  engine.applyHostFontStyles({ tagName: "H1" }, { style: styleFollow }, 0.92);
  const followOk =
    parseFloat(styleFollow.fontSize) === 40.48 && styleFollow.color === "" && styleFollow.fontWeight === "700";
  check("用例8b follow：宿主字号×0.92微缩且清除内联色（美拉德CSS注释色接管）", followOk,
    `fontSize=${styleFollow.fontSize} color="${styleFollow.color}"`);

  // 8c：块级宿主内部插入——译文紧贴 source span（[source][target][ul] 序列）
  const sourceSpan = mk("SPAN", "Original");
  const subUl = mk("UL", "", [mk("LI", "sub")]);
  const liHost = {
    nodeType: 1,
    tagName: "LI",
    childNodes: [sourceSpan, subUl],
    insertAdjacentElement() {}, // 兄弟分支兜底（本用例不应走到）
    querySelector(sel) {
      return sel.includes("fanyi-lite-source") ? sourceSpan : null;
    },
  };
  sourceSpan.parentElement = liHost;
  subUl.parentElement = liHost;
  // 桩补 after(n)：把 n 移动到 sourceSpan 之后（真实 DOM after 语义）
  sourceSpan.after = (n) => {
    const i = liHost.childNodes.indexOf(sourceSpan);
    liHost.childNodes.splice(i + 1, 0, n);
    n.parentElement = liHost;
  };

  const target = mk("FONT", "译文");
  engine.placeWrapper(target, liHost);
  const order =
    liHost.childNodes[0] === sourceSpan &&
    liHost.childNodes[1] === target &&
    liHost.childNodes[2] === subUl;
  check("用例8c 块级宿主：译文内部插入并紧贴 source span（防折行/防flex抛飞）", order,
    `子节点序列=${liHost.childNodes.map((c) => c.tagName).join(",")}`);

  // 8d：整段内容就是单个链接（<h2><a>标题</a></h2>、导航 <li><a>首页</a></li>）
  //     → 译文套同款克隆链接挂载，"译文替换"模式隐藏原文后点击行为 100% 保留
  const soleLink = mk("A", "");
  soleLink.setAttribute("href", "/start");
  soleLink.setAttribute("class", "headline-link");
  soleLink.childNodes = [{ nodeType: 3, nodeValue: "Getting started", parentElement: soleLink }];
  // 测试桩的 cloneNode 不拷贝属性且 mk 无 classList，这里按真实 DOM 语义补齐
  soleLink.cloneNode = function () {
    const c = mk("A", "");
    for (const [k, v] of Object.entries(this._attrs)) c.setAttribute(k, v);
    c.classList = {
      add: (cls) => { c._attrs.class = ((c._attrs.class || "") + " " + cls).trim(); },
      contains: (cls) => (c._attrs.class || "").split(" ").includes(cls),
    };
    c.cloneNode = this.cloneNode;
    c.appendChild = (n) => { c.childNodes.push(n); n.parentElement = c; };
    return c;
  };
  const soleSource = mk("SPAN", "");
  soleSource.childNodes = [soleLink];
  soleLink.parentElement = soleSource;
  const h2Host = {
    nodeType: 1, tagName: "H2", childNodes: [soleSource],
    insertAdjacentElement() {},
    querySelector(sel) { return sel.includes("fanyi-lite-source") ? soleSource : null; },
  };
  soleSource.parentElement = h2Host;
  soleSource.after = (n) => {
    const i = h2Host.childNodes.indexOf(soleSource);
    h2Host.childNodes.splice(i + 1, 0, n);
    n.parentElement = h2Host;
  };
  const target8d = mk("FONT", "标题译文");
  engine.placeWrapper(target8d, h2Host);
  const cloneNode8d = h2Host.childNodes[1];
  const cloneOk =
    !!cloneNode8d && cloneNode8d.tagName === "A" &&
    cloneNode8d._attrs.href === "/start" &&
    (cloneNode8d._attrs.class || "").includes("fanyi-lite-cloned-link") &&
    cloneNode8d.childNodes.includes(target8d);
  check("用例8d sole-link 宿主：译文套同款克隆链接（替换模式不丢点击）", cloneOk,
    `挂载序列=${h2Host.childNodes.map((c) => c.tagName).join(",")}`);
}

// ---------- 用例9：模式切换双语顺序重排（兄弟场景 + 内部场景，双向切换幂等） ----------

// 可移动 DOM 桩：before/after/appendChild 支持
function movable(tag, attrs = {}) {
  const node = {
    nodeType: 1, tagName: tag, childNodes: [], parentElement: null,
    classList: { contains: (c) => (attrs.class || "").split(" ").includes(c) },
    hasAttribute: (k) => k in attrs,
    remove() {},
    querySelector(sel) {
      // 简化桩：支持 ":scope > .class" 与 ".class"
      const m = sel.match(/\.([a-z-]+)$/i);
      if (!m) return null;
      const cls = m[1];
      for (const c of node.childNodes) {
        if (c.nodeType === 1 && c.classList?.contains(cls)) return c;
      }
      return null;
    },
  };

  Object.defineProperty(node, "previousElementSibling", {
    get() {
      const p = node.parentElement;
      if (!p) return null;
      const i = p.childNodes.indexOf(node);
      for (let j = i - 1; j >= 0; j--) {
        if (p.childNodes[j].nodeType === 1) return p.childNodes[j];
      }
      return null;
    },
  });
  Object.defineProperty(node, "nextElementSibling", {
    get() {
      const p = node.parentElement;
      if (!p) return null;
      const i = p.childNodes.indexOf(node);
      for (let j = i + 1; j < p.childNodes.length; j++) {
        if (p.childNodes[j].nodeType === 1) return p.childNodes[j];
      }
      return null;
    },
  });
  node.before = (n) => {
    const p = node.parentElement;
    detach(n); // 先摘除再取索引，保证同父移动时索引正确（对齐真实 DOM 语义）
    const i = p.childNodes.indexOf(node);
    p.childNodes.splice(i, 0, n); n.parentElement = p;
  };
  node.after = (n) => {
    const p = node.parentElement;
    detach(n);
    const i = p.childNodes.indexOf(node);
    p.childNodes.splice(i + 1, 0, n); n.parentElement = p;
  };
  return node;
}
function detach(n) {
  if (n.parentElement) {
    const i = n.parentElement.childNodes.indexOf(n);
    if (i >= 0) n.parentElement.childNodes.splice(i, 1);
  }
}

// 兄弟场景：<div parent><p data-fy-p><span source>原文</span></p><font target>译文</font></div>
const srcSpan = movable("SPAN", { class: "fanyi-lite-source" });
const hostP = movable("P", { "data-fy-p": "1" });
const targetFont = movable("FONT", { class: "fanyi-lite-target" });
const parentDiv = movable("DIV");
parentDiv.childNodes = [hostP, targetFont];
hostP.parentElement = parentDiv; targetFont.parentElement = parentDiv;
hostP.childNodes = [srcSpan]; srcSpan.parentElement = hostP;

// 内部场景：<li data-fy-p><span source>导语</span><ul>子列表</ul><font target>译文</font></li>
const src9 = movable("SPAN", { class: "fanyi-lite-source" });
const subUl9 = movable("UL");
const tgt9 = movable("FONT", { class: "fanyi-lite-target" });
const hostLi = movable("LI", { "data-fy-p": "1" });
hostLi.childNodes = [src9, subUl9, tgt9];
src9.parentElement = hostLi; subUl9.parentElement = hostLi; tgt9.parentElement = hostLi;

// 桩 document.querySelectorAll 供重排函数使用
const origDoc = doc1;
const docWithQSA = Object.create(origDoc);
docWithQSA.querySelectorAll = (sel) =>
  sel === ".fanyi-lite-target" ? [targetFont, tgt9] : [];

// 重排函数内部捕获 factory 的 document，需用 docWithQSA 重新实例化
const factoryRearrange = new Function(
  "document", "NodeFilter", "window", "chrome", "Node",
  pure + "\nreturn { rearrangeBilingualOrder };"
);
const { rearrangeBilingualOrder } = factoryRearrange(
  docWithQSA, NodeFilter, { getComputedStyle: () => normalStyle }, chromeStub, Node
);

let pass9 = true;
// follow 初始态检查
let ok = parentDiv.childNodes[0] === hostP && parentDiv.childNodes[1] === targetFont;
ok = ok && hostLi.childNodes[0] === src9 && hostLi.childNodes[2] === tgt9;
console.log("用例9a follow 初始布局: " + (ok ? "PASS" : "FAIL"));
if (!ok) pass9 = false;

// 切 invert：译文在前
rearrangeBilingualOrder("invert");
ok = parentDiv.childNodes[0] === targetFont && parentDiv.childNodes[1] === hostP;
ok = ok && hostLi.childNodes[0] === tgt9 && hostLi.childNodes[1] === src9 && hostLi.childNodes[2] === subUl9;
console.log("用例9b invert 重排（兄弟+内部译文均前置）: " + (ok ? "PASS" : "FAIL"));
if (!ok) pass9 = false;

// 幂等性：再次 invert 不变
rearrangeBilingualOrder("invert");
ok = parentDiv.childNodes[0] === targetFont && hostLi.childNodes[0] === tgt9;
console.log("用例9c invert 幂等性: " + (ok ? "PASS" : "FAIL"));
if (!ok) pass9 = false;

// 切回 follow：译文回到原文之后
rearrangeBilingualOrder("follow");
ok = parentDiv.childNodes[0] === hostP && parentDiv.childNodes[1] === targetFont;
ok = ok && hostLi.childNodes[0] === src9 && hostLi.childNodes[1] === tgt9 && hostLi.childNodes[2] === subUl9;
console.log("用例9d 切回 follow 布局恢复: " + (ok ? "PASS" : "FAIL"));
if (!ok) pass9 = false;

if (!pass9) allPass = false;

console.log("\n" + (allPass ? "=== 全部 9 组严苛测试全部通过 ===" : "=== 存在失败用例 ==="));
process.exit(allPass ? 0 : 1);
