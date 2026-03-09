import logging
import random
import time
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests

from pipeline.config import SCRAPE_DELAY_SECONDS, USER_AGENTS

logger = logging.getLogger(__name__)

# Per-domain last-request timestamps for rate limiting
_domain_last_request = {}
# Cache robot parsers per domain
_robots_cache = {}


def _check_robots(url):
    """Return True if scraping this URL is allowed by robots.txt."""
    parsed = urlparse(url)
    domain = parsed.netloc
    if domain not in _robots_cache:
        rp = RobotFileParser()
        robots_url = f"{parsed.scheme}://{domain}/robots.txt"
        try:
            rp.set_url(robots_url)
            rp.read()
        except Exception:
            logger.debug("Could not fetch robots.txt for %s — allowing.", domain)
            _robots_cache[domain] = None
            return True
        _robots_cache[domain] = rp
    rp = _robots_cache[domain]
    if rp is None:
        return True
    return rp.can_fetch("*", url)


def _rate_limit(url):
    """Enforce per-domain rate limiting."""
    domain = urlparse(url).netloc
    last = _domain_last_request.get(domain, 0)
    elapsed = time.time() - last
    if elapsed < SCRAPE_DELAY_SECONDS:
        time.sleep(SCRAPE_DELAY_SECONDS - elapsed)
    _domain_last_request[domain] = time.time()


def scrape_article(url):
    """Scrape full article text from a URL using newspaper3k.
    Returns the article text or None on failure."""
    if not _check_robots(url):
        logger.info("Blocked by robots.txt: %s", url)
        return None

    _rate_limit(url)

    try:
        from newspaper import Article

        article = Article(url)
        article.set_html(
            requests.get(
                url,
                headers={"User-Agent": random.choice(USER_AGENTS)},
                timeout=20,
            ).text
        )
        article.parse()
        text = article.text
        if text and len(text.split()) > 50:
            return text
        logger.warning("newspaper3k returned thin content for %s", url)
    except Exception:
        logger.warning("newspaper3k failed for %s — skipping.", url)

    return None
