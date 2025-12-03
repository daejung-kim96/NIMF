@echo off
chcp 65001 >nul
echo ========================================
echo    모든 서버 자동 실행 스크립트
echo ========================================
echo.

echo [INFO] 서버들을 시작합니다...
echo.

REM 백엔드 서버 시작 (포트 3000)
echo [INFO] 백엔드 서버 시작 중...
start "Backend Server" cmd /k "chcp 65001 >nul && cd /d %~dp0BE && npm install && npm run dev"

REM 프론트엔드 서버 시작 (포트 5173)
echo [INFO] 프론트엔드 서버 시작 중...
start "Frontend Server" cmd /k "chcp 65001 >nul && cd /d %~dp0FE && npm install && npm run dev"

REM AI 서버 시작 (포트 8001)
echo [INFO] AI 서버 시작 중...
start "AI Server" cmd /k "chcp 65001 >nul && cd /d %~dp0AI && python main.py"

echo.
echo [SUCCESS] 모든 서버가 별도의 창에서 시작되었습니다!
echo.
echo [INFO] 서버 정보:
echo    - 백엔드 서버: http://localhost:3000
echo    - 프론트엔드 서버: http://localhost:5173
echo    - AI 서버: http://localhost:8000
echo.

REM 종료 대기
pause