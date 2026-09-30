/* ============================================================
   ESLint 扁平配置（ESM）
   设计取舍：
   · 不使用 @eslint/js 的 recommended 预设 —— 本项目含较多历史代码，
     预设会把大量「风格类」问题升级为 error 导致门禁永远红灯。
   · 采用**务实规则子集**：只把「真的可能是 bug」的规则设为 error，
     「可维护性」类设为 warn，并显式声明浏览器/Node/全局对象，
     以保证 `npm run lint` 在零误报下 exit 0。
   ============================================================ */

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  requestIdleCallback: 'readonly',
  performance: 'readonly',
  getComputedStyle: 'readonly',
  matchMedia: 'readonly',
  devicePixelRatio: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  MutationObserver: 'readonly',
  Event: 'readonly',
  CustomEvent: 'readonly',
  Node: 'readonly',
  NodeList: 'readonly',
  Element: 'readonly',
  HTMLElement: 'readonly',
  SVGElement: 'readonly',
  DOMParser: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  Image: 'readonly',
  fetch: 'readonly',
  structuredClone: 'readonly',
  queueMicrotask: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  open: 'readonly',
  close: 'readonly',
  scrollTo: 'readonly',
  getSelection: 'readonly',
  /* 经典脚本注入的全局 API（由 HTML 脚本顺序保证就绪） */
  BallCore: 'readonly',
  Bloub: 'readonly',
  EmotionBall: 'readonly',
  gsap: 'readonly',
  docx: 'readonly',
  /* 各模块在挂载 window 后，模块间以裸全局名互相引用（运行时由 window.* 提供） */
  AIC: 'readonly',
  World: 'readonly',
  Nebula: 'readonly'
};

const nodeGlobals = {
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  global: 'readonly',
  globalThis: 'readonly'
};

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'tools/visual/out/**',
      '*.md',
      '.zcode/**',
      '.codebuddy/**',
      '_backup_*/**',
      '.rem_backup/**'
    ]
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...browserGlobals, ...nodeGlobals }
    },
    linterOptions: {
      reportUnusedDisableDirectives: false
    },
    rules: {
      /* —— 真·bug 类：error —— */
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-self-assign': 'error',
      'no-unreachable': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-obj-calls': 'error',
      'no-sparse-arrays': 'error',
      'no-func-assign': 'error',
      'valid-typeof': 'error',
      'use-isnan': 'error',
      'no-import-assign': 'error',
      'no-new-native-nonconstructor': 'error',
      /* —— 可维护性类：warn —— */
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'off'
    }
  }
];
