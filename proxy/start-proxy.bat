@echo off
chcp 65001 >nul
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装：
    echo https://nodejs.org/dist/v20.15.1/node-v20.15.1-x64.msi
    echo 安装时一直点"下一步"即可。
    pause
    exit /b 1
)
set PORT=9793
if exist "%~dp0port.txt" (
    set /p PORT=<"%~dp0port.txt"
)

echo 正在启动 TeaPass 本地代理 (端口: %PORT%)...
node "%~dp0proxy.js" %PORT%
pause
