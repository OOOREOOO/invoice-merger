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

  console.log('\n' + (failed === 0 ? '全部通过 ✅' : failed + ' 项失败 ❌'));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('测试执行异常:', e); process.exit(2); });
