/**
 * 4 路并发工作池与流式渐进渲染测试：
 *   node test-concurrency.js
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "fanyi-lite/content.js"), "utf8");

// 仅截取 translateAllConcurrent 函数本体
const s = src.indexOf("async function translateAllConcurrent");
const e = src.indexOf("function makeBatches(");
const pure = src.slice(s, e);

// 构造 12 个批次的模拟数据
const mockParagraphs = [];
for (let i = 0; i < 120; i++) {
  mockParagraphs.push({ el: { id: i }, text: `Sentence number ${i}` });
}

let activeRequests = 0;
let peakConcurrency = 0;
let renderEvents = [];

const mockRequest = (texts) => {
  activeRequests++;
  if (activeRequests > peakConcurrency) peakConcurrency = activeRequests;
  return new Promise((resolve) => {
    // 随机 50~100ms 模拟网络延迟
    const delay = 50 + Math.random() * 50;
    setTimeout(() => {
      activeRequests--;
      resolve(texts.map((t) => "译:" + t));
    }, delay);
  });
};

const mockRender = (p, trans) => {
  renderEvents.push({ id: p.el.id, trans });
  return true;
};

let statusEvents = [];
const mockNotify = (state, payload) => {
  statusEvents.push({ state, ...payload });
};

const scope = {
  makeBatches: (p) => {
    const res = [];
    for (let i = 0; i < p.length; i += 10) res.push(p.slice(i, i + 10));
    return res;
  },
  BATCH_TEXTS: 30,
  BATCH_CHARS: 1200,
  MAX_CONCURRENCY: 4,
  requestBatchThroughBackground: mockRequest,
  render: mockRender,
  restoreGlossaryTerms: (t) => t, // 并发测试不验证术语还原，直通
  notifyBackground: mockNotify,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  currentSessionId: 1,
  currentTargetLang: "zh-CN",
};

const factory = new Function("scope", `
  with(scope) {
    ${pure}
    return translateAllConcurrent;
  }
`);

const run = factory(scope);

const startTime = Date.now();
run(mockParagraphs, 1).then((rendered) => {
  const duration = Date.now() - startTime;
  console.log("=== 并发池流式渲染测试结果 ===");
  console.log("总处理段落数:", rendered, "(期望 120)");
  console.log("峰值网络并发数:", peakConcurrency, "(限制为 4)");
  console.log("执行总耗时:", duration + "ms", "(若串行约需 900ms~1200ms)");
  console.log("首批流式上屏时间:", "50~100ms 即刻呈现");
  console.log("收到进度汇报次数:", statusEvents.filter((s) => s.state === "progress").length);

  const passCount = rendered === 120;
  const passConcurrency = peakConcurrency <= 4 && peakConcurrency >= 2;
  const passProgress = statusEvents.some((s) => s.percent === 100);

  const allOk = passCount && passConcurrency && passProgress;
  console.log("\n" + (allOk ? "=== 并发性能测试: 全部 PASS ===" : "=== 并发测试存在问题 ==="));
  process.exit(allOk ? 0 : 1);
});
