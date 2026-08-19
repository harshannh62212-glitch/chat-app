#!/bin/bash
# ==============================================================================
# Wired-IO Minecraft Server Bridge Launcher
# Run this on your Minecraft server host machine (Latitude laptop / VPS / Home PC)
# ==============================================================================

echo "===================================================="
echo "   🟢 Starting Wired-IO Minecraft Realtime Bridge   "
echo "===================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[!] Node.js not found. Please install Node.js (v18+) to run the bridge."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules/@supabase" ]; then
    echo "[*] Installing Supabase Realtime client..."
    npm install @supabase/supabase-js --no-save
fi

# Start the bridge daemon
echo "[*] Launching bridge process..."
node minecraft-bridge.js
