/* ============================================================
   跨屏联动共享层（linkage）
   单一来源，消除 screen1.js 与 window2.js 的重复实现（P1-3 / P1-4）：

   · EV_LABEL / EV_KEY_KINDS        事件类型 → 中文标签 / 关键事件类型集合
   · routeRole / normalizeTitle     派发语义路由（原先两页各一份，逐字重复）
   · RE_TASK_VERB / RE_GREET / …    意图判定正则
   · isDispatch                     是否按「派发指令」而非对话处理
   · dedupeEventRows                事件流降噪（关键事件限量 + 同指标合并 ×N）
   · renderEventRows                事件流行 DOM 生成（两页共用同一套类名结构）
   ============================================================ */

export const EV_LABEL = {
  order: '受理',
  settle: '归档',
  done: '交付',
  risk: '风险',
  dispatch: '派发',
  mode: '模板',
  info: '动态'
};

/* 关键事件类型：优先占位，不参与同指标合并 */
export const EV_KEY_KINDS = new Set(['order', 'settle', 'done', 'risk', 'dispatch', 'mode']);

/* ---------------- 派发语义路由 ---------------- */
export const RE_ROLE_AT = /@(视觉设计|内容撰写|数据分析|规划协调|工程开发)/;
export const RE_TASK_VERB = /(发布|派发|下达|完成|修订|修复|优化|整理|分析|设计|开发|上线|评审|排查|校对|排版|拆解|部署|适配|写|做|改|跑|查|同步|测)/;
export const RE_GREET = /(你好|您好|嗨|哈喽|hello|hi|在吗|早上好|下午好|晚上好|早安|晚安)/i;
export const RE_THANKS = /(谢谢|感谢|辛苦|thx|thanks)/i;
export const RE_WHO = /(你是谁|你叫什么|你能做什么|你会什么|介绍.*(自己|你)|自我介绍)/i;

/**
 * 按语义把输入路由到某位分身。
 * @param {string} text 用户输入
 * @param {Array<{key:string,name:string}>} cast 分身花名册（AIC.CAST）
 */
export function routeRole(text, cast) {
  const s = String(text == null ? '' : text);
  const m = s.match(RE_ROLE_AT);
  if (m && cast) {
    const c = cast.find((x) => x.name === m[1]);
    if (c) return c.key;
  }
  if (/(设计|视觉|海报|banner|色板|配色|图标|logo|UI)/i.test(s)) return 'designer';
  if (/(文案|撰写|稿|文章|口径|FAQ|邮件|标题|keynote)/i.test(s)) return 'writer';
  if (/(数据|分析|报表|漏斗|埋点|指标|转化)/i.test(s)) return 'analyst';
  if (/(开发|上线|部署|接口|前端|代码|修复|工程|压测|适配)/i.test(s)) return 'engineer';
  return 'planner';
}

/** 去掉 @分身 / 礼貌前缀 / 语气动词，得到 26 字以内的任务标题 */
export function normalizeTitle(text) {
  const raw = String(text == null ? '' : text);
  const t = raw
    .replace(/@[\u4e00-\u9fa5A-Za-z]+/g, '')
    .replace(/^(请|帮我|麻烦|立即|马上)/, '')
    .replace(/^(做|写|改|跑|查)(一下|下)?/, '')
    .trim();
  return (t || raw.trim()).slice(0, 26);
}

/** 是否应作为「派发指令」而非日常对话处理（监管终端） */
export function isDispatch(text) {
  const s = String(text == null ? '' : text);
  return RE_TASK_VERB.test(s) || s.length > 40;
}

/* ---------------- 事件流：降噪与渲染 ---------------- */

/** 归一化事件文本（金额差异不应被视为不同事件） */
export function eventNorm(text) {
  return String(text == null ? '' : text)
    .replace(/\s+/g, '')
    .replace(/[0-9%.,，、：:]+/g, '');
}

/**
 * 事件流降噪：关键事件限量优先占位；其余按归一化文本合并计数（同指标只留最新一条 + n）。
 * @returns {Array<{e:object, n:number}>}
 */
export function dedupeEventRows(events, opts = {}) {
  const { keyKinds = EV_KEY_KINDS, keyLimit = 13, infoLimit = 3, norm = eventNorm } = opts;
  const rows = [];
  const seen = new Map();
  let keyShown = 0;
  let infoShown = 0;
  (events || []).forEach((e) => {
    if (keyKinds.has(e.kind)) {
      if (keyShown < keyLimit) { rows.push({ e, n: 1 }); keyShown++; }
      return;
    }
    const key = norm(e.text);
    const hit = seen.get(key);
    if (hit) { hit.n++; return; }
    if (infoShown >= infoLimit) return;
    const rec = { e, n: 1 };
    seen.set(key, rec);
    rows.push(rec);
    infoShown++;
  });
  return rows;
}

/**
 * 事件流行渲染：两页共用同一套类名结构（.ev-row > .num + .ev-tag + .ev-row__tx + .ev-row__n）。
 * @param {Array<{e:object,n:number}>} rows
 * @param {object} opts tag/esc/renderText/labelOf/emptyHTML
 */
export function renderEventRows(rows, opts = {}) {
  const {
    tag = 'div',
    esc = (v) => String(v == null ? '' : v),
    renderText,
    labelOf = () => '',
    emptyHTML = ''
  } = opts;
  const rt = renderText || esc;
  if (!rows || !rows.length) return emptyHTML;
  return rows
    .map(({ e, n }) => {
      const kind = e.kind || 'info';
      const label = labelOf(kind);
      const tx = rt(e.text);
      return (
        `<${tag} class="ev-row ev-row--${kind}">` +
        `<span class="num">${esc(e.t)}</span>` +
        (label ? `<span class="ev-tag ev-tag--${kind}">${esc(label)}</span>` : '') +
        `<span class="ev-row__tx" title="${tx}">${tx}</span>` +
        (n > 1 ? `<span class="ev-row__n">×${n}</span>` : '') +
        `</${tag}>`
      );
    })
    .join('');
}
