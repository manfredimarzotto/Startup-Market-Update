# Startup Intelligence Radar

AI-powered opportunity radar that scans startup news daily, uses Claude Haiku to extract structured market signals (funding rounds, hiring waves, partnerships, acquisitions), scores and ranks opportunities, and displays everything on a static HTML dashboard deployed via GitHub Pages.

**Live dashboard:** https://manfredimarzotto.github.io/Startup-Market-Update/

## What This Project Does

**Startup Intelligence Radar** is an automated deal-sourcing tool that finds and ranks startup investment opportunities. It scans news sources daily, uses AI to extract structured data, scores the opportunities, and presents ranked results on a web dashboard — all running for pennies a day with no infrastructure beyond GitHub.

## How It Works

1. **Collects news** — Pulls articles from 5 RSS feeds (Sifted, TechCrunch, EU-Startups, The Nordic Web, Tech.eu) and filters them by keywords like "raises", "acquires", "hiring"
2. **Reads the articles** — Scrapes full article text (respecting robots.txt and rate limits)
3. **AI extracts structured data** — Sends each article to Claude Haiku, which identifies: what happened (funding round? acquisition? hiring wave?), which companies/investors/people are involved, how much money, what country, and how confident it is
4. **Links entities** — Fuzzy-matches extracted names against a growing database of companies, investors, and people. Creates new records when no match is found
5. **Scores opportunities** — Computes a 0–99 score based on signal strength, recency (decays over 45 days), velocity (multiple signals = higher score), geography (Nordics weighted highest), and signal type
6. **Generates rationales** — Claude Haiku writes a 1–2 sentence explanation of why each opportunity matters
7. **Builds a dashboard** — Renders a static HTML page with all data embedded, deployed to GitHub Pages
8. **Runs daily** — GitHub Actions triggers the pipeline at 06:00 UTC and commits the updated data + dashboard to `main`

## Data Flow

```
RSS Feeds → Keyword Filter → Scrape Articles → Claude Haiku Extraction
→ Entity Resolution → Scoring → Dashboard (GitHub Pages)
```

## Tech Stack

- **Python 3.11** for the pipeline (feedparser, BeautifulSoup, requests, fuzzywuzzy)
- **Claude Haiku** (`claude-haiku-4-5-20251001`) for AI extraction and rationale generation
- **Jinja2** for HTML templating
- **Vanilla JS/CSS** for the frontend dashboard
- **GitHub Actions + GitHub Pages** for CI/CD and hosting

## Key Technical Choices

- **No database** — All data lives in 6 JSON files versioned in Git
- **No backend server** — The dashboard is a single static HTML file; filtering/sorting happens client-side in vanilla JS
- **Cheap to run** — Articles are truncated to 5,000 chars; total API cost is ~$0.07/day
- **Fully automated** — Daily cron via GitHub Actions; can also be triggered manually from the dashboard

## Project Structure

| Area | Key Files |
|------|-----------|
| Pipeline orchestration | `run.py`, `build.py` |
| Data pipeline modules | `pipeline/ingest.py`, `scraper.py`, `extractor.py`, `scorer.py` |
| Data layer | `data/*.json` (signals, companies, investors, people, opportunities) |
| Frontend | `templates/index.html`, `static/app.js`, `static/style.css` |
| Config | `config.json` (sectors, geography weights, scoring params) |
| Automation | `.github/workflows/pipeline.yml` |

## Dashboard Features

- Filter by entity type, geography, country, signal tier, signal type, recency
- Sort by opportunity score or most recent signals
- Track status per opportunity (new → viewed → contacted → archived)
- Clean light theme with responsive mobile layout

## Scoring Formula

Opportunity scores (0–99) are computed per entity in `pipeline/scorer.py`:

| Component | Range | Description |
|-----------|-------|-------------|
| Signal strength | 0–35 | Based on best signal tier (strong=35, medium=22, weak=10) |
| Recency | 0–25 | Linear decay from 25→0 over 45 days |
| Velocity | 0–25 | Multiple recent signals boost score (`min(25, count × 8)`) |
| Geography weight | 0.5–1.0× | Nordics: 1.0, DACH: 0.8, UK: 0.8, Benelux: 0.7, Southern Europe: 0.6, US/Other: 0.5 |
| Type bonus | ×0.3 | funding_round=30, acquisition=28, new_fund=25, hiring_wave=20, etc. |

**Final score:** `min(99, (strength + recency + velocity) × geo_weight + type_bonus × 0.3)`

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the full pipeline (requires ANTHROPIC_API_KEY)
python run.py

# Or build dashboard only (renders templates with current JSON data)
python build.py

# Output: ./index.html (served by GitHub Pages from repo root)
```

## Environment Variables

- `ANTHROPIC_API_KEY` — Required for Claude Haiku signal extraction and rationale generation (stored as GitHub Actions secret)
