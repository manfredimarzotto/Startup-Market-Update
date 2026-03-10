# Startup Radar Intelligence

AI-powered opportunity radar for startup and tech market signals. Aggregates funding rounds, hiring waves, partnerships, and product launches — then scores and ranks opportunities with Claude Haiku.

**Live dashboard:** https://manfredimarzotto.github.io/Startup-Market-Update/

## How it works

```
RSS/Web Sources → Ingest & Filter → Claude Haiku Extraction → Score & Rank → Static Dashboard
```

- **30 signals** across funding, hiring, M&A, partnerships, product launches
- **20 companies** tracked (Einride, Pleo, Wayve, Northvolt, Vercel, etc.)
- **15 investors** profiled (EQT Ventures, Sequoia, Atomico, Insight Partners, etc.)
- **15 ranked opportunities** with AI rationale and key contacts

## Quick start

```bash
pip install -r requirements.txt
python build.py
# Open docs/index.html
```

## Dashboard features

- Filter by entity type, geography, country, signal tier, signal type, recency
- Sort by opportunity score or most recent signals
- Track status per opportunity (new → viewed → contacted → archived)
- Dark terminal-style UI with responsive mobile layout

## Status

- **Phase 1** (current): Static dashboard with mock data
- **Phase 2** (next): Live RSS ingestion, web scraping, Claude Haiku extraction pipeline
