@echo off
chcp 65001 > nul
title PORTAL WEB LMD — VISTA PREVIA LOCAL
color 0A
cls

cd /d "%~dp0"

if exist "rcc_robot\venv\Scripts\python.exe" (
    "rcc_robot\venv\Scripts\python.exe" servidor_local_portal.py
) else if exist "venv\Scripts\python.exe" (
    "venv\Scripts\python.exe" servidor_local_portal.py
) else (
    python servidor_local_portal.py
)

pause
