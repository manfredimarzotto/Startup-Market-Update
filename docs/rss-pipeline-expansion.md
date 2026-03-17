# RSS Pipeline Expansion — Implementation Guide

## Current state

You're running 5 RSS feeds. Most companies show "1 source" in the evidence row,
which means Source Density scores are structurally weak and the scoring model
can't do its job properly. The goal is to get to 12–15 independent feeds so that
well-covered companies naturally surface 3–5 source confirmations.

---

## Source availability audit

I've verified which sources actually have free, accessible RSS feeds
vs. which are paywalled/API-gated. Only verified feeds are included below.

### Tier 1 — High-quality, free RSS (add these first)

| Source | Feed URL | Coverage | Source quality weight |
|--------|----------|----------|---------------------|
| **Crunchbase News** | `https://news.crunchbase.com/feed/` | Global startup funding, data-driven reporting | 4 (specialist) |
| **ArcticStartup** | `https://arcticstartup.com/feed/` | Nordic + Baltic startups, funding, exits | 3 (regional specialist) |
| **tech.eu** | `https://tech.eu/feed/` | Pan-European tech and VC | 4 (Tier 1 European) |
| **TechCrunch Venture** | `https://techcrunch.com/category/venture/feed/` | Global VC and funding rounds | 4 (Tier 1) |
| **deutsche-startups.de** | `https://www.deutsche-startups.de/feed/` | German/DACH startup scene (German language) | 3 (regional specialist) |
| **Startup Insider** | `https://startup-insider.com/feed/` | DACH startup news and funding | 3 (regional specialist) |
| **The Nordic Web** | `https://thenordicweb.com/feed/` | Nordic tech ecosystem coverage | 3 (regional specialist) |

### Tier 2 — Useful supplementary feeds

| Source | Feed URL | Coverage | Source quality weight |
|--------|----------|----------|---------------------|
| **VentureBeat AI** | `https://venturebeat.com/category/ai/feed/` | AI-focused startup and enterprise news | 3 (specialist) |
| **UKTN** | `https://www.uktech.news/feed` | UK tech news and funding | 2 (regional) |
| **Silicon Canals** | `https://siliconcanals.com/feed/` | European startup funding | 2 (regional) |
| **NordicStartupNews** | `https://nordicstartupnews.com/feed/` | Nordic early-stage startups | 2 (regional) |
| **Gründerszene** | `https://www.businessinsider.de/gruenderszene/feed/` | German startup scene (German language) | 2 (regional) |

### NOT available as free RSS (don't waste time)

| Source | Why not | Workaround |
|--------|---------|------------|
| **Dealroom** | Paid SaaS, no public RSS. API requires subscription. | None for v1. Could explore Dealroom for Builders (free for <$10M startups) later. |
| **PitchBook** | Enterprise-gated. No public feed. | You have access through William Blair, but API is separately licensed. |
| **Crunchbase Pro API** | Paid ($49/mo+). The RSS feed above is their free news blog, NOT structured funding data. | Use the news RSS for now; structured API is a v2 upgrade. |
| **The Information** | Paywalled, no RSS. | Skip. |
| **Sifted Pro** | Free tier has RSS but some content is gated. | You may already have this — verify `https://sifted.eu/feed/` still works. |

---

## Implementation plan

### Step 1: Add Tier 1 feeds (biggest impact)

```
Read the current RSS feed configuration. It should be a list of feed URLs
somewhere in the pipeline code (likely a Python list, JSON config, or
environment variable).

Add these 7 new feeds to the existing list:

1. https://news.crunchbase.com/feed/
2. https://arcticstartup.com/feed/
3. https://tech.eu/feed/
4. https://techcrunch.com/category/venture/feed/
5. https://www.deutsche-startups.de/feed/
6. https://startup-insider.com/feed/
7. https://thenordicweb.com/feed/

For each feed, also store its source quality weight (used by the Source
Density scoring factor):
- Crunchbase News: 4
- ArcticStartup: 3
- tech.eu: 4
- TechCrunch Venture: 4
- deutsche-startups.de: 3
- Startup Insider: 3
- The Nordic Web: 3

Make sure the feed parser handles potential issues:
- Some feeds may return XML, some Atom. Use feedparser which handles both.
- Add a timeout (10 seconds) per feed so one slow feed doesn't block the run.
- Log any feeds that fail to parse so we can diagnose without breaking the pipeline.
- For German-language feeds (deutsche-startups, Startup Insider, Gründerszene),
  the LLM extraction step should handle German text — Claude Haiku can process
  German without issues, just make sure the system prompt doesn't assume English.
```

### Step 2: Update source tracking for deduplication

```
The Source Density scoring factor needs to know WHICH sources confirmed
a given company/event, not just how many articles were found.

Update the pipeline to track, per company, per event:
- source_domain: the domain of the RSS feed (e.g., "arcticstartup.com")
- source_quality: the weight from the config (1-5)
- article_url: the specific article URL
- fetched_at: when we ingested it

CRITICAL: Deduplication rules (from scoring-model.md):
- Multiple outlets running the same press release = 1 source at the
  highest-quality tier present
- To detect this: if two articles about the same company + same event
  have >80% text overlap (or were published within 1 hour of each other
  with the same facts), treat them as the same source
- Simple heuristic for v1: if two articles share the same company name
  and the same funding amount and were published on the same day,
  flag them as potential duplicates and count only the highest-tier source

After deduplication, the source count shown in the UI evidence row
should EXACTLY match the number of independent sources found.
```

