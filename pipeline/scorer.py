"""Signal scoring, entity resolution, and opportunity generation."""

import hashlib
import json
import logging
import math
import os
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import anthropic

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
MODEL = "claude-haiku-4-5-20251001"


def _load_json(filename):
    path = DATA_DIR / filename
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _save_json(filename, data):
    path = DATA_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _load_config():
    path = DATA_DIR.parent / "config.json"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── Entity Resolution ──

def _fuzzy_match(name, entities, key="name", threshold=0.8):
    """Simple fuzzy match by normalized name overlap."""
    if not name:
        return None
    name_lower = name.lower().strip()
    for entity in entities:
        entity_name = entity.get(key, "").lower().strip()
        if not entity_name:
            continue
        # Exact match
        if name_lower == entity_name:
            return entity
        # One contains the other
        if name_lower in entity_name or entity_name in name_lower:
            return entity
    return None


def _make_id(prefix, name):
    return prefix + hashlib.sha256(name.lower().encode("utf-8")).hexdigest()[:12]


def resolve_entities(new_signals, companies, investors, people):
    """Link extracted data to existing entities or create new ones."""
    for signal in new_signals:
        extracted = signal.pop("_extracted", {})
        if not extracted:
            continue

        # Company resolution
        company_name = extracted.get("company_name")
        if company_name:
            match = _fuzzy_match(company_name, companies)
            if match:
                signal["company_ids"] = [match["id"]]
                # Backfill domain if missing
                if not match.get("domain") and extracted.get("company_domain"):
                    match["domain"] = extracted["company_domain"]
            else:
                # Create new company
                new_id = _make_id("co_", company_name)
                new_company = {
                    "id": new_id,
                    "name": company_name,
                    "domain": extracted.get("company_domain", ""),
                    "sector": extracted.get("company_sector", ""),
                    "sub_sector": extracted.get("company_sub_sector", ""),
                    "stage": (extracted.get("funding_round_stage") or "").lower().replace(" ", "_"),
                    "hq_country": signal.get("country", ""),  # already normalised by extractor
                    "hq_city": extracted.get("company_hq_city", ""),
                    "employee_count": None,
                    "founded_year": None,
                    "linkedin_url": "",
                    "description": "",
                    "last_signal_at": signal.get("published_at", ""),
                    "signal_count": 1,
                }
                companies.append(new_company)
                signal["company_ids"] = [new_id]
                logger.info("Created new company: %s (%s)", company_name, new_id)

        # Investor resolution
        investor_names = extracted.get("investor_names") or []
        for inv_name in investor_names:
            match = _fuzzy_match(inv_name, investors)
            if match:
                signal["investor_ids"].append(match["id"])
            else:
                new_id = _make_id("inv_", inv_name)
                new_investor = {
                    "id": new_id,
                    "name": inv_name,
                    "type": "vc",
                    "aum_estimate": "",
                    "focus_sectors": [],
                    "focus_geographies": [],
                    "portfolio_count": None,
                    "website": "",
                    "linkedin_url": "",
                    "last_signal_at": signal.get("published_at", ""),
                }
                investors.append(new_investor)
                signal["investor_ids"].append(new_id)
                logger.info("Created new investor: %s (%s)", inv_name, new_id)

        # Person resolution
        person_entries = extracted.get("person_names") or []
        for person_data in person_entries:
            p_name = person_data.get("name", "")
            if not p_name:
                continue
            match = _fuzzy_match(p_name, people)
            if match:
                signal["person_ids"].append(match["id"])
            else:
                new_id = _make_id("per_", p_name)
                new_person = {
                    "id": new_id,
                    "name": p_name,
                    "role": person_data.get("role", ""),
                    "company_id": signal["company_ids"][0] if signal["company_ids"] else None,
                    "investor_id": None,
                    "linkedin_url": "",
                    "email_guess": "",
                    "relevance_tag": person_data.get("relevance", ""),
                }
                people.append(new_person)
                signal["person_ids"].append(new_id)

        # Store funding metadata
        metadata = {}
        if extracted.get("funding_amount_usd"):
            metadata["amount_usd"] = extracted["funding_amount_usd"]
        if extracted.get("funding_amount_raw"):
            metadata["amount_raw"] = extracted["funding_amount_raw"]
        if extracted.get("funding_round_stage"):
            metadata["round_stage"] = extracted["funding_round_stage"]
        if extracted.get("funding_currency"):
            metadata["currency"] = extracted["funding_currency"]
        if extracted.get("valuation_usd"):
            metadata["valuation"] = extracted["valuation_usd"]
        signal["metadata"] = metadata

    return new_signals, companies, investors, people


