# CLAUDE.md

## Project Overview

**Nordic Signal Intelligence** — An AI-powered opportunity radar that aggregates market signals (funding rounds, hiring waves, partnerships, product launches) from RSS feeds and web sources, scores and ranks opportunities using Claude Haiku, and renders a static HTML dashboard deployed via GitHub Pages.

Live site: https://manfredimarzotto.github.io/Startup-Market-Update/

## Architecture

```
Phase 1 (Current — Mock Data):
  JSON data files → build.py (Jinja2) → docs/index.html → GitHub Pages

Phase 2 (Planned — Live Pipeline):
  RSS/Scrape Sources → Ingest & Filter → Claude Haiku Extraction → Score & Rank → JSON → build.py → GitHub Pages
```

## Project Structure

```
├── build.py                        # Entry point — renders Jinja2 templates to docs/
├── config.json                     # User preferences (sectors, geo weights, scoring)
├── data/                           # JSON data layer
│   ├── signals.json                #   Raw market signals (funding, hiring, M&A, etc.)
│   ├── companies.json              #   Company profiles
│   ├── investors.json              #   Investor profiles
│   ├── people.json                 #   Key contacts (founders, partners)
│   ├── opportunities.json          #   Scored & ranked opportunities
│   └── signal_sources.json         #   Feed/source configuration
├── templates/
│   └── index.html                  #   Jinja2 dashboard template
├── static/
│   ├── style.css                   #   Dashboard styles (dark terminal theme)
│   └── app.js                      #   Client-side filtering, sorting, status tracking
├── docs/                           # Built output (served by GitHub Pages)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── index.html                      # Root redirect → docs/index.html
├── .github/workflows/pipeline.yml  # GitHub Actions workflow
├── requirements.txt                # Python dependencies
└── CLAUDE.md                       # This file
```

## Data Model

Six JSON files in `data/`:

- **signal_sources.json** — RSS feeds and scrape targets (id, url, type, refresh interval)
- **signals.json** — Individual market signals with type, tier, confidence, linked entities
- **companies.json** — Company profiles (sector, sub-sector, stage, HQ, employee count)
- **investors.json** — Investor profiles (type, AUM, focus sectors/geographies)
- **people.json** — Key contacts (name, role, company/investor link, LinkedIn)
- **opportunities.json** — AI-scored opportunities linking signals to entities with rationale

## Tech Stack

- **Language:** Python 3
- **AI:** Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) for signal extraction and scoring
- **Templating:** Jinja2
- **Frontend:** Vanilla JS, CSS (dark terminal theme with IBM Plex Sans + JetBrains Mono)
- **Deployment:** GitHub Actions → GitHub Pages (served from `docs/`)

## Environment Variables

- `ANTHROPIC_API_KEY` — Required for Claude Haiku signal extraction (Phase 2)

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Build the dashboard (renders templates with current JSON data)
python build.py

# Output appears in docs/index.html
```

## Git Workflow

- Always rebase feature branches onto `main` before merging to keep a linear history
- Use `git rebase origin/main` (not merge commits) to resolve conflicts

## Development Notes

- Dashboard is a static site: `build.py` renders Jinja2 templates with JSON data into `docs/`
- All data lives in `data/*.json` — no database required
- Client-side JS handles filtering, sorting, and localStorage-based status tracking
- Signal types: `funding_round`, `hiring_wave`, `acquisition`, `partnership`, `product_launch`, `expansion`, `new_fund`, `media_mention`
- Signal tiers: `tier_1_strong`, `tier_2_medium`, `tier_3_weak`
- Opportunity statuses: `new`, `viewed`, `contacted`, `archived` (persisted in browser localStorage)
- Phase 1 uses mock data; Phase 2 will add real RSS ingestion and Claude extraction
