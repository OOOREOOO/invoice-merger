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

## v116 变更

- **合并后隐藏「生成合并 PDF」**：合并成功一次后按钮隐藏，直接使用「下载合并 PDF / 下载分类文件夹」；全部取消勾选或清空后自动恢复
- **操作按钮左右排布**：合并后剩余两个下载按钮恒为水平排列（桌面 flex-row / 窄屏 1fr 1fr 网格）
- 版本号 v115 → v116（资源 URL `?v=116`）

## v117 变更

- **时间轴末节点蓝点**：最后一天的日期节点补上小蓝点（原样式把最后一组的轴线+蓝点整体隐藏，现只隐藏向下延伸的竖线、保留蓝点）
- **悬浮栏可读性**：fabbar 底色 `rgba(255,255,255,.92)` → `.97` 加实 + 边框加深；ghost 按钮从「透明无边框」改为白底 + 1.5px 清晰边框 + 轻投影；disabled 状态统一置灰
- 版本号 v116 → v117（资源 URL `?v=117`）

## v118 变更

- **修复滴滴发票被误判为火车票**：根因是火车票关键词含 `中铁`（中国中铁为建筑企业简称，常出现在网约车行程终点，如「中国中铁二局集团有限公司」），且组合兜底 `中铁` + `站` 命中「江津北站」。已从 `DEFAULT_TRAIN_KWS`、`railSignals`、`isRail` 三处移除 `中铁`
- **验证**：`滴滴出行行程报销单D.pdf` / `滴滴电子发票D.pdf` 分类由 train → ridehail；真实高铁/普速火车票、地铁、航空行程单等 8 用例回归全部通过
- 版本号 v117 → v118（资源 URL `?v=118`）

## v119 变更

- **修复滴滴行程单时间线解析错乱**（重庆+成都局方 7-01 时间线 6 条记录）：
  - **行程丢失/粘连**：`滴滴特快` 车型在 PDF 中被拆成 `滴滴特 快`（token 换行），车型正则不匹配空格导致末条行程锚定失败、并入上一条 → `滴滴特快` 改 `滴滴特\s*快`；19:00 条金额由错误的 ¥13.90 修正为 ¥9.30，07-02 06:49 机场条独立成条
  - **起终点切分**：单 `|` 且 `|` 前无空格（起点列含 `|`、终点列不含，如 `鼎山街道|港龙购物中心 顺丰速运(江津区德感店)`）改为在 `|` 后最近空格切分，修复起点截断/终点带前导 `|` 粘连
  - **垃圾前缀**：剥离滴滴起点 `线|` 前缀（`线|圣泉寺地铁站1B口` → `圣泉寺地铁站1B口`）
  - **城市识别**：CITY_RE 未命中（如嘉兴市）时从地址开头剥离 `XX市` 前缀
  - **无 `|` 切分**：优先按 `) ` 切分（`绿梦宾馆(重庆江北国际机场店) 重庆...`），终点含 `)` 才回退中点切分
- 版本号 v118 → v119（资源 URL `?v=119`）

## v120 变更

- **行程单打印不旋转 + 红框裁切**（样本：上海/享道出行高德行程单、广州/滴滴行程单B）：
  - **不旋转**：merge-core 旋转条件加入 `f.type !== 'itinerary'` 豁免——行程单按原始方向正常打印（红框裁切后高度收缩，无需横放适配）；原逻辑对内容高 >14cm 的行程单会旋转 90°
  - **红框裁切（灵活模式）**：analyzePdf 对行程单先完整像素扫描出内容包围盒（内容高度已确认），再用文本锚点修正边界，修正前校验确有空白的才裁，避免内容被裁切：
    - 上边界 = 标题行（含 行程单/ITINERARY/TRIP TABLE，取最顶部者）文字顶部 + 留白，仅当标题上方确有广告/内容（>0.3cm）才上移，裁掉高德 Logo/企业版横幅/二维码
    - 下边界 = 排除「页码」后的最后一个文本行底部 + 0.15cm（用户确认方案），仅当下方确有空白（>0.1cm）才收缩，紧贴文本行的表格线由 0.15cm 余量兜住，裁掉底部大段空白
  - **验证**：两样本红框高度 21.6cm→5.62cm / 19.8cm→6.22cm；合并页 595×842 竖版未旋转；标题/信息/数据行文字完整
