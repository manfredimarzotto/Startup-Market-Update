import re

# Country name normalization map
COUNTRY_ALIASES = {
    "UK": "United Kingdom",
    "U.K.": "United Kingdom",
    "Britain": "United Kingdom",
    "Great Britain": "United Kingdom",
    "England": "United Kingdom",
    "US": "United States",
    "U.S.": "United States",
    "USA": "United States",
    "U.S.A.": "United States",
    "America": "United States",
    "The Netherlands": "Netherlands",
    "Holland": "Netherlands",
    "UAE": "United Arab Emirates",
    "South Korea": "South Korea",
    "Republic of Korea": "South Korea",
}

ROUND_ALIASES = {
    "series a": "Series A",
    "series b": "Series B",
    "series c": "Series C",
    "series d": "Series D+",
    "series e": "Series D+",
    "series f": "Series D+",
    "pre-seed": "Pre-Seed",
    "preseed": "Pre-Seed",
    "seed": "Seed",
    "growth": "Growth",
    "debt": "Debt",
    "grant": "Grant",
    "unknown": "Unknown",
}

# Approximate conversion rates to USD
CURRENCY_TO_USD = {
    "USD": 1.0,
    "EUR": 1.08,
    "GBP": 1.27,
}


def normalize_deal(deal):
    """Normalize a deal dict in place and return it."""
    # Normalize country
    country = deal.get("company_hq_country") or ""
    deal["company_hq_country"] = COUNTRY_ALIASES.get(country.strip(), country.strip()) or None

    # Normalize round type
    rt = (deal.get("round_type") or "Unknown").strip()
    deal["round_type"] = ROUND_ALIASES.get(rt.lower(), rt)

    # Ensure amount_usd is populated
    if not deal.get("amount_usd") and deal.get("amount_raw"):
        deal["amount_usd"] = _parse_amount_to_usd(deal["amount_raw"], deal.get("currency", "USD"))

    # Clean investor names
    deal["lead_investors"] = [_clean_investor(i) for i in (deal.get("lead_investors") or []) if i]
    deal["other_investors"] = [_clean_investor(i) for i in (deal.get("other_investors") or []) if i]

    return deal


def _clean_investor(name):
    """Strip common prefixes/suffixes from investor names."""
    name = name.strip()
    for prefix in ["led by ", "with participation from ", "joined by ", "including "]:
        if name.lower().startswith(prefix):
            name = name[len(prefix):]
    return name.strip()


def _parse_amount_to_usd(raw, currency):
    """Try to parse a raw amount string to USD number."""
    raw = raw.strip()
    # Detect currency from raw string
    if raw.startswith("€") or "EUR" in raw.upper():
        rate = CURRENCY_TO_USD["EUR"]
    elif raw.startswith("£") or "GBP" in raw.upper():
        rate = CURRENCY_TO_USD["GBP"]
    elif raw.startswith("$") or "USD" in raw.upper():
        rate = 1.0
    else:
        rate = CURRENCY_TO_USD.get(currency, 1.0)

    # Extract number
    match = re.search(r"([\d,.]+)\s*(million|billion|m|b|mn|bn)?", raw, re.IGNORECASE)
    if not match:
        return None

    num_str = match.group(1).replace(",", "")
    try:
        number = float(num_str)
    except ValueError:
        return None

    multiplier_str = (match.group(2) or "").lower()
    if multiplier_str in ("million", "m", "mn"):
        number *= 1_000_000
    elif multiplier_str in ("billion", "b", "bn"):
        number *= 1_000_000_000

    return round(number * rate, 2)
