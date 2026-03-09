# Nordic Signal Intelligence — CLAUDE.md

> AI-powered career & deal radar that scans funding rounds, hiring waves, acquisitions, and market signals across European and US tech — generating 15 high-potential opportunities on demand via a single button click.

## Project Overview

- **Type**: Static site + automated Python pipeline
- **Hosting**: GitHub Pages
- **Pipeline**: GitHub Actions (manual trigger via `workflow_dispatch` + optional daily cron)
- **AI**: Claude Haiku for classification, extraction, and rationale
- **Frontend**: Jinja2 templates + vanilla JS/CSS (no framework)
- **Data**: JSON flat files committed to repo

## Repository Structure

```
nordic-signal-intelligence/
├── CLAUDE.md
├── config.json                    # User preferences (sectors, geo weights, etc.)
├── .github/
│   └── workflows/
│       └── daily-pipeline.yml     # GitHub Actions (manual dispatch + optional cron)
├── data/
│   ├── signals.json
│   ├── companies.json
│   ├── investors.json
│   ├── people.json
│   ├── opportunities.json
│   ├── signal_sources.json
│   └── archive/                   # Historical daily snapshots
│       └── 2026-03-09/
├── pipeline/
│   ├── ingest.py                  # RSS/API/scrape ingestion
│   ├── extract.py                 # Haiku entity extraction + classification
│   ├── deduplicate.py             # Domain/name matching
│   ├── score.py                   # Composite opportunity scoring
│   ├── rank.py                    # Top-N selection + archive
│   └── notify.py                  # Optional: email digest via SendGrid/Resend
├── templates/
│   ├── index.html                 # Jinja2 dashboard template
│   └── email.html                 # Optional: Jinja2 email template
├── static/
│   ├── style.css
│   └── app.js                     # Client-side filtering, status tracking
├── build.py                       # Renders Jinja2 → static HTML
└── docs/                          # GitHub Pages serves from here
    └── index.html
```

---

## Data Model

### 1. Signal

Core unit — a single market signal captured from a source.

| Field | Type | Notes |
|-------|------|-------|
| `id` | str (PK) | UUID |
| `source_url` | str | Original article/PR link |
| `source_id` | str → SignalSource | FK to signal source |
| `source_name` | str | e.g. "TechCrunch", "Sifted" |
| `signal_type` | enum | `funding_round` · `hiring_wave` · `acquisition` · `new_fund` · `media_mention` · `partnership` · `product_launch` · `expansion` |
| `signal_tier` | enum | `tier_1_strong` · `tier_2_medium` · `tier_3_weak` |
| `headline` | str | AI-extracted summary headline |
| `raw_text` | text | Full scraped text for re-processing |
| `published_at` | datetime | When the signal was published |
| `ingested_at` | datetime | When the pipeline captured it |
| `geography` | str | Region tag: "Nordics", "DACH", "UK", etc. |
| `country` | str | ISO country code |
| `ai_confidence` | float | Haiku classification confidence 0–1 |
| `company_ids` | list[str → Company] | Companies mentioned in this signal |
| `investor_ids` | list[str → Investor] | Investors mentioned in this signal |
| `person_ids` | list[str → Person] | People mentioned in this signal |
| `metadata` | json | Flexible: funding amount, round stage, etc. |

**Storage**: `data/signals.json`

### 2. Company

A company entity extracted from signals.

| Field | Type | Notes |
|-------|------|-------|
| `id` | str (PK) | UUID |
| `name` | str | Company name |
| `domain` | str | Website domain (primary dedup key) |
| `sector` | str | e.g. "PropTech", "FinTech", "HealthTech" |
| `sub_sector` | str | e.g. "Construction Procurement SaaS" |
| `stage` | enum | `seed` · `series_a` · `series_b` · `series_c` · `growth` · `public` |
| `hq_country` | str | ISO country code |
| `hq_city` | str | City name |
| `employee_count` | int | Latest known headcount |
| `founded_year` | int | Year founded |
| `linkedin_url` | str | Company LinkedIn page |
| `description` | text | AI-generated one-liner |
| `last_signal_at` | datetime | Most recent signal date |
| `signal_count` | int | Total signals associated |

**Storage**: `data/companies.json`

### 3. Investor

VC firms, angels, or funds appearing in signals.

| Field | Type | Notes |
|-------|------|-------|
| `id` | str (PK) | UUID |
| `name` | str | Fund / investor name |
| `type` | enum | `vc` · `angel` · `cvc` · `pe` · `family_office` |
| `aum_estimate` | str | Estimated AUM range |
| `focus_sectors` | list[str] | Investment themes |
| `focus_geographies` | list[str] | Target regions |
| `portfolio_count` | int | Known portfolio companies |
| `website` | str | Fund website |
| `linkedin_url` | str | LinkedIn page |
| `last_signal_at` | datetime | Most recent signal date |