- 版本号 v119 → v120（资源 URL `?v=120`）

## v121 变更

- **票据分类统计改为「X 张发票，X 张非发票」**：原「N 个 PDF」；发票=可计入金额的类别（火车票/机票/网约车/公共交通/住宿/餐饮/通用发票），非发票=行程单（报销凭证）与其他
- **文件列表隐藏 `.pdf` 后缀**：卡片文件名与悬浮预览 tip 均隐藏 `.pdf`（正则 `/\.pdf$/i` 兼容大写），悬浮 title 保留全名
- 版本号 v120 → v121（资源 URL `?v=121`）

## v122 变更

- **行程单红框上边界重定义**（样本：`滴滴出行行程报销单A (1).pdf`）：
  - 滴滴版行程单含 `姓名/工号/部门` 空白填写栏（标题+姓名栏为每份重复的无用信息）→ 检测到 `姓名|工号|部门` 时，上边界下移到「申请日期/行程时间」摘要行，整段删除标题与姓名/工号/部门栏；高德等无姓名栏的行程单保持 v120 行为（上边界=标题）
  - 修复行程单被裁切：底部沿用「最后文本行 + 0.15cm」方案，灵活裁切确认内容高度后再切，避免内容被截
- **行程单仅在超出半页 A4 时才旋转 90°**：红框裁切后正文高度 ≤14cm 的行程单按原方向直接打印；正文 >14cm（半页 A4 槽位放不下）才 `preRotate90` 横放显示完全
- **修复 `preRotate90` 旋转视觉失效（关键根因）**：`PDFArray.asArray()` 返回浅拷贝（`slice`），此前对副本 `unshift/push` 包裹流导致旋转矩阵在 `save()` 后丢失——MediaBox 互换了但内容没旋转；现改用 PDFArray 自身的 `insert/push` 操作内部数组（applyCropBoxes 同修）
- **修复 `preRotate90` 只互换 CropBox 不互换 MediaBox**：applyCropBoxes 裁剪后 MediaBox 与 CropBox 为独立对象（序列化后共享丢失），`embedPdf` 只读 MediaBox 作为 Form XObject BBox → 旋转尺寸不生效；现同步设置两者
- **验证**：滴滴A 红框 4.73cm（2 笔行程不旋转）、高德 5.62cm（回归保留标题不旋转）、构造 18cm 超长行程单 → 旋转 90°（嵌入 XObject BBox 510×595 竖置 + 内容流含 `0 1 -1 0` 旋转矩阵 + 像素墨水 bbox 122×468px 竖向）；多文件 2-up 冒烟（A+B 拼版 + 发票单页）全部通过
- 版本号 v121 → v122（资源 URL `?v=122`）

## v123 变更

- **行程单改走横向 A4 页放大**（样本：`滴滴出行行程报销单B.pdf`）：
  - 行程单（非火车票、红框裁切后内容高 ≤14cm）布局改走横向 A4 页 `[841.89,595.28]`：内容按宽度满格放大（约 1.67 倍，显示约 6.3cm 高），解决竖版横排受槽位宽度限制只能显示 ~4.3cm 高导致「打印过小」的问题
  - 连续同类行程单每页最多 2 张上下堆叠；内容高 >14cm 的超长行程单维持竖版 + `preRotate90` 旋转（前置阶段已处理）
  - 竖版 2-up 不再与行程单配对（行程单已被横向页分支吸收）
- **修复 v122 引入的 Node 测试回归**：v122 起 `preRotate90`/`applyCropBoxes` 无条件调用 `getPDFLib()` 取 `PDFName`，而 Node 测试环境 `global.PDFLib` 未设置 → 大票旋转路径 null 崩溃（浏览器不受影响）；`getPDFLib` 增加 CommonJS `require('pdf-lib')` 兜底
- **验证**：四用例（单张 B 横向 1 页字高 12.0pt / A+B 横向同页上下 2 张字高 10.0pt / B+发票D 横向页+竖版页 / 超长 18cm 竖版旋转回归正常）全部通过；`test-merge-core.js` 8 组断言全部 PASS
- 版本号 v122 → v123（资源 URL `?v=123`）

## v124 变更

