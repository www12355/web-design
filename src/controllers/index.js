/* ============================================================
 * index.html 控制器：启动器（双窗口启动 / 桌面尺寸预览 / 版权年份）
 * 纯 ES 模块；Bloub 为经典脚本注入的全局。
 * ============================================================ */
import { year } from '../modules/time.js';

// 两颗示例球：白色主 AI + 靛蓝员工（持有 mount 返回值，卸载/隐藏时 stop 以取消 rAF，P0-1）
const demoOrbs = [
  Bloub.mount(document.getElementById('bot-demo-main'), {
    size: 88, shape: 'cercle', ink: '#ffffff', expression: 'attentif', state: 'idle', paper: '#2C2C2E'
  }),
  Bloub.mount(document.getElementById('bot-demo-reel'), {
    size: 88, shape: 'hexagone', color: 'bleu', expression: 'neutre', state: 'idle', paper: '#2C2C2E'
  })
];
function stopDemoOrbs() { demoOrbs.forEach(h => h && h.stop && h.stop()); }
window.addEventListener('pagehide', stopDemoOrbs);
window.addEventListener('visibilitychange', () => { if (document.hidden) stopDemoOrbs(); });

// 同一手势内同步双开，降低拦截概率；被拦截时给出降级提示
function openBoth() {
  const a = window.open('screen1.html', 'screen1');
  const b = window.open('window2.html', 'window2');
  const warn = document.getElementById('launch-warn');
  if (warn) warn.hidden = !!(a || b);
}

function openSized(w, h) {
  window.open('screen1.html', 'screen1', `width=${w},height=${h}`);
}

// 页面入口卡片已改为原生 <button>，键盘 Enter/Space 由浏览器原生提供，
// 原先为 div[role=link] 手写的 keydown 兼容层随之删除。

// 尺寸预览的选中是「驻留态」：点了哪一个尺寸，哪一个就停在选中态。
// 此前只有瞬态 :active，松手后无从判断上一次按的是哪一档。
const sizeBtns = Array.from(document.querySelectorAll('[data-action="open-sized"]'));
function markSized(active) {
  sizeBtns.forEach(b => b.setAttribute('aria-pressed', String(b === active)));
}

// 由 data-action 驱动事件绑定，避免内联 onclick 与 window 全局污染（P2-1）
document.querySelectorAll('[data-action]').forEach(el => {
  el.addEventListener('click', () => {
    const act = el.dataset.action;
    if (act === 'open-both') {
      openBoth();
    } else if (act === 'open-sized') {
      const [w, h] = String(el.dataset.size || '').split('x').map(Number);
      if (w && h) { openSized(w, h); markSized(el); }
    } else if (act === 'open-window') {
      const t = el.dataset.target;
      if (t) window.open(t + '.html', t);
    }
  });
});

// 页脚版权年份取真实时间
const copyEl = document.querySelector('.launch__foot .num');
if (copyEl) copyEl.textContent = `© ${year()} AI Autonomous Operations`;