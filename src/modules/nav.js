/* ============================================================
   极简跨屏导航（P3-1 三屏拆分配套）
   - initNav(current)：把固定顶栏注入各独立页面的 .wx-nav 占位
   - empParam()/setEmpParam()：员工卡页的 ?emp= 深链接读写
   真 URL 即路由：screen2/3/4.html、employee.html、window2.html（卷轴全景）。
   ============================================================ */

const NAV_ITEMS = [
  { id: 'screen2', label: '数字员工', href: 'screen2.html' },
  { id: 'screen3', label: '经营中枢', href: 'screen3.html' },
  { id: 'screen4', label: '知识库', href: 'screen4.html' },
  { id: 'employee', label: '员工卡', href: 'employee.html' },
  { id: 'reel', label: '卷轴全景', href: 'window2.html' }
];

export function initNav(current) {
  const host = document.querySelector('.wx-nav');
  if (!host) return;
  host.innerHTML =
    '<span class="wx-nav__brand">AIC</span>' +
    NAV_ITEMS.map(i =>
      `<a class="wx-nav__item${i.id === current ? ' is-on' : ''}"${i.id === current ? ' aria-current="page"' : ''} href="${i.href}">${i.label}</a>`
    ).join('');
}

export function empParam() {
  return new URLSearchParams(location.search).get('emp');
}

export function setEmpParam(key) {
  const u = new URL(location.href);
  u.searchParams.set('emp', key);
  history.replaceState(null, '', u);
}
