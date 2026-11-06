@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  start "Хозяин леса — локальный сервер" cmd /k "cd /d ""%~dp0"" && py -m http.server 8765"
) else (
  where python >nul 2>nul
  if not errorlevel 1 (
    start "Хозяин леса — локальный сервер" cmd /k "cd /d ""%~dp0"" && python -m http.server 8765"
  ) else (
    echo Python не найден. Можно открыть index.html напрямую, либо установить Python для запуска локального сервера.
    pause
    exit /b 1
  )
)
timeout /t 2 >nul
start "" "http://127.0.0.1:8765/"
