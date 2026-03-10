"""Article full-text scraper with robots.txt respect and rate limiting."""

import logging
import time
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

USER_AGENT = "NordicSignalIntelligence/1.0 (+https://github.com/manfredimarzotto/Startup-Market-Update)"
REQUEST_TIMEOUT = 15
RATE_LIMIT_SECONDS = 1.5
_robots_cache = {}


def _check_robots(url):
    """Check if we're allowed to scrape this URL per robots.txt."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

    if robots_url not in _robots_cache:
        rp = RobotFileParser()
        rp.set_url(robots_url)
        try:
            rp.read()
        except Exception:
            # If we can't read robots.txt, assume allowed
            _robots_cache[robots_url] = None
            return True
        _robots_cache[robots_url] = rp

    rp = _robots_cache[robots_url]
    if rp is None:
        return True
    return rp.can_fetch(USER_AGENT, url)


def _extract_text(html, url):
    """Extract article text from HTML using BeautifulSoup."""
    soup = BeautifulSoup(html, "html.parser")

    # Remove nav, footer, sidebar, script, style elements
    for tag in soup.find_all(["nav", "footer", "aside", "script", "style", "header"]):
        tag.decompose()

    # Try common article containers
    article = (
        soup.find("article")
        or soup.find("div", class_=lambda c: c and "article" in c.lower() if c else False)
        or soup.find("div", class_=lambda c: c and "content" in c.lower() if c else False)
        or soup.find("main")
    )

    if article:
        text = article.get_text(separator="\n", strip=True)
    else:
        text = soup.get_text(separator="\n", strip=True)

    # Clean up: collapse whitespace, limit length
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    text = "\n".join(lines)

    # Truncate to ~5000 chars to keep Claude API costs low
    if len(text) > 5000:
        text = text[:5000] + "\n[truncated]"

    return text


def scrape_article(url):
    """Scrape full text from a URL. Returns text or None on failure."""
    if not _check_robots(url):
        logger.info("Blocked by robots.txt: %s", url)
        return None

    try:
        resp = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning("Failed to fetch %s: %s", url, e)
        return None

    content_type = resp.headers.get("content-type", "")
    if "html" not in content_type.lower():
        logger.info("Skipping non-HTML content: %s (%s)", url, content_type)
        return None

    text = _extract_text(resp.text, url)
    if len(text) < 100:
        logger.info("Extracted text too short (%d chars): %s", len(text), url)
        return None

    return text


def scrape_candidates(candidates):
    """Scrape full text for a list of candidates. Adds 'full_text' key.

    Falls back to RSS summary if scraping fails.
    """
    for i, candidate in enumerate(candidates):
        url = candidate.get("url", "")
        logger.info("Scraping %d/%d: %s", i + 1, len(candidates), url)

        text = scrape_article(url)
        if text:
            candidate["full_text"] = text
        else:
            # Fallback to title + summary
            fallback = f"{candidate.get('title', '')}. {candidate.get('summary', '')}"
            candidate["full_text"] = fallback
            logger.info("Using RSS summary fallback for: %s", url)

        # Rate limit between requests
        if i < len(candidates) - 1:
            time.sleep(RATE_LIMIT_SECONDS)

    return candidates
