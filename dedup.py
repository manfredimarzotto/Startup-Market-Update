import json
import logging
from datetime import datetime, timedelta

from fuzzywuzzy import fuzz

import db

logger = logging.getLogger(__name__)


def deduplicate_deal(new_deal):
    """Check if a deal is a duplicate of an existing one.

    Returns:
        (is_duplicate, existing_deal_id or None)
    If duplicate, merges data into the existing deal.
    """
    existing = db.get_all_deals_for_dedup(days=7)
    new_name = (new_deal.get("company_name") or "").strip().lower()
    new_date = _parse_date(new_deal.get("published_date"))

    for ex in existing:
        ex_name = (ex.get("company_name") or "").strip().lower()
        score = fuzz.ratio(new_name, ex_name)
        if score < 85:
            continue

        ex_date = _parse_date(ex.get("published_date"))
        if new_date and ex_date and abs((new_date - ex_date).days) > 3:
            continue

        # Duplicate found — merge
        logger.info("Duplicate detected: '%s' matches '%s' (score=%d)",
                     new_deal.get("company_name"), ex.get("company_name"), score)
        _merge_deal(ex, new_deal)
        return True, ex["id"]

    return False, None


def _merge_deal(existing, new_deal):
    """Merge new deal data into existing deal record."""
    updates = {}

    # Keep highest amount
    new_amt = new_deal.get("amount_usd")
    ex_amt = existing.get("amount_usd")
    if new_amt and (not ex_amt or new_amt > ex_amt):
        updates["amount_usd"] = new_amt
        updates["amount_raw"] = new_deal.get("amount_raw")
        updates["currency"] = new_deal.get("currency")

    # Merge investor lists
    merged_lead = list(set(existing.get("lead_investors", []) + (new_deal.get("lead_investors") or [])))
    merged_other = list(set(existing.get("other_investors", []) + (new_deal.get("other_investors") or [])))
    if merged_lead != existing.get("lead_investors", []):
        updates["lead_investors"] = merged_lead
    if merged_other != existing.get("other_investors", []):
        updates["other_investors"] = merged_other

    # Add source
    new_urls = new_deal.get("source_urls", [])
    new_names = new_deal.get("source_names", [])
    ex_urls = existing.get("source_urls", [])
    ex_names = existing.get("source_names", [])
    for url, name in zip(new_urls, new_names):
        if url not in ex_urls:
            ex_urls.append(url)
            ex_names.append(name)
    if ex_urls != existing.get("source_urls", []):
        updates["source_urls"] = ex_urls
        updates["source_names"] = ex_names

    # Fill in missing fields
    for field in ("company_hq_country", "company_hq_city", "sector", "short_description", "valuation"):
        if not existing.get(field) and new_deal.get(field):
            updates[field] = new_deal[field]

    if updates:
        db.update_deal(existing["id"], updates)


def _parse_date(date_str):
    """Try to parse a date string into a datetime object."""
    if not date_str:
        return None
    from dateutil import parser as dateutil_parser
    try:
        return dateutil_parser.parse(date_str, ignoretz=True)
    except (ValueError, TypeError):
        return None
