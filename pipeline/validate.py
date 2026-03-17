"""Post-pipeline validation: checks score consistency rules from CLAUDE.md."""

import json
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"


def _load(filename):
    path = DATA_DIR / filename
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def validate():
    """Run all consistency checks. Returns list of warning strings."""
    opportunities = _load("opportunities.json")
    signals = _load("signals.json")

    if not opportunities:
        logger.info("No opportunities to validate")
        return []

    signal_map = {s["id"]: s for s in signals}
    warnings = []

    for opp in opportunities:
        opp_id = opp.get("id", "?")
        breakdown = opp.get("score_breakdown", {})
        sig_ids = opp.get("signal_ids", [])
        sigs = [signal_map[sid] for sid in sig_ids if sid in signal_map]

        # Rule 1: If source count = 1, Sources factor must be <= 5
        unique_sources = set()
        for s in sigs:
            unique_sources.add(s.get("source_id", s.get("source_url", "")))
        source_count = len(unique_sources)
        sources_score = breakdown.get("sources", 0)

        if source_count <= 1 and sources_score > 5:
            warnings.append(
                f"{opp_id}: Sources={sources_score} but only {source_count} unique source(s) "
                f"(must be <=5)"
            )

        # Rule 2: If no funding signals, Capital must be 0
        has_funding = any(
            s.get("signal_type") in ("funding_round", "new_fund") for s in sigs
        )
        capital_score = breakdown.get("capital", 0)
        if not has_funding and capital_score > 0:
            warnings.append(
                f"{opp_id}: Capital={capital_score} but no funding signals found"
            )

        # Rule 3: Score should not exceed 99
        total = opp.get("opportunity_score", 0)
        if total > 99:
            warnings.append(f"{opp_id}: Score={total} exceeds maximum 99")

        # Rule 4: Score breakdown factors should each be 0-25
        for factor in ("events", "capital", "momentum", "sources"):
            val = breakdown.get(factor, 0)
            if val < 0 or val > 25:
                warnings.append(f"{opp_id}: {factor}={val} outside 0-25 range")

    # Distribution check (only meaningful with 10+ opportunities)
    if len(opportunities) >= 10:
        scores = [o.get("opportunity_score", 0) for o in opportunities]
        scores.sort()
        median = scores[len(scores) // 2]
        top_5pct_threshold = scores[int(len(scores) * 0.95)] if len(scores) >= 20 else scores[-1]
        bottom_30pct = scores[int(len(scores) * 0.3)]

        if median > 70:
            warnings.append(
                f"Distribution: median score={median} is high (target 40-55). "
                f"Scores may be clustering at the top."
            )
        if bottom_30pct > 40:
            warnings.append(
                f"Distribution: bottom 30% cutoff={bottom_30pct} (target 0-30). "
                f"Low-end scores may be inflated."
            )
        if min(scores) > 30:
            warnings.append(
                f"Distribution: minimum score={min(scores)}. "
                f"Expected some scores in single digits."
            )

    return warnings


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    warnings = validate()
    if warnings:
        print(f"\n{'='*60}")
        print(f"VALIDATION: {len(warnings)} warning(s)")
        print(f"{'='*60}")
        for w in warnings:
            print(f"  ⚠ {w}")
        print()
        return 1
    else:
        print("\nVALIDATION: all checks passed ✓\n")
        return 0


if __name__ == "__main__":
    sys.exit(main())
