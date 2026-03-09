import json
import logging
import re
import time

import anthropic

from pipeline.config import ANTHROPIC_API_KEY, HAIKU_MODEL

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a startup funding data extraction tool. Given a news article, extract funding round details. Return ONLY a JSON object (no markdown, no explanation) with these fields:
{
  "is_funding_announcement": true/false,
  "company_name": "string",
  "amount_usd": number or null,
  "amount_raw": "string as stated in article, e.g. '€15M' or '$200 million'",
  "currency": "USD" | "EUR" | "GBP" | "other",
  "round_type": "Pre-Seed" | "Seed" | "Series A" | "Series B" | "Series C" | "Series D+" | "Growth" | "Debt" | "Grant" | "Unknown",
  "lead_investors": ["string"],
  "other_investors": ["string"],
  "company_hq_country": "string",
  "company_hq_city": "string or null",
  "sector": "string — e.g. FinTech, PropTech, HealthTech, SaaS, AI/ML, CleanTech, etc.",
  "short_description": "One sentence — what the company does",
  "valuation": "string or null — only if explicitly stated"
}

Rules:
- If the article is NOT about a startup funding round, set is_funding_announcement to false and leave other fields null.
- For amount_usd: convert to USD using approximate rates (1 EUR ≈ 1.08 USD, 1 GBP ≈ 1.27 USD). If amount not stated, set null.
- For round_type: if article says "funding" without specifying round, use "Unknown".
- Only include investors explicitly named in the article.
- company_hq_country should be the full country name, e.g. "United Kingdom", "Germany", "United States"."""

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def extract_deal(title, content):
    """Send article to Claude Haiku and return parsed deal dict, or None."""
    user_text = f"Article title: {title}\n\nArticle content:\n{content[:8000]}"

    for attempt in range(3):
        try:
            client = _get_client()
            response = client.messages.create(
                model=HAIKU_MODEL,
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_text}],
            )
            raw = response.content[0].text.strip()
            return _parse_response(raw)
        except anthropic.RateLimitError:
            wait = 2 ** (attempt + 1)
            logger.warning("Haiku rate limit — retrying in %ds", wait)
            time.sleep(wait)
        except anthropic.APIError as e:
            wait = 2 ** (attempt + 1)
            logger.warning("Haiku API error (%s) — retrying in %ds", e, wait)
            time.sleep(wait)
        except Exception:
            logger.exception("Unexpected error calling Haiku")
            break

    logger.error("Failed to extract deal from: %s", title)
    return None


def _parse_response(raw):
    """Parse Haiku's JSON response with fallback regex extraction."""
    # Try direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Fallback: extract JSON object from response
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    logger.warning("Could not parse Haiku response: %s", raw[:200])
    return None
