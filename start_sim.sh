#!/usr/bin/env bash
# M1 Air / any clone: run from the repo root (/Users/nhharshan/Hunch).
exec "$(cd "$(dirname "$0")" && pwd)/Hunch/nasa-llaso-cad/start_sim.sh" "$@"
