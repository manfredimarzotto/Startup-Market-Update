"""Build script: renders Jinja2 templates with JSON data into docs/ for GitHub Pages."""

import json
import shutil
from datetime import date
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
TEMPLATES_DIR = ROOT / "templates"
STATIC_DIR = ROOT / "static"
DOCS_DIR = ROOT / "docs"


def load_json(filename):
    path = DATA_DIR / filename
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)


def build():
    # Load data
    opportunities = load_json("opportunities.json")
    signals = load_json("signals.json")
    companies = load_json("companies.json")
    investors = load_json("investors.json")
    people = load_json("people.json")
    signal_sources = load_json("signal_sources.json")

    active_sources = sum(1 for s in signal_sources if s.get("is_active"))

    # Render template
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=False)
    template = env.get_template("index.html")
    html = template.render(
        generated_date=date.today().isoformat(),
        source_count=active_sources,
        opportunities_json=json.dumps(opportunities),
        signals_json=json.dumps(signals),
        companies_json=json.dumps(companies),
        investors_json=json.dumps(investors),
        people_json=json.dumps(people),
    )

    # Write to docs/
    DOCS_DIR.mkdir(exist_ok=True)
    (DOCS_DIR / "index.html").write_text(html)

    # Copy static assets
    for src_file in STATIC_DIR.iterdir():
        if src_file.is_file():
            shutil.copy2(src_file, DOCS_DIR / src_file.name)

    print(f"Built dashboard -> docs/index.html ({len(opportunities)} opportunities, {len(signals)} signals)")


if __name__ == "__main__":
    build()
