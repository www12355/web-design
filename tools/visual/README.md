# 视觉回归基座（computedStyle 快照）

用途：在没有人工看画面的前提下，证明「重构前后计算样式零变化」。
只采集 **computedStyle + 几何**，不采集文本，并对随机源做冻结，保证同输入同输出。

## 依赖

- Node（用于 `serve.js`，本项目零运行时依赖）
- Python 3.13 + `playwright`（本机已装）：

```powershell
# 解释器（python 可能不在 PATH，用绝对路径或 py 启动器）
C:\Users\<你>\AppData\Local\Programs\Python\Python313\python.exe
# 或
py -3
```

## 用法

```powershell
# 1) 采基线（改动前）
C:\Users\<你>\AppData\Local\Programs\Python\Python313\python.exe tools/visual/snapshot.py --label base

# 2) 做改动……

# 3) 采改动后
C:\Users\<你>\AppData\Local\Programs\Python\Python313\python.exe tools/visual/snapshot.py --label after-xxx

# 4) 比对：完全一致输出 IDENTICAL 并 exit 0；有差异打印清单并 exit 1
C:\Users\<你>\AppData\Local\Programs\Python\Python313\python.exe tools/visual/compare.py base after-xxx
```

快照落在 `tools/visual/out/<label>.json`（已在 `.gitignore` 中忽略）。

## 设计说明

- **确定性**：页面上下文内冻结 `Date.now` / `performance.now` / `Math.random` /
  `setTimeout` / `setInterval`，并以 `prefers-reduced-motion=reduce` 打开。
  因此世界引擎不会持续跳动、随机数恒定、延时 UI 不触发 —— 同输入必得同输出。
- **采样范围**：`selectors.json` 的 `props` 为 computed 属性白名单；
  每个选择器最多取 `maxPerSelector` 个元素；`window2.html` 额外有 `docreview` 分组
  （点击知识目录行打开交付审阅弹窗后采集 `.doc-review*` / `.dr-*`）。
- **服务端口**：默认 `4188`（避免与你在跑的 `4173` 冲突），可用 `VISUAL_PORT` 覆盖。
- **已知取舍**：因冻结了 `setTimeout`，依赖延时的 UI 分支（如审阅流的分步输出、
  思考链打字机）不会被采集；这些属行为而非样式，回归由 `scripts/check.mjs` 与
  页面 console error 断言兜底。

## 何时必须跑

任何改动 CSS、HTML 结构、或会触发重排/重绘的 JS 之后 —— 先采 `after-<主题>` 再
`compare.py base after-<主题>`；出现差异即说明该改动并非「样式等价」。
