@echo off
cd /d "%~dp0"
if not defined PORT set "PORT=3000"
node --version >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js 24 para iniciar o diario.
  pause
  exit /b 1
)
echo Iniciando Entre dias em http://127.0.0.1:%PORT%
echo Mantenha esta janela aberta enquanto usa o diario.
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$diaryUrl = 'http://127.0.0.1:%PORT%'; for ($attempt = 0; $attempt -lt 30; $attempt++) { try { $response = Invoke-WebRequest -Uri $diaryUrl -UseBasicParsing -TimeoutSec 1; if ($response.StatusCode -eq 200) { Start-Process $diaryUrl; exit } } catch {}; Start-Sleep -Milliseconds 300 }"
node server.js
pause
