#!/usr/bin/env python3
"""Start the LLASO sim from the M1 repo root (/Users/nhharshan/Hunch)."""
import os
import runpy
import sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Hunch", "nasa-llaso-cad")
os.chdir(root)
target = os.path.join(root, "serve.py")
sys.argv[0] = target
runpy.run_path(target, run_name="__main__")
