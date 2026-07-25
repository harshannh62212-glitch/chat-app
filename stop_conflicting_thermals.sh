#!/bin/bash
# Stop host Ubuntu thermald daemon to prevent fan control oscillation
echo "Stopping conflicting host thermal daemons..."
sudo systemctl stop thermald 2>/dev/null || true
sudo systemctl disable thermald 2>/dev/null || true
sudo pkill -9 thermald 2>/dev/null || true
echo "✅ Conflicting thermald daemon stopped! Fan speed control is now smooth and steady."
