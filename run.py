"""Pipeline orchestrator: ingest → scrape → extract → score → build dashboard."""

import json
import logging
import sys
from pathlib import Path

from pipeline.ingest import ingest_all
from pipeline.scraper import scrape_candidates
from pipeline.extractor import extract_all
from pipeline.scorer import (
    _load_config,
    _load_json,
    _save_json,
    resolve_entities,
    score_signals,
    build_opportunities,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline")

DATA_DIR = Path(__file__).parent / "data"


def run_pipeline():
    """Run the full signal intelligence pipeline."""

    # Step 1: Ingest RSS feeds
    logger.info("=== Step 1: Ingesting RSS feeds ===")
    candidates = ingest_all()

    new_signals = []
    if candidates:
        logger.info("Found %d new candidates", len(candidates))

        # Step 2: Scrape full text
        logger.info("=== Step 2: Scraping article text ===")
        candidates = scrape_candidates(candidates)

        # Step 3: Extract signals via Claude Haiku
        logger.info("=== Step 3: Extracting signals (Claude Haiku) ===")
        new_signals = extract_all(candidates)
        if new_signals:
            logger.info("Extracted %d new signals", len(new_signals))
        else:
            logger.warning("No signals extracted from candidates.")
    else:
        logger.info("No new candidates found.")

    # Step 4: Entity resolution + merge with existing data
    logger.info("=== Step 4: Resolving entities ===")
    companies = _load_json("companies.json")
    investors = _load_json("investors.json")
    people = _load_json("people.json")
    existing_signals = _load_json("signals.json")

    if new_signals:
        new_signals, companies, investors, people = resolve_entities(
            new_signals, companies, investors, people
        )

    # Merge signals (append new, keep existing)
    all_signals = existing_signals + new_signals

    # Step 5: Score and rank opportunities (always re-score for updated recency)
    logger.info("=== Step 5: Scoring opportunities ===")
    config = _load_config()
    scored = score_signals(all_signals, config)
    opportunities = build_opportunities(scored, all_signals, companies, investors, config, people)

    logger.info("Generated %d opportunities", len(opportunities))

    # Step 6: Save all data
    logger.info("=== Step 6: Saving data ===")
    _save_json("signals.json", all_signals)
    _save_json("companies.json", companies)
    _save_json("investors.json", investors)
    _save_json("people.json", people)
    _save_json("opportunities.json", opportunities)

    # Step 7: Build dashboard
    _rebuild_dashboard()

    logger.info("=== Pipeline complete ===")
    logger.info("  Signals: %d total (%d new)", len(all_signals), len(new_signals))
    logger.info("  Companies: %d", len(companies))
    logger.info("  Investors: %d", len(investors))
    logger.info("  People: %d", len(people))
    logger.info("  Opportunities: %d", len(opportunities))


def _rebuild_dashboard():
    """Rebuild the static dashboard from current data."""
    logger.info("=== Building dashboard ===")
    from build import build
    build()


if __name__ == "__main__":
    try:
        run_pipeline()
    except Exception as e:
        logger.exception("Pipeline failed: %s", e)
        sys.exit(1)
