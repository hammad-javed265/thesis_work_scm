@echo off
title Supply Chain ML - Deploy

:: ============================================================
::  Supply Chain ML System - Full Stack Deploy Script
::  Starts:  1) FastAPI Backend  (port 8000)
::           2) Next.js Frontend (port 5000)
:: ============================================================

SET ROOT=%~dp0
SET BACKEND=%ROOT%Production_Backend
SET FRONTEND=%ROOT%initial_push

echo.
echo  =========================================================
echo   ML-Driven Assortment Planning System
echo   Starting Full Stack...
echo  =========================================================
echo.

:: ----------------------------------------------------------
:: CHECK: Python installed
:: ----------------------------------------------------------
python --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Python not found. Please install Python 3.9+ and add it to PATH.
    pause
    exit /b 1
)

:: ----------------------------------------------------------
:: CHECK: Node.js installed
:: ----------------------------------------------------------
node --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Node.js not found. Please install Node.js 18+ and add it to PATH.
    pause
    exit /b 1
)

:: ----------------------------------------------------------
:: CHECK: Model artifact exists
:: ----------------------------------------------------------
IF NOT EXIST "%BACKEND%\model_artifacts\rf_model.pkl" (
    echo.
    echo [WARNING] Model not found at Production_Backend\model_artifacts\rf_model.pkl
    echo.
    echo  You need to train the model first. Run production_setup.py?
    echo.
    choice /C YN /M "Run production_setup.py now (this may take 5-8 minutes)"
    IF ERRORLEVEL 2 GOTO SKIP_SETUP
    IF ERRORLEVEL 1 (
        echo.
        echo  Running production setup...
        cd /d "%BACKEND%"
        python production_setup.py
        IF ERRORLEVEL 1 (
            echo [ERROR] production_setup.py failed. Check errors above.
            pause
            exit /b 1
        )
        echo  [OK] Model trained and saved.
    )
)
:SKIP_SETUP

:: ----------------------------------------------------------
:: CHECK: Node modules installed
:: ----------------------------------------------------------
IF NOT EXIST "%FRONTEND%\node_modules" (
    echo.
    echo  [INFO] node_modules not found. Installing dependencies...
    cd /d "%FRONTEND%"
    call npm install
    IF ERRORLEVEL 1 (
        echo [ERROR] npm install failed. Check errors above.
        pause
        exit /b 1
    )
    echo  [OK] Node modules installed.
)

:: ----------------------------------------------------------
:: CHECK: pip packages (quick check for uvicorn)
:: ----------------------------------------------------------
python -c "import uvicorn" >nul 2>&1
IF ERRORLEVEL 1 (
    echo.
    echo  [INFO] Installing Python dependencies...
    pip install fastapi uvicorn pandas numpy scikit-learn openpyxl joblib
    IF ERRORLEVEL 1 (
        echo [ERROR] pip install failed. Check errors above.
        pause
        exit /b 1
    )
    echo  [OK] Python packages installed.
)

:: ----------------------------------------------------------
:: LAUNCH BACKEND  (new window, blue title bar)
:: ----------------------------------------------------------
echo.
echo  [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "Backend - FastAPI (port 8000)" /D "%BACKEND%" cmd /k ^
    "color 1F && echo. && echo  === FastAPI Backend === && echo  http://localhost:8000 && echo  http://localhost:8000/docs && echo. && python -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload"

:: Small delay so backend starts first
timeout /t 3 /nobreak >nul

:: ----------------------------------------------------------
:: LAUNCH FRONTEND  (new window, green title bar)
:: ----------------------------------------------------------
echo  [2/2] Starting Next.js Frontend on http://localhost:5000 ...
start "Frontend - Next.js (port 5000)" /D "%FRONTEND%" cmd /k ^
    "color 2F && echo. && echo  === Next.js Frontend === && echo  http://localhost:5000 && echo. && npm run dev"

:: ----------------------------------------------------------
:: DONE
:: ----------------------------------------------------------
echo.
echo  =========================================================
echo   Both servers launched in separate windows!
echo.
echo   Backend  (FastAPI)  -->  http://localhost:8000
echo   API Docs (Swagger)  -->  http://localhost:8000/docs
echo   Frontend (Next.js)  -->  http://localhost:5000
echo.
echo   Close the individual windows to stop each server.
echo  =========================================================
echo.

:: Open browser after a short delay
timeout /t 5 /nobreak >nul
start "" "http://localhost:5000"

pause
