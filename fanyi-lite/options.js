document.addEventListener("DOMContentLoaded", async () => {
  const currentShortcut = document.getElementById("currentShortcut");
  const btnShortcuts = document.getElementById("btnOpenChromeShortcuts");
  const btnTestProviders = document.getElementById("btnTestProviders");
  const stGoogle = document.getElementById("stGoogle");
  const stDomestic = document.getElementById("stDomestic");
  const glossaryEditor = document.getElementById("glossaryEditor");
  const btnSaveGlossary = document.getElementById("btnSaveGlossary");
  const glossaryStatus = document.getElementById("glossaryStatus");
  const strategyRadios = document.querySelectorAll('input[name="serviceStrategy"]');

  // 1. 快捷键展示与跳转
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === "toggle-translate");
    if (cmd && cmd.shortcut) currentShortcut.textContent = cmd.shortcut;
  } catch {}
  btnShortcuts.addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });

  // 2. 服务引擎策略（智能互备 / 仅国内直连 / 仅 Google）
  try {
    const cfg = await chrome.storage.local.get({ service: "auto" });
    setStrategyActive(cfg.service || "auto");
  } catch {}

  strategyRadios.forEach((r) => {
    r.addEventListener("change", async (e) => {
      const service = e.target.value;
      setStrategyActive(service);
      await chrome.storage.local.set({ service });
    });
  });

  function setStrategyActive(service) {
    strategyRadios.forEach((r) => {
      const isCur = r.value === service;
      r.checked = isCur;
      r.closest(".strategy-label")?.classList.toggle("active", isCur);
    });
  }

  // 3. 引擎连通性自测
  btnTestProviders.addEventListener("click", async () => {
    btnTestProviders.disabled = true;
    btnTestProviders.textContent = "⏳ 正在检测…";
    stGoogle.className = "provider-status status-unknown";
    stGoogle.textContent = "检测中";
    stDomestic.className = "provider-status status-unknown";
    stDomestic.textContent = "检测中";

    try {
      const res = await chrome.runtime.sendMessage({ type: "fanyi_test_providers" });
      if (res?.success && res.res) {
        applyProviderStatus(stGoogle, res.res.google);
        applyProviderStatus(stDomestic, res.res.domestic);
      } else {
        throw new Error(res?.error || "自测失败");
      }
    } catch (e) {
      const fail = "失败";
      stGoogle.className = "provider-status status-fail";
      stGoogle.textContent = fail;
      stDomestic.className = "provider-status status-fail";
      stDomestic.textContent = fail;
    } finally {
      btnTestProviders.disabled = false;
      btnTestProviders.textContent = "🔍 检测引擎连通性";
    }
  });

  function applyProviderStatus(el, val) {
    if (val === "ok") {
      el.className = "provider-status status-ok";
      el.textContent = "✓ 可用";
    } else {
      el.className = "provider-status status-fail";
      el.textContent = val === "empty" ? "返回异常" : "不可达";
      el.title = val || "";
    }
  }

  // 4. 自定义术语表读写
  try {
    const cfg = await chrome.storage.local.get({ userGlossary: "" });
    glossaryEditor.value = cfg.userGlossary || "";
  } catch {}

  let saveTimer = null;
  btnSaveGlossary.addEventListener("click", async () => {
    const text = glossaryEditor.value;
    await chrome.storage.local.set({ userGlossary: text });
    const count = countGlossaryLines(text);
    glossaryStatus.textContent = count > 0 ? `✓ 已保存 ${count} 条术语` : "✓ 已保存（当前无术语）";
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => (glossaryStatus.textContent = ""), 2500);
  });

  function countGlossaryLines(text) {
    if (!text) return 0;
    // 与 content.js parseGlossaryText 的分隔符保持一致：中英冒号与等号均计数
    return text.split("\n").filter((l) => {
      const t = l.trim();
      if (!t || t.startsWith("#")) return false;
      return ["：", ":", "="].some((sep) => t.indexOf(sep) > 0);
    }).length;
  }
});