- **行程单红框水平收紧（只留行程主体）**：v120/v122 只裁上下（标题/姓名栏/底部空白），左右仍是整页像素范围；v124 新增按文本 x 范围收紧（外扩 0.2cm 兜表格线，比像素范围窄 >0.3cm 才生效）——裁掉左右白边，只留「摘要行+表格」主体
- **旋转判定改为「满宽放大后高度 >14cm 才旋转」**：不再按原始高度判，而是按「表格宽放大到横向 A4 满格后的高度」——滴滴B（16.53×3.74cm）满宽 1.7 倍后高 6.4cm → 不旋转；构造 8cm 宽行程单（放大后 28cm）→ 旋转
- **旋转行程单独占竖版页**：slotH 放宽到整页可用高（28.1cm），避免 14cm 槽位上限把旋转后的长边压小（18cm 超长样本从 0.78 倍 → 1.11 倍）
- **实测**（滴滴B 真实样本）：单张横向页满宽放大 1.7 倍、数据行字高 15.3pt（v123 12pt）；A+B 两张同页字高 15.3pt（v123 两张仅 10pt）；A4 纸 + 16.5cm 宽表格的物理放大极限约 1.7 倍，如需 2 倍+ 需 A3 纸（可用宽 40.4cm → 2.44 倍）
- 版本号 v123 → v124（资源 URL `?v=124`）

## v125 变更

- **火车票识别加网约车前置排除**：滴滴/T3/阳光等网约车发票的行程明细常含「高铁站/动车进站口」等地址描述（如「常德站-南进站口(高铁)」「长沙南站-西进站口(动车进站)」），命中 高铁/动车 关键词会被误判为火车票（归错分类 + 加印双份）——`detectTrainByText` 前置排除 滴滴/花小猪/曹操/T3/首汽/如祺/哈啰/阳光出行/出租车/旅客运输/taxi 等网约车特征词；真实铁路电子客票票面不含这些词，前置排除安全
- **CAR_ALT 车型词表扩展**：新增 `T3出行|T3打车|阳光出行|曹操出行|首汽约车|花小猪|如祺出行|哈啰出行|享道出行|高德打车|美团打车|神州专车|万顺叫车` 品牌词（含空格容忍）——修复 T3/阳光等第三方行程单「行程解析为 0」问题（车型列是品牌名，仅靠 快车/专车/优享 匹配不到）
- **城市剥离容忍空格**：`/^([\u4e00-\u9fa5]{2,4})\s*市/`——修复「郴州 市」被拆成两个文本项导致 city 为空、起点带「郴州 市」前缀
- **「标为火车票」手动按钮**：矢量转曲/扫描票（文字提取仅剩符号）无法用文字识别时，卡片上可手动标记为火车票（`trainOverride[f.name]` 生效）
- 版本号 v124 → v125（资源 URL `?v=125`）

## v126 变更

- **修复行程单被误判火车票（核心根因，用户实测 3pt 极小 + 双份）**：
  - 问题链：`classifyInvoice` 规则 3 网约车（滴滴/T3/阳光）先于规则 6 通用行程单 → 行程单返回 `ridehail`；旧版式兜底用 `type !== 'itinerary'` 排除不彻底，`ridehail` 也进入兜底 → 横版行程单红框宽高比 >2.5 且高 <10cm → 误判火车票 → 加印双份 + 豁免裁剪 + 不旋转 → 完整版式被压成 3pt 极小
  - 兜底条件收紧为 `type === 'other'`（仅未识别票据才版式兜底，杜绝 ridehail/行程单误入火车票通道）
  - **特殊归类 1 放宽**：网约车/出租车 → 行程单 的判定不再要求「二维码无金额」（滴滴行程单推广二维码可能解析出金额），改为「二维码非发票（`!qrInvoice`）+ 文字含 行程单/报销凭证/journey」即归行程单——保证行程单走横向 A4 满宽放大 + 行程明细解析，而非竖版小图
- **实测全链验证**（上海加混哪 22 个 PDF）：滴滴行程单A/B/C、T3、阳光 → `itinerary` ✅；滴滴电子发票A/B/C、T3/阳光发票 → `ridehail` ✅（不再误判火车票）；真火车票 4 张 → `train` ✅；合并输出行程单页横向 A4（842×595）数据行字高 15pt/14.9pt（用户版 3pt），滴滴C（9 笔超长）旋转独占竖版页 12.3pt；`test-merge-core.js` 8 组断言全部 PASS
- 版本号 v125 → v126（资源 URL `?v=126`）

