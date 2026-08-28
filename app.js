    const PT_PER_CM = 28.3464567;
    let PDFDocument = null;

    // ============ 方案一启动场景（含四段上传动画）============
    // 01 拖拽悬停 → 02 上传中（真实读取进度驱动进度环+文件飞入）→ 03 识别处理（脉冲扩散）
    // → 04 完成（弹性打勾+真实汇总）→ 渐变自动进入工作台（不需要点击）
    const Launch = (() => {
      const scene = document.getElementById('launchScene');
      const uploadEl = document.getElementById('lsUpload');
      const uploadingEl = document.getElementById('lsUploading');
      const processingEl = document.getElementById('lsProcessing');
      const doneEl = document.getElementById('lsDone');
      const ringBar = document.getElementById('lsRingBar');
      const procRingBar = document.getElementById('lsProcRingBar');
      const pctEl = document.getElementById('lsPct');
      const procPctEl = document.getElementById('lsProcPct');
      const filesEl = document.getElementById('lsFiles');
      const doneSummaryEl = document.getElementById('lsDoneSummary');
      const doneHintEl = document.getElementById('lsDoneHint');
      const CIRC = 2 * Math.PI * 50; // 314.16
      const fileRows = {};
      let shown = true; // 启动场景当前是否可见（首屏可见；进入工作台 hide() 后置 false）
      let procTotal = 0, procCurrent = 0;
      const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

      function show(which) {
        [uploadEl, uploadingEl, processingEl, doneEl].forEach(el => { if (el) el.classList.add('hidden'); });
        if (which) which.classList.remove('hidden');
      }
      function isVisible() { return shown; }

      function setRing(barEl, pctEl_, pct) {
        const p = Math.max(0, Math.min(100, Math.round(pct)));
        if (barEl) barEl.style.strokeDashoffset = (CIRC * (1 - p / 100)).toFixed(1);
        if (pctEl_) pctEl_.textContent = p + '%';
      }

      // 更新"当前识别中发票"单行展示：重新触发 lsRise 飞入动画
      function setCurrentFile(name) {
        const el = document.getElementById('lsProcCurrent');
        if (!el || !name) return;
        const nameEl = el.querySelector('.ls-current-name');
        el.classList.remove('ls-current-anim');
        void el.offsetHeight; // 强制 reflow，让重新加 class 时动画从头跑
        nameEl.textContent = name;
        el.classList.add('ls-current-anim');
      }

      function reset() {
        if (filesEl) filesEl.innerHTML = '';
        Object.keys(fileRows).forEach(k => delete fileRows[k]);
        setRing(ringBar, pctEl, 0);
        setRing(procRingBar, procPctEl, 0);
        // 重置单行"当前识别中发票"
        const cur = document.getElementById('lsProcCurrent');
        if (cur) {
          const n = cur.querySelector('.ls-current-name');
          if (n) n.textContent = '…';
          cur.classList.remove('ls-current-anim');
          void cur.offsetHeight;
          cur.classList.add('ls-current-anim');
        }
        procTotal = 0; procCurrent = 0;
      }

      // 02 上传中：旋转进度环 + 文件行 0.3s 错峰飞入 + 实时百分比（仅最新 3 条；单文件进度条已去除）
      function showUploading(fileNames) {
        shown = true;
        reset();
        show(uploadingEl);
        const allFiles = fileNames || [];
        procTotal = allFiles.length;
        procCurrent = 0;
        allFiles.slice(-3).forEach((nm, i) => {
          const row = document.createElement('div');
          row.className = 'ls-file';
          row.style.animationDelay = (i * 300) + 'ms'; // 0.3s 错峰飞入
          row.innerHTML = '<span class="ls-fname">' + esc(nm) + '</span><span class="ls-fdot"></span>';
          filesEl.appendChild(row);
          fileRows[nm] = { row, dot: row.querySelector('.ls-fdot') };
        });
      }
      function updateProgress(pct, name /*, mb 已忽略：百分比由 setRing 实时刷新 */) {
        setRing(ringBar, pctEl, pct);
        // 单文件进度条已去除：进度反馈统一由顶部进度环承担；fileRows[name] 仅保留用于 stage ③ 的 analyzing 标记
      }
      // 03 识别处理：旋转进度环 + 单行"当前识别中发票"+ 百分比按"已识别/总数"推进
      function showProcessing(name) {
        if (shown && !processingEl.classList.contains('hidden')) {
          procCurrent = Math.min(procCurrent + 1, Math.max(procTotal, 1));
          const p = procTotal > 0 ? Math.round((procCurrent / procTotal) * 100) : 0;
          setRing(procRingBar, procPctEl, p);
          setCurrentFile(name);
          return;
        }
        show(processingEl);
        procCurrent = 1;
        const p = procTotal > 0 ? Math.round((procCurrent / procTotal) * 100) : 0;
        setRing(procRingBar, procPctEl, p);
        if (name) setCurrentFile(name);
      }
      // 04 完成：弹性打勾 + 真实汇总
      function showComplete(allFiles) {
        show(doneEl);
        const usable = (allFiles || []).filter(f => f && f.include && !f.error);
        const amountCategories = new Set(['train', 'flight', 'ridehail', 'transit', 'hotel', 'meal', 'invoice']);
        const total = usable.filter(f => amountCategories.has(f.docType)).reduce((s, f) => s + (f.amount || 0), 0);
        if (doneSummaryEl) {
          doneSummaryEl.innerHTML = '<span class="ls-done-num">' + usable.length + '</span> 张票据 · 合计 <span class="ls-done-amt">¥' + total.toFixed(2) + '</span>';
        }
        if (doneHintEl) doneHintEl.textContent = '正在进入工作台…';
      }
      // 渐变动画隐藏启动场景，露出工作台
      function hide() {
        shown = false;
        scene.classList.add('leave');
        setTimeout(() => { scene.style.display = 'none'; }, 950);
      }
      // 资源就绪：把启动页从"资源准备中"切到"拖拽上传"
      function markReady() {
        const prep = document.getElementById('lsPreparing');
        if (prep) prep.classList.add('hidden');
        if (uploadEl) uploadEl.classList.remove('hidden');
      }
      function isReady() {
        const prep = document.getElementById('lsPreparing');
        return !prep || prep.classList.contains('hidden');
      }
      return { isVisible, isReady, showUploading, updateProgress, showProcessing, showComplete, hide, reset, markReady };
    })();

    // 首张 PDF 识别前预热解析/渲染管线，避免用户开始上传时所有冷启动成本堆在第一张。
    async function warmPdfPipeline() {
      try {
        if (!PDFDocument) return;
        if (!window.pdfjsLib) return;
        const miniDoc = await PDFDocument.create();
        const page = miniDoc.addPage([120, 120]);
        page.drawText('warm', { x: 20, y: 60, size: 16 });
        const mini = await miniDoc.save();
        const doc = await pdfjsLib.getDocument(pdfOpenParams(mini)).promise;
        const warmPage = await doc.getPage(1);
        const viewport = warmPage.getViewport({ scale: 0.2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await warmPage.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        // 预热失败不影响主流程。
      }
    }

    let files = [];
    let ignoredFiles = [];
    let duplicateFiles = [];
    let uploadFolderName = ''; // 上传文件夹名（选择文件夹时记录，用于合并 PDF 命名）          // { id, name, bytes, w, h, pages, train, text, content, analyzeError, include, error }
    const trainOverride = {}; // name -> bool（用户手动修正）
    // v145：缩略图缓存改 LRU（Map，上限 60 张）——dataURL 是字符串驻留内存，
    // 大目录导入时旧实现无限增长（100 个文件 ≈ 10MB+），逐出最久未用的键释放内存
    const THUMB_MAX = 60;
    const thumbCache = new Map(); // id -> dataURL（发票缩略图缓存，LRU）
    function thumbCacheGet(id) {
      if (!thumbCache.has(id)) return null;
      const v = thumbCache.get(id);
      thumbCache.delete(id); thumbCache.set(id, v); // 触摸：移到末尾（最新）
      return v;
    }
    function thumbCacheSet(id, url) {
      thumbCache.delete(id);
      thumbCache.set(id, url);
      while (thumbCache.size > THUMB_MAX) {
        const oldest = thumbCache.keys().next().value;
        thumbCache.delete(oldest); // dataURL 字符串无法 revoke，删除键让 GC 回收
      }
    }
    let mergedOnce = false;   // v116：已成功合并过一次 → 隐藏「生成合并 PDF」按钮

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const old = document.querySelector(`script[data-src="${src}"]`);
        if (old) {
          if (old.dataset.loaded === '1') return resolve();
          old.addEventListener('load', () => resolve(), { once: true });
          old.addEventListener('error', () => reject(new Error('加载失败：' + src)), { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.dataset.src = src;
        s.onload = () => { s.dataset.loaded = '1'; resolve(); };
        s.onerror = () => reject(new Error('加载失败：' + src));
        document.head.appendChild(s);
      });
    }

    function ensurePdfLib() {
      if (PDFDocument) return Promise.resolve(PDFDocument);
      if (window.PDFLib && window.PDFLib.PDFDocument) {
        PDFDocument = window.PDFLib.PDFDocument;
        return Promise.resolve(PDFDocument);
      }
      return loadScript('./pdf-lib.min.js?v=150').then(() => {
        PDFDocument = window.PDFLib && window.PDFLib.PDFDocument;
        if (!PDFDocument) throw new Error('PDF 生成库加载失败');
        return PDFDocument;
      });
    }

    function ensureJsQR() {
      if (window.jsQR) return Promise.resolve(window.jsQR);
      return loadScript('./jsqr.min.js?v=150').then(() => {
        if (!window.jsQR) throw new Error('二维码识别库加载失败');
        return window.jsQR;
      });
    }

    function ensureJSZip() {
      if (window.JSZip) return Promise.resolve(window.JSZip);
      return loadScript('./jszip.min.js?v=150').then(() => {
        if (!window.JSZip) throw new Error('压缩打包库加载失败');
        return window.JSZip;
      });
    }

    let componentReadyPromise = null;
    function prepareComponents() {
      if (componentReadyPromise) return componentReadyPromise;
      const prog = document.getElementById('prog');
      const pct = document.getElementById('progPct');
      const pname = document.getElementById('progName');
      // v147：拖拽区「资源准备中」提示——prepareComponents 进行中显示，
      // 完成/失败时移除；ingest 内已有 promise 复用，用户即使在准备中拖入也自动衔接
      const dzP = document.getElementById('dzPreparing');
      if (dzP) dzP.classList.add('show');
      if (prog) prog.classList.add('show');
      if (pname) pname.textContent = '正在配置PDF相关组件（首次较慢，请稍等）';
      if (pct) pct.textContent = '0%';
      componentReadyPromise = Promise.all([ensurePdfLib()])
        .then(() => warmPdfPipeline())
        .then(() => {
          if (dzP) dzP.classList.remove('show');
          if (prog && !document.body.classList.contains('prog-open')) prog.classList.remove('show');
          // 资源就绪：把启动页从「资源准备中」切到「拖拽上传」
          if (typeof Launch !== 'undefined' && Launch.markReady) Launch.markReady();
        })
        .catch((e) => {
          if (dzP) dzP.classList.remove('show');
          if (prog && !document.body.classList.contains('prog-open')) prog.classList.remove('show');
          toast('配置组件失败：' + (e && e.message || e), true);
          // 失败也切到拖拽上传，让用户能继续；ingest 内部 setStage 会再次提示
          if (typeof Launch !== 'undefined' && Launch.markReady) Launch.markReady();
          throw e;
        });
      return componentReadyPromise;
    }

    // 火车票识别默认关键词（设置面板已去除，使用内置关键词）
    // v118：移除 '中铁' —— 中铁（中国中铁）是建筑企业简称，常作为网约车目的地出现
    //（如"中国中铁二局集团"），票面含"中铁"不代表是火车票；真正的铁路票面必有
    // 铁路/高铁/动车/12306/车次/检票口等强特征，不依赖"中铁"。
    const DEFAULT_TRAIN_KWS = ['火车票','车次','席别','检票口','铁路客票','铁路电子客票','高铁票','动车','铁路','12306'];
    function parseKws() { return DEFAULT_TRAIN_KWS; }
    // 按票面文字内容识别火车票（不再依赖文件名）
    function detectTrainByText(text, kws) {
      const raw = text || '';
      // 清洗：去掉空白、括号、常见分隔符，防止“铁路电子客票”因格式问题无法命中
      const clean = raw.replace(/\s/g, '').replace(/[（）()【】\[\]「」]/g, '');
      // 前置排除：航空行程单/登机牌含“航空、航班、登机”等字样，即使含“电子客票”也不是火车票
      const isAviation = /航空|航班|登机|boarding|民航|承运人|客票及行李/.test(raw) || /航空|航班|登机|民航|承运人/.test(clean);
      const isRail = /铁路|高铁|动车|火车|城际|12306|高铁票/.test(raw) || /铁路|高铁|动车|火车|城际|12306/.test(clean);
      if (isAviation && !isRail) return false;
      // v125：网约车/出行凭证前置排除——滴滴/T3/阳光等网约车发票的行程明细常含
      // “高铁站/动车进站口”等地址描述（如“常德站-南进站口(高铁)”“长沙南站-西进站口(动车进站)”），
      // 命中 高铁/动车 关键词会被误判为火车票（归错分类 + 火车票加印双份）。
      // 真实火车票票面（铁路电子客票）不含 滴滴/T3/出租车/旅客运输 等网约车特征词，前置排除安全。
      if (/滴滴|花小猪|曹操|t3|首汽|如祺|哈啰|阳光出行|享道|神州专车|万顺|网约车|出租车|打车|打的|的士|旅客运输|taxi|uber|didi|出行服务/.test(raw)) return false;
      // 1) 直接关键词匹配
      if (kws.some(k => raw.includes(k) || clean.includes(k))) return true;
      // 2) 组合兜底：铁路/12306 与 客票/车次/座/票价/站 同现（'中铁' 已移除：企业简称，非运输特征）
      const railSignals = ['铁路', '12306'];
      const ticketSignals = ['客票', '车票', '电子客票', '车次', '座', '票价', '检票口', '站'];
      const hasRail = railSignals.some(s => raw.includes(s) || clean.includes(s));
      const hasTicket = ticketSignals.some(s => raw.includes(s) || clean.includes(s));
      return hasRail && hasTicket;
    }
    // 兜底：极少数无法提取文字时，才退回到文件名关键字
    function fallbackDetect(name) {
      const kws = parseKws().map(k => k.toLowerCase());
      const lower = (name || '').toLowerCase();
      return kws.some(k => lower.includes(k));
    }

    // 识别单据类别（优先级从高到低）：
    // 航空行程单 > 火车票 > 网约车 > 机票 > 公共交通 > 行程单(通用) > 住宿 > 餐饮 > 通用发票 > 其他
    function classifyInvoice(text) {
      const t = (text || '').replace(/\s/g, '');
      const lower = t.toLowerCase();

      // 1) 航空行程单（强特征：航空运输电子客票行程单 / 客票及行李票 / itinerary），即使不是发票也要识别
      if (/航空运输电子客票行程单|航空.{0,8}行程单|客票及行李票|itinerary/.test(t + lower)) return 'itinerary';

      // 2) 火车票（铁路电子客票 / 高铁 / 动车；先排除航空特征，见 detectTrainByText）
      if (detectTrainByText(text, parseKws())) return 'train';

      // 3) 网约车 / 出租车（滴滴、T3、曹操、高德打车等出行平台；提到机票的也先归到网约车，因为滴滴企业差旅发票中常含"代订机票"等关键词）
      //   必须先于机票判断：滴滴差旅电子发票可能含"代订机票"字样，放后面会被误判为航空
      if (/网约车|滴滴|花小猪|曹操出行|t3出行|如祺出行|首汽约车|哈啰出行|高德打车|美团打车|出租车|打的|的士|打车|taxi|uber|didi|出行服务|乘车|旅客运输|长途汽车|客运|黔程出行|黔程|久网同城|跨城约车|顺风车|同城出行|城际出行|商务约车|代驾|包车/.test(t + lower)) return 'ridehail';

      // 4) 机票（航空客票 / 登机牌 / 机票购买发票）。网约车已先排过，本步只判纯航空场景。
      if (/机票|航空运输电子客票|航空客票|登机牌|boarding\s*pass|航班|承运人|airline|flight|航程|起飞|到达|机建|燃油附加/.test(t + lower)) return 'flight';

      // 5) 公共交通（地铁 / 公交 / 轨道交通 / 交通卡充值等）
      if (/公共交通|交通卡|地铁|公交|轨道交通|有轨电车|轮渡|摆渡|transit|metro|subway|bus|citytransport/.test(t + lower)) return 'transit';

      // 6) 通用行程单（此时已排除网约车/交通类，出现的"行程单"多为报销凭证），即使不是发票也要识别
      if (/行程单|行程信息|报销凭证|journey/.test(t + lower)) return 'itinerary';

      // 7) 住宿 / 酒店
      if (/住宿|酒店|宾馆|旅店|旅馆|客房|hotel|accommodation/.test(t + lower)) return 'hotel';

      // 8) 餐饮
      if (/餐饮|餐费|餐厅|饭店|酒楼|食品|酒水|宴会|catering|restaurant|外卖/.test(t + lower)) return 'meal';

      // 9) 通用发票
      if (/发票|增值税|电子发票|全电发票|数电发票|机动车.*票|通行费|电子普通发票|专用发票/.test(t)) return 'invoice';

      return 'other';
    }

    // 从票面文字提取金额：小写（数值）+ 大写（中文）。发票/火车票通用。
    function parseAmount(text) {
      const t = text || '';
      const cleaned = t.replace(/\s/g, '');
      // 合理金额范围：0.01 ~ 1亿元。超过此范围的数字一律视为发票号/流水号等非金额。
      const push = (raw) => {
        if (!raw) return;
        const v = parseFloat(raw.replace(/,/g, ''));
        if (isNaN(v) || v < 0.01 || v > 99999999.99) return;
        candidates.push(v);
      };
      const candidates = [];
      // 支持千分位逗号 + 限定整数位 1-8、小数 1-2 位。避免把 20 位发票号当成金额。
      const numFmt = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d{1,8}(?:\\.\\d{1,2})?)';
      // 1) 直接的 ¥xxx
      [...cleaned.matchAll(new RegExp('[¥￥]\\s?' + numFmt, 'g'))].forEach(m => push(m[1]));
      // 2) 带标签的数字：在标签后 8 个字符窗口内查找第一个合理金额（不锚定开头，允许 ": 888.00" 这种带冒号空格的情形）
      const labelRe = /(?:价税合计|价税|金额|合计|总计|总额|票价|应收|应付|实付|小写|人民币|RMB)/g;
      let labelMatch;
      while ((labelMatch = labelRe.exec(cleaned)) !== null) {
        const start = labelMatch.index + labelMatch[0].length;
        const rest = cleaned.slice(start, start + 8);
        const numMatch = rest.match(new RegExp(numFmt));
        if (numMatch) push(numMatch[1]);
      }
      // 取最大（去重），仍可能多张发票
      const uniq = [...new Set(candidates)];
      let amount = uniq.length ? Math.max(...uniq) : null;

      // 大写金额：先找紧跟"大写/人民币"后的中文金额串；否则从全文中提取最长中文金额串
      let upper = '';
      const u1 = cleaned.match(/(?:大写|人民币)[^零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆元整角分]{0,30}([零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆元整角分]+)/);
      if (u1) upper = u1[1];
      else {
        // 放宽到 2+ 字（兼容 "壹元整"、"贰拾元" 这类短金额串）
        const u2 = cleaned.match(/([零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆元整角分]{2,})/);
        if (u2) upper = u2[1];
      }

      // 没有小写时，尝试从大写反推
      if (amount == null && upper) {
        const fromUpper = parseChineseAmount(upper);
        if (fromUpper != null && fromUpper >= 0.01 && fromUpper <= 99999999.99) amount = fromUpper;
      }

      return { amount, upper };
    }

    // 中文大写金额 → 数字（支持常见发票大写格式）
    function parseChineseAmount(str) {
      if (!str) return null;
      const t = str.replace(/\s/g, '').replace(/圆/g, '元');
      const digits = { '零':0,'壹':1,'贰':2,'叁':3,'肆':4,'伍':5,'陆':6,'柒':7,'捌':8,'玖':9 };
      let total = 0, section = 0, currentDigit = 0, hasNum = false;
      for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (digits[ch] !== undefined) {
          currentDigit = digits[ch];
          hasNum = true;
        } else if (ch === '拾') {
          section += (currentDigit || 1) * 10; currentDigit = 0;
        } else if (ch === '佰') {
          section += (currentDigit || 1) * 100; currentDigit = 0;
        } else if (ch === '仟') {
          section += (currentDigit || 1) * 1000; currentDigit = 0;
        } else if (ch === '万') {
          total += (section + currentDigit) * 10000; section = 0; currentDigit = 0;
        } else if (ch === '亿') {
          total += (section + currentDigit) * 100000000; section = 0; currentDigit = 0;
        } else if (ch === '元') {
          total += section + currentDigit; section = 0; currentDigit = 0;
        } else if (ch === '角') {
          total += currentDigit * 0.1; currentDigit = 0;
        } else if (ch === '分') {
          total += currentDigit * 0.01; currentDigit = 0;
        } else if (ch === '整') {
          // 整 = 整元结尾，忽略
        }
      }
      // 末尾若还有未结算的数字（如"壹元"中的"壹"），补回
      total += section + currentDigit;
      return hasNum ? Math.round(total * 100) / 100 : null;
    }

    // 数字 → 中文大写金额（如 1234.56 → 壹仟贰佰叁拾肆元伍角陆分）
    function numToChinese(money) {
      if (money == null || isNaN(money)) return '';
      const neg = money < 0;
      money = Math.abs(Math.round(money * 100) / 100);
      const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
      const intUnits = ['', '拾', '佰', '仟'];
      const groupUnits = ['', '万', '亿', '兆'];
      const [intStr, decStr = '00'] = money.toFixed(2).split('.');
      let result = '';
      if (parseInt(intStr, 10) !== 0) {
        const groups = [];
        let s = intStr;
        while (s.length > 4) { groups.unshift(s.slice(-4)); s = s.slice(0, -4); }
        groups.unshift(s);
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          let gStr = ''; let hasZero = false;
          for (let j = 0; j < g.length; j++) {
            const d = +g[j]; const u = intUnits[g.length - 1 - j];
            if (d === 0) { hasZero = true; }
            else { if (hasZero && gStr !== '') gStr += '零'; gStr += digits[d] + u; hasZero = false; }
          }
          if (gStr !== '') result += gStr + groupUnits[groups.length - 1 - i];
          else if (i < groups.length - 1 && result !== '' && !result.endsWith('零')) result += '零';
        }
        result += '元';
      }
      const jiao = +decStr[0], fen = +decStr[1];
      if (jiao === 0 && fen === 0) {
        result += (result === '' ? '零元' : '') + '整';
      } else {
        if (parseInt(intStr, 10) > 0) result += '元';
        if (jiao > 0) result += digits[jiao] + '角';
        else if (fen > 0 && parseInt(intStr, 10) > 0) result += '零';
        if (fen > 0) result += digits[fen] + '分';
      }
      return (neg ? '负' : '') + result;
    }

    let lastBlobUrl = null;
    let idSeq = 0;

    const $ = (s) => document.querySelector(s);
    const listEl = $('#list');
    const emptyEl = $('#empty');

  function toast(msg, isError, duration) {
      const t = $('#toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(t._t);
      t._t = setTimeout(() => t.classList.remove('show'), duration || 1100);
    }

    // v20：内嵌常用 CMap（base64），file:// 双击打开或 cmaps 目录缺失时文字提取仍可用。
    // GBK 编码中文字体（KaiTi/SimHei/SimSun 等）无 ToUnicode 时必须加载对应 bcmap，
    // 否则文字提取为空 → 类别识别失败 → 页面显示「未识别」。
    const INLINE_CMAPS = (typeof window !== "undefined" && window.INLINE_CMAPS) || {}; // 映射表已外置到 inline-cmaps.js
    // pdf.js 要求类形式：内部 new 实例化，实例提供 fetch({name})；name 无后缀，字典 key 带 .bcmap
    class inlineCMapReaderFactory {
      constructor(params) { this.baseUrl = params.baseUrl; }
      // 注意：pdf.js 调用 fetch 时传 {name} 对象，必须解构；普通参数会收到 [object Object]
      async fetch({ name }) {
        const b64 = INLINE_CMAPS[name + '.bcmap'] || INLINE_CMAPS[name];
        if (b64) {
          const bin = atob(b64);
          const u8 = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          return { cMapData: u8, compressionType: 1 };
        }
        const res = await fetch(this.baseUrl + name + '.bcmap');
        const buf = await res.arrayBuffer();
        return { cMapData: new Uint8Array(buf), compressionType: 1 };
      }
    }

    // v146：PDF 解析 worker 策略——统一返回 getDocument 参数。
    // 线上（http/https）：启用 worker 线程解析（大目录导入不卡 UI），CMap 走默认网络工厂（./cmaps/ 按需 fetch）；
    // file:// 双击打开：保持主线程 + 内嵌 CMap 工厂（v84 曾因 worker 兼容差异回退，file:// 下 worker 加载亦受限）。
    function pdfOpenParams(data) {
      const isHttp = /^https?:$/.test(location.protocol);
      if (isHttp) {
        if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js?v=150';
        }
        return { data, cMapUrl: './cmaps/', cMapPacked: true, disableWorker: false };
      }
      return {
        data, cMapUrl: './cmaps/', cMapPacked: true,
        CMapReaderFactory: inlineCMapReaderFactory,
        disableWorker: true, // v84：主线程解析，确保内嵌 CMap 工厂在 file:// 下确定生效
      };
    }

    // 分析 PDF：同时提取票面文字（火车票识别）与每页「实际内容包围盒」（去掉四周空白，
    // 用于判断小发票）。bytes 会被 pdf.js 转移，这里传副本。
    // 分析 PDF：单次解析 pipeline（票面文字 + 每页内容包围盒 + 第一页二维码一次产出）。
    // v114：像素扫描步长 1px→4px（提速约 16 倍，外扩 4px 补偿采样误差，包围盒只大不小）；
    // 二维码复用同一 doc 渲染，不再单独 getDocument；解析结束统一 doc.destroy()。
    async function analyzePdf(bytes) {
      if (!window.pdfjsLib) return { text: '', content: null, cells: null, qrs: [], error: null };
      const STEP = 4;  // v114：扫描步长（px），原 1px
      let doc = null;
      try {
        // 关键：CJK 字体（如 DengXian）需 CMap 才能解码文字；
        // 不设 cMapUrl 时此类 PDF 提取文字失败（火车票/类别/金额全部丢失）。
        doc = await pdfjsLib.getDocument(pdfOpenParams(bytes.slice())).promise;
        let text = '';
        const content = [];
        const cells = [];   // 扁平文本项（带 y/x 坐标，按 y 升序、行内 x 升序），用于高德行程单表格列切分
        const qrs = [];     // 第一页二维码解码结果
        const jsQR = await ensureJsQR();
        const max = Math.min(doc.numPages, 8);
        for (let p = 1; p <= max; p++) {
          const page = await doc.getPage(p);
          const tc = await page.getTextContent();
          text += (tc.items || []).map(i => i.str || '').join(' ');
          // 收集带坐标的文本项（同 y 合并为一行时整行拼接无法区分单元格，需保留 item 级 x）
          for (const it of tc.items || []) {
            const str = it.str || '';
            if (!str.trim()) continue;
            const tr = it.transform || [1, 0, 0, 1, 0, 0];
            cells.push({ y: Math.round(tr[5]), x: tr[4], str });
          }

          // 渲染到画布，扫描非空白像素求内容包围盒
          // v146：大扫描件降采样——超过 MAX_DIM 边长的页面先按比例缩小再渲染，
          // 避免 A0/A1 扫描页（3000×4000px+）整分辨率渲染导致内存峰值与卡顿；
          // 包围盒扫描是「找内容边界」而非精确像素，降采样后误差 < 1%，可接受。
          const MAX_DIM = 2400; // 最长边像素上限（A4 约 842px，扫描件可到 4000px+）
          const vp1 = page.getViewport({ scale: 1 });
          let viewport = vp1;
          const maxSide = Math.max(vp1.width, vp1.height);
          if (maxSide > MAX_DIM) viewport = page.getViewport({ scale: MAX_DIM / maxSide });
          const W = Math.max(1, Math.ceil(viewport.width));
          const H = Math.max(1, Math.ceil(viewport.height));
          const canvas = document.createElement('canvas');
          canvas.width = W; canvas.height = H;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, W, H);
          await page.render({ canvasContext: ctx, viewport }).promise;
          const data = ctx.getImageData(0, 0, W, H).data;

          // 二维码扫描：仅第一页。先试 scale 1 画布数据，失败再补渲 scale 4
          // （发票二维码约 1.5cm，低分辨率扫不到时需更高像素）
          if (p === 1 && jsQR) {
            let qrCode = null;
            if (W > 200 && H > 200) {
              qrCode = jsQR(data, W, H, { inversionAttempts: 'dontInvert' });
            }
            if (!qrCode) {
              try {
                const vp2 = page.getViewport({ scale: 4 });
                const W2 = Math.ceil(vp2.width), H2 = Math.ceil(vp2.height);
                if (W2 * H2 <= 6000 * 6000) { // 防止超大画布导致卡顿
                  const c2 = document.createElement('canvas');
                  c2.width = W2; c2.height = H2;
                  const ctx2 = c2.getContext('2d');
                  ctx2.fillStyle = '#ffffff';
                  ctx2.fillRect(0, 0, W2, H2);
                  await page.render({ canvasContext: ctx2, viewport: vp2 }).promise;
                  const img2 = ctx2.getImageData(0, 0, W2, H2);
                  qrCode = jsQR(img2.data, W2, H2, { inversionAttempts: 'dontInvert' });
                }
              } catch (e3) { /* 二维码补渲失败，忽略 */ }
            }
            if (qrCode && qrCode.data) qrs.push(qrCode.data.trim());
          }

          let minX = W, minY = H, maxX = -1, maxY = -1;
          for (let y = 0; y < H; y += STEP) {
            const row = y * W * 4;
            for (let x = 0; x < W; x += STEP) {
              const i = row + x * 4;
              const r = data[i], g = data[i + 1], b = data[i + 2];
              if (r > 248 && g > 248 && b > 248) continue; // 视为空白
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
          if (maxY < 0) {
            content.push({ hCm: 0, wCm: 0, empty: true });
          } else {
            // v19：智能底部裁剪——页面下方若有大段无文字内容（图片/广告区，如滴滴发票的 didi 区域），
            // 把内容底部收到「本页文本底部 + 0.1cm」，避免正文被整体缩小或误触发旋转；
            // 命中时标记 cropByText，合并阶段用 CropBox 只绘制正文区域（不显示 didi 等装饰区）。
            // v23 修正：触发阈值 2cm→0.5cm、边距 0.8cm→0.1cm——滴滴发票的 didi 区仅约 0.7cm，
            // 旧参数既不触发、触发后 0.8cm 边距还会把 didi 包回来，导致“删除 didi”不生效。
            // 判定基于未外扩的 maxY，与 v114 语义保持一致。
            let cropByText = false;
            let pageMinPdfY = Infinity;
            for (const it2 of tc.items || []) {
              const s2 = it2.str || '';
              if (!s2.trim()) continue;
              const tr2 = it2.transform || [1, 0, 0, 1, 0, 0];
              if (tr2[5] < pageMinPdfY) pageMinPdfY = tr2[5];
            }
            if (pageMinPdfY !== Infinity) {
              // v27：用 viewport.transform 正确换算文本底部（兼容 MediaBox 原点非 0 的 PDF，
              // 如滴滴发票 MediaBox=[0,432.875,...]，旧写法 H-pageMinPdfY 会算出负值导致 bbox 异常）
              const tf2 = viewport.transform || [1, 0, 0, -1, 0, H];
              const txtBottomCanvas = tf2[1] * 0 + tf2[3] * pageMinPdfY + tf2[5]; // 画布 y = d*y + f
              if (maxY - txtBottomCanvas > 0.5 * PT_PER_CM) {
                maxY = Math.min(maxY, Math.round(txtBottomCanvas + 0.1 * PT_PER_CM));
                cropByText = true;
              }
            }
            // v27：渲染区(view)不贴底（page._pageInfo.view[1] 远大于 0）说明原 MediaBox 底部
            // 有大段被 CropBox 裁掉的空白（滴滴发票 MediaBox=A4 竖版、CropBox 只圈中部票据区，
            // 下方约 15cm 空白）。强制按渲染区内容裁剪，避免 embedPdf 用 MediaBox 嵌入时
            // 把底部空白一起缩放、发票被压小。
            if (!cropByText) {
              try {
                const vinfo = page._pageInfo && page._pageInfo.view;
                if (vinfo && vinfo.length >= 4) {
                  const viewY0 = parseFloat(vinfo[1]) || 0;
                  if (viewY0 > 0.5 * PT_PER_CM) {
                    cropByText = true;
                    maxY = Math.min(maxY, H); // 内容底部收到渲染区下缘，剔除裁剪视图外的空白
                  }
                }
              } catch (e2) { /* 读取失败时保持原逻辑 */ }
            }
            // v120：行程单正文区定位（灵活裁切）——先完整扫描出内容包围盒（内容高度已确认），
            // 再以文本锚点修正边界，修正前校验确实存在空白，避免内容被裁切：
            //   上边界 = 标题行（含 行程单/ITINERARY/TRIP TABLE，取最顶部者）文字顶部 + 小留白，
            //            仅当标题上方确有内容（广告 Banner，均为图片无文本）时才上移 minY；
            //   下边界 = 排除「页码」后的最后一个文本行底部 + 0.15cm（用户确认方案），
            //            仅当下方确有空白（>0.1cm）时才收缩 maxY，紧邻文本行的表格线由 0.15cm 余量兜住。
              const pageText = (tc.items || []).map(ix => ix.str || '').join('');
            if (/行程单|ITINERARY|TRIP TABLE/.test(pageText) && /序号|服务商|车型|上车时间|金额|里程/.test(pageText)) {
              const tfI = viewport.transform || [1, 0, 0, -1, 0, H];
              let titleItem = null;       // 标题锚点项（PDF y 向上，取最顶部者）
              let bodyBottomPdfY = Infinity; // 最后文本行（PDF y 向上，越小越靠下）
              // v124：水平收紧用——主体文本的 PDF x 范围（排除页码），canvas x = pdf x（scale=1 不翻转）
              let bodyMinPdfX = Infinity, bodyMaxPdfX = -Infinity;
              for (const it2 of tc.items || []) {
                const s2 = it2.str || '';
                if (!s2.trim()) continue;
                const tr2 = it2.transform || [1, 0, 0, 1, 0, 0];
                const y2 = tr2[5];
                if (!/页码|^\s*\d+\s*\/\s*\d+\s*$/.test(s2)) {
                  const x2 = tr2[4], w2 = it2.width || 0;
                  if (x2 < bodyMinPdfX) bodyMinPdfX = x2;
                  if (x2 + w2 > bodyMaxPdfX) bodyMaxPdfX = x2 + w2;
                }
                if (/行程单|ITINERARY|TRIP TABLE/.test(s2)) {
                  if (!titleItem || y2 > titleItem.pdfY) titleItem = { pdfY: y2, h: it2.height || 12 };
                } else if (!/页码|^\s*\d+\s*\/\s*\d+\s*$/.test(s2) && y2 < bodyBottomPdfY) {
                  bodyBottomPdfY = y2;
                }
              }
              if (titleItem && bodyBottomPdfY !== Infinity && titleItem.pdfY > bodyBottomPdfY) {
                // v122：顶部锚点分两类——
                //   · 滴滴版行程单（含 姓名/工号/部门 空白填写栏，标题+姓名栏为每份重复的无用信息）：
                //     上边界下移到「申请日期/行程时间」摘要行，整段删除标题与姓名/工号/部门栏
                //   · 其他行程单（高德等，无姓名栏）：上边界 = 标题行（保持 v120 行为）
                let topAnchor = titleItem;
                if (/姓名|工号|部门/.test(pageText)) {
                  let summaryItem = null;
                  for (const it2 of tc.items || []) {
                    const s2 = it2.str || '';
                    if (!s2.trim()) continue;
                    if (!/申请日期|申请时间|行程起止日期|行程时间/.test(s2)) continue;
                    const tr2 = it2.transform || [1, 0, 0, 1, 0, 0];
                    const y2 = tr2[5];
                    if (!summaryItem || y2 > summaryItem.pdfY) summaryItem = { pdfY: y2, h: it2.height || 12 };
                  }
                  if (summaryItem && titleItem.pdfY > summaryItem.pdfY) topAnchor = summaryItem;
                }
                const topCanvas = tfI[3] * topAnchor.pdfY + tfI[5] - (topAnchor.h || 12) - 0.1 * PT_PER_CM; // 锚点文字顶部 + 留白
                // v130：底部余量 0.15cm → 0.45cm——实测滴滴行程单表格底边框线在
                // 「最后文本行底部 + 0.15cm」下方 6.8pt（0.24cm），旧余量会把表格底部
                // 横边框线裁掉（垂直分割线底部截断）；+0.45cm 覆盖边框线并留 0.21cm 保险。
                const bodyBottomCanvas = tfI[3] * bodyBottomPdfY + tfI[5] + 0.45 * PT_PER_CM;               // 最后文本行底部 + 0.45cm
                // 顶部：锚点上方确有大段内容（>0.3cm）才上移；页面顶部即锚点时保持不动
                if (topCanvas > minY + 0.3 * PT_PER_CM && topCanvas < maxY) {
                  minY = Math.round(topCanvas);
                  cropByText = true;
                }
                // 底部：最后文本行下方确有空白（>0.1cm）才收缩；紧贴文本行的表格线由 +0.45cm 余量保留（v130）
                if (bodyBottomCanvas > minY && maxY - bodyBottomCanvas > 0.1 * PT_PER_CM) {
                  maxY = Math.round(bodyBottomCanvas);
                  cropByText = true;
                }
                // v124：水平收紧——只留行程主体（摘要行+表格），裁掉左右白边。
                // 文本 x 范围外扩 0.2cm 兜住表格线；仅当比像素范围窄 >0.3cm 才收紧，避免误裁。
                if (bodyMinPdfX !== Infinity && bodyMaxPdfX !== -Infinity) {
                  const pad = 0.2 * PT_PER_CM;
                  const newMinX = Math.max(minX, Math.round(bodyMinPdfX - pad));
                  const newMaxX = Math.min(maxX, Math.round(bodyMaxPdfX + pad));
                  const narrower = (minX < newMinX - 0.3 * PT_PER_CM) || (maxX > newMaxX + 0.3 * PT_PER_CM);
                  if (newMaxX - newMinX > 1 && narrower) {
                    minX = newMinX;
                    maxX = newMaxX;
                    cropByText = true;
                  }
                }
              }
            }
            // 采样补偿：步长扫描可能漏掉最边缘 (STEP-1)px 的内容，外扩保证包围盒只大不小
            minX = Math.max(0, minX - STEP);
            minY = Math.max(0, minY - STEP);
            maxX = Math.min(W - 1, maxX + STEP);
            maxY = Math.min(H - 1, maxY + STEP);
            const cwPx = maxX - minX + 1;
            const chPx = maxY - minY + 1;
            content.push({
              hCm: chPx / PT_PER_CM,
              wCm: cwPx / PT_PER_CM,
              bbox: { x: minX, y: H - maxY, w: cwPx, h: chPx },
              cropByText,
            });
          }
        }
        cells.sort((a, b) => (b.y - a.y) || (a.x - b.x)); // PDF 坐标 y 向上，视觉从上到下需 y 降序
        return { text, content, cells, qrs, error: null };
      } catch (e) {
        return { text: '', content: null, cells: null, qrs: [], error: e.message || String(e) };
      } finally {
        if (doc) { try { doc.destroy(); } catch (e4) { /* 释放失败忽略 */ } }
      }
    }



    // 解析发票二维码文本：判断是否发票 + 提取金额
    // 常见格式：
    //   - 增值税发票: 01,10,发票代码,开票日期YYYYMMDD,发票号码,校验码,价税合计,不含税金额,税额,...
    //   - 数电票:     URL 带 fpdm/fphm/jshj 参数，或逗号分隔结构化串
    //   - 部分含 JSON / key:value
    function parseQRText(qrText) {
      const t = (qrText || '').trim();
      if (!t) return { isInvoice: false, amount: null };
      // 发票特征：发票要素关键词 / 税务总局查验平台域名 / 20 位发票号码
      // 或税局二维码结构化串（01,10/11,发票代码,日期,号码,校验码,价税合计,...）
      const isInvoice = /fpdm|fphm|jshj|kprq|inv-veri\.chinatax|chinatax\.gov|发票号码|发票代码|价税合计|电子发票|增值税|数电票|全电发票|发票查验|taxinvoice|invoice/i.test(t)
        || /^01[,，]\d{1,2}[,，]/.test(t);
      // 仅发票才提取金额（避免把非发票二维码里的网址/密码等数字误当金额）
      if (!isInvoice) return { isInvoice: false, amount: null };

      let amount = null;
      const valid = (v) => v != null && !isNaN(v) && v >= 0.01 && v <= 99999999.99;
      // 1) key=value / 中文标签直取（优先价税合计/合计金额）
      const kvRe = /(?:jshj|kphjje|hjje|amount|total|合计金额|价税合计|合计|金额|小写)[:=：,，]?\s*(\d{1,8}(?:\.\d{1,2})?)/i;
      const kv = t.match(kvRe);
      if (kv) {
        const v = parseFloat(kv[1]);
        if (valid(v)) amount = v;
      }
      // 2) 逗号/竖线/空格分隔的结构化串：优先含小数的数值，取最大合理值（价税合计通常最大；发票号超 8 位被排除）
      if (amount == null) {
        const nums = t.match(/\d{1,8}(?:\.\d{1,2})?/g) || [];
        const withDec = nums.filter(n => n.includes('.'));
        const pool = withDec.length ? withDec : nums;
        const vals = pool.map(n => parseFloat(n)).filter(valid);
        if (vals.length) amount = Math.max(...vals);
      }
      return { isInvoice, amount };
    }

    // 提取票面日期（YYYY-MM-DD），优先从文字，其次文件名；无则 null
    function extractDate(text, fileName) {
      const norm = (y, mo, d) => `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const t = text || '';
      // 1) 票面文字：2026-08-08 / 2026.08.08 / 2026年8月8日 / 20260808
      let m = t.match(/(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})/);
      if (m) return norm(m[1], m[2], m[3]);
      m = t.match(/(\d{4})(\d{2})(\d{2})(?!\d)/);
      if (m) return norm(m[1], m[2], m[3]);
      // 2) 文件名兜底
      if (fileName) {
        m = fileName.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})|(\d{4})(\d{2})(\d{2})(?!\d)/);
        if (m) return norm(m[1] || m[4], m[2] || m[5], m[3] || m[6]);
      }
      return null;
    }

    // 解析网约车行程单中的多条行程明细（兼容滴滴/和行/T3/曹操/花小猪/如祺/哈啰/首汽/享道等平台）
    // 关键：PDF 文本常按 token 换行拆分（"特惠快\n车"、"周\n一"），因此先把所有空白合并为单行，
    // 再用「序号+车型」锚定每条行程，段内取时间/里程/金额/地址。
    // 返回 [{date, car, time, from, to, km, amount}], 无则 []
    function parseTrips(text, defaultDate, cells) {
      // 高德行程单专用：表头 序号|服务商|车型|上车时间|城市|起点|终点|金额（横向表格，item 级 x 坐标切分）
      if (text && /AMAP ITINERARY|高德地图|高德打车/.test(text)) {
        var g = parseGaodeTrips(text, defaultDate, cells);
        if (g && g.length) return g;
        return parseGaodeTripsRegex(text, defaultDate); // 列解析失败时正则兜底
      }
      // 黔程出行行程单：表头 序号|类型|订单手机号|日期|出发地|目的地|总金额|备注（横版/竖版表格均按 cells 列区间切分）
      if (text && /黔程出行|黔程\s*-\s*行程单|久网同城|跨城约车/.test(text)) {
        return parseQianchengTrips(text, defaultDate, cells);
      }
      return parseDiDiTrips(text, defaultDate);
    }

    // 黔程出行行程单：表头 序号|类型|订单手机号|日期|出发地|目的地|总金额|备注
    // 解析策略：① 视觉行分组（y 容差 5pt）；② 用表头各列的 x 构造列区间；
    // 数据 item 按 x 落入哪个区间归入哪列（长文本/短文本均稳定）；③ 按"序号"列整数锚定每条行程，
    // 提取 日期/出发地/目的地/总金额。无 time/km 字段（黔程版式无上车时间与里程列）。
    function parseQianchengTrips(text, defaultDate, cells) {
      const out = [];
      if (!cells || !cells.length) return out;
      const C = cells.filter(c => c.str && c.str.trim());
      if (C.length < 10) return out;
      // 1) 视觉行分组（y 容差 5）
      const rows = [];
      for (const c of C) {
        let placed = false;
        for (const r of rows) {
          if (Math.abs(r.y - c.y) <= 5) { r.items.push(c); placed = true; break; }
        }
        if (!placed) rows.push({ y: c.y, items: [c] });
      }
      for (const r of rows) r.items.sort((a, b) => a.x - b.x);
      // 2) 表头行：含"序号"+"出发地"+"目的地"+"金额/总金额"的视觉行
      let headRow = null;
      for (const r of rows) {
        const txts = r.items.map(it => it.str.trim());
        if (txts.indexOf('序号') >= 0 && (txts.indexOf('出发地') >= 0) &&
            (txts.indexOf('目的地') >= 0) && r.items.some(it => /总金额|金额/.test(it.str))) {
          headRow = r; break;
        }
      }
      if (!headRow) return out;
      // 3) 表头列区间：用表头中已知列名所在 item 的 x 构造列区间（相邻列 x 中点作边界）
      const HEAD_FIELDS = ['序号', '类型', '订单手机号', '日期', '出发地', '目的地', '总金额', '备注'];
      const colX = {};
      for (const it of headRow.items) {
        const s = it.str.trim();
        const f = HEAD_FIELDS.find(fn => s === fn || s.indexOf(fn) === 0);
        if (f && colX[f] == null) colX[f] = it.x;
      }
      const cols = HEAD_FIELDS.map(f => ({ f, x: colX[f] })).filter(c => c.x != null).sort((a, b) => a.x - b.x);
      if (!cols.length) return out;
      const classify = (x) => {
        for (let i = 0; i < cols.length; i++) {
          const lo = i > 0 ? (cols[i - 1].x + cols[i].x) / 2 : -Infinity;
          const hi = i < cols.length - 1 ? (cols[i].x + cols[i + 1].x) / 2 : Infinity;
          if (x >= lo && x < hi) return cols[i].f;
        }
        return null;
      };
      // 4) 数据行（表头之上），按"序号"列整数锚定行程；无 type/手机号列也允许（其他平台同表头变体）
      const dataRows = rows.filter(r => r.y < headRow.y - 3);
      let cur = null;
      const flush = () => { if (cur && cur.from && cur.to && cur.amount != null) out.push(cur); cur = null; };
      for (const r of dataRows) {
        // 跳过合计/总计/小计/页码等非行程行（避免「合计 380.00」行被当作上一笔的续行把金额覆盖成总额）
        if (r.items.some(it => /合计|总计|小计|页码|共\s*\d+/.test(it.str))) continue;
        for (const it of r.items) {
          const col = classify(it.x);
          if (!col) continue;
          const s = it.str.trim();
          if (col === '序号') {
            // 序号数字：开启一条新行程
            if (/^\d{1,3}$/.test(s)) { flush(); cur = { car: '跨城约车', time: '', km: null }; }
            continue;
          }
          if (!cur) continue;
          if (col === '日期') {
            // 2026-03-09 / 2026/3/9 → 归一 2026-03-09
            const m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
            if (m) cur.date = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
            else cur.date = defaultDate || '';
          } else if (col === '出发地') { cur.from = s; }
          else if (col === '目的地') { cur.to = s; }
          else if (col === '总金额') { cur.amount = parseFloat(s) || null; }
          else if (col === '类型') { if (s) cur.car = s; }
        }
      }
      flush();
      // 兜底：日期未取到用 defaultDate
      for (const t of out) if (!t.date) t.date = defaultDate || '';
      return out;
    }

    // 高德行程单：横向表格，每格一个 item。
    // 解析策略：① 视觉行分组（y 容差 5pt，同一行 item 的 y 有微小差异）；② 用表头各列的 x 构造列区间，
    // 数据 item 按 x 落入哪个区间归入哪列（起点/终点列长文本 x 有偏移也可靠）；③ 按"序号"列锚定每个行程。
    /* 高德行程单正则兜底解析：当 column-interval 模式失败时使用。
   逐行扫描文本，匹配 "序号 车型 上车时间 城市 起点 终点 金额" 模式 */
function parseGaodeTripsRegex(text, defaultDate) {
  var out = [];
  if (!text) return out;
  var flat = text.replace(/[\r\n]+/g, ' ').replace(/[ \t\u3000]+/g, ' ').trim();
  // 高德行：序号 + 服务商名 + 车型 + 日期时间 + 城市 + 起终点 + 金额元
  var tripRe = /(\d{1,3})\s+(\S+?(?:快车|专车|拼车|优享|出租车|特惠|舒适|商务|接送|经济型|经济|标准型|豪华型|商务型))\s+(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*\d{1,2}:\d{2})\s+([\u4e00-\u9fa5]{2,4}市?)\s+(.+?)\s+(\d+(?:\.\d{1,2})?)元/g;
  var m;
  while ((m = tripRe.exec(flat))) {
    var from = '', to = '';
    var routeText = m[5] || '';
    var sep = routeText.lastIndexOf(' ');
    if (sep > 0) { from = routeText.slice(0, sep).trim(); to = routeText.slice(sep + 1).trim(); }
    else { from = routeText; }
    out.push({
      date: (m[3] ? m[3].split(' ')[0] : '') || defaultDate,
      car: m[2],
      time: m[3] || '',
      city: m[4] || '',
      from: from, to: to,
      km: null,
      amount: parseFloat(m[6]) || null
    });
  }
  return out;
}
function parseGaodeTrips(text, defaultDate, cells) {
      const out = [];
      if (!cells || !cells.length) return out;
      const C = cells.filter(c => c.str && c.str.trim());
      if (C.length < 16) return out;
      // 1) 视觉行分组（y 容差 5）
      const rows = [];
      for (const c of C) {
        let placed = false;
        for (const r of rows) {
          if (Math.abs(r.y - c.y) <= 5) { r.items.push(c); placed = true; break; }
        }
        if (!placed) rows.push({ y: c.y, items: [c] });
      }
      for (const r of rows) r.items.sort((a, b) => a.x - b.x);
      // 2) 表头行：含"序号"且含"金额"的视觉行
      let headRow = null;
      for (const r of rows) {
        if (r.items.some(it => it.str.trim() === '序号') && r.items.some(it => it.str.includes('金额'))) { headRow = r; break; }
      }
      if (!headRow) return out;
      const HEAD_FIELDS = ['序号', '服务商', '车型', '上车时间', '城市', '起点', '终点', '金额'];
      const colX = {};
      for (const it of headRow.items) {
        const f = HEAD_FIELDS.find(fn => it.str.includes(fn));
        if (f && colX[f] == null) colX[f] = it.x;
      }
      if (colX['序号'] == null || colX['金额'] == null) return out;
      // 3) 表头列区间：相邻列 x 中点作边界
      const cols = HEAD_FIELDS.map(f => ({ f, x: colX[f] })).filter(c => c.x != null).sort((a, b) => a.x - b.x);
      const classify = (x) => {
        for (let i = 0; i < cols.length; i++) {
          const lo = i > 0 ? (cols[i - 1].x + cols[i].x) / 2 : -Infinity;
          const hi = i < cols.length - 1 ? (cols[i].x + cols[i + 1].x) / 2 : Infinity;
          if (x >= lo && x < hi) return cols[i].f;
        }
        return null;
      };
      // 4) 数据行（表头行之下），按"序号"锚定行程，item 按列区间归位
      const dataRows = rows.filter(r => r.y < headRow.y - 3);
      let cur = null;
      const flush = () => { if (cur) out.push(cur); cur = null; };
      for (const r of dataRows) {
        for (const it of r.items) {
          const col = classify(it.x);
          if (!col) continue;
          const t = it.str;
          if (col === '序号') {
            if (/^\d+$/.test(t.trim())) { flush(); cur = { parts: {} }; }
            continue;
          }
          if (!cur) continue;
          if (col === '金额') {
            const am = t.match(/(\d+(?:\.\d{1,2})?)元/);
            if (am && cur.amount == null) cur.amount = parseFloat(am[1]);
            continue;
          }
          cur.parts[col] = (cur.parts[col] || '') + t;
        }
      }
      flush();
      // 5) 组装
      return out.map(o => {
        const tm = o.parts['上车时间'] ? o.parts['上车时间'].match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*(\d{1,2}:\d{2})/) : null;
        let city = (o.parts['城市'] || '').replace(/\s+/g, '');
        let from = (o.parts['起点'] || '').replace(/\s+/g, '');
        // 列边界偏移可能让起点误入城市列（如"嘉兴市万聚..."）：
        // 从城市列头部提取城市名，余量回填到起点
        if (city.length > 4) {
          const cm = city.match(/^([\u4e00-\u9fa5]{2,3}市)/);
          if (cm && city.length > cm[1].length) {
            from = city.slice(cm[1].length) + from;
            city = cm[1];
          }
        }
        return {
          date: (tm ? tm[1] : '') || defaultDate,
          car: (o.parts['车型'] || '').replace(/\s+/g, '') || (o.parts['服务商'] || '').replace(/\s+/g, ''),
          time: tm ? (tm[1] + ' ' + tm[2]) : '',
          city,
          from,
          to: (o.parts['终点'] || '').replace(/\s+/g, ''),
          km: null,
          amount: o.amount != null ? o.amount : null,
        };
      });
    }

    function parseDiDiTrips(text, defaultDate) {
      const out = [];
      // PDF 文本流按 token 换行："特惠快\n车" 是单元格内换行（应合并），"店)\n七星关区" 是列间换行（应保留空格）。
      // 统一策略：换行 → 单空格，车型词/周X 匹配容忍空格。
      const flat = (text || '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[ \t\u3000]+/g, ' ')
        .trim();
      if (!flat) return out;
      // 车型词容忍换行产生的空格（特惠快 车 / 惊喜特 价 / 城际拼 车 / 拼 车）
      // v125：扩展第三方网约车品牌词（T3打车/阳光出行/曹操出行/首汽约车/花小猪/如祺/哈啰/享道/高德打车/美团打车等）——
      // 第三方行程单车型列是品牌名（如“T3打车”“阳光出行”），仅靠 快车/专车/优享 等车型词匹配不到 → 行程丢失
      // v133：惊喜特价车型词容忍「惊喜」与「特价」间换行空格（滴滴新版式把"惊喜特价"拆成两个文本项）
      const CAR_ALT = '滴滴特\\s*快|滴滴轻\\s*享|滴滴豪\\s*华|滴滴舒\\s*适|滴滴专\\s*车|特惠快\\s*车|惊喜\\s*特\\s*价|跨城拼\\s*车|城际拼\\s*车|跨城约\\s*车|同城约\\s*车|城际约\\s*车|顺风车|T3\\s*出\\s*行|T3\\s*打\\s*车|阳光\\s*出\\s*行|曹操\\s*出\\s*行|曹操\\s*专\\s*车|首汽\\s*约\\s*车|花小\\s*猪|如祺\\s*出\\s*行|哈啰\\s*出\\s*行|享道\\s*出\\s*行|高德\\s*打\\s*车|美团\\s*打\\s*车|神州\\s*专\\s*车|万顺\\s*叫\\s*车|特惠|轻享|优享|跨城拼|经济型|专车|豪华车|快车|接送机|商务车|舒适型|出租车|接机/站|接机|送机|拼\\s*车';
      const CITY_RE = /(成都市?|北京市?|上海市?|广州市?|深圳市?|杭州市?|南京市?|苏州市?|武汉市?|西安市?|重庆市?|天津市?|合肥市?|济南市?|青岛市?|无锡市?|宁波市?|毕节市?|六盘水市?|遵义市?|贵阳市?|黄山市?)/;
      const ENTRY_RE = new RegExp('(\\d+)\\s+(' + CAR_ALT + ')(?![\\u4e00-\\u9fa5])', 'g');
      const WEEK_RE = /周[\s\u3000]*[一二三四五六日天]/g;
      const entries = [];
      let m;
      while ((m = ENTRY_RE.exec(flat)) !== null) {
        entries.push({ seq: m[1], car: m[2], start: m.index, end: ENTRY_RE.lastIndex });
      }
      for (let i = 0; i < entries.length; i++) {
        const cur = entries[i];
        const segStart = cur.end;
        const segEnd = (i + 1 < entries.length) ? entries[i + 1].start : flat.length;
        const seg = flat.slice(segStart, segEnd).trim();
        if (!seg) continue;
        // 1) 时间：YYYY-MM-DD HH:mm:ss 或 MM-DD HH:mm
        // v133：容忍滴滴新版式时间列拆项（"21:" 与 "52" 两个文本项 → flat 后 "21: 52"）——
        // 冒号后允许空格，tm[3] 捕获分钟（可含秒），timeStr 重组为标准 "HH:MM"
        const tm = seg.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2})\s+(\d{1,2}):\s*(\d{2}(?::\d{2})?)/);
        if (!tm) continue;
        const timeStr = tm[1] + ' ' + tm[2] + ':' + tm[3];
        // 2) 里程/金额：段内所有小数，取最后两个（里程在前、金额在后）；只有一个则里程空
        const decimals = [];
        for (const dm of seg.matchAll(/(\d+(?:\.\d+)?)/g)) {
          const s = dm[1];
          if (s.includes('.') && s !== '.') {
            const v = parseFloat(s);
            if (!isNaN(v)) decimals.push(v);
          }
        }
        if (decimals.length < 1) continue;
        const km = decimals.length >= 2 ? decimals[decimals.length - 2] : null;
        const amount = decimals[decimals.length - 1];
        if (isNaN(amount)) continue;
        // 3) 地址：时间之后、里程金额之前
        const afterTime = seg.slice(seg.indexOf(tm[0]) + tm[0].length);
        let addr = afterTime;
        const amtIdx = afterTime.lastIndexOf(String(amount));
        if (amtIdx > 0) addr = afterTime.slice(0, amtIdx).trim();
        if (km != null) {
          const kmIdx = addr.lastIndexOf(String(km));
          if (kmIdx > 0) addr = addr.slice(0, kmIdx).trim();
        }
        // 4) 清周X + 城市（时间前/后均可；城市名可能被空格拆开如"贵阳 市"）
        addr = addr.replace(WEEK_RE, ' ').replace(/[ \t\u3000]+/g, ' ').trim();
        const cityMatch = seg.match(CITY_RE);
        let city = '';
        let addrBody = addr;
        if (cityMatch) {
          city = cityMatch[1].replace(/\s+/g, '').replace(/市$/, '市');
          const cityPattern = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          addrBody = addr
            .replace(new RegExp(cityPattern + '\\s*市?'), ' ')
            .replace(/[ \t\u3000]+/g, ' ')
            .trim();
        } else {
          // v119：城市不在硬编码列表（如嘉兴市）时，从地址开头剥离 "XX市" 前缀
          // v125：容忍 "郴州 市"（城市名与"市"被拆成两个 item 带空格）——`\s*` 允许中间空白
          const cm = addrBody.match(/^([\u4e00-\u9fa5]{2,4})\s*市/);
          if (cm) {
            city = cm[1] + '市';
            addrBody = addrBody.slice(cm[0].length).replace(/[ \t\u3000]+/g, ' ').trim();
          }
        }
        // 5) 起终点切分：起点/终点列内"区县|地点"用 | 分层；两列之间无显式分隔
        const pipes = [];
        for (const p of addrBody.matchAll(/\|/g)) pipes.push(p.index);
        let from = '', to = '';
        if (pipes.length >= 2) {
          // 两个地址块都有 |：以最后一个 | 前最近空格为界
          const lastPipe = pipes[pipes.length - 1];
          const beforeLast = addrBody.slice(0, lastPipe);
          const sp = beforeLast.lastIndexOf(' ');
          if (sp > 0) { from = beforeLast.slice(0, sp).trim(); to = addrBody.slice(sp + 1).trim(); }
          else { from = beforeLast.trim(); to = addrBody.slice(lastPipe).trim(); }
        } else if (pipes.length === 1) {
          // v140：广州GF308 行程单 A 出现新 wrap 模式——起点被换行拆成两段并用 | 衔接（"白云机场-T3-P12停车楼二层-上车点|白云机场-T3-P12停车楼"），
          // 后面再接 wrap 续行"二层-上车点"+终点带括号地址"悦云酒店(广州白云国际机场店)"。| 只是起点内部分层标记，不是起终点分隔。
          // 切分策略——起点取 | 之前；终点从 | 后第一个 ( 向前找最近空格作为店名起点
          const p = pipes[0];
          from = addrBody.slice(0, p).trim();
          const afterPipe = addrBody.slice(p + 1);
          const cb1 = afterPipe.indexOf('(');
          if (cb1 > 0) {
            // 向前找店名起点：括号前最近的空格或字符串起点
            const sp = afterPipe.lastIndexOf(' ', cb1);
            to = afterPipe.slice(sp > 0 ? sp + 1 : 0).trim();
          } else {
            // 无括号：按 v119 兜底，| 后第一个空格切
            const sp2 = afterPipe.indexOf(' ');
            if (sp2 > 0) {
              from = (from + ' ' + afterPipe.slice(0, sp2)).trim();
              to = afterPipe.slice(sp2 + 1).trim();
            } else {
              to = afterPipe.trim();
            }
          }
        } else {
          // v119：无 | 时优先按 ") " 切分（起点常为括号地点："绿梦宾馆(重庆江北国际机场店) 重庆..."），
          // 终点也含 ) 时回退中点切分（避免 "A(B) C(D)" 被切成 "A(B) C" / "D)"）
          const cbIdx = addrBody.lastIndexOf(') ');
          if (cbIdx > 0 && !addrBody.slice(cbIdx + 2).includes(')')) {
            from = addrBody.slice(0, cbIdx + 1).trim();
            to = addrBody.slice(cbIdx + 2).trim();
          } else {
            // 按地址中部最近的空格切分（中点后/前均尝试）
            // —— 行 3 类："汉庭酒店(...) 贵阳..." 空格在中点之前
            const mid = Math.floor(addrBody.length / 2);
            let sp = addrBody.indexOf(' ', mid);
            if (sp < 0) sp = addrBody.lastIndexOf(' ', mid); // 往后找不到时往前找
            if (sp > 0) {
              from = addrBody.slice(0, sp).trim();
              to = addrBody.slice(sp + 1).trim();
            } else {
              // 仍无空格：按 ")" 切分（括号内常为起点备注，括号后为终点）
              const cb = addrBody.lastIndexOf(')');
              if (cb > 0 && cb < addrBody.length - 1) {
                from = addrBody.slice(0, cb + 1).trim();
                to = addrBody.slice(cb + 1).trim();
              } else {
                from = addrBody; to = '';
              }
            }
          }
        }
        // v119：剥离滴滴行程单起点垃圾前缀 "线|"（"线|圣泉寺地铁站1B口"→"圣泉寺地铁站1B口"）
        from = from.replace(/^线\|/, '');
        out.push({
          date: (tm[1].length >= 8
            ? tm[1].replace(/[./]/g, '-')
            : (defaultDate ? defaultDate.slice(0, 4) + '-' + tm[1].replace(/[./]/g, '-') : defaultDate)),
          car: cur.car.replace(/\s+/g, ''),   // 车型去空格（"特惠快 车"→"特惠快车"）
          time: timeStr,
          city, from, to,
          km, amount,
        });
      }
      return out;
    }

    // 用 pdf.js 把第一页渲染成缩略图 dataURL（LRU 缓存，v145 上限 60 张）
    async function renderThumb(bytes, id, scale = 0.25) {
      const cached = thumbCacheGet(id);
      if (cached) return cached;
      if (!window.pdfjsLib) return '';
      try {
        const doc = await pdfjsLib.getDocument(pdfOpenParams(bytes.slice())).promise;
        if (!doc.numPages) return '';
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const url = canvas.toDataURL('image/jpeg', 0.85);
        thumbCacheSet(id, url);
        return url;
      } catch (e) {
        console.warn('缩略图生成失败', e);
        return '';
      }
    }

    // ---- 文件读取 ----
    // 用 FileReader 读取，可获取字节级进度（arrayBuffer() 没有 progress 事件）
    function readBytes(file, onProgress) {
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
        fr.onload = () => resolve(new Uint8Array(fr.result));
        fr.onerror = () => reject(fr.error || new Error('读取失败'));
        fr.readAsArrayBuffer(file);
      });
    }

    async function hashBytes(bytes) {
      try {
        if (window.crypto && window.crypto.subtle) {
          const digest = await window.crypto.subtle.digest('SHA-256', bytes);
          return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
        }
      } catch (e) { /* 非安全上下文时退回轻量签名 */ }
      const step = Math.max(1, Math.floor(bytes.length / 16));
      let sample = '';
      for (let i = 0; i < bytes.length; i += step) sample += bytes[i].toString(16);
      return bytes.length + ':' + sample;
    }

    async function ingest(FileListLike, source) {
      const allArr = Array.from(FileListLike);
      const arr = allArr.filter(f => /\.pdf$/i.test(f.name));
      const ignoredNow = allArr.filter(f => !/\.pdf$/i.test(f.name)).map(f => f.name);
      if (ignoredNow.length) ignoredFiles = ignoredFiles.concat(ignoredNow);
      if (arr.length === 0) { toast('文件夹内没有 PDF（图片等非 PDF 文件已忽略）'); return; }
      $('#generate').disabled = true;
      $('#drop').classList.add('busy');
      const launchActive = Launch.isVisible(); // 首次上传（启动场景可见）时走四段动画；工作台二次导入走原进度条
      const kws = parseKws();
      const prog = $('#prog'), fill = $('#progFill'), pct = $('#progPct'), pname = $('#progName');
      const total = arr.length;
      const totalBytes = arr.reduce((s, f) => s + (f.size || 0), 0);
      let done = 0, readBytesTotal = 0;
      const setProg = (cur, mb) => {
        const p = total ? Math.round((done / total) * 100) : 0;
        fill.style.width = p + '%';
        pct.textContent = p + '%';
      document.getElementById('prog').style.setProperty('--prog-bg', Math.min(92, Math.max(8, p)) + '%');
      pct.classList.remove('bump'); void pct.offsetWidth; pct.classList.add('bump');
        pname.textContent = cur ? '正在读取 ' + cur : `已完成 ${done}/${total}`;
        if (mb != null) pname.textContent += ` · ${mb}MB`;
      };
      const setStage = (stage, name, mb) => {
        pname.textContent = name ? `${stage} ${name}` : stage;
        if (mb != null) pname.textContent += ` · ${mb}MB`;
      };
      prog.classList.add('show');
      document.body.classList.add('prog-open');
      setProg('');
      setStage('正在配置PDF相关组件（首次较慢，请稍等）', '');
      // 启动场景：进入 02 上传中（进度环 + 文件飞入）
      if (launchActive) {
        Launch.showUploading(arr.map(f => f.name));
        const sn = document.getElementById('lsStageName');
        if (sn) sn.textContent = '正在配置PDF相关组件（首次较慢，请稍等）';
      }
      try {
        await prepareComponents();
      } catch (e) {
        toast('识别组件加载失败：' + (e && e.message || e), true);
        prog.classList.remove('show');
        document.body.classList.remove('prog-open');
        $('#drop').classList.remove('busy');
        return;
      }
      // 新增计数：循环前 files 长度
      const beforeLen = files.length;
      // v114：并发导入 —— 分派前完成同名预检（同步执行，避免并发下同名竞态），
      // 随后 3 路信号量并行处理；「查重 → files.push」段内无 await 间隔，JS 单线程保证原子性。
      const CONC = 3;
      const pending = [];
      for (const f of arr) {
        if (files.some(x => x.name === f.name)) {
          duplicateFiles.push({ name: f.name, original: f.name, reason: '同名文件已存在' });
          done++; readBytesTotal += f.size || 0; setProg(f.name);
          continue;
        }
        pending.push(f);
      }
      const processOne = async (f) => {
        setProg(f.name);
        try {
          // 读取阶段：按文件字节实时更新整体进度
          const bytes = await readBytes(f, (p) => {
            const overall = total ? (done + p) / total : 0;
            fill.style.width = (overall * 100).toFixed(1) + '%';
            pct.textContent = Math.round(overall * 100) + '%';
      document.getElementById('prog').style.setProperty('--prog-bg', Math.min(92, Math.max(8, Math.round(overall * 100))) + '%');
            const mb = ((readBytesTotal + (f.size || 0) * p) / 1048576).toFixed(1);
            pname.textContent = `正在读取 ${f.name} · ${mb}MB`;
            if (launchActive) Launch.updateProgress(overall * 100, f.name, mb);
          });
          readBytesTotal += f.size || 0;
          setStage('正在识别', f.name);
          if (launchActive) Launch.showProcessing(f.name);
          const hash = await hashBytes(bytes);
          const duplicate = files.find(x => x.hash === hash);
          if (duplicate) {
            duplicateFiles.push({ name: f.name, original: duplicate.name, reason: '内容与已导入文件相同' });
            return;
          }
          let w = 0, h = 0, pages = 0, text = '', content = null, analyzeError = '';
          try {
            const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const pg = doc.getPages();
            pages = pg.length;
            if (pages > 0) { const s = pg[0].getSize(); w = s.width; h = s.height; }
          } catch (e) { /* 暂记为无法解析 */ }
          // 分析票面：单次解析 pipeline 一次产出文字 / 包围盒 / 二维码（v114）
          const ana = await analyzePdf(bytes);
          text = ana.text; content = ana.content; analyzeError = ana.error || '';
          const type = classifyInvoice(text);
          let train = type === 'train';
          // v18：文字提取失败或票面无类别信号时，用版式兜底识别火车票——
          // 横版长条票（宽/高 > 2.5 且内容高 < 10cm）判定为火车票（自动加印 + 豁免旋转）
          // v126：仅对原始分类为「未识别(other)」的票兜底！此前用 type!=='itinerary' 排除，
          // 但滴滴/T3/阳光行程单 classifyInvoice 命中网约车规则返回 ridehail（规则3 在规则6 行程单之前），
          // 横版行程单红框宽高比>2.5 且高<10cm → 被误判为火车票 → 加印双份 + 豁免裁剪 + 不旋转 → 压成极小。
          if (!train && type === 'other') {
            const c0 = content && content[0];
            const pw = c0 ? c0.wCm : (w / PT_PER_CM);
            const ph = c0 ? c0.hCm : (h / PT_PER_CM);
            if (ph > 0 && pw / ph > 2.5 && ph < 10) train = true;
          }
          const amt = parseAmount(text);
          // 二维码识别：数据直接来自 ana.qrs（与文字/包围盒同一次解析，不再二次解析 PDF）
          let qrAmount = null, qrInvoice = false, qrRaw = '';
          try {
            for (const q of ana.qrs || []) {
              const p = parseQRText(q);
              if (p.isInvoice) qrInvoice = true;
              if (p.amount != null && qrAmount == null) qrAmount = p.amount;
              if (!qrRaw) qrRaw = q.slice(0, 120);
            }
          } catch (e) { /* 二维码解码失败不影响主流程 */ }
          // 特殊归类 1：网约车/出租车若二维码非发票 + 文字含"行程单/报销凭证"，则归到行程单
          // （如滴滴出行-行程单属于报销凭证而非发票，金额不应计入发票总额）
          // v126：不再要求"二维码无金额"——滴滴行程单上的推广二维码可能解析出金额，
          // 只要二维码不是发票二维码（qrInvoice=false）且文字含行程单特征，就归行程单，
          // 避免 finalType 停留在 ridehail → 行程明细丢失/版式异常。
          let finalType = (qrInvoice && type === 'other') ? 'invoice' : type;
          if (!qrInvoice && (finalType === 'ridehail' || finalType === 'taxi') && /行程单|报销凭证|journey/.test(text)) {
            finalType = 'itinerary';
          }
          // 特殊归类 2：二维码确认为发票 + 文字含"发票/电子发票/增值税"等特征，强制升级为发票
          // 修复：被"出租车/打车"等关键词误判为 ridehail 的出租车发票场景
          // v95：ridehail 不再被强制改回——网约车平台电子发票（滴滴出行等，含税务二维码）
          // 是出行服务发票，应保留在「公共交通与网约车发票」分区
          if (qrInvoice && /发票|增值税|电子发票|价税合计|普通发票|专用发票/.test(text) &&
              finalType === 'other') {
            finalType = 'invoice';
          }
          const finalAmount = (qrAmount != null) ? qrAmount : amt.amount;
          const date = extractDate(text, f.name);
          // 行程单解析多条行程明细（网约车时间线用）；高德格式需要 item 级坐标切分
          const trips = (finalType === 'itinerary') ? parseTrips(text, date, ana.cells) : [];
          const contentSignature = [
            pages,
            Math.round(w * 10) / 10,
            Math.round(h * 10) / 10,
            (text || '').replace(/\s+/g, '').slice(0, 1200),
            qrRaw || ''
          ].join('|');
          const duplicateByContent = files.find(x => x.contentSignature === contentSignature && x.name !== f.name);
          if (duplicateByContent) {
            duplicateFiles.push({ name: f.name, original: duplicateByContent.name, reason: '内容与已导入文件相同' });
            return;
          }
          const rec = {
            id: ++idSeq, name: f.name, bytes, hash, contentSignature, w, h, pages, text, content, analyzeError,
            train,
            date,
            trips,                                    // 多条行程明细（网约车时间线渲染用）
            docType: finalType,
            amount: finalAmount,
            upper: amt.upper,
            qrAmount,
            include: true, error: pages === 0
          };
          files.push(rec);
          // 调试：在控制台输出识别到的文字片段、金额、行程明细，便于排查
          console.log(`[${f.name}] 类型:${finalType} 文字:`, text.slice(0, 500).replace(/\s+/g, ' ') || '(空)',
            '| 金额:', finalAmount, amt.upper ? '| 大写:' + amt.upper : '',
            qrAmount != null ? `| 二维码金额:${qrAmount}` : (qrRaw ? `| 二维码(未解析出金额):${qrRaw}` : ''),
            qrInvoice ? '| 二维码:是发票' : '',
            trips.length ? `| 行程×${trips.length}: ` + trips.map(t => `${t.car}/${t.time}/${t.km}km/${t.amount}元`).join(' | ') : (finalType === 'itinerary' ? '| 行程单未识别明细' : ''),
            analyzeError ? `错误:${analyzeError}` : '');
        } catch (e) {
          toast('读取失败：' + f.name);
        }
      };
      // 3 路并发 worker
      let cursor = 0;
      const worker = async () => {
        while (true) {
          const i = cursor++;
          if (i >= pending.length) break;
          const f = pending[i];
          try { await processOne(f); }
          finally { done++; setProg(f.name); }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONC, pending.length) }, () => worker()));
      // 收尾：100% 后淡出进度条，恢复拖拽区
      done = total; setProg('');
      prog.classList.remove('show');
      document.body.classList.remove('prog-open');
      setTimeout(() => { fill.style.width = '0%'; }, 400); // 等淡出结束后再归零，避免填充条突兀缩回
      $('#drop').classList.remove('busy');
      // 提示可能未识别到的文件
      const unsure = files.filter(f => !f.train && !f.error && (!f.text || f.text.length < 10));
      if (unsure.length) {
        toast(`${unsure.length} 个文件未提取到有效文字，若含火车票请手动开启“火车票”开关`);
      }
      // 导入成功后：新增文件数 > 0 → 隐藏拖入卡片，显示时间线/文件信息/fabbar
      const newCount = files.length - beforeLen;
      function enterWorkbench() {
        // v9：上传后自动隐藏拖入卡（继续添加可用窗口拖放；清空后恢复）——带淡出上滑动画
        const _dropCard = $('#dropCard');
        const _header = document.querySelector('header.app');
        _dropCard.classList.add('dropCard-hide');
        if (_header) { _header.classList.add('dropCard-hide'); }
        setTimeout(() => {
          _dropCard.classList.add('hidden');
          _dropCard.classList.remove('dropCard-hide');
          if (_header) { _header.classList.add('hidden'); _header.classList.remove('dropCard-hide'); }
        }, 400);
        $('#timelineCard').classList.remove('hidden');
        $('#fileInfoCard').classList.remove('hidden');
        $('#fabbar').classList.remove('hidden');
      }
      if (newCount > 0) {
        const ignoredText = ignoredFiles.length ? `忽略非PDF：${ignoredFiles.join('、')}` : '没有非PDF文件被忽略';
        toast(`已导入 ${files.length} 个 PDF\n重复跳过 ${duplicateFiles.length} 个\n${ignoredText}`, false, 3250);
        if (launchActive) {
          // 04 完成：弹性打勾 + 真实汇总 → 渐变动画自动进入工作台（不需要点击）
          Launch.showComplete(files);
          setTimeout(() => { enterWorkbench(); Launch.hide(); }, 1700);
        } else {
          enterWorkbench();
        }
      } else if (launchActive) {
        // 全部为重复文件：不播完成动画，直接进入工作台
        Launch.hide();
        enterWorkbench();
      }
      render();
      updateGenerateBtn();
      updateTimeline();
    }

    // 文件夹 / 拖拽的目录遍历
    function readEntry(entry) {
      return new Promise((resolve) => {
        if (entry.isFile) {
          entry.file(file => resolve([file]));
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const all = [];
          const readBatch = () => reader.readEntries(async (ents) => {
            if (!ents.length) {
              let flat = [];
              for (const sub of all) flat = flat.concat(sub);
              resolve(flat);
            } else {
              const res = ents.map(e => readEntry(e));
              const r = await Promise.all(res);
              all.push(...r);
              readBatch();
            }
          });
          readBatch();
        } else resolve([]);
      });
    }

    async function handleDrop(dt) {
      let collected = [];
      if (dt.items && dt.items.length && dt.items[0].webkitGetAsEntry) {
        const entries = [];
        for (const it of dt.items) {
          const e = it.webkitGetAsEntry && it.webkitGetAsEntry();
          if (e) entries.push(e);
        }
        if (entries.length) {
          const nested = await Promise.all(entries.map(readEntry));
          collected = nested.flat();
        }
      }
      if (!collected.length && dt.files && dt.files.length) {
        collected = Array.from(dt.files);
      }
      if (collected.length) ingest(collected, 'drop');
    }

    // ---- 渲染列表 ----
    // 内联 SVG 图标（tabler 风格 path，MIT，stroke 1.5；无构建环境，内联复用标准图标库 path）
    const ICON_RECEIPT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v18l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5V3l-2 1.5-2-1.5-2 1.5L9 3 7 4.5 5 3z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';
    const ICON_PLANE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>';
    const ICON_FILE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>';
    const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    const ICON_ALERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
    const ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

    function buildRow(f, threshold, idx) {
      const row = document.createElement('div');
      row.className = 'file-card';  // v83：卡片式
      row.style.setProperty('--idx', idx || 0);

      // v125：无文字票据显示「未识别」徽章，并提供「标为火车票」按钮（矢量转曲票/扫描票无法提取文字时手动归类）
      const noText = !f.text || f.text.length < 10;
      const manualTrain = !!trainOverride[f.name];
      const warn = (!f.error && !f.train && !manualTrain && noText)
        ? '<span class="badge err" title="未提取到文字（可能为矢量转曲票/扫描票）">未识别</span>'
        : '';
      const trainBtn = (noText && !f.error)
        ? `<button class="train-btn" data-act="train" title="${manualTrain ? '已标记为火车票，点击取消' : '文字提取失败，标记为火车票（加印双份）'}" style="${manualTrain ? 'background:#10B981;border-color:#10B981;color:#fff' : ''}">${manualTrain ? '火车票 ✓' : '标为火车票'}</button>`
        : '';
      // 金额（大小写）：优先用票面大写，否则由小写金额生成；二维码识别金额时标注来源
      const amtLower = (f.amount != null) ? '¥' + f.amount.toFixed(2) : '-';
      const amtUpper = (f.upper || (f.amount != null ? numToChinese(f.amount) : ''));
      const amountStr = `<span class="amt" title="小写 ${amtLower}${amtUpper ? ' / 大写 ' + amtUpper : ''}">${amtLower}</span>`;
      const catMap = {
        train:    { cls: 'cat-train',    label: '火车票',   color: '#10B981' },
        flight:   { cls: 'cat-flight',   label: '机票',     color: '#3B82F6' },
        itinerary:{ cls: 'cat-itinerary',label: '行程单',   color: '#14B8A6' },
        ridehail: { cls: 'cat-ridehail', label: '网约车',   color: '#14B8A6' },
        transit:  { cls: 'cat-transit',  label: '公共交通', color: '#14B8A6' },
        hotel:    { cls: 'cat-hotel',    label: '住宿',     color: '#8B5CF6' },
        meal:     { cls: 'cat-meal',     label: '餐饮',     color: '#F59E0B' },
        invoice:  { cls: 'cat-invoice',  label: '发票',     color: '#3B82F6' },
        other:    { cls: 'cat-other',    label: '其他',     color: '#6E8296' }
      };
      const cat = catMap[f.docType || 'other'];
      const catBadge = `<span class="badge ${cat.cls}">${cat.label}</span>`;
      // 行程单显示日期标签（按日期排序时的视觉锚点）
      const dateTag = (f.docType === 'itinerary' && f.date) ? `<span class="meta-date">${f.date}</span>` : '';

      // v121：文件名显示隐藏 .pdf 后缀（悬浮 title 保留全名）
      const dispName = f.name.replace(/\.pdf$/i, '');
      // v83：行式 → 卡片横向排布；发票金额明细隐藏，只保留规格与类别
      row.innerHTML = `
        <div class="fc-head">
          <div class="row-check ${f.include ? 'on' : ''}" data-act="include" data-cat="${f.docType || 'other'}" style="--cat-color:${cat.color}" title="${f.include ? '包含' : '未选中'}"></div>
          <div class="fc-name" title="${escapeHtml(f.name)}">${escapeHtml(dispName)}</div>
          <span class="amt" style="color:${cat.color}" title="${amtLower}${amtUpper ? ' / 大写 ' + amtUpper : ''}">${amtLower}</span>
        </div>
        ${trainBtn ? `<div class="fc-actions">${trainBtn}${warn}</div>` : (warn ? `<div class="fc-actions">${warn}</div>` : '')}
      `;

      // v115：勾选改为无障碍 checkbox（键盘可用：空格/回车切换）
      const checkEl = row.querySelector('[data-act="include"]');
      checkEl.setAttribute('role', 'checkbox');
      checkEl.setAttribute('aria-checked', String(f.include));
      checkEl.setAttribute('tabindex', '0');
      const toggleInclude = () => {
        const wasOn = f.include;
        f.include = !f.include;
        checkEl.setAttribute('aria-checked', String(f.include));
        checkEl.classList.toggle('on', f.include);
        checkEl.title = f.include ? '包含' : '未选中';
        if (wasOn) toast('已取消选中，未选中的发票将不予合并打印');
        render(); updateGenerateBtn();
      };
      checkEl.onclick = toggleInclude;
      checkEl.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleInclude(); }
      });

      // v125：无文字票据「标为火车票」——trainOverride 此前从未被赋值（无 UI），
      // 矢量转曲票/扫描票无法提取文字时无法归类；现在一键标记，合并时加印双份。
      const trainBtnEl = row.querySelector('[data-act="train"]');
      if (trainBtnEl) {
        trainBtnEl.addEventListener('click', (e) => {
          e.stopPropagation();
          trainOverride[f.name] = !trainOverride[f.name];
          f.train = !!trainOverride[f.name];
          toast(trainOverride[f.name] ? '已标记为火车票（合并时加印双份）' : '已取消火车票标记');
          render();
        });
      }

      // 鼠标悬浮预览第一页缩略图
      row.addEventListener('mouseenter', () => showPreviewFor(f, row));
      row.addEventListener('mouseleave', hidePreview);
      return row;
    }

    // v95：按细类目分区；行程单并入「公共交通与网约车发票」作子标题。空分区常驻显示。
    const SECTIONS = [
      { key: 'train',     title: '火车票',             icon: ICON_RECEIPT, color: '#10B981', types: new Set(['train']) },
      { key: 'flight',    title: '机票',               icon: ICON_PLANE,   color: '#3B82F6', types: new Set(['flight']) },
      { key: 'public',    title: '公共交通与网约车发票', icon: ICON_PLANE,   color: '#14B8A6', types: new Set(['ridehail', 'transit', 'itinerary']) },
      { key: 'hotel',     title: '住宿',               icon: ICON_FILE,    color: '#8B5CF6', types: new Set(['hotel']) },
      { key: 'meal',      title: '餐饮',               icon: ICON_FILE,    color: '#F59E0B', types: new Set(['meal']) },
      { key: 'invoice',   title: '通用发票',           icon: ICON_FILE,    color: '#3B82F6', types: new Set(['invoice']) },
      { key: 'other',     title: '其他发票',           icon: ICON_FILE,    color: '#6E8296', types: new Set(['other']) }
    ];

    function render() {
      // 记录当前各分区展开状态（勾选/删除等触发 render 时保持折叠状态不丢失）
      const expandedKeys = new Set();
      document.querySelectorAll('.list-section[data-sec]').forEach(s => {
        if (!s.classList.contains('collapsed')) expandedKeys.add(s.getAttribute('data-sec'));
      });
      // 小发票阈值固定 14cm（A4 默认 14+ 独占，火车票固定 1 页两张）；原页面顶部设置项已去除
      const threshold = 14 * PT_PER_CM;
      listEl.innerHTML = '';
      // v121：统计「X 张发票，X 张非发票」——发票=可计入金额的类别（火车票/机票/网约车/公共交通/住宿/餐饮/通用发票），
      // 非发票=行程单（报销凭证）与其他
      const INV_DOC_TYPES = new Set(['train', 'flight', 'ridehail', 'transit', 'hotel', 'meal', 'invoice']);
      const invCount = files.filter(f => INV_DOC_TYPES.has(f.docType || 'other')).length;
      const nonInvCount = files.length - invCount;
      if (files.length === 0) {
        listEl.appendChild(emptyEl);
        emptyEl.style.display = '';
        $('#count').textContent = '0 张发票，0 张非发票';
        return;
      }
      emptyEl.style.display = 'none';
      $('#count').textContent = invCount + ' 张发票，' + nonInvCount + ' 张非发票';

      // 按分区依次渲染；v96：分区默认折叠，空分区隐藏（无票据的标签不显示）
      for (const sec of SECTIONS) {
        let list = files.filter(f => sec.types.has(f.docType || 'other'));
        if (list.length === 0) continue;  // 空分区隐藏
        // 行程单子组按票面日期升序（无日期排最后）
        const sortByDate = (arr) => arr.slice().sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.localeCompare(b.date);
        });
        // 行程单与「其他」不计入总金额；其余类目分区显示小计（行程单金额单独统计）
        // v131：分区小计过滤勾选（f.include）——取消勾选发票后分区小计与总金额同步扣减
        const showSum = (sec.key !== 'other');
        const sumList = list.filter(f => f.include && f.docType !== 'itinerary');
        const sum = showSum ? sumList.reduce((s, f) => s + (f.amount || 0), 0) : 0;
        const sumStr = showSum && sumList.some(f => f.amount != null)
          ? `<b style='color:${sec.color}'>¥${sum.toFixed(2)}</b>` : '';

        const wrap = document.createElement('div');
        wrap.className = 'list-section' + (expandedKeys.has(sec.key) ? '' : ' collapsed');
        wrap.setAttribute('data-sec', sec.key);
        const head = document.createElement('div');
        head.className = 'list-section-head';
        head.title = '点击收起 / 展开';
        head.innerHTML = `
          <div class="title"><span class="v3-dot" style="background:${sec.color}"></span>${sec.title}</div>
          <div class="meta">${list.length} 个${sumStr ? ' · ' + sumStr : ''}<span class="caret">${ICON_CHEVRON}</span></div>
        `;
        head.addEventListener('click', () => {
          wrap.classList.toggle('collapsed');
        });
        const body = document.createElement('div');
        body.className = 'list-section-body file-grid';  // v83：行式 → 卡片网格横向排布
        if (sec.key === 'public') {
          // v95：网约车/公共交通票据在前；行程单为子组（子标题「行程单」）
          const norm = list.filter(f => f.docType !== 'itinerary');
          const iti = sortByDate(list.filter(f => f.docType === 'itinerary'));
          norm.forEach((f, i) => body.appendChild(buildRow(f, threshold, i)));
          if (iti.length) {
            const sub = document.createElement('div');
            sub.className = 'sec-subtitle';
            sub.textContent = '行程单';
            body.appendChild(sub);
            iti.forEach((f, i) => body.appendChild(buildRow(f, threshold, norm.length + i)));
          }
        } else {
          list.forEach((f, i) => body.appendChild(buildRow(f, threshold, i)));
        }
        wrap.appendChild(head);
        wrap.appendChild(body);
        listEl.appendChild(wrap);
      }
    }

    function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

    // 悬浮预览控制
    let previewTimer = null;
    function showPreviewFor(f, rowEl) {
      const pop = $('#previewPop');
      const img = $('#previewImg');
      const tip = $('#previewTip');
      pop.classList.add('show');
      img.style.opacity = '0.4';
      tip.textContent = '正在生成预览…';
      // v153：预览改为视口右下角固定定位（由 CSS .preview-pop 控制），避免 hover 列表底部行时下方不可见
      clearTimeout(previewTimer);
      previewTimer = setTimeout(async () => {
        // v146：悬浮缩略图延迟到空闲期渲染——快速划过多个卡片时（鼠标扫过整列）
        // 逐个排队渲染会占用大量主线程；requestIdleCallback 让浏览器在空闲帧才生成，
        // 配合 thumbCache LRU（v145），既省内存又避免导入大目录时悬浮预览卡顿。
        const doRender = async () => {
          const url = await renderThumb(f.bytes, f.id, 0.8);  // v89：渲染分辨率 0.5→0.8，超采样显示更清晰
          if (url) {
            img.src = url;
            img.style.opacity = '1';
            tip.textContent = `${f.name.replace(/\.pdf$/i, '')}`;
          } else {
            img.src = '';
            tip.textContent = '预览生成失败';
          }
        };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(doRender, { timeout: 2000 });
        else doRender();
      }, 120);
    }
    function hidePreview() {
      clearTimeout(previewTimer);
      $('#previewPop').classList.remove('show');
    }

    function updateGenerateBtn() {
      const usable = files.filter(f => f.include && !f.error);
      $('#generate').disabled = usable.length === 0;
      // v131：「下载分类文件夹」仅合并成功后显示（mergedOnce）；清空/全部取消勾选时隐藏重置
      const _dz = $('#dlZip');
      if (_dz) {
        if (mergedOnce && usable.length > 0) { _dz.classList.remove('hidden'); _dz.disabled = false; }
        else { _dz.classList.add('hidden'); _dz.disabled = true; }
      }
      const summary = $('#summary');

      // v116：合并成功后保持「生成合并 PDF」隐藏；全部取消勾选/清空时重置，恢复生成按钮
      const _gen = $('#generate');
      if (mergedOnce && usable.length > 0) {
        _gen.classList.add('hidden');
      } else if (usable.length === 0) {
        mergedOnce = false;
        _gen.classList.remove('hidden');
      }

      if (usable.length === 0) {
        summary.innerHTML = '<div class="summary-empty">还没有可合并的文件</div>';
        return;
      }

      const trainCount = usable.filter(f => f.train).length;
      const itineraryCount = usable.filter(f => f.docType === 'itinerary').length;
      const transitCount = usable.filter(f => f.docType === 'transit').length;
      // 计入总金额的类别：火车票 / 机票 / 网约车 / 公共交通 / 住宿 / 餐饮 / 通用发票
      // 行程单（报销凭证）与其他非发票不计入
      const amountCategories = new Set(['train', 'flight', 'ridehail', 'transit', 'hotel', 'meal', 'invoice']);
      const invoiceFiles = usable.filter(f => amountCategories.has(f.docType));
      const unknownAmtCount = invoiceFiles.filter(f => f.amount == null).length;
      const totalAmount = invoiceFiles.reduce((sum, f) => sum + (f.amount || 0), 0);

      // 仅展示金额合计；文件数说明已移除（点击生成时通过 toast 提示）
      let html = '';

      // 第一行：大字金额合计 + 大写
      if (invoiceFiles.length) {
        html += `<div class="total"><span class="amt">¥${totalAmount.toFixed(2)}</span></div>`;
      }
      if (unknownAmtCount) {
        html += `<div class="warn">${ICON_ALERT}${unknownAmtCount} 张发票金额未识别</div>`;
      }

      summary.innerHTML = html;
    }

    // ---- 网约车时间线：仅识别行程单，按行程明细逐行展示 ----
    // 行程列：起点 / 终点 合并，中间以 → 连接（无终点只显示起点）
    function routeCell(t) {
      const fRaw = (t.from || '-').replace(/\s+/g, '');
      const tRaw = (t.to || '').replace(/\s+/g, '');
      const from = escapeHtml(fRaw);
      const to = escapeHtml(tRaw);
      if (!to || to === '-') return `<span class="route"><span class="route-fa">${from}</span></span>`;
      return `<span class="route"><span class="route-fa">${from} → </span><span class="route-to">${to}</span></span>`;
    }

    function updateTimeline() {
      const usable = files.filter(f => f.include && !f.error);
      const countEl = $('#timelineCount');
      const timelineEl = $('#timeline');
      if (usable.length === 0) {
        countEl.textContent = '0 段行程';
        timelineEl.innerHTML = '<div class="tl-empty">导入行程单后，按行程逐条展示</div>';
        return;
      }
      const itineraryFiles = usable.filter(f => f.docType === 'itinerary');
      if (itineraryFiles.length === 0) {
        countEl.textContent = '0 段行程';
        timelineEl.innerHTML = '<div class="tl-empty">未识别到任何行程单</div>';
        return;
      }
      // 汇总所有行程，按 date 升序
      const allTrips = [];
      for (const f of itineraryFiles) {
        if (f.trips && f.trips.length) {
          for (const t of f.trips) allTrips.push(t);
        } else if (f.date) {
          // 未解析出明细行程：退化为单行摘要（保持总段数合理）
          allTrips.push({
            date: f.date,
            car: '行程单',
            time: '',
            city: '',
            from: '',
            to: '',
            km: null,
            amount: null,
          });
        }
      }
      if (allTrips.length === 0) {
        countEl.textContent = '0 段行程';
        timelineEl.innerHTML = '<div class="tl-empty">未从行程单中识别到任何行程</div>';
        return;
      }
      allTrips.sort((a, b) => {
        const da = a.date || '', db = b.date || '';
        const ta = (a.time || '').split(' ').pop() || '', tb = (b.time || '').split(' ').pop() || '';
        return da.localeCompare(db) || ta.localeCompare(tb);
      });
      const groups = [];
      allTrips.forEach((t) => {
        const d = t.date || '-';
        const last = groups[groups.length - 1];
        if (!last || last.date !== d) groups.push({ date: d, trips: [t] });
        else last.trips.push(t);
      });

      function weekdayLabel(dateStr) {
        if (!dateStr || dateStr === '-') return '';
        const full = dateStr.length >= 10 ? dateStr : new Date().getFullYear() + '-' + dateStr;
        const d = new Date(full);
        if (isNaN(d.getTime())) return '';
        return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
      }

      timelineEl.innerHTML = `<div class="tl-timeline-new">${groups.map((g) => {
        const displayDate = (g.date || '-').length >= 10 ? g.date.slice(5) : g.date || '-';
        const cards = g.trips.map((t) => `
          <div class="tl-trip-card" data-day="${escapeHtml(g.date)}">
            <div class="tl-trip-time">${escapeHtml(((t.time || '').split(' ').pop()) || '-')}</div>
            <div class="tl-trip-route">${routeCell(t)}</div>
            <div class="tl-trip-amount">${t.amount != null ? '¥' + t.amount.toFixed(2) : '-'}</div>
          </div>
        `).join('');
        return `
          <div class="tl-day-group" data-day="${escapeHtml(g.date)}">
            <div class="tl-day-meta">
              <div class="tl-day-date">${escapeHtml(displayDate)}</div>
              <div class="tl-day-week">${escapeHtml(weekdayLabel(g.date))}</div>
              <div class="tl-axis"><span class="tl-axis-node"></span></div>
            </div>
            <div class="tl-day-cards">${cards}</div>
          </div>
        `;
      }).join('')}</div>`;
      const tripSum = allTrips.reduce((s, t) => s + (t.amount || 0), 0);
      countEl.textContent = `共 ${allTrips.length} 笔 · 小计 ¥${tripSum.toFixed(2)}`;
    }

    // ---- 生成 ----
    async function generate() {
      const usable = files.filter(f => f.include && !f.error);
      if (usable.length === 0) { toast('没有可合并的文件'); return; }
      $('#generate').disabled = true;
      toast('正在合并 ' + usable.length + ' 个文件…');
      try {
        await ensurePdfLib();
        // 依赖检查：从完整站点打开时 PDFLib 一定存在；缺失说明打开了不完整副本
        if (typeof PDFDocument === 'undefined' || typeof mergeInvoices === 'undefined') {
          toast('合并库未加载：请从完整站点（combined-apps 或 oreo-workstation）打开本页面', true);
          $('#generate').disabled = false;
          return;
        }
        // 全部票据强制两联拼版（长票自动旋转 90° 适配 A4，火车票保持上下排布）；marginMm 固定 8mm
        // v131：行程单（报销凭证）默认排序到最后再打印——稳定排序，其余类别保持勾选顺序
        const thresholdCm = 14;
        const marginMm = 8;
        const sortedUsable = usable
          .map(f => ({ f, iti: (f.docType === 'itinerary') ? 1 : 0 }))
          .sort((a, b) => a.iti - b.iti)
          .map(o => o.f);
        const input = sortedUsable.map(f => ({ name: f.name, bytes: f.bytes, train: f.train, content: f.content, type: f.docType }));
        const merged = await mergeInvoices(PDFDocument, input, {
          thresholdCm, marginMm,
          forceTwoUp: true,
          isTrain: (name) => (name in trainOverride ? trainOverride[name] : fallbackDetect(name))
        });
        if (!merged) { toast('合并结果为空'); return; }
        if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
        lastBlobUrl = URL.createObjectURL(new Blob([merged], { type: 'application/pdf' }));
        $('#preview').src = lastBlobUrl;
        $('#resultCard').style.display = '';
        $('#resultCard').scrollIntoView({ behavior: 'smooth' });
        const outDoc = await PDFDocument.load(merged);
        const _dlName = (uploadFolderName ? uploadFolderName + '_合并发票' : '合并发票') + '_' + new Date().toISOString().slice(0,10) + '.pdf';
        const _dlEl = $('#dlName'); if (_dlEl) _dlEl.textContent = _dlName;
        toast('可在 PDF 组件窗口右上角点击图标网页打印\n合并完成：共 ' + outDoc.getPageCount() + ' 页 A4', false, 4200);
        const _dm = $('#dlMerged'); if (_dm) { _dm.disabled = false; _dm.classList.remove('hidden'); }
        // v116：合并成功后隐藏「生成合并 PDF」——已生成的结果直接下载即可，无需再次生成
        mergedOnce = true;
        const _gen = $('#generate'); if (_gen) _gen.classList.add('hidden');
      } catch (e) {
        console.error(e);
        toast('合并出错：' + (e.message || e), true);
        // 错误详情可视化：页面显示完整错误信息，便于排查
        var errBox = document.getElementById('mergeErrBox');
        if (!errBox) {
          errBox = document.createElement('div');
          errBox.id = 'mergeErrBox';
          errBox.style.cssText = 'margin:10px 0;padding:10px 14px;border:1px solid rgba(210,65,14,.4);border-radius:10px;background:rgba(210,65,14,.06);font-size:12px;color:#B93A0C;font-family:Consolas,monospace;white-space:pre-wrap;word-break:break-all;';
          var rc = document.getElementById('resultCard');
          (rc ? rc.parentNode : document.body).appendChild(errBox);
        }
        errBox.textContent = '合并出错: ' + (e && e.message || e) + (e && e.stack ? '\n' + e.stack.split('\n').slice(0, 3).join('\n') : '');
      } finally {
        updateGenerateBtn();
      }
    }

    function download() {
      if (!lastBlobUrl) return;
      const a = document.createElement('a');
      a.href = lastBlobUrl;
      const _d = new Date().toISOString().slice(0,10);
      a.download = (uploadFolderName ? uploadFolderName + '_合并发票' : '合并发票') + '_' + _d + '.pdf';
      document.body.appendChild(a); a.click(); a.remove();
    }

    // v97：按文件信息分类打包 zip（STORE 未压缩），行程单在公共交通分类下建子目录
    async function downloadZip() {
      const usable = files.filter(f => f.include && !f.error);
      if (!usable.length) { toast('没有可打包的文件', true); return; }
      const JSZipCtor = await ensureJSZip();
      if (!JSZipCtor) { toast('打包库未加载，请从完整站点打开', true); return; }
      toast('正在打包分类文件夹…');
      const zip = new JSZipCtor();
      // 只创建有文件的类目目录：按 类目+子目录 分组，空类目不生成
      const groups = new Map();
      usable.forEach(f => {
        const sec = SECTIONS.find(s => s.types.has(f.docType || 'other')) || SECTIONS[SECTIONS.length - 1];
        const sub = (f.docType === 'itinerary') ? '行程单' : '';
        const gk = sec.key + '|' + sub;
        if (!groups.has(gk)) groups.set(gk, { path: sub ? sec.title + '/' + sub : sec.title, files: [] });
        groups.get(gk).files.push(f);
      });
      groups.forEach(g => {
        const folder = zip.folder(g.path);
        g.files.forEach(f => folder.file(f.name, f.bytes));
      });
      const _d = new Date().toISOString().slice(0,10);
      zip.generateAsync({ type: 'array', compression: 'STORE' }).then(arr => {
        // JSZip type:'array' 返回普通数组，必须转 Uint8Array 再 Blob（否则十进制化损坏）
        const u8 = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
        const blob = new Blob([u8], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '已整理发票_' + _d + '.zip';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast('分类文件夹已下载');
      }).catch(e => toast('打包失败: ' + (e && e.message || e), true));
    }

    // ---- 上传入口收敛：选择文件夹 / 选择 PDF（多处复用同一逻辑） ----
    const openFolderPicker = () => $('#folderInput').click();
    const openFilePicker = () => $('#fileInput').click();

    // ---- 启动场景事件（方案一：拖拽悬停高亮 + 上传按钮） ----
    const lsUpload = document.getElementById('lsUpload');
    if (lsUpload) {
      lsUpload.onclick = (e) => {
        if (e.target.closest('button')) return;
        openFolderPicker();
      };
      ['dragenter','dragover'].forEach(ev => lsUpload.addEventListener(ev, (e) => { e.preventDefault(); lsUpload.classList.add('drag'); }));
      ['dragleave','drop'].forEach(ev => lsUpload.addEventListener(ev, (e) => { e.preventDefault(); lsUpload.classList.remove('drag'); }));
      // drop 时阻断冒泡，避免 window drop 二次触发 handleDrop；导入统一走 handleDrop
      lsUpload.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); handleDrop(e.dataTransfer); });
    }
    const lsPickFolder = document.getElementById('lsPickFolder');
    const lsPickFiles = document.getElementById('lsPickFiles');
    if (lsPickFolder) lsPickFolder.onclick = (e) => { e.stopPropagation(); openFolderPicker(); };
    if (lsPickFiles) lsPickFiles.onclick = (e) => { e.stopPropagation(); openFilePicker(); };

    // ---- 事件绑定 ----
    $('#pickFolder').onclick = openFolderPicker;
    $('#pickFiles').onclick = openFilePicker;
    $('#folderInput').onchange = (e) => {
      const fs = e.target.files;
      uploadFolderName = (fs && fs.length && fs[0].webkitRelativePath) ? fs[0].webkitRelativePath.split('/')[0] : '';
      ingest(fs, 'folder');
    };
    $('#fileInput').onchange = (e) => ingest(e.target.files, 'files');

    const drop = $('#drop');
    // 点击卡片空白处打开文件夹选择；点击内部按钮（选择文件夹/选择 PDF）时事件会冒泡到这里，
    // 必须跳过，否则会再次触发 folderInput.click() 导致弹两次窗口
    drop.onclick = (e) => {
      if (e.target.closest('button')) return;
      openFolderPicker();
    };
    ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => handleDrop(e.dataTransfer));

    // 全窗口拖放也能接收
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => { e.preventDefault(); if (e.target === drop) return; handleDrop(e.dataTransfer); });

    $('#generate').onclick = generate;
    $('#download').onclick = download;
    $('#dlMerged').onclick = () => {
      if (!lastBlobUrl) { toast('请先点击「生成合并 PDF」', true); return; }
      download();
    };
    $('#dlZip').onclick = downloadZip;
    updateGenerateBtn();
    updateTimeline();
    // v146：组件预热延迟到空闲期（requestIdleCallback）——避开首屏关键渲染期下载 pdf-lib/jsqr（781KB），
    // 用户开始导入时再按需加载（ingest 内 prepareComponents 有 promise 复用，延迟不阻塞导入）。
    function whenIdle(fn) {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 3000 });
      else setTimeout(fn, 0);
    }
    whenIdle(() => prepareComponents().catch(() => {}));
  