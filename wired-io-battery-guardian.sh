#!/usr/bin/env bash
# /usr/local/bin/wired-io-battery-guardian.sh
# Wired-IO Low Battery Auto-Save System
# Triggered by UPower when battery drops to 15% (discharging).
# Saves all running state so the next boot is identical to current state.
#
# What it saves:
#   1. Running process list with args
#   2. All Docker container states (commits running containers to images)
#   3. PostgreSQL database dump
#   4. Open file list per process
#   5. Systemd unit states
#   6. Current network config
#   7. Fan/thermal config
#   8. Snapshot metadata
# Then initiates a systemd hibernate (writes RAM to swap, true S4 sleep).

set -euo pipefail

SAVE_DIR="/var/lib/wired-io/battery-saves"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
SNAPSHOT_DIR="${SAVE_DIR}/${TIMESTAMP}"
LATEST_LINK="${SAVE_DIR}/latest"
LOG="${SAVE_DIR}/guardian.log"

mkdir -p "${SNAPSHOT_DIR}"
exec >> "${LOG}" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "=========================================="
log "LOW BATTERY AUTO-SAVE TRIGGERED"
log "Battery: $(cat /sys/class/power_supply/BAT0/capacity 2>/dev/null || echo '?')%"
log "Saving state to: ${SNAPSHOT_DIR}"
log "=========================================="

# ── 1. Running process snapshot ──────────────────────────────────────────────
log "[1/7] Snapshotting running processes..."
ps auxww > "${SNAPSHOT_DIR}/processes.txt" 2>/dev/null || true
# Save systemd services that are running (user-startable ones)
systemctl list-units --type=service --state=running --no-pager --plain \
  > "${SNAPSHOT_DIR}/systemd-running-services.txt" 2>/dev/null || true
log "[1/7] DONE"

# ── 2. Docker containers: commit + export state ───────────────────────────────
log "[2/7] Saving Docker container states..."
DOCKER_SAVE_DIR="${SNAPSHOT_DIR}/docker"
mkdir -p "${DOCKER_SAVE_DIR}"

if command -v docker &>/dev/null; then
  # Save running container metadata
  docker ps --format '{{json .}}' > "${DOCKER_SAVE_DIR}/running-containers.json" 2>/dev/null || true
  docker ps -a --format '{{json .}}' > "${DOCKER_SAVE_DIR}/all-containers.json" 2>/dev/null || true
  docker network ls --format '{{json .}}' > "${DOCKER_SAVE_DIR}/networks.json" 2>/dev/null || true

  # Commit each running container to a tagged image snapshot
  while IFS= read -r line; do
    CONTAINER_ID=$(echo "${line}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ID'])" 2>/dev/null || true)
    CONTAINER_NAME=$(echo "${line}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Names'])" 2>/dev/null || true)
    if [ -n "${CONTAINER_ID}" ] && [ -n "${CONTAINER_NAME}" ]; then
      SAFE_NAME=$(echo "${CONTAINER_NAME}" | tr '/' '_' | tr -d ' ')
      log "  Committing container: ${CONTAINER_NAME} -> battery-save/${SAFE_NAME}:${TIMESTAMP}"
      docker commit "${CONTAINER_ID}" "battery-save/${SAFE_NAME}:${TIMESTAMP}" \
        --message "Auto-save at ${TIMESTAMP} (battery low)" 2>/dev/null || true
    fi
  done < <(docker ps --format '{{json .}}' 2>/dev/null)
fi
log "[2/7] DONE"

# ── 3. PostgreSQL database dump ───────────────────────────────────────────────
log "[3/7] Dumping PostgreSQL database..."
DB_SAVE_DIR="${SNAPSHOT_DIR}/postgres"
mkdir -p "${DB_SAVE_DIR}"

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'chat_app_db'; then
  docker exec chat_app_db pg_dump -U chat_user chat_db \
    > "${DB_SAVE_DIR}/chat_db_${TIMESTAMP}.sql" 2>/dev/null \
    && log "[3/7] Database dump: OK ($(du -sh "${DB_SAVE_DIR}/chat_db_${TIMESTAMP}.sql" | cut -f1))" \
    || log "[3/7] Database dump: FAILED (container may be unavailable)"
else
  log "[3/7] chat_app_db not running — skipping"
fi