## v127 变更

- **修复旋转行程单未缩放到合适宽度（旋转后右半列被裁 / 标题泄漏）**：
  - 问题链：`preRotate90` 的裁剪路径矩形坐标写反（转置）——旋转 cm `0 1 -1 0 (mbY+mbH) 0` 把用户点 (X,Y) 映射到设备 (mbY+mbH−Y, X)，旧路径 rect `(0,0)-(mbH,mbW)` 在设备空间覆盖 x∈[mbY, mbY+mbH−mbW+mbH]（实测 [−224,258]），把旋转后应在页面外的标题/姓名栏（设备 x<0）纳入可见区，同时把表格右半列（源内容 x_c>mbH → 设备 y>mbH）切掉 → 用户看到的「行程单只有左半（序号~起点），终点/里程/金额列丢失，旋转后未缩放到合适宽度」
  - 修复：裁剪矩形改为**旋转后页面 [0,0,mbH,mbW] 对应的用户空间区域** `rect (0,mbY)-(mbW,mbY+mbH)`——设备空间恰好覆盖旋转后页面，标题/页脚（设备 x<0 或 x>mbH）被排除、表格全列保留
  - 裁剪路径用 m/l/h 显式构建（re 在多层变换下 pdf.js 解析顺序错乱，路径被延迟构建导致 clip 引用错误路径）
- **实测全链验证**（重庆+成都局方 顶层 13 页 + 广州GF308 子文件夹 5 页，像素级墨迹检查）：旋转行程单（滴滴D 5 笔 17.00×9.10cm）独占竖版页，标题/姓名栏被裁、5 笔行程全列完整显示、墨迹全部在页面边界内；`test-merge-core.js` 新增 [9] v127 回归（合成行程单：右半列 RIGHT 在转置版裁剪区外必须保留、裁剪区上方 TITLE 必须被裁，渲染像素断言——转置版 FAIL 右半列被裁）
- 版本号 v126 → v127（资源 URL `?v=127`）

## v128 变更

- **行程单只占 1/2 A4 布局（用户新原则：最大程度保证行程可读性 + 行程单只占半页）**：
  - 用户反馈：行程单输出页非 A4（v123 横向 A4 页 842×595、v124 旋转独占整页），要求行程单在标准竖版 A4 上只占半页
  - **删除 v123 横向 A4 放大页（LANDSCAPE 常量）与 v124 旋转独占整页分支**——所有票据（含行程单）统一竖版 A4 2-up：每页 2 张上下堆叠、每张最多占半页槽位（slotH ≈ 13.6cm）
  - **旋转判定改为「半页槽位内两种方向字号择优」**：不旋转 s1=min(slotW/w,slotH/h)、旋转 s2=min(slotW/h,slotH/w)，s2>s1 才 preRotate90。因 slotW(549.9) > slotH(386.9)，**宽扁表（w≥h）恒不旋转**（字更大），仅源内容竖长（w<h）旋转后横放占满槽宽字更大 → 旋转
  - 实测效果（滴滴D 5 笔 17.00×9.10cm）：不旋转横向 1.14 倍放大（v126 旋转后仅 0.8 倍），5 笔 9 列全显示、占半页——比旋转整页字号更大且满足 1/2 A4
- **全链验证**（重庆+成都局方 11 页 + 广州GF308 4 页）：全部竖版 A4 595×842、无横向页、墨迹全部页面边界内；行程单两两配对各占半页；`test-merge-core.js` [9] 更新为 v128 竖长条旋转场景（bbox 320×520 → 旋转判定 s2>s1，验证旋转+裁剪：上部内容 UPPER 保留、标题 TITLE 被裁——转置版 FAIL 上部内容丢失，仍能回归 v127 修复）
- 版本号 v127 → v128（资源 URL `?v=128`）

## v129 变更

