#!/bin/bash
# Double-click in Finder on the M1 Air. Opens only the updated 3D rover.
cd "$(dirname "$0")" || exit 1
exec python3 open_rover.py
