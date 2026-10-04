# Chrome 网上应用店发布指南

商品：宇宙无敌超级霹雳便捷的网页翻译工具（作者：阿帝）
本指南对应版本：**v0.8.7**（商店上传包 `dist/fanyi-lite-v0.8.7.zip`，2026-10-02 打包）

---

## 0. 已就绪的材料（直接取用）

| 材料 | 位置 | 用途 |
|---|---|---|
| 商店上传包 | `dist/fanyi-lite-v0.8.7.zip` | 开发者控制台上传（manifest 已在 zip 根目录） |
| 截图 ×3（1280×800） | `dist/store-follow.png`、`dist/store-replace.png`、`dist/store-invert.png` | 商店详情页截图（三种呈现模式实拍） |
| 商店文案 | 本文件第 4 节 | 名称/简介/详细描述/分类 |
| 权限理由与隐私声明 | 本文件第 5 节 | 审核必填（建议英文填写） |
| 隐私政策草稿 | 本文件第 7 节 | 需发布到公开 URL 后填入 |

---

## 1. 前置条件

1. **Google 账号**（建议注册一个专用账号，开发者名称会公开显示）；必须开启**两步验证**。
2. **一次性注册费 $5 美元**：需要一张国际信用卡（Visa/万事达等）。免费发布不需要绑收款账户。
3. **网络**：注册、上传、查审核状态都要访问 Google（国内需要代理）。⚠️ 用户安装也要求能访问 Chrome 商店。
4. 你的**浏览器需要能访问 Google 翻译**才能完整体验（本扩展已有国内直连通道兜底，商店截图与介绍已按此描述）。

## 2. 注册开发者账号

1. 打开 `https://chrome.google.com/webstore/devconsole`（需代理），登录 Google 账号。
2. 同意《Chrome 应用商店开发者协议》并支付 $5 注册费。
3. 填写账号详情：**开发者名称**（公开显示，填「阿帝」或你的品牌名）、联系方式等。

## 3. 上传扩展包

1. 控制台右上角「**新增商品 / New item**」。
2. 拖入 `dist/fanyi-lite-v0.8.7.zip` 上传（⚠️ 必须是本 zip，不要用资源管理器右键压缩的嵌套文件夹包）。
3. 上传成功后进入「商店发布 / Store listing」标签页填写信息（文案见第 4 节）。

## 4. 商店文案（直接复制粘贴）

- **名称**（自动读自 manifest，不可改）：宇宙无敌超级霹雳便捷的网页翻译工具
- **简短说明**（自动读自 manifest，v0.8.8 已按 KWS 规则改为自然句式）：一款干净优雅的整页翻译扩展。按 Alt+1 即可将网页译成中文，原文与译文对照阅读，或整页替换为中文排版。多语种互译，国内外网络均可流畅使用。作者：阿帝
- **类别**：工具（Tools）　**语言**：中文（简体）
- **详细描述**（长描述，直接粘贴）：

```text
这是一款为中文用户打造的整页翻译扩展：在任意网页上按一下 Alt+1，页面文字就会变成中文；再按一次，完整还原原文。

翻译结果有三种阅读方式，可随时切换——译文跟在原文旁对照阅读；或整页替换成中文，像浏览中文网站一样干净；也可以让中文作为主角、原文退为小字注释，适合深度阅读。

它内置了常见站点的行业术语库，也支持添加自己的术语，让专业词汇的译名在全文保持一致。翻译由 Google 翻译接口完成；如果网络无法访问 Google，会自动切换到国内可直连的翻译通道，无需代理也能正常使用。

扩展只在你主动按下翻译时读取当前页面的文字，偏好设置全部保存在本地，不收集任何其他数据。翻译进行中时，工具栏图标会亮起一圈彩虹描边，方便确认状态。

按 Alt+1 即可开始，快捷键可以在扩展的选项页查看和修改。
```text
【一键全文翻译 · Alt+1 即开即关】
在任意网页按 Alt+1，整页外文瞬间变成中文；再按一次完整还原原文。支持「总是翻译」模式，进入外文网页自动开始翻译。

【三大呈现模式，随场景切换】
● 译文跟随 —— 原文旁附上美拉德风格中文注释，双语对照阅读
● 译文替换 —— 整页变成原生中文排版，像中文网站一样干净
● 原文跟随 —— 中文当主角、原文退为注释，适合深度阅读

【专业级行业翻译】
内置 技术/学术/医疗/法律/金融/电商/游戏/工业 八大行业术语库，按站点自动匹配；支持自定义术语表（每行一条，如 "me: 我"），术语译名全文统一。

【国内外双引擎，网络无忧】
Google 免费接口 + 国内极速直连通道，失败自动降级；没有代理也能用。可手动锁定引擎，或一键连通性自测。

【细节拉满】
● 按钮与导航链接翻译后保留原样式和点击功能，翻译状态一目了然（图标亮起彩虹描边）
● 多语种互译：英/日/韩/俄/法/德/西/阿拉伯/希伯来/泰/印地等
● SPA 网站路由切换自动跟进翻译
● 4 路并发流水线，长页面也快速出结果

