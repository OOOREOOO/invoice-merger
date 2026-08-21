# 发票整合 · Invoice Merger

将文件夹中的 PDF（发票、行程单、火车票等）合并为 A4 打印册：全部票据自动两联拼版、超长票据自动旋转 90° 适配 A4、火车票一页双份加印，并自动识别金额、类别与网约车行程。

## 快速开始

直接在浏览器打开 `index.html`（file:// 即可），拖入文件夹或 PDF 文件：

- **选择文件夹 / 选择 PDF**：按钮或拖放均可
- **识别**：自动提取票面文字、内容包围盒、二维码（发票校验 + 金额），分类为火车票 / 机票 / 网约车 / 住宿 / 餐饮 / 通用发票等
- **合并**：点击「生成合并 PDF」→ A4 打印册；可下载合并 PDF 或 ZIP

## 文件结构

| 文件 | 说明 |
|---|---|
| `index.html` | 单页应用（样式已合并为单个 style 块，无外网依赖） |
| `merge-core.js` | 合并布局核心（UMD：浏览器 window / Node globalThis 均可调用） |
| `pdf.min.js` / `pdf-lib.min.js` / `jsqr.min.js` / `jszip.min.js` | 本地依赖（pdf.js 解析、pdf-lib 合并、jsQR 二维码、JSZip） |
| `cmaps/` | CJK 字体映射（中文发票文字提取必需） |
| `test-merge-core.js` | merge-core 布局不变量测试（Node） |

## merge-core API

```js
// Node（需 pdf-lib npm 包）
const { PDFDocument } = require('pdf-lib');
require('./merge-core.js');

// 浏览器（pdf-lib.min.js 已加载）
// globalThis.mergeInvoices 可直接调用

const out = await globalThis.mergeInvoices(PDFDocument, files, opts);
// out: Uint8Array（合并后 PDF）；无文件时返回 null

// files: [{ name, bytes: Uint8Array, train?: bool, content?: [{ hCm, wCm, empty?, bbox? }] }]
// opts:  { thresholdCm?: 14, marginMm?: 8, isTrain?: fn, trainDouble?: true }
```

布局规则：

- 每页两张（2-up）上下拼版，按**实际内容包围盒**裁剪绘制（扫描进 A4 的小票也能正确识别为小票）
- 内容高 > 14cm 的大发票独占一页（缩放适配）
- 火车票**一页双份**加印（`trainDouble: false` 可关闭）
- 行程单预旋转 90° 后拼版

## 测试

```bash
# 需 Node 18+ 与 pdf-lib
NODE_PATH=<node_modules 路径> node test-merge-core.js
```

覆盖：2-up 拼版页数、大票独占、火车票加印（默认开 / 关）、混合输入页数、文件名兜底识别、A4 输出与可重载不变量。

## v115 变更

- **性能**：像素扫描步长 1px→4px（提速约 16 倍）；analyzePdf 单次解析 pipeline（文字 + 包围盒 + 二维码一次产出，减少一次 getDocument）；3 路并发导入
- **CSS 工程**：62 个 style 块合并为 1 个（保留级联语义）；移除全部深色模式分支（页面恒为浅色主题）；精确重复规则去重，体积 -7.5%
- **无障碍**：toast aria-live、checkbox 键盘可操作（空格/回车）、预览弹窗窄屏自适应
- **渲染**：长列表 content-visibility 优化
- **清理**：移除 Google Fonts、pdf.worker 引用、死加载条脚本、重复滚动置顶脚本等死代码
- 版本号 v114 → v115（资源 URL `?v=115`）