**Storage**: `data/investors.json`

### 4. Person

Key people — founders, execs, partners to connect with.

| Field | Type | Notes |
|-------|------|-------|
| `id` | str (PK) | UUID |
| `name` | str | Full name |
| `role` | str | Current title |
| `company_id` | str → Company | FK to company |
| `investor_id` | str → Investor | FK to investor (if applicable) |
| `linkedin_url` | str | LinkedIn profile |
| `email_guess` | str | Pattern-based guess (first@domain) |
| `relevance_tag` | enum | `hiring_manager` · `founder` · `partner` · `c_suite` |

**Storage**: `data/people.json`

### 5. Opportunity

Scored, ranked output — the daily "Top 15" shown in the dashboard.

| Field | Type | Notes |
|-------|------|-------|
| `id` | str (PK) | UUID |
| `generated_date` | date | Date this opportunity was generated |
| `company_id` | str → Company | FK to company (if entity_type = company) |
| `investor_id` | str → Investor | FK to investor (if entity_type = investor) |
| `person_id` | str → Person | FK to person (if entity_type = person) |
| `signal_ids` | list[str → Signal] | Supporting signals |
| `contact_ids` | list[str → Person] | Suggested contacts |
| `opportunity_score` | float | Composite score 0–100 |
| `score_breakdown` | json | `{ signal_strength, recency, sector_fit, growth_velocity }` |
| `ai_rationale` | text | Haiku-generated 2-line pitch |
| `entity_type` | enum | `company` · `investor` · `person` |
| `status` | enum | `new` · `viewed` · `contacted` · `archived` |

**Storage**: `data/opportunities.json`

### 6. SignalSource

Registry of data sources the pipeline scrapes.

| Field | Type | Notes |
|-------|------|-------|
| `id` | str (PK) | UUID |
| `name` | str | e.g. "Sifted RSS", "Crunchbase API" |
| `type` | enum | `rss` · `api` · `scrape` · `manual` |
| `url` | str | Feed URL or API endpoint |
| `refresh_interval` | str | e.g. "6h", "24h" |
| `last_fetched_at` | datetime | Last successful pull |
| `is_active` | bool | Enabled/disabled toggle |
| `geography_tag` | str | Default geo for this source |

**Storage**: `data/signal_sources.json`

### Entity Relationships

| From | To | Relationship | Cardinality |
|------|----|-------------|-------------|
| Signal | Company | mentions | M:N |
| Signal | Investor | mentions | M:N |
| Signal | Person | mentions | M:N |
| Signal | SignalSource | ingested from | M:1 |
| Opportunity | Company | targets | M:1 |
| Opportunity | Investor | targets | M:1 |
| Opportunity | Signal | supported by | M:N |
| Opportunity | Person | suggests contact | M:N |
| Person | Company | works at | M:1 |
| Person | Investor | partner at | M:1 |

M:N relationships stored as ID arrays on the "owning" side (e.g. `signal_ids: ["s_001", "s_002"]` on Opportunity). No junction tables — keep it simple until you outgrow JSON. SQLite is a drop-in upgrade.

---

## Dashboard ↔ Data Model Mapping

| Dashboard Filter | Schema Field |
|-----------------|-------------|
| Entity Type (Companies / Investors / People) | `Opportunity.entity_type` |
| Geography dropdown | `Signal.geography` / `Company.hq_country` |
| Country dropdown | `Company.hq_country` / `Investor.focus_geographies` |
| Signal Tier checkboxes | `Signal.signal_tier` |
| Signal Type checkboxes | `Signal.signal_type` |
| Recency radio buttons | `Signal.published_at` (0–14d, 15–30d, 30–45d) |
| Sort by Signal Strength | `Opportunity.opportunity_score` |
| Summary card counts | Aggregated from filtered `Opportunity` records |
| Status tracking | `Opportunity.status` (persisted via localStorage) |
| "Generate Today's Opportunities" button | Triggers GitHub Actions `workflow_dispatch` via API call from frontend. Shows loading state while pipeline runs, then refreshes dashboard with new data |

---

## Scoring Engine

Composite score (0–100) with four weighted components:

| Component | Weight | Logic |
|-----------|--------|-------|
| Signal Strength | 35% | Tier weight × signal count. Tier 1 = 3×, Tier 2 = 2×, Tier 3 = 1× |
| Recency | 25% | Exponential decay on `published_at`. Full score at 0 days, 50% at 14 days, 10% at 45 days |
| Growth Velocity | 25% | Multiple signals in a short window. 3+ signals in 14 days = max score |
| Sector Relevance | 15% | Configurable sector preferences in `config.json`. Exact match = full, adjacent = 50% |

---

## Pipeline Steps