# ── Scoring ──
#
# Four-factor model (0–100 total):
#   Events   (0–25): Observable company actions × recency multiplier
#   Capital  (0–25): Funding signals only — log-scaled amount + stage bonus. 0 when no funding.
#   Momentum (0–25): Signal velocity + type diversity (proxy for sector activity)
#   Sources  (0–25): Independent source count × source quality weight
#
# Geography weight is applied as a final multiplier (0.5–1.0).
# 45-day decay window — events older than 45 days contribute 0.

TIER_BASE = {"tier_1_strong": 12, "tier_2_medium": 6, "tier_3_weak": 3}
FUNDING_TYPES = {"funding_round", "new_fund"}


def _days_ago(published_at):
    """Return days since published_at, or 999 if unparseable."""
    if not published_at:
        return 999
    try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        return max(0, (datetime.now(timezone.utc) - dt).days)
    except (ValueError, TypeError):
        return 999


def _recency_mult(days):
    """Recency multiplier: 0-7d=1.0, 8-15d=0.80, 16-30d=0.60, 31-45d=0.40, >45d=0."""
    if days <= 7:
        return 1.0
    if days <= 15:
        return 0.80
    if days <= 30:
        return 0.60
    if days <= 45:
        return 0.40
    return 0.0


def _compute_events(recent_sigs):
    """Events (0-25): observable company actions × recency multiplier.

    Each signal contributes base points (by tier) × recency multiplier.
    Best signal counted in full, additional signals add diminishing points.
    """
    scored = []
    for s in recent_sigs:
        base = TIER_BASE.get(s.get("signal_tier"), 2)
        mult = _recency_mult(_days_ago(s.get("published_at")))
        scored.append(base * mult)
    if not scored:
        return 0
    scored.sort(reverse=True)
    # Best signal at full value, subsequent at 40% (diminishing)
    total = scored[0] + sum(v * 0.4 for v in scored[1:])
    return min(25, int(total))


def _compute_capital(recent_sigs):
    """Capital (0-25): funding signals only. 0 when no recent funding."""
    funding_sigs = [s for s in recent_sigs if s.get("signal_type") in FUNDING_TYPES]
    if not funding_sigs:
        return 0
    # Log-scaled amount
    max_amount = 0
    for sig in funding_sigs:
        amount = sig.get("metadata", {}).get("amount_usd")
        if amount and isinstance(amount, (int, float)) and amount > 0:
            max_amount = max(max_amount, amount)
    if max_amount <= 0:
        # Funding signal exists but no amount extracted — give minimal score
        return 3
    # Log scale: $100K=3, $1M=8, $10M=14, $100M=19, $1B+=25
    log_val = math.log10(max_amount)
    return max(1, min(25, int((log_val - 4) * 4.5)))


def _compute_momentum(recent_sigs):
    """Momentum (0-25): signal velocity + type diversity.

    Proxy for sector-level activity when real sector data unavailable.
    Velocity: signals per 2-week window. Diversity: distinct signal types.
    """
    if not recent_sigs:
        return 0
    # Velocity: more signals in shorter time = higher momentum
    count = len(recent_sigs)
    velocity_pts = min(15, count * 5)  # 1=5, 2=10, 3+=15

    # Type diversity bonus: distinct signal types
    types = set(s.get("signal_type") for s in recent_sigs)
    diversity_pts = min(10, len(types) * 4)  # 1=4, 2=8, 3+=10

    return min(25, velocity_pts + diversity_pts)


