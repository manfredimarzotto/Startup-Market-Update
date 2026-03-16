# CLAUDE.md

## Project Overview

**Startup Intelligence Radar** — An AI-powered opportunity radar that aggregates market signals (funding rounds, hiring waves, partnerships, product launches) from RSS feeds and web sources, scores and ranks opportunities using Claude Haiku, and renders a static HTML dashboard deployed via GitHub Pages.

Live site: https://manfredimarzotto.github.io/Startup-Market-Update/

## Architecture

```
RSS/Scrape Sources → Ingest & Filter → Scrape Full Text → Claude Haiku Extraction → Entity Resolution → Score & Rank → JSON → build.py (Vite + React) → GitHub Pages
```

Pipeline steps (orchestrated by `run.py`):
1. **Ingest** — Fetch active RSS feeds, keyword-filter entries
2. **Scrape** — Fetch full article text (respects robots.txt, 1.5s rate limit)
3. **Extract** — Send article text to Claude Haiku for structured signal extraction
4. **Resolve** — Fuzzy-match extracted entities against existing data, create new records if unmatched
5. **Score** — Compute opportunity scores from signal strength, recency, velocity, geography
6. **Build** — Build React frontend with Vite, copy output to repo root

## Project Structure

```
├── run.py                          # Pipeline orchestrator (ingest → scrape → extract → score → build)
├── build.py                        # Dashboard builder (runs Vite build, copies output to repo root)
├── config.json                     # User preferences (sectors, geo weights, scoring)
├── pipeline/                       # Data pipeline modules
│   ├── __init__.py
│   ├── ingest.py                   #   RSS feed fetcher with keyword filtering
│   ├── scraper.py                  #   Full-text article scraper (Playwright + BeautifulSoup)
│   ├── extractor.py                #   Claude Haiku signal extraction (structured JSON)
│   └── scorer.py                   #   Entity resolution, scoring, opportunity generation
├── data/                           # JSON data layer (fetched at runtime by React app)
│   ├── signals.json                #   Market signals (funding, hiring, M&A, etc.)
│   ├── companies.json              #   Company profiles
│   ├── investors.json              #   Investor profiles
│   ├── people.json                 #   Key contacts (founders, partners)
│   ├── opportunities.json          #   Scored & ranked opportunities
│   └── signal_sources.json         #   Feed/source configuration
├── frontend/                       # React + Tailwind dashboard (Vite)
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html                  #   HTML shell
│   └── src/
│       ├── main.jsx                #   React entry point
│       ├── App.jsx                 #   Main layout (sidebar + card feed)
│       ├── index.css               #   Tailwind + mesh gradient + glassmorphism
│       ├── components/
│       │   ├── Header.jsx          #   Top bar with generate button
│       │   ├── shared.jsx          #   Shared UI primitives (scoreColor, FitDot, OwnerBadge, Spark, TriggerIcon)
│       │   ├── OpportunityCard.jsx #   Bento-box opportunity card (discovery view)
│       │   └── TriageTable.jsx     #   Tabular triage view
│       └── hooks/
│           ├── useData.js          #   Data loading + enrichment utilities
│           ├── useFilters.js       #   Filter/sort state + logic
│           └── useStatus.js        #   localStorage status persistence
├── templates/                      # (legacy) Jinja2 template — replaced by frontend/
├── static/                         # (legacy) CSS/JS — replaced by frontend/
├── index.html                      # Built output (served by GitHub Pages from root)
├── assets/                         # Built output (Vite JS/CSS bundles)
├── .github/workflows/pipeline.yml  # GitHub Actions: daily cron + manual dispatch
├── .nojekyll                       # Disables Jekyll processing on GitHub Pages
├── .gitignore                      # Ignores __pycache__, .env, .venv, build artifacts
├── requirements.txt                # Python dependencies
├── README.md                       # Project README
└── CLAUDE.md                       # This file
```

## Data Model

Six JSON files in `data/`:

- **signal_sources.json** — RSS feeds and scrape targets (id, url, type, refresh interval, geography_tag, is_active)
- **signals.json** — Individual market signals with type, tier, confidence, linked entity IDs, country code, metadata (amount, round stage, valuation)
- **companies.json** — Company profiles (sector, sub-sector, stage, hq_country, hq_city, employee_count)
- **investors.json** — Investor profiles (type, AUM, focus sectors/geographies)
- **people.json** — Key contacts (name, role, company/investor link, LinkedIn, relevance_tag)
- **opportunities.json** — AI-scored opportunities linking signals to entities with rationale, score breakdown, and status

## Config Reference (`config.json`)

| Field | Description | Default |
|---|---|---|
| `preferred_sectors` | Sector list for filtering | `["FinTech", "CleanTech", "HealthTech", "AI/ML", "SaaS", "DeepTech"]` |
| `geography_weights` | Multiplier per geography (0.0–1.0) | Nordics: 1.0, DACH: 0.8, UK: 0.8, etc. |
| `minimum_signal_tier` | Lowest tier to include | `"tier_3_weak"` |
| `daily_opportunities` | Max opportunities per run | `15` |
| `recency_decay_days` | Days until a signal scores 0 for recency | `30` |

