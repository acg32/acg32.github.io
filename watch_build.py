#!/usr/bin/env python3
"""
Simple watcher: rebuilds the site when files in pages/ or static/ change.
Avoids external dependencies; relies on periodic mtime checks.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from typing import Dict

WATCH_DIRS = ["pages", "static"]
SLEEP_SECONDS = 1.0


def snapshot() -> Dict[str, float]:
  """Return a mapping of file path -> mtime for watched dirs."""
  mtimes: Dict[str, float] = {}
  for base in WATCH_DIRS:
    if not os.path.isdir(base):
      continue
    for root, dirs, files in os.walk(base):
      dirs[:] = [d for d in dirs if d not in {"build", "__pycache__"}]
      for name in files:
        path = os.path.join(root, name)
        try:
          mtimes[path] = os.path.getmtime(path)
        except FileNotFoundError:
          # File vanished between walk and stat; skip it.
          continue
  return mtimes


def run_build() -> int:
  build_cmd = ["uv", "run", "build.py"] if shutil.which("uv") else [sys.executable, "build.py"]
  print(f"[watch] Running: {' '.join(build_cmd)}", flush=True)
  proc = subprocess.run(build_cmd)
  if proc.returncode == 0:
    print("[watch] Build completed.", flush=True)
  else:
    print(f"[watch] Build failed with code {proc.returncode}.", flush=True)
  return proc.returncode


def main() -> int:
  print(f"[watch] Watching {', '.join(WATCH_DIRS)} for changes. Ctrl+C to stop.", flush=True)
  prev = snapshot()
  while True:
    time.sleep(SLEEP_SECONDS)
    current = snapshot()
    if current != prev:
      prev = current
      run_build()


if __name__ == "__main__":
  import shutil

  try:
    raise SystemExit(main())
  except KeyboardInterrupt:
    print("\n[watch] Stopped.")