def _compute_sources(recent_sigs):
    """Sources (0-25): independent source count × quality weight.

    1 source → 3-5, 2 sources → 8-10, 3 → 13-15, 4 → 18-20, 5+ → 25.
    Quality weight: tier_1=5, tier_2=4, tier_3=3.
    """
    if not recent_sigs:
        return 0
    # Count unique source URLs as independent sources
    source_urls = set()
    quality_sum = 0
    for s in recent_sigs:
        url = s.get("source_url", "")
        if url and url not in source_urls:
            source_urls.add(url)
            tier = s.get("signal_tier", "tier_3_weak")
            quality_sum += {"tier_1_strong": 5, "tier_2_medium": 4, "tier_3_weak": 3}.get(tier, 3)
    return min(25, quality_sum)


def _geo_weight(geography, config):
    """Apply geography preference weight from config."""
    weights = config.get("geography_weights", {})
    return weights.get(geography, 0.5)


def score_signals(all_signals, config):
    """Group signals by entity and compute opportunity scores.

    Score = Events + Capital + Momentum + Sources (each 0-25), scaled by geo weight.
    """
    # Group by primary entity
    entity_signals = defaultdict(list)
    for sig in all_signals:
        company_ids = sig.get("company_ids", [])
        investor_ids = sig.get("investor_ids", [])

        if company_ids:
            entity_signals[("company", company_ids[0])].append(sig)
        elif investor_ids:
            for inv_id in investor_ids:
                entity_signals[("investor", inv_id)].append(sig)
        elif sig.get("person_ids"):
            for per_id in sig["person_ids"]:
                entity_signals[("person", per_id)].append(sig)

    decay_days = config.get("recency_decay_days", 45)

    scored = []
    for (entity_type, entity_id), sigs in entity_signals.items():
        # Only consider signals within decay window
        recent_sigs = [s for s in sigs if _days_ago(s.get("published_at")) <= decay_days]
        if not recent_sigs:
            continue

        # Compute four factors
        events = _compute_events(recent_sigs)
        capital = _compute_capital(recent_sigs)
        momentum = _compute_momentum(recent_sigs)
        sources = _compute_sources(recent_sigs)

        raw_score = events + capital + momentum + sources

        # Geography weight
        geo = recent_sigs[0].get("geography", "")
        geo_mult = _geo_weight(geo, config)
        final_score = min(99, int(raw_score * geo_mult))

        # Collect all contact IDs
        contact_ids = []
        for s in recent_sigs:
            contact_ids.extend(s.get("person_ids", []))
        contact_ids = list(dict.fromkeys(contact_ids))  # dedupe preserving order

        scored.append({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "signal_ids": [s["id"] for s in recent_sigs],
            "contact_ids": contact_ids,
            "opportunity_score": final_score,
            "score_breakdown": {
                "events": events,
                "capital": capital,
                "momentum": momentum,
                "sources": sources,
                "geo_weight": round(geo_mult, 2),
            },
        })

    # Sort by score descending
    scored.sort(key=lambda x: x["opportunity_score"], reverse=True)

    # Limit to configured daily count
    limit = config.get("daily_opportunities", 15)
    return scored[:limit]


# ── AI Rationale Generation ──

RATIONALE_PROMPT = """\
Write a factual one-line summary for {entity_name} using ONLY the signals below.

Signals:
{signal_summaries}

Source count: {source_count}

Rules:
- Maximum 120 characters
- Lead with the hard fact (round size, or key event if no funding)
- Use middot (·) to separate facts
- Include source count as a fact (e.g. "3 sources")
- Include one concrete market/policy datapoint if available from signals
- NEVER use these words: validates, signals, positions, captures, conviction, inflection, critical, meaningful, substantial, significant, well-positioned
- NO narrative framing: "at a moment when", "making this", "positioning the"
- State facts, not interpretations

Examples of GOOD output:
- "€30M Series A closed · defence procurement subsystems · 4 sources · NATO 3.5% GDP mandate in effect."
- "$9M round · AI parts procurement for MRO · 2 sources · investor undisclosed."
- "€270K across 3 angel closes · AI therapy localisation · 2 sources · no lead identified."
- "No new round · hiring surge +40% QoQ · 3 sources · German digitisation mandate Q3 2026."

Write ONLY the summary line, nothing else:"""


