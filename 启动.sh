#!/usr/bin/env bash
# 一键启动：启动本地服务器并打开浏览器（Git Bash / Linux）
cd "$(dirname "$0")" || exit 1

PORT=${PORT:-4173}
URL="http://localhost:${PORT}/index.html"

echo
echo "  ============================================"
echo "    AI 经营中枢预览 — 一键启动"
echo "  ============================================"
echo

# 已存在服务：直接打开浏览器
if netstat -ano 2>/dev/null | grep ":$PORT " | grep -q LISTENING || \
   ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  echo "  [*] 端口 ${PORT} 已有服务在运行，直接打开浏览器..."
else
  echo "  [*] 启动本地服务器：node serve.js  (端口 ${PORT})"
  (node serve.js >serve.log 2>&1 &)
  # 等待服务就绪
  for _ in $(seq 1 20); do
    if netstat -ano 2>/dev/null | grep ":$PORT " | grep -q LISTENING || \
       ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
      break
    fi
    sleep 1
  done
fi

echo "  [*] 打开浏览器：${URL}"
start "$URL" 2>/dev/null || open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || \
  echo "  请手动访问：${URL}"
echo