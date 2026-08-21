@echo off
chcp 65001 > nul
title RADAR MONITOR DE CITAS DE VISADOS CONSULARES
color 0B
cls

echo =====================================================================
echo    RADAR MONITOR DE CITAS: VISADO FAMILIAR DE ESPAÑOL / CIUDADANO UE
echo =====================================================================
echo.

cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
    echo [ERROR] No se encuentra el entorno virtual en: venv\Scripts\python.exe
    echo Por favor, ejecuta primero instalar_dependencias.bat
    pause
    exit /b
)

"venv\Scripts\python.exe" radar_citas_visados.py

pause
