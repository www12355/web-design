/* ============================================================
 * index.html 控制器：启动器（双窗口启动 / 桌面尺寸预览 / 版权年份）
 * 纯 ES 模块；Bloub 为经典脚本注入的全局。
 * ============================================================ */
import { year } from '../modules/time.js';

// 两颗示例球：白色主 AI + 靛蓝员工（持有 mount 返回值，卸载/隐藏时 stop 以取消 rAF，P0-1）
const demoOrbs = [
  Bloub.mount(document.getElementById('bot-demo-main'), {
    size: 88, shape: 'cercle', ink: '#ffffff', expression: 'attentif', state: 'idle', paper: '#0d1524'
  }),
  Bloub.mount(document.getElementById('bot-demo-reel'), {
    size: 88, shape: 'hexagone', color: 'bleu', expression: 'neutre', state: 'idle', paper: '#0d1524'
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

// 卡片支持键盘打开
document.querySelectorAll('.launch-card[role="link"]').forEach(card => {
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
  });
});

// 由 data-action 驱动事件绑定，避免内联 onclick 与 window 全局污染（P2-1）
document.querySelectorAll('[data-action]').forEach(el => {
  el.addEventListener('click', () => {
    const act = el.dataset.action;
    if (act === 'open-both') {
      openBoth();
    } else if (act === 'open-sized') {
      const [w, h] = String(el.dataset.size || '').split('x').map(Number);
      if (w && h) openSized(w, h);
    } else if (act === 'open-window') {
      const t = el.dataset.target;
      if (t) window.open(t + '.html', t);
    }
  });
});

// 页脚版权年份取真实时间
const copyEl = document.querySelector('.launch__foot .num');
if (copyEl) copyEl.textContent = `© ${year()} AI Autonomous Operations`;