import os

# API Keys (from environment variables)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
NEWSAPI_KEY = os.getenv("NEWSAPI_KEY")

# RSS Feed URLs
RSS_FEEDS = [
    {"name": "TechCrunch", "url": "https://techcrunch.com/category/fundraise/feed/"},
    {"name": "Sifted", "url": "https://sifted.eu/feed"},
    {"name": "EU-Startups", "url": "https://www.eu-startups.com/feed/"},
    {"name": "Tech.eu", "url": "https://tech.eu/feed/"},
    {"name": "VentureBeat", "url": "https://venturebeat.com/category/business/feed/"},
]

# Keyword filter — article title must contain at least one of these
FUNDING_KEYWORDS = [
    "raises", "raised", "secures", "secured", "funding", "Series A",
    "Series B", "Series C", "Series D", "seed round", "pre-seed",
    "venture", "backed", "investment", "round", "million", "billion",
    "fundraise", "fundraising", "capital", "valuation",
]

# Geography filter — keep deals from these countries only (empty = keep all)
ALLOWED_COUNTRIES = []

# Haiku model
HAIKU_MODEL = "claude-haiku-4-5-20251001"

# Scraper settings
SCRAPE_DELAY_SECONDS = 3
MAX_SCRAPE_PER_RUN = 30
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
]