def generate_rationales(opportunities, all_signals, companies, investors, people=None):
    """Generate AI rationale for each opportunity using Claude Haiku."""
    if people is None:
        people = []
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("No ANTHROPIC_API_KEY — skipping rationale generation")
        for opp in opportunities:
            opp["ai_rationale"] = "Rationale generation requires ANTHROPIC_API_KEY."
        return opportunities

    client = anthropic.Anthropic(api_key=api_key)
    signal_map = {s["id"]: s for s in all_signals}
    company_map = {c["id"]: c for c in companies}
    investor_map = {i["id"]: i for i in investors}
    person_map = {p["id"]: p for p in people}

    total_input_tokens = 0
    total_output_tokens = 0

    for opp in opportunities:
        entity_id = opp["entity_id"]
        entity_type = opp["entity_type"]

        if entity_type == "company":
            entity = company_map.get(entity_id, {})
        elif entity_type == "investor":
            entity = investor_map.get(entity_id, {})
        else:
            entity = person_map.get(entity_id, {})
        entity_name = entity.get("name", "Unknown")

        sig_summaries = []
        for sid in opp["signal_ids"]:
            sig = signal_map.get(sid, {})
            sig_summaries.append(f"- [{sig.get('signal_type', '')}] {sig.get('headline', '')}")

        prompt = RATIONALE_PROMPT.format(
            entity_name=entity_name,
            signal_summaries="\n".join(sig_summaries),
            source_count=len(opp["signal_ids"]),
        )

        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=80,
                messages=[{"role": "user", "content": prompt}],
            )
            total_input_tokens += getattr(response.usage, "input_tokens", 0)
            total_output_tokens += getattr(response.usage, "output_tokens", 0)
            if not response.content:
                logger.warning("Empty rationale response for %s", entity_name)
                opp["ai_rationale"] = f"Multiple signals detected for {entity_name}."
                continue
            opp["ai_rationale"] = response.content[0].text.strip()
        except Exception as e:
            logger.error("Rationale generation failed for %s: %s", entity_name, e)
            opp["ai_rationale"] = f"Multiple signals detected for {entity_name}."

    # Log cost summary
    # Claude Haiku pricing: $0.80/MTok input, $4.00/MTok output
    input_cost = total_input_tokens * 0.80 / 1_000_000
    output_cost = total_output_tokens * 4.00 / 1_000_000
    total_cost = input_cost + output_cost
    logger.info(
        "API usage [Rationales]: %d input + %d output tokens = $%.4f",
        total_input_tokens, total_output_tokens, total_cost,
    )

    return opportunities


# ── Build Final Opportunities ──

def build_opportunities(scored, all_signals, companies, investors, config, people=None):
    """Build final opportunity records with rationale."""
    if people is None:
        people = []
    scored = generate_rationales(scored, all_signals, companies, investors, people)

    today = date.today().isoformat()
    opportunities = []

    for i, opp in enumerate(scored):
        entity_type = opp["entity_type"]
        entity_id = opp["entity_id"]

        record = {
            "id": f"opp_{today.replace('-', '')}_{i+1:03d}",
            "generated_date": today,
            "company_id": entity_id if entity_type == "company" else None,
            "investor_id": entity_id if entity_type == "investor" else None,
            "person_id": entity_id if entity_type == "person" else None,
            "signal_ids": opp["signal_ids"],
            "contact_ids": opp["contact_ids"],
            "opportunity_score": opp["opportunity_score"],
            "score_breakdown": opp["score_breakdown"],
            "ai_rationale": opp.get("ai_rationale", ""),
            "entity_type": entity_type,
            "status": "new",
        }
        opportunities.append(record)

    return opportunities
