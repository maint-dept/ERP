@echo off
title Push Updates to GitHub Pages (maint-dept/ERP)
echo =========================================================================
echo    AL-MUSLIM GROUP - ERP GITHUB PAGES SYNC ^& DEPLOYMENT HELPER
echo =========================================================================
echo.

set "GIT_EXE=git"
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
    ) else (
        echo [ERROR] Git was not found!
        echo Please ensure Git is installed.
        pause
        exit /b 1
    )
)

echo [1/3] Mirroring all latest files from public/ to root...
powershell -NoProfile -Command "Copy-Item -Path '%~dp0public\*' -Destination '%~dp0' -Recurse -Force"
if %ERRORLEVEL% equ 0 (
    echo [OK] Files mirrored successfully.
) else (
    echo [WARN] Mirroring note. Continuing...
)
echo.

echo [2/3] Checking Git status...
cd /d "%~dp0"
if not exist ".git" (
    "%GIT_EXE%" init
    "%GIT_EXE%" branch -M main
    "%GIT_EXE%" remote add origin https://github.com/maint-dept/ERP.git
)

"%GIT_EXE%" config user.name "maint-dept"
"%GIT_EXE%" config user.email "maint-dept@users.noreply.github.com"

echo [3/3] Adding files, committing and pushing to GitHub...
"%GIT_EXE%" add .
"%GIT_EXE%" commit -m "Update ERP system and MySQL database synchronization"
echo.
echo Now pushing to https://github.com/maint-dept/ERP ...
echo (If a GitHub login window appears in your browser, click 'Sign in with your browser')
echo.
"%GIT_EXE%" push -u origin main --force

if %ERRORLEVEL% equ 0 (
    echo.
    echo =========================================================================
    echo  [SUCCESS] All files and MySQL database updates pushed to GitHub!
    echo  GitHub Pages is now deploying your site.
    echo  Please check in 1-2 minutes:
    echo  https://maint-dept.github.io/ERP/
    echo =========================================================================
) else (
    echo.
    echo [NOTE] If push was rejected, please check your GitHub authentication.
)

echo.
pause
