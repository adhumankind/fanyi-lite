/**
 * 多服务降级链验证：node test-fallback.js
 * 场景1：Google 失败 → 自动降级国内直连引擎成功 + 记忆 lastWorking
 * 场景2：国内引擎失败 → 自动回落 Google 成功
 * 场景3：两者皆挂 → 抛出可诊断错误
 * 场景4：用户锁定单服务 → 只用被锁服务（失败即失败，不串链）
 * 场景5：auto 无记忆时默认顺序 Google 优先
 * 注意：PROVIDERS 在 new Function 顶层求值时会捕获 __g/__d 引用，
 *       因此每个场景必须"先设桩 → 再建实例 → 后调用"。
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "fanyi-lite/background.js"), "utf8");

const s = src.indexOf("const PROVIDERS = [");
const e = src.indexOf("// ---------- 引擎一：Google");
let pure = src.slice(s, e);
pure = pure.replace(
  /const PROVIDERS = \[[\s\S]*?\];/,
  "const PROVIDERS = [{ id: \"google\", name: \"Google\", fn: globalThis.__g }, { id: \"domestic\", name: \"国内直连\", fn: globalThis.__d }];"
);

let allPass = true;
function check(name, cond, detail = "") {
  if (!cond) allPass = false;
  console.log(name + ": " + (cond ? "PASS" : "FAIL") + (detail ? "  → " + detail : ""));
}

const storageState = { service: "auto" };
const chromeStub = {
  storage: { local: { get: async (def) => ({ ...def, ...storageState }) } },
};
const makeCtx = () =>
  new Function(
    "chrome", "console", "setTimeout",
    pure + "\nreturn { translateWithFallback, getLast: () => lastWorkingProvider };"
  )(chromeStub, console, setTimeout);

async function run() {
  // ---------- 场景1：Google 挂，国内直连顶上 ----------
  globalThis.__g = async () => { throw new Error("Google API HTTP 503"); };
  globalThis.__d = async (t) => t.map((x) => "DM:" + x);
  let ctx = makeCtx();
  let r = await ctx.translateWithFallback(["hi"], "zh-CN");
  check("场景1 Google挂→国内直连顶上", r.provider === "domestic" && r.data[0] === "DM:hi", `provider=${r.provider}`);
  check("场景1b 记忆 lastWorking=domestic", ctx.getLast() === "domestic");

  // ---------- 场景2：国内引擎挂，Google 活 ----------
  globalThis.__g = async (t) => t.map((x) => "GG:" + x);
  globalThis.__d = async () => { throw new Error("Domestic API HTTP 500"); };
  ctx = makeCtx();
  const r2 = await ctx.translateWithFallback(["hi"], "zh-CN");
  check("场景2 国内挂→回落Google", r2.provider === "google" && r2.data[0] === "GG:hi", `provider=${r2.provider}`);

  // ---------- 场景3：双挂 → 抛出 ----------
  globalThis.__g = async () => { throw new Error("net down"); };
  globalThis.__d = async () => { throw new Error("auth down"); };
  ctx = makeCtx();
  let err = null;
  try { await ctx.translateWithFallback(["hi"], "zh-CN"); } catch (e) { err = e; }
  check("场景3 双挂→抛出错误", !!err && !!err.message, `err="${err && err.message}"`);

  // ---------- 场景4：锁定国内直连（Google 可用也不串） ----------
  storageState.service = "domestic";
  globalThis.__g = async (t) => t.map((x) => "GG:" + x);
  globalThis.__d = async () => { throw new Error("Domestic locked fail"); };
  ctx = makeCtx();
  let lockErr = null;
  try { await ctx.translateWithFallback(["hi"], "zh-CN"); } catch (e) { lockErr = e; }
  check("场景4 锁定国内直连→失败不串Google", lockErr?.message === "Domestic locked fail", `err="${lockErr && lockErr.message}"`);

  // ---------- 场景5：auto 无记忆时默认顺序 Google 优先 ----------
  storageState.service = "auto";
  globalThis.__g = async (t) => t.map((x) => "GG:" + x);
  globalThis.__d = async (t) => t.map((x) => "DM:" + x);
  const ctx5 = makeCtx();
  const r5 = await ctx5.translateWithFallback(["hi"], "zh-CN");
  check("场景5 auto默认Google优先", r5.provider === "google", `provider=${r5.provider}`);

  console.log("\n" + (allPass ? "=== 降级链 6 项全部通过 ===" : "=== 存在失败用例 ==="));
  process.exit(allPass ? 0 : 1);
}

run();
