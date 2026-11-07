@echo off
setlocal
cd /d "%~dp0"

echo === Compilando (draft) ===
call gradle draftCompileGwt
if errorlevel 1 goto :error

echo === Copiando a site ===
call gradle makeSite
if errorlevel 1 goto :error

echo === Servidor en http://localhost:8000/circuitjs.html ===
start "" http://localhost:8000/circuitjs.html
cd site
python -m http.server 8000
goto :eof

:error
echo.
echo *** La compilacion ha fallado ***
pause
exit /b 1