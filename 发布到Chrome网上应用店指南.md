# Chrome 网上应用店发布指南

商品：宇宙无敌超级霹雳便捷的网页翻译工具（作者：阿帝）
本指南对应版本：**v0.8.9**（商店上传包 `dist/fanyi-lite-v0.8.9.zip`）

---

## 0. 已就绪的材料

| 材料 | 位置 | 用途 |
|---|---|---|
| 商店上传包 | `dist/fanyi-lite-v0.8.9.zip` | 开发者控制台上传（manifest 已在 zip 根目录） |
| 截图 ×3（1280×800） | `dist/store-follow.png`、`dist/store-replace.png`、`dist/store-invert.png` | 商店详情页截图 |
| 商店文案 | 本文件第 4 节 | 极简保守版 |
| 权限理由与隐私声明 | 本文件第 5 节 | 逐框替换 |
| 隐私政策（已上线） | https://gist.github.com/adhumankind/9a402d04903bb0b38d9d17a25c703111 | 直接填此 URL |

---

## ⚠️ 两次被拒教训（务必遵守）

1. 第一次：简短说明用分号罗列功能词（术语库/双引擎/三模式…），被判"描述中超过 5 个实体"。
2. 第二次：某个字段里出现英文行业清单（technology, academia, medical, legal, finance, e-commerce, gaming, and industry），同样被判关键字垃圾内容。

**规则：所有对外字段（简介、详细描述、单一用途、各理由框）一律使用本指南给出的原文，不要自行添加任何枚举、清单、行业名称、标签或宣传语。写多错多。**

---

## 1. 提交修改的步骤

1. 打开商品管理页（需代理 + 原 Google 账号）：
   `https://chrome.google.com/webstore/devconsole/oeljnbolabnjhgikfgfalijlphkkaagh`
2. 左侧「**版本**」→ 上传 `dist/fanyi-lite-v0.8.9.zip`（新简介随包生效）。
3. 左侧「**商店发布**」→ 详细描述整段替换为第 4 节文案 → 保存。
4. 左侧「**访问权限**」→ 逐框核对第 5 节文案：**把所有含有行业清单或其他罗列内容的理由框整段替换**（上次被标记的英文清单就藏在其中一框里）。
5. 右上角「**提交审核**」。

## 2. 商店文案（极简保守版，整段复制）

- **简短说明**（随包自动生效）：一键将整个网页翻译成中文，支持双语对照阅读。作者：阿帝
- **类别**：工具（Tools）　**语言**：中文（简体）
- **详细描述**（整段替换为以下内容）：

```text
在任意网页按 Alt+1，页面文字就会翻译成中文；再按一次恢复原文。
译文可以跟在原文旁对照阅读。偏好设置保存在本地，不收集其他数据。
```

- **截图**：三张 store-*.png。
- 除以上内容外，不要填写任何其他宣传语、标签或枚举。

## 3. 隐私与权限声明（逐框替换）

| 字段 | 填写内容 |
|---|---|
| 单一用途 | `Translate web page text into the user's chosen language.` |
| storage 理由 | `Store the user's preferences locally.` |
| 主机权限理由 | `The extension translates the web page the user is viewing, so it needs to read that page's text.` |
| 数据使用 | 「网站内容」= 是，其余全部 = 否；出售数据/无关用途 = 否 |
| 网站内容理由 | `When the user activates translation, the text of the page is sent to the translation service to produce the translation.` |
| 远程代码 | 不，我并未使用远程代码 |
| 隐私政策 URL | `https://gist.github.com/adhumankind/9a402d04903bb0b38d9d17a25c703111` |

填完逐框检查一遍：任何理由框里都不应再出现行业清单、顿号/逗号罗列或英文枚举。

## 4. 提交与预期

- 分布范围：公开（Public）。
- 提交后全站权限会再次进入人工深审（1～7 天，慢则数周），属正常流程。
- 若再被拒，把邮件原文发来；也可在「版本 > 状态」页点「申诉」。

## 5. 隐私政策（已上线，无需改动）

https://gist.github.com/adhumankind/9a402d04903bb0b38d9d17a25c703111 （GitHub 账号 adhumankind 名下，可直接编辑）

## 6. 备选渠道：Edge 加载项（国内直连、免注册费）

同一份 zip 原样上传：`https://partner.microsoft.com/dashboard/microsoftedge`