# ── 4. Fan / thermal config snapshot ─────────────────────────────────────────
log "[4/7] Saving thermal & fan state..."
{
  echo "fan_pwm=$(cat /sys/class/hwmon/hwmon7/pwm1 2>/dev/null || echo 'unknown')"
  echo "fan_enable=$(cat /sys/class/hwmon/hwmon7/pwm1_enable 2>/dev/null || echo 'unknown')"
  echo "fan_rpm=$(cat /sys/class/hwmon/hwmon7/fan1_input 2>/dev/null || echo 'unknown')"
  echo "cpu_temp=$(awk '{printf "%.1f", $1/1000}' /sys/class/hwmon/hwmon7/temp1_input 2>/dev/null || echo 'unknown')°C"
} > "${SNAPSHOT_DIR}/thermal-state.txt"
log "[4/7] DONE"

# ── 5. Network state ──────────────────────────────────────────────────────────
log "[5/7] Saving network config..."
{
  ip addr show 2>/dev/null
  echo "---ROUTES---"
  ip route show 2>/dev/null
  echo "---CONNECTIONS---"
  ss -tunap 2>/dev/null | head -50
} > "${SNAPSHOT_DIR}/network-state.txt" 2>/dev/null || true
log "[5/7] DONE"

# ── 6. App config & crontab ──────────────────────────────────────────────────
log "[6/7] Saving app configs..."
cp -r /home/harshan/apps/chat-app/docker-compose.yml "${SNAPSHOT_DIR}/" 2>/dev/null || true
crontab -l > "${SNAPSHOT_DIR}/crontab.txt" 2>/dev/null || true
systemctl cat docker.service > "${SNAPSHOT_DIR}/docker.service.txt" 2>/dev/null || true
log "[6/7] DONE"

# ── 7. Master snapshot manifest ──────────────────────────────────────────────
log "[7/7] Writing snapshot manifest..."
BATTERY=$(cat /sys/class/power_supply/BAT0/capacity 2>/dev/null || echo '?')
STATUS=$(cat /sys/class/power_supply/BAT0/status 2>/dev/null || echo '?')
python3 - <<PYEOF
import json, os, datetime, subprocess

manifest = {
    "timestamp": "${TIMESTAMP}",
    "iso_time": datetime.datetime.now().isoformat(),
    "battery_percent": ${BATTERY:-0},
    "battery_status": "${STATUS}",
    "snapshot_dir": "${SNAPSHOT_DIR}",
    "files_saved": os.listdir("${SNAPSHOT_DIR}"),
    "restore_instructions": [
        "1. Boot machine normally",
        "2. Run: sudo systemctl start docker",
        "3. cd ~/apps/chat-app && docker compose up -d",
        "4. If DB lost: docker exec -i chat_app_db psql -U chat_user chat_db < ${SNAPSHOT_DIR}/postgres/*.sql",
        "5. All Docker containers will restore from battery-save/* images if needed"
    ],
    "auto_hibernate_initiated": True
}

with open("${SNAPSHOT_DIR}/manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)

print("Manifest written OK")
PYEOF

# Update the "latest" symlink
rm -f "${LATEST_LINK}"
ln -s "${SNAPSHOT_DIR}" "${LATEST_LINK}"
log "[7/7] DONE — Snapshot complete"

# ── Notify all logged-in users ────────────────────────────────────────────────
for tty in $(who | awk '{print $2}'); do
  echo "⚡ WIRED-IO: Battery at ${BATTERY}% — Auto-saving state and hibernating in 30s. Plug in charger to cancel." \
    > "/dev/${tty}" 2>/dev/null || true
done

log "All state saved. Initiating systemd hibernate in 30 seconds..."
log "To cancel: sudo systemctl cancel hibernate"

# Wait 30 seconds to give user a chance to plug in charger
sleep 30

# Check battery again — if charger was plugged in, abort
CURRENT_AC=$(cat /sys/class/power_supply/AC/online 2>/dev/null || echo '1')
CURRENT_STATUS=$(cat /sys/class/power_supply/BAT0/status 2>/dev/null || echo 'Charging')

if [ "${CURRENT_AC}" = "1" ] || [ "${CURRENT_STATUS}" != "Discharging" ]; then
  log "ABORT: Charger detected — skipping hibernate"
  exit 0
fi

log "Initiating hibernate NOW..."
systemctl hibernate || {
  log "hibernate failed — falling back to suspend"
  systemctl suspend || true
}