## Scoring Formula

Opportunity scores are computed per entity (company/investor/person) in `pipeline/scorer.py`:

- **Signal strength** (0–25): Based on best signal tier — `tier_1_strong`=25, `tier_2_medium`=15, `tier_3_weak`=5
- **Recency** (0–30): Linear decay from 30→0 over `recency_decay_days` (default 30)
- **Deal magnitude** (0–25): Log-scaled funding amount — $100K=5, $1M=10, $10M=15, $100M=20, $1B+=25
- **Velocity** (0–10): `min(10, signal_count × 4)` — mild bonus for multiple signals
- **Type bonus** (scaled by 0.3): `funding_round`=30, `acquisition`=28, `new_fund`=25, `hiring_wave`=20, `partnership`=18, `expansion`=15, `product_launch`=12, `media_mention`=8
- **Geography weight**: Multiplier from `config.json` (default 0.5 for unlisted regions)

Final score: `min(99, (strength + recency + deal_magnitude + velocity) × geo_weight + type_bonus × 0.3)`

## Tech Stack

- **Language:** Python 3 (CI uses 3.11), Node.js 22 (frontend build)
- **AI:** Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) for signal extraction and rationale generation
- **Frontend:** React 19 + Tailwind CSS 3.4 (built with Vite 6), light theme (#fafbfc bg)
- **Scraping:** feedparser (RSS), Playwright + BeautifulSoup (article text)
- **Entity resolution:** fuzzywuzzy + python-Levenshtein
- **Deployment:** GitHub Actions → GitHub Pages (served from repo root on `main`)

## Environment Variables

- `ANTHROPIC_API_KEY` — Required for Claude Haiku signal extraction and rationale generation (stored as GitHub Actions secret)

## Commands

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend && npm install && cd ..

# Run the full pipeline (ingest → scrape → extract → score → build)
# Requires ANTHROPIC_API_KEY environment variable
python run.py

# Build dashboard only (builds React app with current JSON data)
python build.py

# Dev mode (hot reload on http://localhost:5173)
cd frontend && npm run dev

# Output appears in ./index.html + ./assets/ (repo root)
```

There are currently no automated tests in the project.

## Git Workflow

- Always rebase feature branches onto `main` before merging to keep a linear history
- Use `git rebase origin/main` (not merge commits) to resolve conflicts
- **Before every push**, always run `git fetch origin main && git rebase origin/main` first. This is mandatory — never push without rebasing onto the latest main. PRs are squash-merged, so pushing stale commits will cause merge conflicts that block the PR.
- **Automated pipeline commits** (`Update signals and dashboard - ...`) run daily on `main` via GitHub Actions. Long-lived feature branches will drift behind these commits. Rebase onto main before pushing to keep the branch current
- Never commit to `main` directly — always use feature branches and PRs

## Development Notes

- `run.py` orchestrates the full pipeline: ingest → scrape → extract → resolve → score → build
- `build.py` builds the React frontend with Vite and copies output to repo root (`index.html`, `assets/`)
- **Feature branches should only modify source files** (`frontend/`, `pipeline/`, etc.) — built output (`index.html`, `assets/`) is generated by the pipeline on `main` and should not be committed from feature branches to avoid merge conflicts
- All data lives in `data/*.json` — no database required
- React app fetches data from `./data/*.json` at runtime (no build-time embedding)
- React handles filtering, sorting, and localStorage-based status tracking
- Generate button opens GitHub Actions dispatch page (no token exposure)
- Pipeline runs daily at 06:00 UTC via cron, plus on-demand via workflow_dispatch
- Signal types: `funding_round`, `hiring_wave`, `acquisition`, `partnership`, `product_launch`, `expansion`, `new_fund`, `media_mention`
- Signal tiers: `tier_1_strong`, `tier_2_medium`, `tier_3_weak`
- Opportunity statuses: `new`, `viewed`, `contacted`, `archived` (persisted in browser localStorage)
- RSS feeds configured in `data/signal_sources.json`
- Keyword filtering on titles/summaries minimizes unnecessary scraping and API calls
- Article text truncated to 5000 chars to keep Haiku costs low (~$0.07/day)
- Entity resolution uses fuzzy name matching (substring containment); new entities auto-created when unmatched
- Country codes are normalized to European ISO-2 codes in `extractor.py`; non-European codes become `"Other"`
- Scraper respects robots.txt and uses a 1.5s rate limit between requests
- Scraper user agent: `NordicSignalIntelligence/1.0`

# ── Startup Intelligence Radar — Project Rules ──

## Scoring Model

The signal strength scoring model is defined in /docs/scoring-model.md. All code must follow it exactly.

### Core rules
- Score = Events (0–25) + Capital (0–25) + Momentum (0–25) + Sources (0–25) = 0–100
- Score is ABSOLUTE (81 always means the same thing). Percentile is shown as secondary context.
- 45-day decay window. Events older than 45 days contribute 0.
- Thesis Fit is NOT part of the score. It is a separate, user-configured overlay.
- Scores must be computed mechanically from structured inputs, NEVER generated as a vibes-based number by an LLM.

### Factor definitions
- **Events**: observable company actions (funding, hires, launches, partnerships). Base points × recency multiplier.
- **Capital**: funding signals only. Stage-adjusted round size + investor quality indicators. = 0 when no recent funding.
- **Momentum**: sector-level tailwinds (policy, competitor events, TAM revisions, sector VC volume trends). NOT company-specific.
- **Sources**: independent corroboration count × source quality weight. A company with 1 source MUST have a Sources score of 1–5. The Sources score shown in the UI must be consistent with the source count shown in the evidence metadata row.

### Score integrity checks
- If source count = 1, Sources factor must be ≤ 5
- If no recent funding, Capital factor must be 0
- Score distribution across all companies should span from single digits to ~85, NOT cluster in 65–81
- Target distribution: top 5% = 75–100, median = 40–55, bottom 30% = 0–30

## Summary Style

All company summaries must follow factual compression style. This applies to both the pipeline LLM prompt and any manually written text.

### Rules
1. Lead with the hard fact (round size, or key event if no funding)
2. Use middot separators (·) between facts
3. Include source count as a fact
4. Include one concrete market/policy datapoint if available
5. Maximum 120 characters
6. NO interpretation words: "validates", "signals", "positions", "captures", "at a critical moment", "inflection point", "conviction"
7. NO hedging: "meaningful", "substantial", "significant"
8. NO narrative framing: "at a moment when", "making this", "positioning the"

### Good examples
- "€30M Series A closed · defence procurement subsystems · 4 sources · NATO 3.5% GDP mandate in effect."
- "$9M round · AI parts procurement for MRO · 2 sources · investor undisclosed."
- "€270K across 3 angel closes · AI therapy localisation · 2 sources · no lead identified."
- "No new round · hiring surge +40% QoQ · 3 sources · German digitisation mandate Q3 2026."

### Bad examples (never produce these)
- "signals strong investor conviction in AI-driven supply chain modernization at a critical inflection point"
- "validates the seasonal hydrogen storage market at a critical inflection point where Europe's renewable overcapacity"
- "captures meaningful angel momentum for a culturally-adapted AI therapy model at a moment when mental health AI"

### Test
After generating summaries, grep for banned words. If any summary contains "signals", "validates", "positions", "inflection point", "critical moment", "meaningful", or "substantial", rewrite it.

## Trigger Style (Why Surfaced)

Each company should have 2–5 triggers in the "Why surfaced" drawer.

### Rules
- Each trigger needs: type (funding/policy/hiring/sector/competitor/growth), text (≤80 chars), time (relative)
- Triggers should come from DIFFERENT categories per company — not 3x "funding"
- Same factual compression rules as summaries: state what happened, not what it means
- If the pipeline can only extract 1–2 real triggers, show 1–2. Do not fabricate triggers to hit a count.

### Good triggers
- funding: "€30M Series A closed; Nordic defence fund consortium lead"
- policy: "NATO defence spending mandate raised to 3.5% GDP (binding)"
- hiring: "3 senior procurement roles posted — Tallinn, Brussels"
- sector: "European defence tech VC volume +140% YoY (Dealroom)"

### Bad triggers
- "Company is well-positioned to capture significant market share"
- "Strong investor conviction validates the thesis"

## UI Design System (v4)

- Theme: light (#fafbfc background, #fff cards, #0f172a primary text)
- Score colours: >=75 green (#10b981), >=50 amber (#d97706), <50 grey (#94a3b8)
- Factor labels in UI: Events, Capital, Momentum, Sources (NOT Timing, Market, or Fit)
- Fit badge: separate from score, coloured dot (green/amber/grey) + "high/medium/low fit"
- Signal filter chips: dark (#0f172a) when active
- Fit filter chips: green-tinted (#ecfdf5 bg, #059669 text) when active — visually distinct from signal chips
- Percentile shown as secondary text: "Top X%"
- Methodology footer always present at bottom
- Design reference file: docs/design-reference-v4.jsx

## Data Quality Rules

- Source count in evidence row must match Sources factor in score breakdown
- Capital factor = 0 when company has no recent funding round
- ~30% of companies should have owner assigned, CRM sync, and last-touch data
- Status should be a mix: mostly "new", some "viewed", a few "contacted"
- Contacted KPI at top must reflect actual count of contacted-status companies
- All numbers must be internally consistent — if the UI says "4 sources", the pipeline must have found 4 independent sources
