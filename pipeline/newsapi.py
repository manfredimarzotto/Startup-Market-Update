import logging
import time
from datetime import datetime, timedelta

import requests

from pipeline.config import NEWSAPI_KEY

logger = logging.getLogger(__name__)

QUERIES = [
    '"startup raises" OR "funding round" OR "Series A" OR "Series B"',
    '"startup fundraise" OR "seed round" OR "venture capital"',
    '"European startup funding" OR "startup secures"',
]

ENDPOINT = "https://newsapi.org/v2/everything"


def fetch_newsapi():
    """Query NewsAPI with rotating queries. Returns unified article list."""
    if not NEWSAPI_KEY:
        logger.warning("NEWSAPI_KEY not set — skipping NewsAPI.")
        return []

    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    articles = []
    seen_urls = set()

    for query in QUERIES:
        try:
            logger.info("NewsAPI query: %s", query[:60])
            resp = requests.get(
                ENDPOINT,
                params={
                    "q": query,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "from": yesterday,
                    "apiKey": NEWSAPI_KEY,
                },
                timeout=30,
            )
            if resp.status_code == 429:
                logger.warning("NewsAPI rate limit hit — stopping NewsAPI for this run.")
                break
            resp.raise_for_status()
            data = resp.json()
            for item in data.get("articles", []):
                url = item.get("url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                content = item.get("content") or item.get("description") or ""
                articles.append({
                    "title": item.get("title", ""),
                    "url": url,
                    "content": content,
                    "published_date": item.get("publishedAt", ""),
                    "source": "NewsAPI",
                })
            logger.info("Got %d articles from query", len(data.get("articles", [])))
        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 429:
                logger.warning("NewsAPI rate limit hit — stopping.")
                break
            logger.exception("NewsAPI HTTP error")
        except Exception:
            logger.exception("NewsAPI fetch error")
        time.sleep(2)

    return articles
