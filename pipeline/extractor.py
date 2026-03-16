"""Signal extraction from article text using Claude Haiku."""

import hashlib
import json
import logging
import os
from datetime import datetime, timezone

import anthropic

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 1024

# European country codes accepted by the dashboard. Anything else becomes "Other".
EUROPEAN_COUNTRY_CODES = {
    "SE", "DK", "FI", "NO",          # Nordics
    "DE", "AT", "CH",                 # DACH
    "GB", "IE",                       # UK & Ireland
    "NL", "BE", "LU",                 # Benelux
    "FR", "ES", "IT", "PT",           # Southern Europe
    "PL", "EE", "LV", "LT",          # Eastern Europe / Baltics
    "CZ", "RO", "HU", "BG", "HR",    # Central / Southeast Europe
}

EXTRACTION_PROMPT = """\
You are a market intelligence analyst. Extract structured signal data from this article.

Article title: {title}
Source: {source_name}
Published: {published_at}

Article text:
{text}

---

Extract the following as JSON. If a field is unknown, use null.
Return ONLY valid JSON, no markdown fences or explanation.

{{
  "signal_type": "funding_round | hiring_wave | acquisition | partnership | product_launch | expansion | new_fund | media_mention",
  "signal_tier": "tier_1_strong (confirmed event with named parties, specific amounts, or official announcements) | tier_2_medium (credible report but missing full details, e.g. unnamed sources, no amount disclosed, unconfirmed) | tier_3_weak (speculation, opinion, tangential mention, or media coverage without new facts)",
  "headline": "one-line summary of the signal",
  "company_name": "primary company mentioned",
  "company_hq_country": "ISO 2-letter country code (e.g. SE, DE, GB, FR, NL, FI, NO, DK, IT, ES, CH, AT, BE, IE, PL, EE) or null. Use the actual country, never use region codes like 'EU'.",
  "company_hq_city": "city or null",
  "company_sector": "e.g. FinTech, CleanTech, AI/ML, SaaS, HealthTech, Logistics, DeepTech, FoodTech, DevTools",
  "company_sub_sector": "more specific sub-sector or null",
  "company_domain": "company website domain like 'example.com' (no https://) or null",
  "investor_names": ["list of investor names mentioned"],
  "person_names": [
    {{"name": "person name", "role": "their role", "relevance": "founder | c_suite | partner | hiring_manager"}}
  ],
  "funding_amount_raw": "original amount string like '$50M' or '€30M' or null",
  "funding_amount_usd": null or estimated USD number,
  "funding_currency": "USD | EUR | GBP | SEK | DKK | NOK or null",
  "funding_round_stage": "Seed | Series A | Series B | etc. or null",
  "valuation_usd": null or estimated USD number,
  "geography": "Nordics | DACH | UK | Benelux | Southern Europe | US | Asia or best fit",
  "ai_confidence": 0.0 to 1.0
}}
"""


def _get_client():
    """Create Anthropic client using API key."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        return anthropic.Anthropic(api_key=api_key)
    raise RuntimeError("ANTHROPIC_API_KEY environment variable is required")


def _parse_json_response(text):
    """Parse JSON from Claude's response, handling common formatting."""
    text = text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse extraction JSON: %s", e)
        return None


def extract_signal(candidate, client):
    """Extract a structured signal from a single candidate article."""
    prompt = EXTRACTION_PROMPT.format(
        title=candidate.get("title", ""),
        source_name=candidate.get("source_name", ""),
        published_at=candidate.get("published_at", ""),
        text=candidate.get("full_text", candidate.get("summary", "")),
    )

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        if not response.content:
            logger.error("Empty response from Claude for %s", candidate.get("url"))
            return None
        raw = response.content[0].text
    except Exception as e:
        logger.error("Claude API error for %s: %s", candidate.get("url"), e)
        return None

    data = _parse_json_response(raw)
    if not data:
        return None

    # Build signal record
    url = candidate.get("url", "")
    signal_id = "sig_" + hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]

    # Normalise country: map non-European codes to "Other"
    raw_country = (data.get("company_hq_country") or "").strip().upper()
    country = raw_country if raw_country in EUROPEAN_COUNTRY_CODES else ("Other" if raw_country else "")

    signal = {
        "id": signal_id,
        "source_url": url,
        "source_id": candidate.get("source_id", ""),
        "source_name": candidate.get("source_name", ""),
        "signal_type": data.get("signal_type", "media_mention"),
        "signal_tier": data.get("signal_tier", "tier_3_weak"),
        "headline": data.get("headline", candidate.get("title", "")),
        "raw_text": "",
        "published_at": candidate.get("published_at", ""),
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "geography": data.get("geography", candidate.get("geography", "")),
        "country": country,
        "ai_confidence": data.get("ai_confidence", 0.5),
        "company_ids": [],
        "investor_ids": [],
        "person_ids": [],
        "metadata": {},
    }

    # Store extracted metadata for scorer to use
    signal["_extracted"] = data

    return signal


def extract_all(candidates):
    """Extract signals from all candidates using Claude Haiku."""
    if not candidates:
        return []

    client = _get_client()
    signals = []

    for i, candidate in enumerate(candidates):
        logger.info("Extracting %d/%d: %s", i + 1, len(candidates), candidate.get("title", "")[:60])
        signal = extract_signal(candidate, client)
        if signal:
            signals.append(signal)
        else:
            logger.warning("Extraction failed for: %s", candidate.get("url"))

    logger.info("Extracted %d signals from %d candidates", len(signals), len(candidates))
    return signals
