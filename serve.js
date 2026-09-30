/* ============================================================
 * 本地静态服务器（零依赖，Node 内置 http）
 * 用途：原生 ES 模块需经 HTTP 访问，此脚本用于本地预览。
 * 用法：node serve.js 或 npm run serve（默认端口 4173，可用 PORT 覆盖）。
 *       Windows 会把 4137-4236 等段划入系统保留端口（WinNAT 排除范围），
 *       4173 落段内时 listen 报 EACCES；端口被占用则报 EADDRINUSE。
 *       两种情况都自动回退到候选端口，以启动日志打印的实际地址为准。
 * ============================================================ */
'use strict';

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4173;
/* 候选回退端口：均避开 Windows 保留段（3336-4336 / 5357 / 50000-50059） */
const FALLBACKS = [4973, 4337, 4444, 8420];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // 规范化路径，防止目录穿越
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

/* 依次尝试候选端口：EACCES（系统保留段）/ EADDRINUSE（被占用）自动回退，
   其余错误照常崩溃——静默换端口只会掩盖真实故障。
   注意：listen(port, cb) 的 cb 是一次性 'listening' 监听器，绑定失败后仍会
   残留并在后续端口成功时误触发（实测会打印三条错误端口的「已启动」），
   故成功日志统一走共享 'listening' 处理器，端口以 activePort 为准。 */
const CANDIDATES = [PORT, ...FALLBACKS.filter(p => p !== PORT)];
let activePort = CANDIDATES[0];

server.on('listening', () => {
  console.log(`AI 经营中枢预览已启动 →  http://localhost:${activePort}`);
  if (activePort !== PORT) console.log(`  （默认端口 ${PORT} 被系统保留或占用，已自动回退）`);
  console.log('  打开 index.html 查看启动器，或直接访问 screen1.html / window2.html');
});

function listenAt(i) {
  if (i >= CANDIDATES.length) {
    console.error(`所有候选端口均不可用：${CANDIDATES.join(', ')}。可用 PORT=端口 手动指定。`);
    process.exit(1);
  }
  activePort = CANDIDATES[i];
  const onError = (err) => {
    server.removeListener('error', onError);
    const retryable = err.code === 'EACCES' || err.code === 'EADDRINUSE';
    if (!retryable || i + 1 >= CANDIDATES.length) {
      console.error(`监听端口 ${activePort} 失败：${err.code || err.message}`);
      process.exit(1);
    }
    console.warn(`端口 ${activePort} 不可用（${err.code}），自动切换 → ${CANDIDATES[i + 1]}`);
    listenAt(i + 1);
  };
  server.once('error', onError);
  server.listen(activePort);
}
listenAt(0);
