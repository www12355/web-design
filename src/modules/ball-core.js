/* ============================================================
   ball-core · 两套球引擎共享层（P1-1）
   背景：bloub.js 与 emotionball/* 均以「经典脚本」<script> 加载，
         无法使用 ES 模块 import，故以 window.BallCore 暴露共享层，
         必须在 bloub.js / emotionball 之前加载（三页已按序插入）。

   收敛内容（真实重复部分）：
   · 颜色解析 / 序列化：hexToRgb、rgbToHex
   · 颜色插值：lerpColor（= bloub.mixHex 的数学等价实现，round+clamp 一致）
   · 调色板 COLORS：bloub 的 12 色注册表单一来源

   说明：两套引擎的 SHAPES / EXPRESSIONS 语义不同（一方为身体轮廓+面部表情，
   另一方为眼环点阵+情绪种子），强行合并会改变视觉表现，故不并入本层。
   ============================================================ */
(function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* '#abc' / '#aabbcc' → [r,g,b] */
  function hexToRgb(hex) {
    let h = String(hex == null ? '' : hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }

  /* 统一颜色插值：等价于 bloub.mixHex 与 emotionball.lerpColor（逐通道线性插值 + round + clamp） */
  function lerpColor(a, b, t) {
    if (a === b) return b;
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(
      A[0] + (B[0] - A[0]) * t,
      A[1] + (B[1] - A[1]) * t,
      A[2] + (B[2] - A[2]) * t
    );
  }

  /* bloub 侧的历史命名（mixHex）指向同一实现，保证现有调用点零改动 */
  const mixHex = lerpColor;

  /* bloub 调色板（12 色注册表）：取值保持原样，单一来源 */
  const COLORS = [
    { id: 'encre', hex: '#eafdff' },
    { id: 'brun', hex: '#ffb347' },
    { id: 'rouge', hex: '#ff5a6a' },
    { id: 'orange', hex: '#ffd23f' },
    { id: 'ambre', hex: '#ffd23f' },
    { id: 'vert', hex: '#2dd4bf' },
    { id: 'turquoise', hex: '#2dd4bf' },
    { id: 'bleu', hex: '#5ec8ff' },
    { id: 'violet', hex: '#c084fc' },
    { id: 'rose', hex: '#f472b6' },
    { id: 'gris', hex: '#a3a3a3' },
    { id: 'creme', hex: '#f1efe9' }
  ];

  window.BallCore = { clamp, hexToRgb, rgbToHex, lerpColor, mixHex, COLORS };
})();
