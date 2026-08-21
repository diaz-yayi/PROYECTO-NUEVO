@echo off
setlocal enabledelayedexpansion
title Robot Verificador Registro Civil Central de Espana
color 0A

echo =====================================================================
echo    ROBOT VERIFICADOR DE EXPEDIENTES - REGISTRO CIVIL CENTRAL [RCC]
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/3] Comprobando entorno de Python y dependencias...
if not exist venv\Scripts\activate.bat (
    echo Creando entorno virtual aislado...
    python -m venv venv
)

if not exist venv\Scripts\activate.bat (
    echo [ERROR] No se pudo crear el entorno virtual de Python.
    echo Asegurate de que Python este instalado y anadido al PATH.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo [2/3] Instalando y verificando librerias necesarias...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
playwright install chromium

echo.
echo [3/3] Iniciando verificacion automatica con la Sede del Ministerio...
echo.
python verificador_rcc.py

echo.
echo =====================================================================
echo Proceso finalizado. Resultados sincronizados en Google Workspace (VERIFICACION_RCC).
echo =====================================================================
pause
