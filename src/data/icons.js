/* ============================================================
 * 图标精灵（一次注入，供三页共用）
 *   ft-*  ：文件类型标记（Word/PPT/PDF/Excel/Figma/Code），自带品牌色，
 *           由「图形 + 文字标签」双重编码，不参与全站配色纪律。
 *   ic-*  ：UI 线性图标（Lucide 语言：24 viewBox / stroke 1.5 / 圆头圆角 /
 *           fill:none / 颜色一律 currentColor），用于状态徽章与状态图标。
 *           状态图标与中文文案、颜色共同构成三冗余编码（见 DESIGN.md §状态）。
 * 纯数据模块：SPRITE 为可直接插入 <body> 的 SVG sprite 字符串。
 * ============================================================ */

export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" id="aic-ft-sprite"><defs>
  <symbol id="ft-word" viewBox="0 0 24 24"><path d="M6.5 2.5h7L18.5 7.5v12a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19.5v-15A1.5 1.5 0 016.5 2.5z" fill="#6fa8ff"/><path d="M13.5 2.5l5 5h-4.3a.7.7 0 01-.7-.7V2.5z" fill="#fff" opacity=".28"/><text x="11.6" y="16.6" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff">W</text></symbol>
  <symbol id="ft-ppt" viewBox="0 0 24 24"><path d="M6.5 2.5h7L18.5 7.5v12a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19.5v-15A1.5 1.5 0 016.5 2.5z" fill="#ff7a4d"/><path d="M13.5 2.5l5 5h-4.3a.7.7 0 01-.7-.7V2.5z" fill="#fff" opacity=".28"/><text x="11.6" y="16.6" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff">P</text></symbol>
  <symbol id="ft-pdf" viewBox="0 0 24 24"><path d="M6.5 2.5h7L18.5 7.5v12a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19.5v-15A1.5 1.5 0 016.5 2.5z" fill="#ff5a4d"/><path d="M13.5 2.5l5 5h-4.3a.7.7 0 01-.7-.7V2.5z" fill="#fff" opacity=".28"/><text x="11.75" y="15.6" text-anchor="middle" font-size="4.9" font-weight="700" fill="#fff">PDF</text></symbol>
  <symbol id="ft-xls" viewBox="0 0 24 24"><path d="M6.5 2.5h7L18.5 7.5v12a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19.5v-15A1.5 1.5 0 016.5 2.5z" fill="#52d68a"/><path d="M13.5 2.5l5 5h-4.3a.7.7 0 01-.7-.7V2.5z" fill="#fff" opacity=".28"/><text x="11.6" y="16.6" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff">X</text></symbol>
  <symbol id="ft-fig" viewBox="0 0 24 24"><path d="M6.5 2.5h7L18.5 7.5v12a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19.5v-15A1.5 1.5 0 016.5 2.5z" fill="#ffffff" stroke="#cfe7ff"/><path d="M13.5 2.5l5 5h-4.3a.7.7 0 01-.7-.7V2.5z" fill="#cfe7ff"/><g transform="translate(8.1 7.2)"><path d="M0 1.6A1.6 1.6 0 011.6 0h1.6v3.2H1.6A1.6 1.6 0 010 1.6Z" fill="#f24e1e"/><path d="M3.4 0H5a1.6 1.6 0 110 3.2H3.4Z" fill="#ff7262"/><path d="M0 4.9A1.6 1.6 0 011.6 3.3h1.6v3.2H1.6A1.6 1.6 0 010 4.9Z" fill="#a259ff"/><circle cx="5" cy="4.9" r="1.6" fill="#1abcfe"/><path d="M0 8.2A1.6 1.6 0 011.6 6.6h1.6v1.6A1.6 1.6 0 110 8.2Z" fill="#0acf83"/></g></symbol>
  <symbol id="ft-code" viewBox="0 0 24 24"><path d="M6.5 2.5h7L18.5 7.5v12a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19.5v-15A1.5 1.5 0 016.5 2.5z" fill="#a79cff"/><path d="M13.5 2.5l5 5h-4.3a.7.7 0 01-.7-.7V2.5z" fill="#fff" opacity=".28"/><path d="M9.4 11.6l-2.1 2.1 2.1 2.1M13.9 11.6l2.1 2.1-2.1 2.1" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></symbol>

  <symbol id="ic-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.25"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></symbol>
  <symbol id="ic-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.25"/><path d="M12 7v5.2l3.4 2"/></symbol>
  <symbol id="ic-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 3.6 2.5 17.6A1.6 1.6 0 0 0 3.9 20h16.2a1.6 1.6 0 0 0 1.4-2.4L13.4 3.6a1.6 1.6 0 0 0-2.8 0Z"/><path d="M12 9.5v4"/><path d="M12 16.8h.01"/></symbol>
  <symbol id="ic-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.25"/><path d="m14.8 9.2-5.6 5.6"/><path d="m9.2 9.2 5.6 5.6"/></symbol>
  <symbol id="ic-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.25"/></symbol>
  <symbol id="ic-bolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></symbol>
  <symbol id="ic-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></symbol>
</defs></svg>`;
