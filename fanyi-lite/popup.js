/**
 * 宇宙无敌超级霹雳便捷的网页翻译工具 — 弹出操作面板逻辑
 */
document.addEventListener("DOMContentLoaded", async () => {
  const btnToggle = document.getElementById("btnToggle");
  const btnToggleLabel = document.getElementById("btnToggleLabel");
  const hotkeyChip = document.getElementById("hotkeyChip");
  const chkAutoTranslate = document.getElementById("chkAutoTranslate");
  const btnOptions = document.getElementById("btnOptions");
  const footerVersion = document.getElementById("footerVersion");
  const modeRadios = document.querySelectorAll('input[name="transMode"]');
  const selTargetLang = document.getElementById("selTargetLang");
  const selIndustry = document.getElementById("selIndustry");
  const industryAutoBadge = document.getElementById("industryAutoBadge");
  const industryHint = document.getElementById("industryHint");

  // 版本号单一事实源：始终读取 manifest，避免多处硬编码漂移
  try {
    footerVersion.textContent = `v${chrome.runtime.getManifest().version} · 阿帝出品`;
  } catch {}

  let currentTabId = null;

  // 1. 获取当前活动标签页并查询其翻译状态，联动主按钮文案
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id;
  queryPageStatus();

  // 2. 读取保存的配置
  const settings = await chrome.storage.local.get({
    transMode: "follow",
    alwaysTranslate: false,
    targetLang: "zh-CN",
    industry: "auto",
    userGlossary: "",
  });

  chkAutoTranslate.checked = !!settings.alwaysTranslate;
  setRadioActive(settings.transMode);
  selTargetLang.value = settings.targetLang || "zh-CN";
  selIndustry.value = settings.industry || "auto";
  refreshIndustryBadge(settings.industry || "auto", tab?.url);

  // 3. 读取当前注册的快捷键并显示在按钮上
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === "toggle-translate");
    if (cmd && cmd.shortcut) hotkeyChip.textContent = cmd.shortcut;
  } catch {}

  // 4. 点击大按钮：切换当前页面翻译（带即时动效反馈）
  btnToggle.addEventListener("click", async () => {
    if (!currentTabId) return;
    const isTranslating = btnToggle.classList.contains("state-running");
    const isTranslated = btnToggle.classList.contains("state-translated");

    if (!isTranslating && !isTranslated) {
      btnToggle.classList.add("state-running");
      btnToggleLabel.textContent = "正在发起翻译…";
    }

    try {
      await chrome.tabs.sendMessage(currentTabId, { type: "toggle-translate" });
      setTimeout(() => window.close(), 160); // 留出 160ms 让用户看到视觉确认反馈后优雅关闭
    } catch {
      window.close();
    }
  });

  // 5. 模式切换
  modeRadios.forEach((r) => {
    r.addEventListener("change", async (e) => {
      const mode = e.target.value;
      setRadioActive(mode);
      await chrome.storage.local.set({ transMode: mode });
      if (currentTabId) sendToTab({ type: "set-mode", mode });
    });
  });

  // 6. 目标语言切换（变更目标语言将触发已翻译页面自动重翻）
  selTargetLang.addEventListener("change", async (e) => {
    await chrome.storage.local.set({ targetLang: e.target.value });
  });

  // 7. 行业切换
  selIndustry.addEventListener("change", async (e) => {
    const industry = e.target.value;
    await chrome.storage.local.set({ industry });
    refreshIndustryBadge(industry, tab?.url);
  });

  // 8. 总是翻译开关
  chkAutoTranslate.addEventListener("change", async (e) => {
    await chrome.storage.local.set({ alwaysTranslate: e.target.checked });
  });

  // 9. 底部入口（快捷键修改入口在 Options 设置页）
  btnOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

  function sendToTab(message) {
    if (!currentTabId) return;
    try {
      const res = chrome.tabs.sendMessage(currentTabId, message);
      if (res && typeof res.catch === "function") res.catch(() => {});
    } catch {}
  }

  function queryPageStatus() {
    if (!currentTabId) return;
    chrome.tabs.sendMessage(currentTabId, { type: "get-status" }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      btnToggle.classList.remove("state-running", "state-translated");
      if (res.running) {
        btnToggleLabel.textContent = "正在翻译中…";
        btnToggle.classList.add("state-running");
      } else if (res.translated) {
        btnToggleLabel.textContent = "还原当前页面原文";
        btnToggle.classList.add("state-translated");
      } else {
        btnToggleLabel.textContent = "翻译当前页面";
      }
    });
  }

  function refreshIndustryBadge(industry, url) {
    const LABELS = {
      tech: "技术", academic: "学术", medical: "医疗", legal: "法律",
      finance: "金融", ecommerce: "电商", gaming: "游戏", industrial: "工业", general: "通用",
    };
    if (industry !== "auto") {
      industryAutoBadge.hidden = true;
      industryHint.textContent = `已启用手动指定行业词库：${LABELS[industry] || industry}`;
      return;
    }
    industryAutoBadge.hidden = false;
    // 向前端复用内容脚本同款规则做轻量预测（展示用）
    const HOSTS = [
      ["tech", ["github.com", "stackoverflow.com", "npmjs.com", "juejin.cn", "v2ex.com"]],
      ["academic", ["arxiv.org", "ieee.org", "nature.com", "springer.com"]],
      ["medical", ["webmd.com", "nih.gov", "mayoclinic.org"]],
      ["legal", ["law.cornell.edu", "lexisnexis.com"]],
      ["finance", ["reuters.com", "bloomberg.com", "wsj.com", "ft.com"]],
      ["ecommerce", ["amazon.com", "ebay.com", "aliexpress.com"]],
      ["gaming", ["store.steampowered.com", "epicgames.com", "ign.com"]],
      ["industrial", ["siemens.com", "abb.com", "honeywell.com"]],
    ];
    let detected = "general";
    try {
      const h = new URL(url || "").hostname.replace(/^www\./, "").toLowerCase();
      for (const [ind, list] of HOSTS) {
        if (list.some((x) => h === x || h.endsWith("." + x))) { detected = ind; break; }
      }
    } catch {}
    industryAutoBadge.textContent = `识别:${LABELS[detected]}`;
    industryHint.textContent = `已按当前站点自动匹配行业词库：${LABELS[detected]}`;
  }

  function setRadioActive(mode) {
    modeRadios.forEach((r) => {
      const isCur = r.value === mode;
      r.checked = isCur;
      r.closest(".mode-option")?.classList.toggle("active", isCur);
    });
  }
});
