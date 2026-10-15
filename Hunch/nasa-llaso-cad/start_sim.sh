#!/usr/bin/env bash
# Start NASA LLASO CAD sim on the correct port and open the launch pad in the browser.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PORT="${HUNCH_SIM_PORT:-8002}"
URL="http://127.0.0.1:${PORT}/launcher.html"

if curl -sf -o /dev/null --max-time 1 "$URL"; then
  echo "Sim already running at $URL"
else
  echo "Starting sim server on port $PORT (from $ROOT)..."
  HUNCH_SIM_REDIRECT_PORT="${HUNCH_SIM_REDIRECT_PORT:-80}" python3 serve.py "$PORT" &
  for _ in $(seq 1 30); do
    if curl -sf -o /dev/null --max-time 1 "$URL"; then
      break
    fi
    sleep 0.2
  done
fi

if ! curl -sf -o /dev/null --max-time 2 "$URL"; then
  echo "Server did not start. Run manually: cd \"$ROOT\" && python3 serve.py $PORT"
  echo "Then open: $URL"
  exit 1
fi

echo "Open: $URL"
if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
fi
