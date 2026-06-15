#!/usr/bin/env python3
"""jz-check-metrics entrypoint — resolves Python env and delegates to check_metrics.py."""
import os
import subprocess
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent
SCRIPT = SKILL_ROOT / "scripts" / "check_metrics.py"
ENSURE_PYTHON = Path("/Users/hwang/Projects/jinzheceo/scripts/ensure_shared_python.sh")


def resolve_python() -> str:
    if ENSURE_PYTHON.exists():
        result = subprocess.run(
            ["bash", str(ENSURE_PYTHON)],
            capture_output=True, text=True, check=True, timeout=30,
        )
        python_bin = result.stdout.strip()
        if python_bin:
            return python_bin
    return sys.executable


def main() -> int:
    python_bin = resolve_python()
    cmd = [python_bin, str(SCRIPT), *sys.argv[1:]]
    env = os.environ.copy()
    return subprocess.call(cmd, env=env)


if __name__ == "__main__":
    raise SystemExit(main())
