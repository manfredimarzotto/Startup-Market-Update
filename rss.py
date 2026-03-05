import logging
import time

import feedparser

from config import RSS_FEEDS

logger = logging.getLogger(__name__)


def fetch_all_feeds():
    """Fetch all configured RSS feeds and return a unified article list."""
    articles = []
    for feed_cfg in RSS_FEEDS:
        name = feed_cfg["name"]
        url = feed_cfg["url"]
        try:
            logger.info("Fetching RSS: %s", name)
            feed = feedparser.parse(url)
            if feed.bozo and not feed.entries:
                logger.warning("RSS parse error for %s: %s", name, feed.bozo_exception)
                continue
            for entry in feed.entries:
                # Extract content — prefer full content, fall back to summary
                content = ""
                if hasattr(entry, "content") and entry.content:
                    content = entry.content[0].get("value", "")
                elif hasattr(entry, "summary"):
                    content = entry.summary or ""

                # Strip HTML tags for word counting (rough)
                import re
                text_only = re.sub(r"<[^>]+>", " ", content).strip()

                published = ""
                if hasattr(entry, "published"):
                    published = entry.published
                elif hasattr(entry, "updated"):
                    published = entry.updated

                articles.append({
                    "title": entry.get("title", ""),
                    "url": entry.get("link", ""),
                    "content": text_only,
                    "published_date": published,
                    "source": name,
                })
            logger.info("Got %d entries from %s", len(feed.entries), name)
        except Exception:
            logger.exception("Failed to fetch RSS feed: %s", name)
        time.sleep(2)  # 2-second delay between feeds
    return articles