- **行程单半页槽位内默认居上排布**：`drawInSlot` 的 topAlign 恒为 true（此前仅单张时居上、两张时各自槽内垂直居中）——矮内容行程单（如 1 笔行程仅 5cm 高）不再在半页槽内上下留白居中，内容顶部对齐槽顶、下方自然留白，符合报销单打印惯例
- **全链验证**（重庆+成都局方 11 页）：全部竖版 A4、墨迹边界内；页6 行程单页墨迹顶部 y 由 v128 的 145pt 上移至 28pt（居中→居上位移 ~117pt）；`test-merge-core.js` 16 项 PASS
- 版本号 v128 → v129（资源 URL `?v=129`）

## v130 变更

- **行程单裁剪底部余量加大（表格底边框线完整显示）**：`redFrame` 的 bodyBottomCanvas 余量 0.15cm → 0.45cm——实测滴滴行程单表格底边框线在「最后文本行底部 + 0.15cm」下方 6.8pt（0.24cm），旧余量把表格底部横边框线裁掉（截图：第二行垂直分割线底部截断、无底边框）；+0.45cm 覆盖边框线并留 0.21cm 保险
- **全链验证**（重庆+成都局方 11 页）：全部竖版 A4、墨迹边界内；页6 成都2笔行程单第二行分割线到底、底部横边框线完整；`test-merge-core.js` 16 项 PASS
- 版本号 v129 → v130（资源 URL `?v=130`）

## v131 变更

- **行程单默认排序到最后再打印**：`generate()` 合并前对可用文件做稳定排序（`docType==='itinerary'` 排末位）——行程单（报销凭证）统一放在合并 PDF 末尾，其余类别保持勾选顺序；行程单常与发票配对 2-up，排后不影响配对
- **「下载分类文件夹」按钮合并后才显示**：dlZip 初始隐藏（`hidden`），仅 `mergedOnce && usable.length>0` 时显示；清空/全部取消勾选时恢复隐藏（与「生成合并 PDF」的 v116 显示逻辑一致）
- **取消勾选发票 → 金额栏扣减**：核心总金额（updateGenerateBtn）本就按 `f.include` 过滤；v131 补齐 render() 分区小计过滤（`sumList = list.filter(f => f.include && ...)`）——取消勾选后分区小计与右侧总金额同步扣减，视觉一致
- **验证**：行程单排序（稳定排序，非行程单保序）+ 金额扣减（勾选 380 / 取消后扣减）Node 断言通过；内联 JS 语法检查 3 块全过；`test-merge-core.js` 16 项 PASS
- 版本号 v130 → v131（资源 URL `?v=131`）

## v132 变更

- **首页一屏显示（布局垂直压缩）**：用户反馈首页高度超出单屏（右侧出现滚动条），要求「上传待归档」高度缩短一倍、整页一屏显示
  - `.wrap` 内边距：顶部 32px → 14px、底部 130px → 96px（桌面端 140px → 96px 覆盖同步）
  - `header.app`：标题 30px → 23px、副文案 13.5px → 12px、行高 1.6 → 1.45、margin-bottom 24px → 10px；品牌图标 42px → 30px、右上角按钮压缩
  - `.card` 内边距 22px → 14px；`.v3-panel-head` margin-bottom 18px → 8px、标题 19px → 16px、徽标 padding 收窄
  - `.drop`（拖拽区）内边距 38px → 14px（高度减半核心）、图标 46px → 30px、主文字 17px → 14px、说明 13px → 11.5px、按钮区 margin-top 16px → 8px
  - `.dz-hint` margin-top 14px → 6px、字号 12px → 11.5px；手机端 `.wrap` 底部 190px → 130px
  - **实测**：1366×768 / 1440×900 / 1920×1080 三种视口 puppeteer-core + Edge headless 断言 `scrollHeight === innerHeight`（hasVScroll=false，无垂直滚动条）；dropCard 高度 350px（原 ~500px+）、drop 拖拽区 242px（高度缩短一倍达成）；页面底部保留适量留白不顶底
- 版本号 v131 → v132（资源 URL `?v=132`）

## v133 变更

