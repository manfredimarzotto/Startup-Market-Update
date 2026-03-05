"""Dashboard renderer — queries DB, computes stats, renders Jinja2 template to static HTML."""

import json
import os
from collections import Counter
from datetime import datetime

from jinja2 import Environment, FileSystemLoader

import db

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def render_dashboard():
    """Main entry: query deals, compute stats, render HTML."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    deals = db.get_recent_deals(days=30)

    # Compute stats
    today = datetime.utcnow().strftime("%Y-%m-%d")
    today_deals = [d for d in deals if (d.get("published_date") or "")[:10] == today]
    week_deals = deals[::]  # all within 30 days; we'll filter in template via JS too

    # For the 7-day window, we use a rough filter
    from datetime import timedelta
    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    week_deals = [d for d in deals if (d.get("published_date") or "")[:10] >= seven_days_ago]

    stats = {
        "total_deals_today": len(today_deals),
        "capital_today": sum(d.get("amount_usd") or 0 for d in today_deals),
        "deals_this_week": len(week_deals),
        "avg_round_week": _avg_round(week_deals),
        "top_sector_week": _top_sector(week_deals),
        "last_scan": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    }

    # Summary charts data
    round_counts = Counter(d.get("round_type", "Unknown") for d in week_deals)
    sector_counts = Counter(d.get("sector", "Other") for d in week_deals)
    geo_counts = _geo_split(week_deals)
    top_investors = _top_investors(week_deals)

    # SVG charts
    round_chart_svg = _horizontal_bar_svg(round_counts, "Deals by Round Type")
    sector_chart_svg = _horizontal_bar_svg(sector_counts, "Deals by Sector")
    geo_bar_svg = _geo_bar_svg(geo_counts)

    # Serialize deals for JS
    deals_json = json.dumps(deals, default=str)

    # Render
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    template = env.get_template("dashboard.html")
    html = template.render(
        deals=deals,
        deals_json=deals_json,
        stats=stats,
        round_chart_svg=round_chart_svg,
        sector_chart_svg=sector_chart_svg,
        geo_bar_svg=geo_bar_svg,
        top_investors=top_investors,
    )
    out_path = os.path.join(OUTPUT_DIR, "index.html")
    with open(out_path, "w") as f:
        f.write(html)
    print(f"Dashboard written to {out_path}")


def _avg_round(deals):
    amounts = [d["amount_usd"] for d in deals if d.get("amount_usd")]
    if not amounts:
        return 0
    return round(sum(amounts) / len(amounts), 0)


def _top_sector(deals):
    sectors = [d.get("sector", "Other") for d in deals if d.get("sector")]
    if not sectors:
        return "N/A"
    return Counter(sectors).most_common(1)[0][0]


def _geo_split(deals):
    us = sum(1 for d in deals if d.get("company_hq_country") == "United States")
    europe = sum(1 for d in deals if d.get("company_hq_country") in (
        "United Kingdom", "Germany", "France", "Netherlands", "Spain",
        "Italy", "Sweden", "Denmark", "Finland", "Norway", "Ireland",
        "Belgium", "Austria", "Switzerland", "Portugal", "Poland",
        "Czech Republic", "Estonia", "Latvia", "Lithuania", "Romania",
        "Bulgaria", "Croatia", "Hungary", "Luxembourg",
    ))
    other = len(deals) - us - europe
    return {"US": us, "Europe": europe, "Other": other}


def _top_investors(deals, n=5):
    investor_count = Counter()
    for d in deals:
        for inv in d.get("lead_investors", []):
            investor_count[inv] += 1
        for inv in d.get("other_investors", []):
            investor_count[inv] += 1
    return investor_count.most_common(n)


def _horizontal_bar_svg(counts, title, width=320, bar_height=18, gap=4):
    """Render a simple horizontal bar chart as inline SVG."""
    if not counts:
        return ""
    items = counts.most_common(10)
    max_val = max(v for _, v in items)
    bar_area_width = width - 130
    total_height = len(items) * (bar_height + gap) + 30

    lines = [f'<svg width="{width}" height="{total_height}" xmlns="http://www.w3.org/2000/svg">']
    lines.append(f'<text x="0" y="14" fill="#7D8590" font-family="monospace" font-size="11">{title}</text>')

    y = 26
    colors = {
        "Seed": "#D29922", "Pre-Seed": "#D29922",
        "Series A": "#3FB950", "Series B": "#58A6FF",
        "Series C": "#BC8CFF", "Series D+": "#BC8CFF",
        "Growth": "#7D8590", "Debt": "#7D8590",
        "Grant": "#7D8590", "Unknown": "#7D8590",
    }
    default_color = "#58A6FF"

    for label, val in items:
        bar_w = max(2, int((val / max_val) * bar_area_width)) if max_val > 0 else 2
        color = colors.get(label, default_color)
        lines.append(f'<text x="0" y="{y + 13}" fill="#E6EDF3" font-family="monospace" font-size="11">{label[:14]}</text>')
        lines.append(f'<rect x="120" y="{y}" width="{bar_w}" height="{bar_height}" fill="{color}" rx="2"/>')
        lines.append(f'<text x="{122 + bar_w}" y="{y + 13}" fill="#7D8590" font-family="monospace" font-size="11">{val}</text>')
        y += bar_height + gap

    lines.append("</svg>")
    return "\n".join(lines)


def _geo_bar_svg(geo, width=320, height=28):
    """Render a US/Europe/Other stacked bar."""
    total = sum(geo.values()) or 1
    us_w = int((geo["US"] / total) * width)
    eu_w = int((geo["Europe"] / total) * width)
    other_w = width - us_w - eu_w

    lines = [f'<svg width="{width}" height="{height + 20}" xmlns="http://www.w3.org/2000/svg">']
    lines.append(f'<text x="0" y="12" fill="#7D8590" font-family="monospace" font-size="11">US vs Europe</text>')
    y = 18
    x = 0
    if us_w > 0:
        lines.append(f'<rect x="{x}" y="{y}" width="{us_w}" height="{height}" fill="#58A6FF" rx="2"/>')
        if us_w > 30:
            lines.append(f'<text x="{x + 4}" y="{y + 17}" fill="#0A0E17" font-family="monospace" font-size="10">US {geo["US"]}</text>')
        x += us_w
    if eu_w > 0:
        lines.append(f'<rect x="{x}" y="{y}" width="{eu_w}" height="{height}" fill="#3FB950" rx="2"/>')
        if eu_w > 30:
            lines.append(f'<text x="{x + 4}" y="{y + 17}" fill="#0A0E17" font-family="monospace" font-size="10">EU {geo["Europe"]}</text>')
        x += eu_w
    if other_w > 0:
        lines.append(f'<rect x="{x}" y="{y}" width="{other_w}" height="{height}" fill="#7D8590" rx="2"/>')
        if other_w > 40:
            lines.append(f'<text x="{x + 4}" y="{y + 17}" fill="#0A0E17" font-family="monospace" font-size="10">Other {geo["Other"]}</text>')
    lines.append("</svg>")
    return "\n".join(lines)


if __name__ == "__main__":
    db.init_db()
    render_dashboard()
