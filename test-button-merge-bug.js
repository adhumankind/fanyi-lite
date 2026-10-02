/**
 * 诊断与验证：DeepMind 顶栏链接/按钮与行内超链接的提取与渲染
 * 测试场景：
 * <div>
 *   <a class="chip" href="/build">Build with Gemini</a>
 *   <a class="chip primary" href="/try"><svg>✦</svg> Try Gemini</a>
 * </div>
 *
 * 缺陷验证：
 * 之前由于 a 标签未作为独立交互块，被外层 div 误当成纯文本合并成一句话！
 */
const PARAGRAPH_TAGS_OLD = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6",
  "LI", "DT", "DD", "BLOCKQUOTE", "FIGCAPTION",
  "TD", "TH", "CAPTION", "SUMMARY", "BUTTON",
]);

// 改进方案：任何具有独立交互/导航语义的元素（a, button, [role=button], [role=link]）
// 都必须被视作独立的独立段落单元（INTERACTIVE_TAGS），禁止被祖先容器偷并！
const INTERACTIVE_TAGS = new Set(["A", "BUTTON"]);

console.log("旧规则中 A 是否为段落标签:", PARAGRAPH_TAGS_OLD.has("A"));
console.log("新规则中 A 必须独立作为独立单元，禁止合并！");