- **修复滴滴行程单新版式行程全部解析失败（0 笔 → 时间线空行）**：用户反馈 `滴滴出行行程报销单C.pdf`（上海加混哪目录）无法识别解析，时间线出现「08-26 空行」
  - **现象**：时间线显示 08-26（周三）空行程行——行程单文件被归类 itinerary、`extractDate` 抓到票面「申请日期：2026-08-26」作 `f.date`，但 `parseDiDiTrips` 返回 0 笔 → render() 退化为单行摘要（date 有、time/from/to/amount 全空）
  - **根因 A（致命，时间列拆项）**：滴滴新版式把上车时间拆成两个文本项「21:」+「52」（`07-13 21:` 与 `52 周一` 分属不同 item），flat 合并后变「07-13 21: 52」（冒号后带空格）→ 时间正则 `\d{1,2}:\d{2}` 要求冒号后紧跟数字 → 全部行程 `continue` 跳过 → 0 笔
  - **根因 B（第 9 笔丢失）**：车型「惊喜特价」被拆成「惊喜」+「特价」两个文本项，CAR_ALT 词表 `惊喜特\s*价` 要求「惊喜」与「特」连续 → 「9 惊喜 特价」锚定失败 → 第 9 笔行程段并入第 8 笔
  - **修复**（parseDiDiTrips）：
    - 时间正则改为 `(\d{1,2}):\s*(\d{2}(?::\d{2})?)` 容忍冒号后空格，timeStr 用 tm[2]+':'+tm[3] 重组（"21: 52"→"21:52"，兼容旧格式与含秒）
    - CAR_ALT `惊喜特\s*价` → `惊喜\s*特\s*价`（容忍「惊喜」与「特价」间换行空格）
  - **验证**：C.pdf 解析 0 → **9 笔**，金额合计 151.36 元与票面「共9笔行程，合计151.36元」吻合；A（1笔 17.60）/B（1笔 19.80）/T3（1笔 24.58）回归正常；`test-merge-core.js` 16 项 PASS；内联 JS 语法 3 块全过
  - **分析方法沉淀**：行程单解析失败先看 flat 文本里时间/车型是否被换行拆项（"21: 52"、"惊喜 特价"），再检查 ENTRY_RE 锚定数 vs 票面笔数
- 版本号 v132 → v133（资源 URL `?v=133`）

## v134 变更

- **新增「打印」按钮（网页打印票据清单）**：合并成功后操作栏出现「打印」按钮（下载合并 PDF / 下载分类文件夹 旁），点击触发 `window.print()`
  - **按钮样式**：与 dlMerged/dlZip 一致（ghost 圆角、黑色文字、打印机图标），初始隐藏
  - **显隐逻辑**：合并成功（mergedOnce）后显示可用；清空/全部取消勾选时隐藏重置（与 dlZip 同逻辑）
  - **@media print 打印视图**：只打印票据清单——「票据分类」列表（分区+金额）+「网约车时间线」（行程明细）；隐藏操作栏、上传拖拽区、合并预览、toast、天气等；卡片去玻璃效果、`break-inside: avoid` 防跨页截断、白底打印
  - **验证**：puppeteer + Edge headless——初始按钮 hidden+disabled、onclick 已绑定、emulateMediaType('print') 下 fabbar/dropCard/resultCard display:none 且 timelineCard/fileInfoCard display:block、body 无背景图；页面无 JS 错误
- 版本号 v133 → v134（资源 URL `?v=134`）

## v135 变更

- **打印按钮与下载按钮左右排布**：用户反馈打印按钮与上方按钮未正常左右排布，且总金额框留白过多
  - 移动端 `.fabbar .actions` 由 2 列 grid 改为 **3 列 grid**（`1fr 1fr 1fr`），「下载合并 PDF / 下载分类文件夹 / 打印」三按钮同一行左右排布
- **总金额框样式参考「加载百分比数字」 redesigned**：
  - 背景：`linear-gradient(135deg, #1b2836, #0e1822)`（深色胶囊）
  - 边框：`1.5px solid rgba(240,83,28,.85)`（橙红描边）
  - 圆角：`999px`；padding 收窄为 `5px 11px 5px 13px`
  - 宽度：`width: fit-content` + `display: inline-flex`，按金额内容自适应，消除金额右侧过多留白
  - 标签「总金额」：`rgba(255,255,255,.72)` 浅白；金额数字：`#FF6A38` 橙色高亮、字重 800
  - 移除了旧版的浅灰/浅橙底、大圆角、宽 padding 样式
- **打印内容改为合并后的 PDF**：
  - 打印按钮从 `window.print()`（网页打印）改为通过隐藏 iframe 加载 `lastBlobUrl`（合并 PDF blob URL），调用 `contentWindow.print()` 触发浏览器 PDF 打印对话框
  - 按钮 title 同步改为「打印合并后的 PDF 文件」
  - 移除 v134 专为网页打印引入的 `@media print` 规则
