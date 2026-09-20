# AI 自主经营中枢（ai-autonomous-ops）

零构建、零运行时依赖的纯静态多页演示站（原生 ES 模块 + 经典脚本混用）。打开即跑。

## 启动方式

```bash
node serve.js          # 默认 http://localhost:4173
# 或
启动.bat / 启动.sh
```

浏览器打开：

- `index.html` —— 启动器（深色）
- `screen1.html` —— 运营驾驶舱（深色，单窗口）
- `window2.html` —— 横向卷轴（屏 2 / 屏 3 / 屏 4，多窗口）

## 架构

- **单一真相源**：`src/modules/world.js` 的 `World.state` 是唯一状态源，通过 `localStorage` 在多窗口间同步（租约/派发协议）。
- **只读派生**：各页面控制器（`src/controllers/*`）只读取 `World.state` 并渲染，不直接改 localStorage 协议。
- **球引擎**：`window.Bloub`（AI 实体球）与 `window.EmotionBall`（情绪球）共享数据层 `src/modules/ball-core.js`。
- **联动层**：`src/modules/linkage.js` 提供跨页联动 UI / 事件流的统一渲染。

## 目录

```
src/
  modules/   引擎与共享层（world / bloub / emotionball / ball-core / linkage / time / nebula / docgen）
  controllers/ 页面控制器（index / screen1 / window2/*）
  data/      静态数据（worldData.js 等）
  styles/    tokens.css + components.css + pages/*
```

## 工程化

- 本仓库通过 `ARCHITECTURE-REVIEW.md` 追溯一次全量架构评审（P0–P3）及修复记录。
- 首提交为修复前完整快照，含 `_backup_*` 等目录，可随时 `git checkout` 还原。