1. **Ingest** — Triggered by "Generate" button (workflow_dispatch) or optional cron. Fetches RSS, APIs, scrapers → raw text
2. **Extract** — Claude Haiku parses entities, classifies signal_type & tier
3. **Deduplicate** — Match companies/investors by domain, fuzzy name match
4. **Score** — Composite scoring: signal strength × recency × sector fit
5. **Rank & Serve** — Top 15 opportunities → JSON → Jinja2 dashboard

---

## Build Phases

### Phase 1: Foundation (2–3 days)

**Goal**: Working dashboard with mock data, full filter UI, and project scaffolding.

**Tasks**:

1. **Project scaffolding** (2h, setup) — Repo structure, CLAUDE.md, GitHub Pages setup, Jinja2 templates, vanilla JS/CSS
2. **Data model → JSON seed files** (3h, data) — Create all 6 JSON files with 20–30 realistic mock records each
3. **Dashboard layout + summary cards** (3h, frontend) — Header with "Generate Today's Opportunities" button (top-right, blue CTA), top-level counts (Companies / Investors / People), date display, responsive grid
4. **Filter sidebar** (4h, frontend) — Entity type checkboxes, geography dropdown, country dropdown, signal tier checkboxes, signal type checkboxes, recency radio buttons, sort dropdown — all wired to JS filtering logic
5. **Opportunity cards** (4h, frontend) — Card component showing: company/investor/person name, signal type badges, tier indicator, AI rationale, score, suggested contacts — with filter/sort reactivity
6. **Status tracking** (2h, frontend) — localStorage-based status toggling: new → viewed → contacted → archived. Filter by status. Persist across sessions
7. **Generate button wiring** (2h, frontend) — "Generate Today's Opportunities" button triggers GitHub Actions `workflow_dispatch` via GitHub API (`POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`). Shows loading/spinner state while pipeline runs. Requires a GitHub personal access token stored in a JS config. In Phase 1, button loads mock data; real pipeline wiring in Phase 2

**Acceptance Criteria**:
- Site loads on GitHub Pages with mock data
- "Generate Today's Opportunities" button visible in header top-right (blue CTA)
- Generate button shows loading state on click and loads mock data in Phase 1
- All 8 filter types work correctly and combine (AND logic)
- Summary cards update counts dynamically based on active filters
- Opportunity cards show score, rationale, contacts, signal badges
- Status tracking persists via localStorage
- "Reset All Filters" clears everything

---

### Phase 2: Ingestion Pipeline (4–5 days)

**Goal**: Automated data collection from 3–5 real sources, running on a schedule.

**Tasks**:

1. **Source registry setup** (2h, data) — Define initial sources in signal_sources.json: Sifted RSS, TechCrunch RSS, Crunchbase (if API access), EU-Startups, The Nordic Web
2. **RSS/feed ingestion script** (4h, pipeline) — Python script using feedparser to pull from RSS sources, extract article text via BeautifulSoup, store as raw signal records
3. **API ingestion** (4h, pipeline) — If Crunchbase API available: pull recent funding rounds. Fallback: scrape structured sources like Dealroom, Pitchbook news, or tech.eu
4. **Deduplication logic** (3h, pipeline) — Match companies by domain (primary key), fuzzy name match as fallback using difflib. Merge signals pointing to same entity
5. **Multi-geography tagging** (2h, pipeline) — Auto-tag geography based on source + content analysis. Support: Nordics, DACH, UK, Benelux, Southern Europe, US. Country-level ISO codes
6. **GitHub Actions workflow** (3h, setup) — Workflow with `workflow_dispatch` trigger (manual, called from dashboard button) + optional daily cron at 06:00 UTC. Runs ingestion scripts, commits updated JSON files, triggers Pages rebuild. Wire the dashboard "Generate" button to call the dispatch API with a GitHub PAT

**Acceptance Criteria**:
- Clicking "Generate Today's Opportunities" on dashboard triggers the full pipeline
- Pipeline can also run on optional daily cron schedule
- 3+ real data sources ingested successfully
- Raw signals stored with correct schema fields
- Deduplication prevents duplicate company/investor records
- Geography tags applied automatically
- New data appears on dashboard after each pipeline run

**Risks**: Source reliability — RSS feeds change structure, APIs have rate limits. Build with graceful failure handling per source so one broken source doesn't kill the whole pipeline.

---

### Phase 3: AI Extraction & Scoring (3–4 days)

**Goal**: Claude Haiku classifies signals, extracts entities, scores and ranks opportunities.

**Tasks**:

1. **Signal classification prompt** (3h, ai) — Haiku prompt: raw article text → signal_type, signal_tier, headline, confidence score. Structured JSON output with fallback parsing
2. **Entity extraction prompt** (3h, ai) — Haiku prompt: extract company names + domains, investor names, people + roles + companies. Returns structured JSON for entity linking
3. **Person/contact enrichment** (3h, ai) — For each extracted person: generate LinkedIn URL pattern, email guess (first@company-domain). Flag relevance: founder, hiring_manager, partner, c_suite
4. **Opportunity scoring engine** (4h, pipeline) — Composite score (0–100) per the scoring weights defined above
5. **AI rationale generation** (2h, ai) — Haiku generates a 2-line pitch per opportunity: why this company/investor is interesting right now. Grounded in specific signals
6. **Top-N selection + output** (2h, pipeline) — Select top 15 opportunities per day, write to opportunities.json with full score breakdown. Archive previous days

**Acceptance Criteria**:
- Haiku correctly classifies signal_type for 85%+ of signals
- Entities extracted and linked to correct company/investor records
- Person records include LinkedIn URL pattern and email guess
- Opportunity scores are deterministic and explainable via score_breakdown
- AI rationale is specific to each opportunity (not boilerplate)
- Top 15 opportunities surface genuinely interesting signals

**Risks**: Haiku token costs at scale — estimate ~$0.50–2/day for 50–100 signals. Prompt iteration needed to get classification accuracy right. Build an eval harness: 20 manually-labelled signals to test against.

---

### Phase 4: Polish & Optional Notifications (2–3 days)

**Goal**: UX polish, production hardening, and optional email delivery.

**Tasks**:

1. **Generate button UX refinement** (2h, frontend) — Polling for pipeline completion (check if opportunities.json updated via GitHub API or timestamp), success/failure toast notifications, cooldown to prevent double-triggers, "Last generated: X minutes ago" timestamp
2. **Dashboard UX polish** (4h, frontend) — Loading states, empty states, hover effects, mobile responsiveness, keyboard shortcuts for power users
3. **Historical view** (3h, frontend) — Date picker or "previous days" navigation to browse past opportunity batches. Archive structure: `data/archive/2026-03-09/`
4. **Error handling & monitoring** (2h, setup) — Pipeline failure alerts (GitHub Actions notification), source health dashboard, ingestion stats logging
5. **Configuration file** (2h, setup) — User-editable config.json: preferred sectors, geography weights, minimum signal tier, number of daily opportunities
6. **Optional: Email digest** (2h, pipeline) — GitHub Actions step that sends email via SendGrid / Resend free tier after pipeline completes. Not the primary flow — the dashboard "Generate" button is the main interaction

**Acceptance Criteria**:
- Generate button shows real-time feedback: loading → success/failure
- Dashboard works well on mobile
- Can browse previous days' opportunities
- Pipeline failures trigger GitHub notification
- Config changes (sectors, geo weights) reflected in next run
- (Optional) Email digest sends after generation if configured

**Risks**: GitHub Actions API rate limits for `workflow_dispatch` — 1,000 requests/hour per repo, which is more than enough for manual use. PAT token needs `actions:write` scope.

---

## Architecture Decisions

**Why GitHub Pages?** Zero hosting cost, same pattern as Fundraise Radar, no auth/server complexity. Pipeline runs server-side via GitHub Actions — the dashboard is just a static reader of JSON output.

**Why JSON flat files?** Simpler to debug (human-readable files in repo), no DB hosting needed, git history gives free versioning/rollback. SQLite is a drop-in upgrade if needed.

**Why Claude Haiku?** Best cost/quality ratio for structured extraction. At ~50–100 signals/day, expect ~$0.50–2/day.

**How does status tracking work without a server?** localStorage for personal use. Cross-device sync possible later via private gist or GitHub API.

**How does "Generate Today's Opportunities" work?** The dashboard button calls the GitHub API to trigger a `workflow_dispatch` event on the pipeline workflow. The pipeline runs in GitHub Actions (ingest → extract → score → rank), commits updated JSON, and GitHub Pages rebuilds. The dashboard polls for completion and refreshes. Requires a GitHub PAT with `actions:write` scope, stored in a JS config variable (this is a personal tool, not a public app — acceptable trade-off).

**Why manual trigger over automated email?** More control over when you run it, no email noise, instant feedback in the dashboard. Optional cron schedule available as a fallback if you want daily automation later.

---

## Claude Code Workflow

Follow the standard phase-based approach:

1. **Research** — Read this CLAUDE.md, understand the data model and current phase
2. **Plan** — Break the current phase's tasks into concrete implementation steps
3. **Implement** — Build incrementally, commit after each working task
4. **Validate** — Test against acceptance criteria before moving to next phase

Use `/compact` between phases to manage context. Each phase should be a focused session.

---

## Tech Stack

- Python 3.11
- Claude Haiku API (anthropic SDK)
- GitHub Actions
- BeautifulSoup / feedparser
- Jinja2 Templates
- GitHub Pages
- Vanilla JS + CSS
- SendGrid / Resend (optional, email digest only)
