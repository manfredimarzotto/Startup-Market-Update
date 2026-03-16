"""Build script: builds React frontend and copies data for GitHub Pages."""

import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
FRONTEND_DIR = ROOT / "frontend"
DIST_DIR = ROOT / "dist"
OUTPUT_DIR = ROOT


def load_json(filename):
    path = DATA_DIR / filename
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def build():
    # Step 1: Install frontend dependencies (if node_modules missing)
    node_modules = FRONTEND_DIR / "node_modules"
    if not node_modules.exists():
        print("Installing frontend dependencies...")
        subprocess.run(
            ["npm", "install"],
            cwd=str(FRONTEND_DIR),
            check=True,
        )

    # Step 2: Build the React app
    print("Building React frontend...")
    subprocess.run(
        ["npm", "run", "build"],
        cwd=str(FRONTEND_DIR),
        check=True,
    )

    # Step 3: Copy dist output to repo root
    if not DIST_DIR.exists():
        print("ERROR: dist/ directory not found after build", file=sys.stderr)
        sys.exit(1)

    for item in DIST_DIR.iterdir():
        dest = OUTPUT_DIR / item.name
        if item.is_dir():
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    # Step 4: Copy data/ into output so the React app can fetch it
    data_out = OUTPUT_DIR / "data"
    # data/ already exists in repo root, no copy needed

    # Summary
    opportunities = load_json("opportunities.json")
    signals = load_json("signals.json")
    print(f"Built dashboard -> index.html ({len(opportunities)} opportunities, {len(signals)} signals)")


if __name__ == "__main__":
    build()
