#!/bin/bash
# ==============================================================================
# Script to disable and remove Locator Bars / Bossbars from Minecraft Server
# ==============================================================================

MC_DIR="$HOME/minecraft-server"

echo "🔧 Turning off Locator Bar / Bossbars on Minecraft Server..."

# 1. Send in-game command if server is running under screen
if screen -list | grep -q "mc"; then
  echo "📡 Sending command to running Minecraft screen session..."
  screen -S mc -p 0 -X stuff "bossbar list$(printf \\r)"
  sleep 1
  # Attempt to remove common locator bossbar IDs
  screen -S mc -p 0 -X stuff "bossbar remove minecraft:locator$(printf \\r)"
  screen -S mc -p 0 -X stuff "bossbar remove locator$(printf \\r)"
  screen -S mc -p 0 -X stuff "bossbar remove compass$(printf \\r)"
fi

# 2. Check if running as systemd service
if systemctl is-active --quiet mc-server 2>/dev/null; then
  echo "🔄 mc-server systemd service detected."
fi

# 3. Disable locator/compass plugins if present in plugins directory
if [ -d "$MC_DIR/plugins" ]; then
  echo "🔍 Checking plugins directory for locator/compass plugins..."
  for plugin in "$MC_DIR/plugins"/*locator*.jar "$MC_DIR/plugins"/*compass*.jar "$MC_DIR/plugins"/*tracker*.jar; do
    if [ -f "$plugin" ]; then
      echo "Disabling plugin: $(basename "$plugin")"
      mv "$plugin" "$plugin.disabled"
    fi
  done
fi

echo "✅ Locator bar removal applied!"
echo "If you are running the server via systemd, restart it using: sudo systemctl restart mc-server"
