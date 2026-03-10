# CLAUDE.md

## Project Overview

**Startup Intelligence Radar** — An AI-powered opportunity radar that aggregates market signals (funding rounds, hiring waves, partnerships, product launches) from RSS feeds and web sources, scores and ranks opportunities using Claude Haiku, and renders a static HTML dashboard deployed via GitHub Pages.

Live site: https://manfredimarzotto.github.io/Startup-Market-Update/

## Architecture

```
RSS/Scrape Sources → Ingest & Filter → Scrape Full Text → Claude Haiku Extraction → Entity Resolution → Score & Rank → JSON → build.py (Jinja2) → GitHub Pages
```

## Project Structure

```
├── run.py                          # Pipeline orchestrator (ingest → scrape → extract → score → build)
├── build.py                        # Dashboard renderer (Jinja2 templates → docs/)
├── config.json                     # User preferences (sectors, geo weights, scoring)
├── pipeline/                       # Data pipeline modules
│   ├── __init__.py
│   ├── ingest.py                   #   RSS feed fetcher with keyword filtering
│   ├── scraper.py                  #   Full-text article scraper (BeautifulSoup, robots.txt)
│   ├── extractor.py                #   Claude Haiku signal extraction (structured JSON)
│   └── scorer.py                   #   Entity resolution, scoring, opportunity generation
├── data/                           # JSON data layer
│   ├── signals.json                #   Market signals (funding, hiring, M&A, etc.)
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
├── .github/workflows/pipeline.yml  # GitHub Actions: daily cron + manual dispatch
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

- `ANTHROPIC_API_KEY` — Required for Claude Haiku signal extraction and rationale generation

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run the full pipeline (ingest → scrape → extract → score → build)
# Requires ANTHROPIC_API_KEY environment variable
python run.py

# Build dashboard only (renders templates with current JSON data)
python build.py

# Output appears in docs/index.html
```

## Git Workflow

- Always rebase feature branches onto `main` before merging to keep a linear history
- Use `git rebase origin/main` (not merge commits) to resolve conflicts

## Development Notes

- `run.py` orchestrates the full pipeline: ingest → scrape → extract → resolve → score → build
- `build.py` renders Jinja2 templates with JSON data into `docs/`
- All data lives in `data/*.json` — no database required
- Client-side JS handles filtering, sorting, and localStorage-based status tracking
- Generate button opens GitHub Actions dispatch page (no token exposure)
- Pipeline runs daily at 06:00 UTC via cron, plus on-demand via workflow_dispatch
- Signal types: `funding_round`, `hiring_wave`, `acquisition`, `partnership`, `product_launch`, `expansion`, `new_fund`, `media_mention`
- Signal tiers: `tier_1_strong`, `tier_2_medium`, `tier_3_weak`
- Opportunity statuses: `new`, `viewed`, `contacted`, `archived` (persisted in browser localStorage)
- RSS feeds configured in `data/signal_sources.json`
- Keyword filtering on titles/summaries minimizes unnecessary scraping and API calls
- Article text truncated to 5000 chars to keep Haiku costs low (~$0.07/day)
- Entity resolution uses fuzzy name matching; new entities auto-created when unmatched