- **验证**：
  - puppeteer + Edge headless：移动端 actions 为三列 grid；导入发票后总金额框深色胶囊、宽度按内容自适应（¥800.00 → 151.6px）
  - 合并后打印按钮显示可用；点击打印按钮 iframe 数量 1→2，确认创建了隐藏 iframe 并加载合并 PDF
  - test-merge-core 16 项 PASS；内联 JS 语法 3 块全过
- 版本号 v134 → v135（资源 URL `?v=135`）

## v136 变更

- **总金额数字放大、框居中**：用户反馈总金额框数字偏小、右侧留白过多、未居中
  - `.fabbar .summary .total .amt`：`font-size` 20px → **28px**，`font-weight` 800 → **900**；标签 `.tl` 13px 配浅白
  - 总金额框自身改为 `display: flex; align-items: center; justify-content: center; gap: 8px;`（框内文字垂直/水平居中）
  - 框宽度仍 `fit-content` 自适应金额内容；padding 加宽为 `7px 18px 7px 20px`
  - 桌面端 `.fabbar .summary` 增加 `align-items: center; text-align: center;`，使深色胶囊在右侧汇总区内水平居中（实测 1440px 下中心点偏移 < 1px）
- **修复打印按钮无响应**：v135 使用 `left:-9999px` 的 off-screen iframe，在部分浏览器/无头环境下无法触发 `contentWindow.print()`
  - 改为**可见但透明**的 iframe（`opacity:0; pointer-events:none; z-index:-1; width:100%; height:100%`），避免浏览器对离屏 iframe 的优化/安全限制
  - onload 后延迟 400ms 调用 `contentWindow.focus()` + `contentWindow.print()`
  - 增加 try/catch；若 print 抛错，兜底 `window.open(lastBlobUrl, '_blank')` 在新标签页打开 PDF
  - 增加 3s 超时兜底：若 iframe 加载/打印完全无响应，自动 `window.open(lastBlobUrl, '_blank')`
  - iframe 清理延迟 1200ms，避免过早移除影响打印对话框
- **验证**
  - puppeteer + Edge headless（桌面 1440×900）：总金额数字 28px/900、框在 summary 内水平居中（中心点偏移 0.5px）
  - puppeteer + Edge headless（移动 412×915）：总金额框 flex + justify-center + align-center
  - 合并后点击打印按钮：iframe[title="print-frame"] 创建成功，`src` 为 blob URL
  - `test-merge-core.js` 16 项 PASS；内联 JS 语法 3 块全过
- 版本号 v135 → v136（资源 URL `?v=136`）

## v137 变更

- **修复 actions 按钮折行（一排排布）**：用户反馈 fabbar 内「打印」按钮掉到第二排；同时要求「总金额」缩 50%、金额缩 30%；并要求打印按钮点击**直接出现打印对话框，不要跳出新窗口**
  - 根因：通用 `.actions { ... flex-wrap: wrap }` 规则影响；641px+ 的 `.fabbar .actions { flex-direction: row }` 覆盖未含 nowrap，actions 宽度被 summary 320px 压缩成 138px，三个按钮被强制 wrap 成纵向
  - 修复：
    - 640px 内 grid 3列 → `display: flex; flex-wrap: nowrap; gap: 6px`，按钮 `flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis;`
    - 641px+ `.fabbar .actions` 增加 `flex: 1 1 auto; flex-wrap: nowrap; padding: 4px 6px;`，按钮 `flex: 0 1 auto; padding: 10px 12px`（按文字宽度显示不被截断）
    - `.fabbar .actions .btn.primary`（640px 内）由 grid-column 1/-1 → `flex: 1 1 0`
    - 641px+ `.fabbar .summary` 改 `flex: 0 1 auto; min-width: 0`，让 summary 不再挤压 actions
- **总金额/金额按比例缩小**：
  - `.fabbar .summary .total .tl` `font-size: 13px` → **7px**（缩 50%）
  - `.fabbar .summary .total .amt` `font-size: 28px` → **20px**（缩 30%）
  - total 容器 padding 5px 12px 5px 14px、gap 5px（紧凑配比）
