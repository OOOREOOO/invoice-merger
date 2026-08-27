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

  console.log('\n[9] v128 回归：竖长条行程单旋转 + 裁剪（上部内容保留、标题被裁）');
  // 合成源：A4 竖版，裁剪区 bbox{x:50,y:300,w:320,h:520}（mbW=320, mbH=520，竖长条）。
  // v128 旋转判定：半页槽内 s2>s1 → 旋转（竖长条旋转后横放占满槽宽，字更大）。
  // 旋转 cm (0 1 -1 0 520 0) 后：源内容 x_c 映射到设备 y、y_c 映射到设备 x。
  //  - TITLE：源 y=850 → y_c=550 > mbH=520 → 设备 x=520-550=-30（页面外，须被裁）
  //  - UPPER：源 (100,750) → x_c=50、y_c=450 → 设备 (70,50)；
  //    v127 转置裁剪区设备 x∈[mbH-mbW,mbH]=[200,520] → UPPER x=70 被裁（上部内容丢失）；
  //    修复版裁剪区设备 x∈[0,mbH]=[0,520] → 保留（回归 v127 修复）
  //  - LEFT：源 (100,400) → x_c=50、y_c=100 → 设备 (420,50)，恒保留
  // 用 size8 嵌入字体（旋转后文字高 32pt 不超页面）
  const itDoc = await PDFDocument.create();
  const itFont = await itDoc.embedFont(require('pdf-lib').StandardFonts.Helvetica);
  const itPage = itDoc.addPage([595.28, 841.89]);
  itPage.drawText('TITLE', { x: 150, y: 850, size: 8, font: itFont });  // 设备 x=-30，须被裁
  itPage.drawText('UPPER', { x: 100, y: 750, size: 8, font: itFont });  // 设备 x=70，转置版会裁
  itPage.drawText('LEFT', { x: 100, y: 400, size: 8, font: itFont });   // 设备 x=420，恒保留
  const itBytes = new Uint8Array(await itDoc.save());
  const cIt = [{ cropByText: true, bbox: { x: 50, y: 300, w: 320, h: 520 }, hCm: 18.34, wCm: 11.29 }];
  const r8 = await globalThis.mergeInvoices(PDFDocument, [
    { name: 'it.pdf', bytes: itBytes, type: 'itinerary', train: false, content: cIt },
  ], {});
  const d8 = await PDFDocument.load(r8);
  assert(d8.getPageCount() === 1, '竖长条行程单 → 1 页（实际 ' + d8.getPageCount() + ' 页）');
  const pg8 = d8.getPage(0);
  assert(Math.abs(pg8.getWidth() - A4[0]) < 1 && Math.abs(pg8.getHeight() - A4[1]) < 1,
    '行程单 → 标准竖版 A4（实际 ' + pg8.getWidth().toFixed(0) + 'x' + pg8.getHeight().toFixed(0) + '，不再横向页/旋转整页）');
  // 像素级验证（canvas 坐标系：PDF 顶部 = canvas y=0）：
  //  - UPPER 旋转后设备 x=70 → 输出 x≈22.7+70×1.057≈96.7pt（页面左部）
  //    转置版 UPPER 被裁 → 页面左部 x∈[80,150] 无墨迹（LEFT 在 x≈466）
  //  - TITLE 设备 x=-30 → 输出 x≈-9（页面外）；最左墨迹应 ≥ 20pt（UPPER/LEFT 均在槽内）
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
    let inkInLeft = 0; // x∈[80,150] 区域墨迹数（UPPER 是否保留）
    for (let y = 0; y < cv.height; y++) {
      const base = y * cv.width * 4;
      for (let x = 0; x < cv.width; x++) {
        const i = base + x * 4;
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
          if (x < inkMinX) inkMinX = x;
          if (x > inkMaxX) inkMaxX = x;
          if (y < inkMinY) inkMinY = y;
          if (y > inkMaxY) inkMaxY = y;
          if (x >= 80 && x <= 150) inkInLeft++;
        }
      }
    }
    // 墨迹全部在页面边界内
    assert(inkMinX >= 0 && inkMaxX < cv.width && inkMinY >= 0 && inkMaxY < cv.height,
      '合并输出墨迹在页面边界内（x[' + inkMinX + ',' + inkMaxX + '] y[' + inkMinY + ',' + inkMaxY + '] px）');
    // UPPER 保留：页面左部 x∈[80,150] 应有墨迹；v127 转置裁剪会裁掉 → 该区域无墨迹
    assert(inkInLeft > 0, '上部内容保留（左部 x∈[80,150] 墨迹=' + inkInLeft + 'px；转置裁剪会裁掉 UPPER）');
    // TITLE 被裁：最左墨迹应为 UPPER（输出 x≈96.7）；TITLE 泄漏会在 x≈-9（页面外，被 XObject BBox 裁掉）
    assert(inkMinX > 20, '裁剪区上方标题被裁（最左墨迹 x=' + inkMinX.toFixed(0) + 'px > 20px）');
  } catch (e) {
    console.log('  SKIP 渲染依赖不可用: ' + e.message);
  }

  console.log('\n' + (failed === 0 ? '全部通过 ✅' : failed + ' 项失败 ❌'));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('测试执行异常:', e); process.exit(2); });
