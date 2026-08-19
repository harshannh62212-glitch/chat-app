@echo off
title Wired-IO Minecraft Realtime Bridge
echo ====================================================
echo    🟢 Starting Wired-IO Minecraft Realtime Bridge   
echo ====================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js not found. Please install Node.js (v18+) to run the bridge.
    pause
    exit /b
)

if not exist node_modules\@supabase (
    echo [*] Installing Supabase Realtime client...
    call npm install @supabase/supabase-js --no-save
)

echo [*] Launching bridge process...
node minecraft-bridge.js
pause
