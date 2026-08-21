@echo off
setlocal enabledelayedexpansion
title Radar de Citas LMD - Consulados de Espana
color 0B

echo =====================================================================
echo    RADAR MONITOR DE CITAS LMD - CONSULADOS DE ESPANA [MAEC]
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/2] Verificando entorno de ejecucion...
if not exist venv\Scripts\activate.bat (
    echo Creando entorno virtual aislado...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo [2/2] Iniciando Radar de Citas Consulares...
echo.
python radar_citas_lmd.py

echo.
echo =====================================================================
echo Radar finalizado.
echo =====================================================================
pause
