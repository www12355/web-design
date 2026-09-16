/* ============================================================
   卷轴导航（第 2/3/4 屏横向卷轴 · 原 window2.js 内联块抽出，P2-5 按屏拆分）
   拖拽 + 吸附 + 键盘左右 + 入场动效。行为与原实现逐行等价。
   依赖注入：
     · gsapOK      —— gsap 可用性判定（与页面其它动画共用同一判定）
     · isBlockedTarget —— 键盘导航需避让的元素（如搜索框）
     · later       —— 可被 pagehide 统一清理的 setTimeout（见 window2.js）
   ============================================================ */
export function initReel({ gsapOK, isBlockedTarget, later }) {
  const reel = document.getElementById('reel');
  const pages = [...document.querySelectorAll('.reel__page')];
  let idx = 1;
  /* 拖拽后抑制点击的标记（保留原语义；当前无消费方，仅为行为等价） */
  let suppressClick = false;

  /* ---------------- 入场动效（gsap 可选，失败直接显示） ---------------- */
  const revealed = new Set([1]);
  function revealPage(i) {
    if (revealed.has(i)) return;
    revealed.add(i);
    const page = pages[i];
    const els = page.querySelectorAll('.reveal');
    if (i === 2) {
      els.forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
    } else if (gsapOK() && els.length) {
      gsap.fromTo(els, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.07, ease: 'power2.out', clearProps: 'transform' });
      later(() => {
        els.forEach(el => { if (getComputedStyle(el).opacity === '0') { el.style.opacity = 1; el.style.transform = 'none'; } });
      }, 1200);
    } else {
      els.forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
    }
    if (i === 0 && gsapOK()) {
      gsap.fromTo(page.querySelectorAll('.chat-row, .chat-day, .msg-react'),
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.055, ease: 'power2.out', clearProps: 'transform' });
      gsap.from(page.querySelectorAll('.agn__foot .track i'),
        { width: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out' });
      gsap.from(page.querySelectorAll('.agn__core'),
        { scale: 0.72, duration: 0.6, stagger: 0.07, ease: 'back.out(1.7)', clearProps: 'transform' });
    }
  }

  function go(i, smooth = true) {
    idx = Math.max(0, Math.min(pages.length - 1, i));
    reel.scrollTo({ left: idx * reel.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
    revealPage(idx);
  }

  /* ---------------- 拖拽 + 吸附 ---------------- */
  let down = false, moved = false, startX = 0, startLeft = 0, lastX = 0;
  reel.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = true; moved = false;
    startX = e.clientX; lastX = e.clientX; startLeft = reel.scrollLeft;
    reel.classList.add('dragging');
    reel.style.scrollSnapType = 'none';
    reel.style.scrollBehavior = 'auto';
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    lastX = e.clientX;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    reel.scrollLeft = startLeft - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    reel.classList.remove('dragging');
    reel.style.scrollSnapType = '';
    reel.style.scrollBehavior = '';
    const delta = startX - lastX;
    let target = idx;
    if (delta > reel.clientWidth * 0.4) target = idx + 1;
    else if (delta < -reel.clientWidth * 0.4) target = idx - 1;
    if (moved) { suppressClick = true; later(() => { suppressClick = false; }, 0); }
    go(target);
  });

  let scrollTimer = 0;
  reel.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = later(() => {
      const i = Math.round(reel.scrollLeft / reel.clientWidth);
      if (i !== idx) { idx = i; revealPage(i); }
    }, 90);
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (isBlockedTarget && isBlockedTarget(e.target)) return;
    if (e.key === 'ArrowLeft') go(idx - 1);
    if (e.key === 'ArrowRight') go(idx + 1);
  });

  return { go, getIdx: () => idx };
}
