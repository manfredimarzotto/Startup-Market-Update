#!/usr/bin/env python3
"""Main pipeline orchestrator for Startup Fundraise Radar."""

import logging
import os
import sys
from datetime import datetime

from pipeline import db, rss, newsapi, scraper, extractor, dedup
from pipeline import normalize as norm
from pipeline.config import FUNDING_KEYWORDS, MAX_SCRAPE_PER_RUN, ALLOWED_COUNTRIES
from dashboard import renderer as dashboard

# Setup logging
os.makedirs("logs", exist_ok=True)
log_file = os.path.join("logs", f"run_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


def title_matches_keywords(title):
    """Check if title contains at least one funding-related keyword."""
    title_lower = title.lower()
    return any(kw.lower() in title_lower for kw in FUNDING_KEYWORDS)


def run_pipeline():
    logger.info("=== Pipeline started ===")

    # 1. FETCH
    logger.info("Step 1: Fetching articles...")
    rss_articles = rss.fetch_all_feeds()
    newsapi_articles = newsapi.fetch_newsapi()
    all_articles = rss_articles + newsapi_articles
    logger.info("Fetched %d total articles (%d RSS, %d NewsAPI)",
                len(all_articles), len(rss_articles), len(newsapi_articles))

    # 2. FILTER
    logger.info("Step 2: Filtering...")
    # Deduplicate by URL
    seen_urls = set()
    unique_articles = []
    for art in all_articles:
        url = art["url"]
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        unique_articles.append(art)
    logger.info("After URL dedup: %d articles", len(unique_articles))

    # Skip already-seen articles
    new_articles = []
    for art in unique_articles:
        if not db.is_article_seen(art["url"]):
            new_articles.append(art)
    logger.info("After DB dedup: %d new articles", len(new_articles))

    # Keyword pre-filter on title
    filtered = [a for a in new_articles if title_matches_keywords(a["title"])]
    logger.info("After keyword filter: %d articles", len(filtered))

    # 3. ENRICH
    logger.info("Step 3: Enriching short articles...")
    scrape_count = 0
    for art in filtered:
        word_count = len(art["content"].split())
        if word_count < 200 and scrape_count < MAX_SCRAPE_PER_RUN:
            logger.info("Scraping full text for: %s", art["url"])
            full_text = scraper.scrape_article(art["url"])
            if full_text:
                art["content"] = full_text
                scrape_count += 1
            else:
                db.mark_article_seen(art["url"], art["title"], art["source"], scrape_failed=True)

    # 4. EXTRACT
    logger.info("Step 4: Extracting deal data via Haiku...")
    deals = []
    for art in filtered:
        # Mark as seen regardless of extraction result
        db.mark_article_seen(art["url"], art["title"], art["source"])

        if len(art["content"].split()) < 30:
            logger.info("Skipping very short article: %s", art["title"][:80])
            continue

        result = extractor.extract_deal(art["title"], art["content"])
        if result is None:
            continue
        if not result.get("is_funding_announcement"):
            continue

        # Attach source metadata
        result["source_urls"] = [art["url"]]
        result["source_names"] = [art["source"]]
        result["published_date"] = art["published_date"]
        deals.append(result)

    logger.info("Extracted %d funding deals", len(deals))

    # 5. NORMALIZE
    logger.info("Step 5: Normalizing...")
    for deal in deals:
        norm.normalize_deal(deal)

    # Apply geography filter if configured
    if ALLOWED_COUNTRIES:
        deals = [d for d in deals if d.get("company_hq_country") in ALLOWED_COUNTRIES]
        logger.info("After geo filter: %d deals", len(deals))

    # 6. DEDUPLICATE & 7. STORE
    logger.info("Step 6-7: Deduplicating and storing...")
    new_count = 0
    dup_count = 0
    for deal in deals:
        is_dup, existing_id = dedup.deduplicate_deal(deal)
        if is_dup:
            dup_count += 1
        else:
            db.insert_deal(deal)
            new_count += 1

    logger.info("Stored %d new deals, merged %d duplicates", new_count, dup_count)

    # 8. RENDER
    logger.info("Step 8: Rendering dashboard...")
    dashboard.render_dashboard()

    logger.info("=== Pipeline complete ===")


if __name__ == "__main__":
    db.init_db()
    run_pipeline()
