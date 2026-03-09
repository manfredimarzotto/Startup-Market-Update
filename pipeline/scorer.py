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
    with open(path) as f:
        return json.load(f)


def _save_json(filename, data):
    path = DATA_DIR / filename
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _load_config():
    path = DATA_DIR.parent / "config.json"
    if not path.exists():
        return {}
    with open(path) as f:
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
    return prefix + hashlib.sha256(name.lower().encode()).hexdigest()[:8]


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
            else:
                # Create new company
                new_id = _make_id("co_", company_name)
                new_company = {
                    "id": new_id,
                    "name": company_name,
                    "domain": "",
                    "sector": extracted.get("company_sector", ""),
                    "sub_sector": extracted.get("company_sub_sector", ""),
                    "stage": (extracted.get("funding_round_stage") or "").lower().replace(" ", "_"),
                    "hq_country": extracted.get("company_hq_country", ""),
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

TIER_SCORES = {"tier_1_strong": 35, "tier_2_medium": 22, "tier_3_weak": 10}
TYPE_SCORES = {
    "funding_round": 30, "acquisition": 28, "new_fund": 25,
    "hiring_wave": 20, "partnership": 18, "expansion": 15,
    "product_launch": 12, "media_mention": 8,
}


def _recency_score(published_at, decay_days=45):
    """Score from 0-25 based on how recent the signal is."""
    if not published_at:
        return 0
    try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        days = (datetime.now(timezone.utc) - dt).days
    except (ValueError, TypeError):
        return 0
    if days <= 0:
        return 25
    if days >= decay_days:
        return 0
    return max(0, int(25 * (1 - days / decay_days)))


def _geo_weight(geography, config):
    """Apply geography preference weight from config."""
    weights = config.get("geography_weights", {})
    return weights.get(geography, 0.5)


def score_signals(all_signals, config):
    """Group signals by entity and compute opportunity scores."""
    # Group by primary company
    entity_signals = defaultdict(list)
    for sig in all_signals:
        company_ids = sig.get("company_ids", [])
        investor_ids = sig.get("investor_ids", [])

        if company_ids:
            entity_signals[("company", company_ids[0])].append(sig)
        elif investor_ids:
            for inv_id in investor_ids:
                entity_signals[("investor", inv_id)].append(sig)

    decay_days = config.get("recency_decay_days", 45)

    scored = []
    for (entity_type, entity_id), sigs in entity_signals.items():
        # Only consider recent signals
        recent_sigs = [s for s in sigs if _recency_score(s.get("published_at"), decay_days) > 0]
        if not recent_sigs:
            continue

        # Compute score components
        signal_strength = max(
            TIER_SCORES.get(s.get("signal_tier"), 0) for s in recent_sigs
        )
        type_bonus = max(
            TYPE_SCORES.get(s.get("signal_type"), 0) for s in recent_sigs
        )
        recency = max(
            _recency_score(s.get("published_at"), decay_days) for s in recent_sigs
        )
        # Velocity: multiple signals = stronger opportunity
        velocity = min(25, len(recent_sigs) * 8)

        # Geography weight
        geo = recent_sigs[0].get("geography", "")
        geo_mult = _geo_weight(geo, config)

        raw_score = signal_strength + recency + velocity
        weighted_score = min(99, int(raw_score * geo_mult + type_bonus * 0.3))

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
            "opportunity_score": weighted_score,
            "score_breakdown": {
                "signal_strength": signal_strength,
                "recency": recency,
                "growth_velocity": velocity,
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
You are a venture analyst. Given these market signals about {entity_name}, write a 1-2 sentence rationale explaining why this is a noteworthy opportunity right now. Be specific about the signals and what makes the timing interesting. Be concise and direct — no filler.

Signals:
{signal_summaries}

Entity: {entity_name} ({entity_type})
Score: {score}/99

Write the rationale as a single paragraph, no quotes or prefix:"""


def generate_rationales(opportunities, all_signals, companies, investors):
    """Generate AI rationale for each opportunity using Claude Haiku."""
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

    for opp in opportunities:
        entity_id = opp["entity_id"]
        entity_type = opp["entity_type"]

        if entity_type == "company":
            entity = company_map.get(entity_id, {})
        else:
            entity = investor_map.get(entity_id, {})
        entity_name = entity.get("name", "Unknown")

        sig_summaries = []
        for sid in opp["signal_ids"]:
            sig = signal_map.get(sid, {})
            sig_summaries.append(f"- [{sig.get('signal_type', '')}] {sig.get('headline', '')}")

        prompt = RATIONALE_PROMPT.format(
            entity_name=entity_name,
            entity_type=entity_type,
            signal_summaries="\n".join(sig_summaries),
            score=opp["opportunity_score"],
        )

        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            opp["ai_rationale"] = response.content[0].text.strip()
        except Exception as e:
            logger.error("Rationale generation failed for %s: %s", entity_name, e)
            opp["ai_rationale"] = f"Multiple signals detected for {entity_name}."

    return opportunities


# ── Build Final Opportunities ──

def build_opportunities(scored, all_signals, companies, investors, config):
    """Build final opportunity records with rationale."""
    scored = generate_rationales(scored, all_signals, companies, investors)

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
            "person_id": None,
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
