"""RSS feed ingestion with keyword filtering."""

import hashlib
import json
import logging
import re
import socket
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import feedparser

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"

# Keywords that suggest a market signal worth extracting
SIGNAL_KEYWORDS = [
    # Funding
    r"\braises?\b", r"\braised\b", r"\bfunding\b", r"\bseries [a-f]\b",
    r"\bseed\b", r"\bpre-seed\b", r"\bround\b", r"\b\$\d+[mkb]\b",
    r"\b€\d+[mkb]\b", r"\b£\d+[mkb]\b", r"\bvaluation\b", r"\bunicorn\b",
    # M&A
    r"\bacquir\w+\b", r"\bmerger\b", r"\btakeover\b", r"\bbought\b",
    # Hiring / Growth
    r"\bhir(es?|ing)\b", r"\bjobs?\b", r"\bexpand\w*\b", r"\blaunch\w*\b",
    r"\bopen\w* office\b", r"\bnew market\b",
    # Partnerships
    r"\bpartner\w*\b", r"\bdeal\b", r"\bcontract\b", r"\bsupply\b",
    # IPO / Exit
    r"\bipo\b", r"\bpublic\b", r"\blist(ing|ed)\b", r"\bexit\b",
    # Product
    r"\bproduct\b", r"\bplatform\b", r"\bsdk\b", r"\bapi\b",
    # German-language signals (DACH feeds)
    r"\bfinanzierung\w*\b", r"\bmillionen\b", r"\binvestor\w*\b",
    r"\bübernahme\b", r"\bserie [a-f]\b", r"\bgründer\w*\b",
    r"\bwachstum\b", r"\bstart-?up\b",
]

KEYWORD_PATTERN = re.compile("|".join(SIGNAL_KEYWORDS), re.IGNORECASE)


def load_sources():
    """Load signal sources from JSON."""
    path = DATA_DIR / "signal_sources.json"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_existing_signals():
    """Load existing signals to avoid duplicates."""
    path = DATA_DIR / "signals.json"
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def make_signal_id(url):
    """Deterministic signal ID from URL."""
    return "sig_" + hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]


def matches_keywords(text):
    """Check if text contains any signal keywords."""
    return bool(KEYWORD_PATTERN.search(text))


def parse_feed_date(entry):
    """Extract published date from feed entry."""
    for attr in ("published_parsed", "updated_parsed"):
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                dt = datetime(*parsed[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except (ValueError, TypeError):
                pass
    return datetime.now(timezone.utc).isoformat()


FEED_TIMEOUT_SECONDS = 10


def fetch_feed(source):
    """Fetch and parse a single RSS feed, returning candidate signals."""
    url = source.get("url", "")
    source_id = source.get("id", "")
    source_name = source.get("name", "")
    geo_tag = source.get("geography_tag", "")
    quality_weight = source.get("source_quality_weight", 2)
    source_domain = urlparse(url).netloc.removeprefix("www.")

    logger.info("Fetching feed: %s (%s)", source_name, url)

    old_timeout = socket.getdefaulttimeout()
    try:
        socket.setdefaulttimeout(FEED_TIMEOUT_SECONDS)
        feed = feedparser.parse(
            url,
            request_headers={"User-Agent": "NordicSignalIntelligence/1.0"},
        )
    except Exception as e:
        logger.error("Failed to parse feed %s: %s", url, e)
        return []
    finally:
        socket.setdefaulttimeout(old_timeout)

    if feed.bozo and not feed.entries:
        logger.warning("Feed %s returned no entries (bozo: %s)", url, feed.bozo_exception)
        return []

    candidates = []
    for entry in feed.entries:
        title = entry.get("title", "")
        summary = entry.get("summary", "")
        link = entry.get("link", "")

        if not link:
            continue

        # Keyword filter on title + summary
        combined = f"{title} {summary}"
        if not matches_keywords(combined):
            continue

        candidates.append({
            "url": link,
            "title": title,
            "summary": summary,
            "published_at": parse_feed_date(entry),
            "source_id": source_id,
            "source_name": source_name,
            "source_domain": source_domain,
            "source_quality_weight": quality_weight,
            "geography": geo_tag,
        })

    logger.info("Found %d candidates from %s (%d total entries)",
                len(candidates), source_name, len(feed.entries))
    return candidates


def ingest_all():
    """Fetch all active RSS sources and return deduplicated candidates."""
    sources = load_sources()
    active = [s for s in sources if s.get("is_active") and s.get("type") == "rss"]

    existing_signals = load_existing_signals()
    existing_urls = {s.get("source_url") for s in existing_signals}

    all_candidates = []
    seen_urls = set()

    for source in active:
        candidates = fetch_feed(source)
        for c in candidates:
            url = c["url"]
            if url in existing_urls or url in seen_urls:
                continue
            seen_urls.add(url)
            all_candidates.append(c)

    # Update last_fetched_at on sources
    now = datetime.now(timezone.utc).isoformat()
    for source in sources:
        if source.get("is_active") and source.get("type") == "rss":
            source["last_fetched_at"] = now

    sources_path = DATA_DIR / "signal_sources.json"
    with open(sources_path, "w", encoding="utf-8") as f:
        json.dump(sources, f, indent=2)

    logger.info("Ingested %d new candidates from %d feeds", len(all_candidates), len(active))
    return all_candidates


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    candidates = ingest_all()
    for c in candidates:
        print(f"  [{c['source_name']}] {c['title']}")
    print(f"\nTotal: {len(candidates)} new candidates")
