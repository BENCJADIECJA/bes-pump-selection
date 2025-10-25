@echo off
TITLE Servidor de la API - Proyecto BES

echo ========================================================
echo   INICIANDO SERVIDOR DE LA API - PROYECTO BES
echo ========================================================
echo.

REM --- Paso 1: Activar el Entorno Virtual ---
echo Activando el entorno virtual (venv)...
CALL .\venv\Scripts\activate.bat

IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: No se pudo encontrar el entorno virtual en la carpeta 'venv'.
    echo Asegurese de haberlo creado ejecutando: python -m venv venv
    pause
    exit /b
)

echo Entorno virtual activado.
echo.

REM --- Paso 2: Ejecutar la aplicacion Python ---
echo Iniciando la aplicacion Flask (app.py)...
echo (Para detener el servidor, presione CTRL+C en esta ventana)
echo.

python app.py

REM --- Mantener la ventana abierta al finalizar ---
echo El servidor se ha detenido.
pause
