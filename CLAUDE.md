# CLAUDE.md

## Project Overview

**Startup Market Update** — A startup fundraise tracking pipeline that aggregates funding news from RSS feeds and NewsAPI, extracts deal data using Claude Haiku, and renders a static HTML dashboard deployed via GitHub Pages.

Live site: https://manfredimarzotto.github.io/Startup-Market-Update/

## Architecture

```
RSS Feeds / NewsAPI → Filter (keywords) → Scrape full text → Extract deals (Claude Haiku) → Normalize → Deduplicate → SQLite DB → HTML Dashboard
```

### Key Files

| File | Purpose |
|------|---------|
| `run.py` | Main pipeline orchestrator |
| `config.py` | API keys, RSS feeds, keywords, settings |
| `rss.py` | RSS feed fetcher |
| `newsapi.py` | NewsAPI fetcher |
| `scraper.py` | Full article text scraper |
| `extractor.py` | Deal extraction via Claude Haiku |
| `normalize.py` | Data normalization (amounts, dates, etc.) |
| `dedup.py` | Fuzzy deduplication of deals |
| `db.py` | SQLite database layer |
| `dashboard.py` | Jinja2 HTML dashboard renderer |
| `templates/dashboard.html` | Dashboard HTML template |
| `generate_preview.py` | Preview generator with sample data |
| `index.html` | Root redirect for GitHub Pages |
| `output/index.html` | Generated dashboard output |

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
python generate_preview.py
```

## Development Notes

- Pipeline runs as a GitHub Actions workflow (`.github/workflows/pipeline.yml`)
- Dashboard output goes to `output/index.html`
- SQLite DB and logs are gitignored
- RSS feeds are configured in `config.py` (TechCrunch, Sifted, EU-Startups, Tech.eu, VentureBeat)
- Keyword filtering happens on article titles before scraping to minimize API/scrape calls
- Geography filtering is available but currently disabled (`ALLOWED_COUNTRIES = []`)
