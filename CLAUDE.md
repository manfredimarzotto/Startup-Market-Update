# CLAUDE.md

## Project Overview

**Startup Market Update** — A startup fundraise tracking pipeline that aggregates funding news from RSS feeds and NewsAPI, extracts deal data using Claude Haiku, and renders a static HTML dashboard deployed via GitHub Pages.

Live site: https://manfredimarzotto.github.io/Startup-Market-Update/

## Architecture

```
RSS Feeds / NewsAPI → Filter (keywords) → Scrape full text → Extract deals (Claude Haiku) → Normalize → Deduplicate → SQLite DB → HTML Dashboard
```

## Project Structure

```
├── run.py                          # Entry point — orchestrates the full pipeline
├── pipeline/                       # Data ingestion and processing
│   ├── config.py                   #   Settings: API keys, RSS feeds, keywords
│   ├── rss.py                      #   RSS feed fetcher (TechCrunch, Sifted, etc.)
│   ├── newsapi.py                  #   NewsAPI fetcher with funding queries
│   ├── scraper.py                  #   Full article scraper (newspaper3k, robots.txt)
│   ├── extractor.py                #   Deal extraction via Claude Haiku
│   ├── normalize.py                #   Data normalization (countries, currencies, rounds)
│   ├── dedup.py                    #   Fuzzy deduplication (fuzzywuzzy)
│   └── db.py                       #   SQLite database layer
├── dashboard/                      # Dashboard rendering
│   ├── renderer.py                 #   Jinja2 HTML renderer with SVG charts
│   ├── preview.py                  #   Sample data preview generator
│   └── templates/
│       └── dashboard.html          #   Jinja2 HTML template
├── output/
│   └── index.html                  # Generated dashboard (sample data)
├── index.html                      # Root redirect for GitHub Pages
├── .github/workflows/pipeline.yml  # GitHub Actions: runs 2x daily, deploys to gh-pages
├── requirements.txt                # Python dependencies
└── CLAUDE.md                       # This file
```

## Tech Stack

- **Language:** Python 3
- **AI:** Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) for deal extraction
- **Data:** SQLite (local), feedparser, requests, BeautifulSoup, newspaper3k
- **Templating:** Jinja2
- **Dedup:** fuzzywuzzy + python-Levenshtein
- **Deployment:** GitHub Actions → GitHub Pages

## Environment Variables

- `ANTHROPIC_API_KEY` — Required for Claude Haiku deal extraction
- `NEWSAPI_KEY` — Required for NewsAPI article fetching

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run the full pipeline
python run.py

# Generate preview dashboard with sample data
python -m dashboard.preview
```

## Git Workflow

- Always rebase feature branches onto `main` before merging to keep a linear history
- Use `git rebase origin/main` (not merge commits) to resolve conflicts

## Development Notes

- Pipeline runs as a GitHub Actions workflow (`.github/workflows/pipeline.yml`)
- Dashboard output goes to `output/index.html`
- SQLite DB (`deals.db`) and logs are gitignored
- RSS feeds are configured in `pipeline/config.py`
- Keyword filtering happens on article titles before scraping to minimize API/scrape calls
- Geography filtering is available but currently disabled (`ALLOWED_COUNTRIES = []`)
