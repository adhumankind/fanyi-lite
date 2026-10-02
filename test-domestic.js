/**
 * 国内直连引擎单元测试：node test-domestic.js
 * 场景1：启发式源语言检测（英/日/韩/俄/希腊/阿拉伯）
 * 场景2：正常响应解析
 * 场景3：配额耗尽警告识别（不把警告串当译文渲染）
 * 场景4：无效源语言错误识别
 * 场景5：批内并发池结果按序返回
 * 场景6：空文本直通
 * 场景7：超长段落 splitLongText 智能切分（MyMemory 500 字符硬限防护）
 * 场景8：无警告的裸空响应 → 段落级回退原文，不熔断整批
 * 场景9：限长错误对半切分自救（防御兜底，正常分块不会触发）
 * 场景10：中日韩目标语言分块拼接无空格，其他目标语言保留空格
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "fanyi-lite/background.js"), "utf8");

const s = src.indexOf("async function fetchDomesticTranslate");
const e = src.indexOf("// ---------- 连通性自测");
const pure = src.slice(s, e);

let allPass = true;
function check(name, cond, detail = "") {
  if (!cond) allPass = false;
  console.log(name + ": " + (cond ? "PASS" : "FAIL") + (detail ? "  → " + detail : ""));
}

function makeEnv(responder) {
  let fetchCalls = [];
  const fetchMock = async (url) => {
    fetchCalls.push(String(url));
    return responder(url);
  };
  // 切片需覆盖 detectSourceLang + pooledMap + fetchDomesticTranslate 三段
  const s0 = src.indexOf("function detectSourceLang");
  const enginePure = src.slice(s0, e);
  const fn = new Function(
    "fetch", "URLSearchParams", "setTimeout", "clearTimeout", "decodeHtmlEntities",
    enginePure + "\nreturn { fetchDomesticTranslate, detectSourceLang };"
  )(fetchMock, URLSearchParams, setTimeout, clearTimeout, (t) => t);
  return { ...fn, fetchCalls };
}

// ---------- 场景1：源语言检测 ----------
{
  const s1 = src.indexOf("function detectSourceLang");
  const e1 = src.indexOf("async function fetchDomesticTranslate");
  const fn = new Function(
    src.slice(s1, e1) +
    "\nreturn { detectSourceLang };"
  );
  const { detectSourceLang } = fn();
  const cases = [
    [["Hello world", "Another English line"], "en"],
    [["こんにちは世界"], "ja"],
    [["안녕하세요"], "ko"],
    [["Привет мир"], "ru"],
    [["Καλημέρα κόσμε"], "el"],
    [["مرحبا بالعالم"], "ar"],
  ];
  for (const [texts, expected] of cases) {
    const got = detectSourceLang(texts);
    check(`检测 ${texts[0].slice(0, 8)} → ${expected}`, got === expected, `got=${got}`);
  }
}

// ---------- 场景2：正常响应 ----------
{
  const env = makeEnv(() => ({
    ok: true,
    json: async () => ({ responseData: { translatedText: "你好世界" }, responseStatus: 200 }),
  }));
  env.fetchDomesticTranslate(["Hello world"], "zh-CN").then((res) => {
    check("场景2 正常解析译文", res[0] === "你好世界", JSON.stringify(res));
    check("场景2b langpair 携带检测出的源语言 en", env.fetchCalls[0].includes("langpair=en%7Czh-CN") || env.fetchCalls[0].includes("langpair=en|zh-CN"),
      env.fetchCalls[0]);

    // ---------- 场景3：配额警告 ----------
    const envQ = makeEnv(() => ({
      ok: true,
      json: async () => ({
        responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY" },
        responseStatus: 200,
      }),
    }));
    envQ.fetchDomesticTranslate(["Hello"], "zh-CN").then(
      () => {
        check("场景3 配额警告不被当作译文", false, "竟然没抛错");
        finish();
      },
      (e) => {
        check("场景3 配额警告抛出友好错误", /额度已用尽/.test(e.message), e.message);
        finish();
      }
    );
  });

  function finish() {
    // ---------- 场景4：无效源语言 ----------
    const envI = makeEnv(() => ({
      ok: true,
      json: async () => ({
        responseData: { translatedText: "'AUTO' IS AN INVALID SOURCE LANGUAGE" },
        responseDetails: "INVALID SOURCE LANGUAGE",
      }),
    }));
    envI.fetchDomesticTranslate(["こんにちは"], "zh-CN").then(
      () => {
        check("场景4 无效语言错误抛出", false, "竟然没抛错");
        finalCheck();
      },
      (e) => {
        check("场景4 无效语言错误抛出", /Domestic API bad response/.test(e.message), e.message);
        finalCheck();
      }
    );
  }

  function finalCheck() {
    // ---------- 场景5：并发池保序 ----------
    const envP = makeEnv((url) => {
      const q = decodeURIComponent(url.split("q=")[1].split("&")[0]).replace(/\+/g, " ");
      return new Promise((resolve) => {
        // 后到的先返回，验证结果仍按输入顺序
        const delay = q.includes("slow") ? 60 : 10;
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ responseData: { translatedText: "译:" + q }, responseStatus: 200 }),
        }), delay);
      });
    });
    envP.fetchDomesticTranslate(["a slow one", "b fast", "c fast"], "zh-CN").then((res) => {
      check("场景5 并发池结果按输入顺序返回", res[0] === "译:a slow one" && res[1] === "译:b fast" && res[2] === "译:c fast",
        JSON.stringify(res));

      // ---------- 场景6：空文本直通 ----------
      envP.fetchDomesticTranslate(["", "  "], "zh-CN").then((res2) => {
        check("场景6 空文本直通为空串", res2.every((x) => x === ""), JSON.stringify(res2));
        done();
      });
    });
  }

  function done() {
    // ---------- 场景7：超长段落 splitLongText 智能切分（MyMemory 500 字符硬限） ----------
    const sSplit = src.indexOf("function splitLongText");
    const eSplit = src.indexOf("async function fetchDomesticTranslate");
    const splitFn = new Function(src.slice(sSplit, eSplit) + "\nreturn splitLongText;");
    const splitLongText = splitFn();

    {
      const r1 = splitLongText("Hello world", 460);
      check("场景7a 短文本不切分", r1.length === 1 && r1[0] === "Hello world");

      const r2 = splitLongText("a".repeat(460), 460);
      check("场景7b 恰好在 460 边界不切分", r2.length === 1);

      const r3 = splitLongText("a".repeat(461), 460);
      check("场景7c 超出边界立即切分", r3.length === 2);

      const en = "The first sentence is quite long and talks about artificial intelligence systems. ".repeat(7);
      const r4 = splitLongText(en, 460);
      check("场景7d 英文长文按句子边界切切分且每块 ≤460",
        r4.length >= 2 && r4.every((c) => c.length <= 460),
        `原长=${en.length} 块数=${r4.length} 块长=${r4.map((c) => c.length).join(",")}`);

      const noPunct = "x".repeat(1200);
      const r5 = splitLongText(noPunct, 460);
      check("场景7e 无标点超长串硬切且内容无损",
        r5.length === 3 && r5.join("") === noPunct,
        `块数=${r5.length}`);

      const zh = "我们的使命是负责任地构建人工智能以造福人类。".repeat(30);
      const r6 = splitLongText(zh, 460);
      check("场景7f 中文长文按句号切分且每块 ≤460",
        r6.length >= 2 && r6.every((c) => c.length <= 460),
        `原长=${zh.length} 块数=${r6.length} 块长=${r6.map((c) => c.length).join(",")}`);
    }

    // ---------- 场景8：裸空响应 → 段落级回退原文 ----------
    {
      const envE = makeEnv(() => ({
        ok: true,
        json: async () => ({ responseData: { translatedText: "" }, responseStatus: 200 }),
      }));
      envE.fetchDomesticTranslate(["Hello world"], "zh-CN").then(
        (res) => {
          check("场景8 空响应回退原文且不抛错", res[0] === "Hello world", JSON.stringify(res));
          scenario9();
        },
        (e) => {
          check("场景8 空响应回退原文且不抛错", false, e.message);
          scenario9();
        }
      );
    }

    function scenario9() {
      // ---------- 场景9：限长错误对半切分自救 ----------
      const envL = makeEnv((url) => {
        const q = decodeURIComponent(url.split("q=")[1].split("&")[0]).replace(/\+/g, " ");
        return {
          ok: true,
          json: async () =>
            q.length > 200
              ? {
                  responseData: { translatedText: "QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 CHARS" },
                  responseDetails: "QUERY LENGTH LIMIT EXCEEDED",
                }
              : { responseData: { translatedText: "译" + q }, responseStatus: 200 },
        };
      });
      const longX = "x".repeat(600);
      envL.fetchDomesticTranslate([longX], "zh-CN").then(
        (res) => {
          // 600 字符先按 460 预算切成 2 块；460 块触发挥救→230→115×2，140 块直接过。
          // 共 8 次查询（460/230/230 触限 + 5 次成功），5 个子译块按序拼接：
          // 译x115 译x115 译x115 译x115 译x140
          const expected =
            "译" + "x".repeat(115) +
            "译" + "x".repeat(115) +
            "译" + "x".repeat(115) +
            "译" + "x".repeat(115) +
            "译" + "x".repeat(140);
          check(
            "场景9 限长错误对半切分自救且原文不丢",
            res[0] === expected,
            `返回长度=${res[0]?.length}`
          );
          const qLens = envL.fetchCalls.map((u) =>
            decodeURIComponent(u.split("q=")[1].split("&")[0]).replace(/\+/g, " ").length
          );
          check(
            "场景9b 自救后成功查询均 ≤200（触限的 460/230 已被切碎重发）",
            qLens.length === 8 && qLens.filter((n) => n <= 200).length === 5,
            `查询长度=${qLens.join(",")}`
          );
          scenario10();
        },
        (e) => {
          check("场景9 限长错误对半切分自救且原文不丢", false, e.message);
          scenario10();
        }
      );
    }

    function scenario10() {
      // ---------- 场景10：CJK 目标语言拼接无空格 ----------
      const envJ = makeEnv((url) => {
        const q = decodeURIComponent(url.split("q=")[1].split("&")[0]).replace(/\+/g, " ");
        return {
          ok: true,
          json: async () => ({ responseData: { translatedText: "译" + q }, responseStatus: 200 }),
        };
      });
      const splitFn = new Function(
        src.slice(src.indexOf("function splitLongText"), src.indexOf("async function fetchDomesticTranslate")) +
        "\nreturn splitLongText;"
      );
      const splitLongText = splitFn();
      const longEn = "Alpha beta gamma delta epsilon. ".repeat(15); // 480 字符，多句边界

      envJ.fetchDomesticTranslate([longEn], "zh-CN").then((resZh) => {
        const chunksZh = splitLongText(longEn, 460, "");
        check(
          "场景10a 中文目标分块拼接无空格",
          resZh[0] === chunksZh.map((c) => "译" + c).join(""),
          `块数=${chunksZh.length}`
        );
        envJ.fetchDomesticTranslate([longEn], "fr").then((resFr) => {
          const chunksFr = splitLongText(longEn, 460, " ");
          check(
            "场景10b 非法语目标分块拼接保留空格",
            resFr[0] === chunksFr.map((c) => "译" + c).join(" "),
            `块数=${chunksFr.length}`
          );
          finalReport();
        });
      });
    }

    function finalReport() {
      console.log("\n" + (allPass ? "=== 国内直连引擎 22 项断言全部通过 ===" : "=== 存在失败用例 ==="));
      process.exit(allPass ? 0 : 1);
    }
  }
}