【隐私说明】
偏好设置仅保存在本地；仅在你触发翻译时，将所访问页面的文本发送给你选择的翻译服务（Google 翻译或 MyMemory）用于生成译文。不收集、不上传任何其他数据。

快捷键 Alt+1 可在扩展「选项」页查看与修改。
```

- **截图**：上传 `dist/store-follow.png`、`dist/store-replace.png`、`dist/store-invert.png` 三张。
- **小宣传图（440×280）**：当前为可选项，可跳过；后续想加可再做。

## 5. 隐私与权限声明（「隐私权规范」标签页，审核重点）

- **单一用途**：
  `Translate the text of web pages into the user's chosen language, displayed alongside or in place of the original text.`
- **数据使用**：勾选「**网站内容 / Website content**」= 是，其余类别全部 = 否；「是否出售数据」「是否在无关用途中使用数据」= 否。
  - Website content 理由（英文粘贴）：
    `This is a full-page translation extension. When the user triggers translation (Alt+1 or the toolbar toggle), the text of the page being visited is sent to the translation service the user selected (Google Translate or MyMemory) to obtain the translation. No other data is collected, and nothing is stored on any server.`
- **权限理由**：
  - `storage`：
    `Store user preferences locally (target language, display mode, industry glossary, engine strategy). No server is involved.`
  - `host_permissions <all_urls>`（同时解释内容脚本全站注入）：
    `A full-page translation extension must be able to access the text of any page the user chooses to translate. The content script only extracts text when the user explicitly triggers translation, and only sends that text to the chosen translation API. No browsing history or personal data is collected.`
- **远程代码**：无（MV3 纯静态包，符合政策）。
- **隐私政策 URL**：把第 7 节文本发布到一个公开可访问的地址（推荐：GitHub Gist 单文件 → 获得 RAW 链接；或 GitHub Pages / 自己的网站），把链接填入「隐私政策」字段。⚠️ 处理"网站内容"数据的扩展必须提供隐私政策 URL。

## 6. 提交与审核

> ⚠️ **审核经验（v0.8.7 被拒实录）**：首版简介采用"功能词分号罗列"句式，被 KWS（关键字垃圾内容）自动检测以"描述中超过 5 个实体"拒绝（违规参考 Yellow Argon）。v0.8.8 起简介与详细描述均改为自然叙事句式，避免分号/顿号罗列功能关键词；若再次遇到同类拒绝，也可在「版本 > 状态」页对修订版本点「申诉」。

1. 「分布范围」选 **公开（Public）**（也可先「不公开/Unlisted」仅凭链接安装，审核标准相同）。
2. 点「**提交审核 / Submit for review**」。
3. 审核预期：全站内容脚本权限通常触发**人工审核**，一般 1～7 天，偶有更久。期间状态显示「待审核」。
4. 被拒最常见原因：权限理由不充分、缺隐私政策、截图与实际功能不符。按本指南填写基本可避免；若被拒会给出原因，补正后重新提交即可。
5. 通过后自动上架。**此后更新**：改 `manifest.json` 的 version → 重新打包 zip → 控制台同一商品上传新包 → 再走一次审核（通常更快）。

## 7. 隐私政策（草稿，发布为公开网页后填 URL）

```text
隐私政策 — 宇宙无敌超级霹雳便捷的网页翻译工具（浏览器扩展）
最后更新：2026-10-02　作者：阿帝

1. 我们处理的数据
① 偏好设置（目标语言、显示模式、行业术语表、引擎策略）：仅保存在你的浏览器本地（chrome.storage.local），不上传、不同步。
② 网页文本：仅当你在某个网页上主动触发翻译（Alt+1 或工具栏开关）时，该页面中提取出的文本会被发送到你当前选择的翻译服务（Google 翻译 translate.googleapis.com，或 MyMemory api.mymemory.translated.net）用于生成译文。

2. 我们不做的事
· 不收集、不存储、不出售任何个人身份信息；
· 不包含任何统计/分析/广告组件；
· 除上述翻译服务外，不向任何服务器发送数据；
· 不包含远程代码，所有逻辑均在本地运行。

3. 第三方服务
翻译请求由你选择的翻译服务处理，其数据处理遵循该服务商自己的隐私政策（Google 或 MyMemory）。

4. 联系方式
阿帝 ——（填你的邮箱）
```

## 8. 备选 / 补充渠道：Microsoft Edge 加载项（国内直连）

- **免注册费、国内可直连提交**，接受同一份 Chrome MV3 zip（`dist/fanyi-lite-v0.8.7.zip` 原样上传）。
- 入口：`https://partner.microsoft.com/dashboard/microsoftedge`（微软账号登录）→ 创建扩展 → 上传 zip → 填写类似的商店信息与隐私声明 → 提交审核。
- 建议双商店同时上架，Edge 审核通常也较快。

---

## 附：本次商店包内容核对

- manifest.json（version 0.8.7，permissions 仅 storage，host_permissions <all_urls>）
- background.js / content.js / style.css / popup.html / popup.js / options.html / options.js
- icons/：active·inactive·icon 三套 × 16/32/48/128（美拉德「译」字纯色块，active 带彩虹描边）
- 已通过全部 12 套自动化测试；activeTab 权限已移除（代码未使用，降低审核摩擦）
