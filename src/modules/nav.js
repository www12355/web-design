/* ============================================================
   员工卡页深链接工具
   - empParam()/setEmpParam()：员工卡页的 ?emp= 深链接读写
   （全局跨屏导航已移除，本文件仅保留深链接读写）
   ============================================================ */

export function empParam() {
  return new URLSearchParams(location.search).get('emp');
}

export function setEmpParam(key) {
  const u = new URL(location.href);
  u.searchParams.set('emp', key);
  history.replaceState(null, '', u);
}