- **打印按钮直接弹出对话框（不再跳出新窗口）**：v136 兜底用 `window.open(lastBlobUrl, '_blank')` 触发新标签页，用户反馈跳出窗口不符合预期
  - 移除 `window.open` 兜底；改为 iframe onload → `contentWindow.focus()+print()`，若 onload 未触发 1.8s 后重试一次（仍只 print 不 open）
  - 极端兜底：仅当 print 抛异常才 toast 提示「请在新标签页打开后 Ctrl+P 打印」，仍不主动开窗
- **验证**：
  - puppeteer+Edge headless 768px：三按钮同排（top 925）、等宽/按内容（111/119/68px），文字完整「下载合并 PDF/下载分类文件夹/打印」
  - puppeteer+Edge headless 412px 移动端：三按钮同排 top 788
  - 总金额 `tl=7px`、`amt=20px/font-weight:900`
  - monkey-patch `window.open` 计数：点击打印后 `iframeCreated=true`、`openCount=0`（直接打印，未跳窗）
  - test-merge-core 16 项 PASS；内联 JS 语法 3 块全过
- 版本号 v136 → v137（资源 URL `?v=137`）

## v138 变更

- **删除打印按钮**：用户决定放弃内置打印功能，改为提示用户在浏览器内置 PDF viewer 右上角点击打印图标（更稳定、避开 PDF.js print overlay）
  - HTML：删除 `<button id="btnPrint">` 打印按钮（fabbar 只剩「下载合并 PDF」「下载分类文件夹」两个按钮）
  - JS：删除 updateGenerateBtn 中 btnPrint 显隐块、合并成功后 btnPrint 显示、onclick 绑定块（含 v134-v137 全部打印逻辑）
- **金额阿拉伯数字扩大 50%**：`font-size` 20px → **30px**；`font-weight` 900 → **800**（衬线粗体过黑，无衬线 800 更平衡）
- **字体务实化**（用户先要求"更有美感"换衬线，再回退）：
  - 改用系统无衬线 `-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif`
  - 配 `font-variant-numeric: tabular-nums`（数字等宽对齐）+ `font-weight: 800` + `letter-spacing: .01em`
  - 财务发票风格，简洁清晰，无花哨衬线装饰
- **总金额胶囊 padding 适配 30px 大数字**：5px 12px 5px 14px → 7px 16px 7px 18px；gap 5 → 7
- **合并后 toast 两行提示**（白色背景黑色文字，duration 4200ms）：
  - **第一行**：「可在 PDF 组件窗口右上角点击图标网页打印」
  - 第二行：「合并完成：共 N 页 A4」
  - 利用 `.toast` 已有的 `white-space: pre-line`（`\n` 换行）
- **验证**：
  - puppeteer+Edge headless（1440×900）：`btnPrint` 已不存在；actions 仅 2 按钮且同排（top 一致）；金额 `font-size=30px`、衬线去除、字体=无衬线系统栈
  - puppeteer+Edge headless（412×915 移动端）：同 2 按钮布局、toast 两行提示正常
  - 合并后 toast textContent 含「可在 PDF 组件窗口右上角点击图标网页打印」「合并完成：共 N 页 A4」
  - test-merge-core 16 项 PASS；内联 JS 语法 3 块全过
- 版本号 v137 → v138（资源 URL `?v=138`）

## v139 变更

- **删除「总金额」三字**：用户反馈胶囊文字仅保留金额数字"¥800.00"
  - HTML 模板：`<span class="tl">总金额</span>` 删除，胶囊内只剩 `<span class="amt">¥xxx.xx</span>`
  - `.tl` CSS 规则保留（未引用不影响）
- **阿拉伯数字缩小 30%**：`font-size` 30px → **21px**（保留 800 字重 + 无衬线务实字体 + tabular-nums）
- **胶囊紧凑化**：删除 .tl 后 `gap` 7px → 0；`padding` 7px 16px 7px 18px → 7px 18px（左右对称且留出余额数字呼吸空间）
- **验证**：puppeteer+Edge headless 1440×900——`totalText="¥800.00"`、`hasTL=false`、`amtFontSize=21px`、无衬线系统字体栈生效；test-merge-core 16 项 PASS；内联 JS 3 块全过
- 版本号 v138 → v139（资源 URL `?v=139`）
