#!/usr/bin/env bash
# Start Lexi on http://localhost:5000 (creates .venv on the first run).
set -e
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
exec .venv/bin/python main.py
