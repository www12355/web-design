@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PORT=4173"
set "URL=http://localhost:%PORT%/index.html"

echo.
echo  ============================================
echo    AI 经营中枢预览 - 一键启动
echo  ============================================
echo.

rem 已存在服务：直接打开浏览器，不重复启动
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo  [*] 端口 %PORT% 已有服务在运行，直接打开浏览器...
    goto open
)

echo  [*] 启动本地服务器：node serve.js  ^(端口 %PORT%^)
echo.
start "AI经营中枢预览服务器" cmd /k "chcp 65001>nul & node serve.js"

rem 等待服务就绪（每次约1秒，最多20次）
set /a tries=0
:waitloop
set /a tries+=1
if %tries% gtr 20 (
    echo  [!] 等待超时，仍尝试打开浏览器...
    goto open
)
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 goto waitloop

:open
echo  [*] 打开浏览器...
start "" "%URL%"
echo.
echo  若浏览器未自动打开，请手动访问： %URL%
echo  提示：关闭弹出的服务器窗口即可停止服务。
echo.
endlocal