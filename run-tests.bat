@echo off
rem Pocket Band tests: double-click to install what the tests need (first time only) and run every check.
rem Needs Node.js 18 or newer from https://nodejs.org (the LTS installer is fine).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org, then double-click this file again.
  pause
  exit /b 1
)
if not exist node_modules\playwright (
  echo Installing the test tools, first time only...
  call npm install
  if errorlevel 1 goto failed
)
echo Making sure the test browser is installed...
call npx playwright install chromium
if errorlevel 1 goto failed
echo.
echo Running every check on every instrument. The full run takes a while; npm run test:quick is a shorter one.
echo.
call npm test
set RESULT=%errorlevel%
if exist test-report.html start "" test-report.html
echo.
if "%RESULT%"=="0" (echo ALL PASSED) else (echo SOME CHECKS FAILED - see the table above or test-report.html)
pause
exit /b %RESULT%

:failed
echo Something went wrong installing the test tools. Check your internet connection and try again.
pause
exit /b 1
