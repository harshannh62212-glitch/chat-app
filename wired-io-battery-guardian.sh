#!/bin/bash

# Auto-hibernation battery watchdog script
# Checks battery level every 30 seconds

LAST_STATE="active"

while true; do
  # Get battery device
  BAT_DEV=$(upower -e | grep battery | head -n 1)
  if [ -n "$BAT_DEV" ]; then
    # Extract percentage and state
    PERCENT=$(upower -i "$BAT_DEV" | grep percentage | awk '{print $2}' | tr -d '%')
    STATE=$(upower -i "$BAT_DEV" | grep state | awk '{print $2}')
    
    if [ -n "$PERCENT" ]; then
      # Handle 21% boundary to send the last sleeping signal to Vercel/clients
      if [ "$PERCENT" -le 21 ] && [ "$STATE" = "discharging" ]; then
        if [ "$LAST_STATE" != "sleeping" ]; then
          echo "[BATTERY GUARDIAN] Battery is at ${PERCENT}%. Sending system sleeping signal..."
          curl -s -X POST -H "Content-Type: application/json" -d '{"status": "sleeping"}' http://localhost:8000/api/system/status
          LAST_STATE="sleeping"
        fi
      else
        if [ "$LAST_STATE" = "sleeping" ] && [ "$STATE" = "charging" ]; then
          echo "[BATTERY GUARDIAN] Charger connected. Resetting system status to active..."
          curl -s -X POST -H "Content-Type: application/json" -d '{"status": "active"}' http://localhost:8000/api/system/status
          LAST_STATE="active"
        fi
      fi

      # Handle < 20% boundary to trigger hibernation
      if [ "$PERCENT" -lt 20 ] && [ "$STATE" = "discharging" ]; then
        echo "[BATTERY GUARDIAN] Critical battery level (${PERCENT}%). Initiating system hibernation..."
        systemctl hibernate
      fi
    fi
  fi
  sleep 30
done
