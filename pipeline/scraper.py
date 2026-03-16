"""Article full-text scraper using Playwright (with requests fallback).

Uses a headless Chromium browser to render JS-heavy pages, bypass
simple bot detection, and handle cookie walls. Falls back to plain
requests for speed when Playwright is unavailable.
"""

import logging
import time
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
REQUEST_TIMEOUT = 20_000  # Playwright uses milliseconds
RATE_LIMIT_SECONDS = 1.5
MAX_TEXT_CHARS = 5000
_robots_cache = {}

# Lazy-loaded Playwright browser instance
_browser = None
_playwright_ctx = None


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
            _robots_cache[robots_url] = None
            return True
        _robots_cache[robots_url] = rp

    rp = _robots_cache[robots_url]
    if rp is None:
        return True
    return rp.can_fetch(USER_AGENT, url)


def _get_browser():
    """Lazy-init a Playwright Chromium browser."""
    global _browser, _playwright_ctx
    if _browser is not None:
        return _browser

    try:
        from playwright.sync_api import sync_playwright
        _playwright_ctx = sync_playwright().start()
        _browser = _playwright_ctx.chromium.launch(headless=True)
        logger.info("Playwright browser started")
        return _browser
    except Exception as e:
        logger.warning("Playwright unavailable, will use requests fallback: %s", e)
        return None


def _close_browser():
    """Close the Playwright browser if running."""
    global _browser, _playwright_ctx
    if _browser:
        try:
            _browser.close()
        except Exception:
            pass
        _browser = None
    if _playwright_ctx:
        try:
            _playwright_ctx.stop()
        except Exception:
            pass
        _playwright_ctx = None


def _extract_text(html):
    """Extract article text from HTML using BeautifulSoup."""
    soup = BeautifulSoup(html, "html.parser")

    # Remove nav, footer, sidebar, script, style elements
    for tag in soup.find_all(["nav", "footer", "aside", "script", "style", "header"]):
        tag.decompose()

    # Try common article containers
    article = (
        soup.find("article")
        or soup.find("div", class_=lambda c: ("article" in c.lower()) if c else False)
        or soup.find("div", class_=lambda c: ("content" in c.lower()) if c else False)
        or soup.find("main")
    )

    if article:
        text = article.get_text(separator="\n", strip=True)
    else:
        text = soup.get_text(separator="\n", strip=True)

    # Clean up: collapse whitespace, limit length
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    text = "\n".join(lines)

    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS] + "\n[truncated]"

    return text


def _fetch_with_playwright(url, browser):
    """Fetch a page using Playwright headless browser."""
    page = browser.new_page(user_agent=USER_AGENT)
    try:
        response = page.goto(url, timeout=REQUEST_TIMEOUT, wait_until="domcontentloaded")
        if response is None or response.status >= 400:
            status = response.status if response else "no response"
            logger.warning("Playwright got status %s for %s", status, url)
            return None

        # Wait briefly for JS-rendered content to settle
        page.wait_for_timeout(2000)

        html = page.content()
        return html
    except Exception as e:
        logger.warning("Playwright failed for %s: %s", url, e)
        return None
    finally:
        page.close()


def _fetch_with_requests(url):
    """Fallback: fetch a page using plain requests."""
    import requests

    try:
        resp = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=15,
            allow_redirects=True,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning("Requests failed for %s: %s", url, e)
        return None

    content_type = resp.headers.get("content-type", "")
    if "html" not in content_type.lower():
        logger.info("Skipping non-HTML content: %s (%s)", url, content_type)
        return None

    return resp.text


def scrape_article(url, browser=None):
    """Scrape full text from a URL. Returns text or None on failure."""
    if not _check_robots(url):
        logger.info("Blocked by robots.txt: %s", url)
        return None

    # Try Playwright first, fall back to requests
    html = None
    if browser:
        html = _fetch_with_playwright(url, browser)
    if html is None:
        html = _fetch_with_requests(url)
    if html is None:
        return None

    text = _extract_text(html)
    if len(text) < 100:
        logger.info("Extracted text too short (%d chars): %s", len(text), url)
        return None

    return text


def scrape_candidates(candidates):
    """Scrape full text for a list of candidates. Adds 'full_text' key.

    Falls back to RSS summary if scraping fails.
    """
    browser = _get_browser()

    try:
        for i, candidate in enumerate(candidates):
            url = candidate.get("url", "")
            logger.info("Scraping %d/%d: %s", i + 1, len(candidates), url)

            text = scrape_article(url, browser)
            if text:
                candidate["full_text"] = text
            else:
                fallback = f"{candidate.get('title', '')}. {candidate.get('summary', '')}"
                candidate["full_text"] = fallback
                logger.info("Using RSS summary fallback for: %s", url)

            # Rate limit between requests
            if i < len(candidates) - 1:
                time.sleep(RATE_LIMIT_SECONDS)
    finally:
        _close_browser()

    return candidates
