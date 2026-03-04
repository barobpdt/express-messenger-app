@echo off
echo Stopping Express server...

:: package.json에서 PORT 설정 확인 (기본값 8081)
set PORT=8081

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    echo Found process PID: %%a on port %PORT%
    taskkill /PID %%a /F
    echo Server stopped successfully.
    goto :done
)

echo No server found running on port %PORT%.
:done
pause
