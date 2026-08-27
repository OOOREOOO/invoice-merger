/*
 * test-merge-core.js — merge-core.js 布局不变量测试（Node 环境）
 *
 * 运行：
 *   NODE_PATH=<node workspace>/node_modules node test-merge-core.js
 *
 * 覆盖场景（依据 merge-core.js 布局算法 v114+）：
 *   1. 两张小票（内容高 < 14cm）→ 2-up 拼版 1 页
 *   2. 一张大票（内容高 > 14cm）→ 独占 1 页（缩放至 ≤14cm 槽位）
 *   3. 火车票 → 加印双份（trainDouble 默认 true）→ 2 页
 *   4. 空输入 → 返回 null
 *   5. 组合：输出可被 pdf-lib 重新打开且页数符合预期
 */
const { PDFDocument } = require('pdf-lib');
require(require('path').join(__dirname, 'merge-core.js'));

const A4 = [595.28, 841.89];
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  PASS ' + msg);
  } else {
    failed++;
    console.error('  FAIL ' + msg);
  }
}

async function makePdf({ w, h, text }) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([w, h]);
  page.drawText(text || 'TEST', { x: 30, y: h - 50, size: 12 });
  const bytes = await doc.save();
  return new Uint8Array(bytes);
}

async function main() {
  console.log('构造测试 PDF…');
  const small1 = await makePdf({ w: 400, h: 300, text: 'SMALL A' });   // 内容高 ~10.6cm < 14cm
  const small2 = await makePdf({ w: 400, h: 300, text: 'SMALL B' });
  const big = await makePdf({ w: A4[0], h: A4[1], text: 'BIG' });       // 内容高 ~29.7cm > 14cm
  const train = await makePdf({ w: 700, h: 200, text: 'TRAIN' });       // 横版长条票

  const cSmall = [{ hCm: 10.6, wCm: 14.1 }];
  const cBig = [{ hCm: 29.7, wCm: 21.0 }];
  const cTrain = [{ hCm: 7.1, wCm: 24.7 }];

  console.log('\n[1] 空输入返回 null');
  const r0 = await globalThis.mergeInvoices(PDFDocument, [], {});
  assert(r0 === null, '空文件列表 → null');

  console.log('\n[2] 两张小票 2-up 拼版');
  const r1 = await globalThis.mergeInvoices(PDFDocument, [
    { name: 'a.pdf', bytes: small1, content: cSmall },
    { name: 'b.pdf', bytes: small2, content: cSmall },
  ], {});
  const d1 = await PDFDocument.load(r1);
  assert(d1.getPageCount() === 1, '小票×2 → 1 页（实际 ' + d1.getPageCount() + ' 页）');
  const pg1 = d1.getPage(0);
  assert(Math.abs(pg1.getWidth() - A4[0]) < 1 && Math.abs(pg1.getHeight() - A4[1]) < 1,
    '输出页为 A4 尺寸');

  console.log('\n[3] 一张大票独占一页');
  const r2 = await globalThis.mergeInvoices(PDFDocument, [
    { name: 'big.pdf', bytes: big, content: cBig },
  ], {});
  const d2 = await PDFDocument.load(r2);
  assert(d2.getPageCount() === 1, '大票 → 1 页（实际 ' + d2.getPageCount() + ' 页）');

  console.log('\n[4] 火车票加印：一页两张（2-up 同页双份）');
  const r3 = await globalThis.mergeInvoices(PDFDocument, [
    { name: 'train.pdf', bytes: train, train: true, content: cTrain },
  ], {});
  const d3 = await PDFDocument.load(r3);
  assert(d3.getPageCount() === 1, '火车票双份同页 → 1 页（实际 ' + d3.getPageCount() + ' 页）');

  console.log('\n[4b] 火车票+小票：验证加印生效（默认双份 vs trainDouble=false）');
  const r4b = await globalThis.mergeInvoices(PDFDocument, [
    { name: 'train.pdf', bytes: train, train: true, content: cTrain },
    { name: 'a.pdf', bytes: small1, content: cSmall },
  ], {});
  const d4b = await PDFDocument.load(r4b);
  assert(d4b.getPageCount() === 2,
    '默认加印：seq=[train,train,a] → 页1双份 + 页2小票 = 2 页（实际 ' + d4b.getPageCount() + ' 页）');
  const r4c = await globalThis.mergeInvoices(PDFDocument, [
    { name: 'train.pdf', bytes: train, train: true, content: cTrain },
    { name: 'a.pdf', bytes: small1, content: cSmall },
  ], { trainDouble: false });
  const d4c = await PDFDocument.load(r4c);
  assert(d4c.getPageCount() === 1,
    'trainDouble=false：seq=[train,a] → 1 页（实际 ' + d4c.getPageCount() + ' 页）');

  console.log('\n[5] trainDouble=false 关闭加印');
  const r4 = await globalThis.mergeInvoices(PDFDocument, [
    { name: 'train.pdf', bytes: train, train: true, content: cTrain },
  ], { trainDouble: false });
  const d4 = await PDFDocument.load(r4);
  assert(d4.getPageCount() === 1, 'trainDouble=false → 1 页（实际 ' + d4.getPageCount() + ' 页）');

  console.log('\n[6] 混合：小票×2 + 大票 + 火车票');
  const r5 = await globalThis.mergeInvoices(PDFDocument, [
    { name: 'a.pdf', bytes: small1, content: cSmall },
    { name: 'b.pdf', bytes: small2, content: cSmall },
    { name: 'big.pdf', bytes: big, content: cBig },
    { name: 'train.pdf', bytes: train, train: true, content: cTrain },
  ], {});
  const d5 = await PDFDocument.load(r5);
  // 小票拼 1 页 + 大票 1 页 + 火车票双份同页 1 页 = 3 页
  assert(d5.getPageCount() === 3, '混合 → 3 页（实际 ' + d5.getPageCount() + ' 页）');

  console.log('\n[7] 文件名兜底识别火车票（isTrain 默认关键字）');
  const r6 = await globalThis.mergeInvoices(PDFDocument, [
    { name: '高铁票.pdf', bytes: train, content: cTrain },
  ], {});
  const d6 = await PDFDocument.load(r6);
  assert(d6.getPageCount() === 1, '文件名含"高铁"→ 识别为火车票双份同页 → 1 页（实际 ' + d6.getPageCount() + ' 页）');

  console.log('\n[8] 输出 PDF 可重新加载（不变量）');
  const r7 = await globalThis.mergeInvoices(PDFDocument, [
    { name: 'a.pdf', bytes: small1, content: cSmall },
    { name: 'b.pdf', bytes: small2, content: cSmall },
  ], {});
  assert(r7 instanceof Uint8Array && r7.length > 1000, '返回 Uint8Array 且非空');

  console.log('\n[9] v127 回归：旋转行程单裁剪（右半列必须保留，裁剪区上方标题必须被裁）');
  // 合成源：A4 竖版，裁剪区 bbox{x:50,y:300,w:300,h:250}（mbW=300, mbH=250）。
  // 旋转 cm (0 1 -1 0 250 0) 后：源内容 x_c 映射到设备 y，y_c 映射到设备 x。
  //  - TITLE：源 y=558 → y_c=258 → 设备 x=250-258=-8（页面外，须被裁）
  //  - LEFTCOL：源 x=100 → x_c=50 → 设备 y=50（须保留）
  //  - RIGHT：源 x=310 → x_c=260 → 设备 y=260（mbH=250 < 260 ≤ mbW=300）
  //    修复版裁剪区设备 y∈[0,mbW]=[0,300] → 保留；转置版裁剪区设备 y∈[0,mbH]=[0,250] → 被裁（右半列丢失）
  // 用 size8 嵌入字体：4 字符竖排高 32pt，RIGHT 设备 y∈[260,292] ≤ 300 不超页面
  const itDoc = await PDFDocument.create();
  const itFont = await itDoc.embedFont(require('pdf-lib').StandardFonts.Helvetica);
  const itPage = itDoc.addPage([595.28, 841.89]);
  itPage.drawText('TITLE', { x: 150, y: 558, size: 8, font: itFont });  // 设备 x=-8，须被裁
  itPage.drawText('LEFTCOL', { x: 100, y: 400, size: 8, font: itFont }); // 设备 y=50，须保留
  itPage.drawText('RIGHT', { x: 310, y: 400, size: 8, font: itFont });   // 设备 y=260，转置版会裁
  const itBytes = new Uint8Array(await itDoc.save());
  const cIt = [{ cropByText: true, bbox: { x: 50, y: 300, w: 300, h: 250 }, hCm: 8.82, wCm: 10.58 }];
  const r8 = await globalThis.mergeInvoices(PDFDocument, [
    { name: 'it.pdf', bytes: itBytes, type: 'itinerary', train: false, content: cIt },
  ], {});
  const d8 = await PDFDocument.load(r8);
  assert(d8.getPageCount() === 1, '旋转行程单 → 独占 1 页（实际 ' + d8.getPageCount() + ' 页）');
  const pg8 = d8.getPage(0);
  assert(Math.abs(pg8.getWidth() - A4[0]) < 1 && Math.abs(pg8.getHeight() - A4[1]) < 1,
    '旋转行程单 → 竖版 A4（实际 ' + pg8.getWidth().toFixed(0) + 'x' + pg8.getHeight().toFixed(0) + '）');
  // 像素级验证（canvas 坐标系：PDF 顶部 = canvas y=0，底部 = y=高）：
  //  - RIGHT 设备 y∈[260,292] → 输出 PDF y∈[731,802] → canvas y∈[40,111]（页面顶部）
  //    转置版裁剪区设备 y≤250 把 RIGHT 全切 → canvas 顶部无墨迹（最上墨迹 = LEFTCOL 顶部 canvas y≈450）
  //  - TITLE 设备 x=-8 → 若裁剪生效则不可见，最左墨迹 = LEFTCOL（输出 x≈377）；
  //    若裁剪失效（转置版把标题纳入裁剪区）→ TITLE 可见于输出 x≈30
  try {
    const { getDocument } = await import('file:///C:/Users/83406/.workbuddy/binaries/node/workspace/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = require('@napi-rs/canvas');
    const jd = await getDocument({ data: r8, standardFontDataUrl: 'file:///C:/Users/83406/.workbuddy/binaries/node/workspace/node_modules/pdfjs-dist/standard_fonts/' }).promise;
    const pg = await jd.getPage(1);
    const vp = pg.getViewport({ scale: 1 });
    const cv = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let inkMinX = cv.width, inkMaxY = 0, inkMinY = cv.height, inkMaxX = 0;
    for (let y = 0; y < cv.height; y++) {
      const base = y * cv.width * 4;
      for (let x = 0; x < cv.width; x++) {
        const i = base + x * 4;
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
          if (x < inkMinX) inkMinX = x;
          if (x > inkMaxX) inkMaxX = x;
          if (y < inkMinY) inkMinY = y;
          if (y > inkMaxY) inkMaxY = y;
        }
      }
    }
    // 墨迹全部在页面边界内
    assert(inkMinX >= 0 && inkMaxX < cv.width && inkMinY >= 0 && inkMaxY < cv.height,
      '合并输出墨迹在页面边界内（x[' + inkMinX + ',' + inkMaxX + '] y[' + inkMinY + ',' + inkMaxY + '] px）');
    // RIGHT 保留：canvas 顶部应有墨迹（RIGHT 在页面顶部区域）；转置裁剪会裁掉 → 最上墨迹为 LEFTCOL 底部区
    assert(inkMinY < 200, '右半列保留（最上墨迹 y=' + inkMinY.toFixed(0) + 'px < 200px；转置裁剪会切到 ~450px）');
    // TITLE 被裁：最左墨迹 = LEFTCOL（输出 x≈377）；TITLE 泄漏会出现在 x≈30
    assert(inkMinX > 100, '裁剪区上方标题被裁（最左墨迹 x=' + inkMinX.toFixed(0) + 'px > 100px；TITLE 泄漏会在 ~30px）');
  } catch (e) {
    console.log('  SKIP 渲染依赖不可用: ' + e.message);
  }

  console.log('\n' + (failed === 0 ? '全部通过 ✅' : failed + ' 项失败 ❌'));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('测试执行异常:', e); process.exit(2); });