### Step 3: Wire source quality into Source Density scoring

```
Read docs/scoring-model.md, specifically the Source Density factor (Factor 4).

Update the scoring engine so that Source Density is computed as:

  raw_source_score = sum(source_quality_weight for each independent source)
  Source Density = min(25, raw_source_score)

Where source_quality_weight comes from the feed config:
  - Tier 1 publication (TechCrunch, tech.eu, Crunchbase News): 4
  - Specialist/regional (ArcticStartup, deutsche-startups, UKTN): 3
  - General regional: 2
  - Company press release / blog: 4 (primary source)
  - Social media / LinkedIn: 1.5
  - Unverified aggregator: 1

Example: A company covered by Crunchbase News (4) + ArcticStartup (3)
+ deutsche-startups (3) = Source Density of 10/25.

A company covered only by one aggregator blog (1) = Source Density of 1/25.

This should produce much more differentiated Source scores than the current
system, and the source count in the evidence row will now be meaningful
rather than "1 source" for everything.
```

### Step 4: Add Tier 2 feeds

After Tier 1 is working and you've verified source counts are improving:

```
Add these supplementary feeds to the pipeline:

1. https://venturebeat.com/category/ai/feed/ (weight: 3)
2. https://www.uktech.news/feed (weight: 2)
3. https://siliconcanals.com/feed/ (weight: 2)
4. https://nordicstartupnews.com/feed/ (weight: 2)
5. https://www.businessinsider.de/gruenderszene/feed/ (weight: 2)

Same parser rules as Step 1. These are lower-priority but increase
geographic coverage (UK, broader Europe, DACH depth) and will help
companies that aren't covered by Tier 1 sources get non-zero Source
Density scores.
```

### Step 5: Validate the impact

```
After adding all new feeds, run the pipeline and show me:

1. Source count distribution across all companies:
   - How many companies now have 1 source? 2? 3? 4+?
   - Target: at least 30% of companies should have 2+ sources
   - Target: top 10 companies should have 3+ sources

2. Source Density factor distribution:
   - Before expansion: what was the mean/median Sources score?
   - After expansion: what is the new mean/median?
   - Are there still companies with Sources > 10 but source_count = 1?
     (That would be a bug — consistency check)

3. Overall score distribution change:
   - Show the before/after histogram or percentile table
   - Did the expansion create more spread in scores?

4. New companies surfaced:
   - Are there companies that now appear in the radar that weren't
     there before? (Covered by Nordic/DACH feeds but not by the
     original 5 feeds)

5. Any feed failures or parsing issues to fix?
```

---

## Expected impact

### Source count improvement

| Metric | Before (5 feeds) | After (12+ feeds) |
|--------|------------------|-------------------|
| Companies with 1 source | ~85% | ~40–50% |
| Companies with 2+ sources | ~15% | ~40–50% |
| Companies with 3+ sources | ~5% | ~15–20% |
| Max sources for top company | 2–3 | 5–7 |

### Score distribution improvement

The main effect will be on Source Density, which will create more separation:
- Companies covered by multiple Tier 1 outlets (TechCrunch + Crunchbase + tech.eu)
  will score 12–20 on Sources
- Companies with one regional mention will score 2–3 on Sources
- This 10–18 point spread on one factor alone creates much more honest
  differentiation in total scores

### New geographic coverage

| Region | Before | After |
|--------|--------|-------|
| Nordics | Partial (Sifted) | Strong (ArcticStartup + Nordic Web + Nordic Startup News) |
| DACH | Weak | Strong (deutsche-startups + Startup Insider + Gründerszene) |
| UK | Partial (TechCrunch, Sifted) | Better (UKTN added) |
| Broader EU | Partial | Better (Silicon Canals + tech.eu dedicated feed) |

---

## Pipeline performance considerations

- 12 feeds at ~50 articles each = ~600 articles per run
- Current pipeline processes ~250 articles (5 feeds × ~50)
- Claude Haiku extraction at ~600 articles ≈ $0.15–0.20 per run (still very cheap)
- Add 15-second total timeout per feed so pipeline completes in <5 minutes
- Consider parallel fetching (asyncio or threading) if sequential is too slow

---

## What this does NOT solve

Adding more RSS feeds improves Source Density but does NOT fix:

1. **Events factor** — still depends on what types of events the articles describe.
   The LLM extraction prompt needs to classify event types (funding, hiring,
   partnership, product launch) for Events scoring to work properly.

2. **Momentum factor** — sector-level signals (policy changes, TAM revisions)
   are rarely in startup-focused RSS feeds. These may need manual input or
   a separate feed of policy/regulatory news (e.g., EU policy RSS, government
   gazette feeds). This is a v2 enhancement.

3. **Capital factor detail** — round size and stage come from article extraction,
   which is already in the pipeline. But investor quality indicators (lead
   investor track record, sector relevance) require enrichment data that RSS
   alone can't provide. v2 enhancement.

For v1, the RSS expansion primarily strengthens Source Density and broadens
company coverage. That's the highest-impact improvement for the least effort.
