import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "deals.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name TEXT NOT NULL,
            amount_usd REAL,
            amount_raw TEXT,
            currency TEXT,
            round_type TEXT,
            lead_investors TEXT,  -- JSON array
            other_investors TEXT, -- JSON array
            company_hq_country TEXT,
            company_hq_city TEXT,
            sector TEXT,
            short_description TEXT,
            valuation TEXT,
            source_urls TEXT,    -- JSON array
            source_names TEXT,   -- JSON array
            published_date TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS seen_articles (
            url TEXT PRIMARY KEY,
            title TEXT,
            source TEXT,
            fetched_at TEXT DEFAULT (datetime('now')),
            scrape_failed INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_deals_published ON deals(published_date);
        CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_name);
        CREATE INDEX IF NOT EXISTS idx_deals_round ON deals(round_type);
    """)
    conn.commit()
    conn.close()


def is_article_seen(url):
    conn = get_connection()
    row = conn.execute("SELECT 1 FROM seen_articles WHERE url = ?", (url,)).fetchone()
    conn.close()
    return row is not None


def mark_article_seen(url, title, source, scrape_failed=False):
    conn = get_connection()
    conn.execute(
        "INSERT OR IGNORE INTO seen_articles (url, title, source, scrape_failed) VALUES (?, ?, ?, ?)",
        (url, title, source, 1 if scrape_failed else 0),
    )
    conn.commit()
    conn.close()


def insert_deal(deal):
    conn = get_connection()
    conn.execute(
        """INSERT INTO deals
        (company_name, amount_usd, amount_raw, currency, round_type,
         lead_investors, other_investors, company_hq_country, company_hq_city,
         sector, short_description, valuation, source_urls, source_names, published_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            deal["company_name"],
            deal.get("amount_usd"),
            deal.get("amount_raw"),
            deal.get("currency"),
            deal.get("round_type"),
            json.dumps(deal.get("lead_investors", [])),
            json.dumps(deal.get("other_investors", [])),
            deal.get("company_hq_country"),
            deal.get("company_hq_city"),
            deal.get("sector"),
            deal.get("short_description"),
            deal.get("valuation"),
            json.dumps(deal.get("source_urls", [])),
            json.dumps(deal.get("source_names", [])),
            deal.get("published_date"),
        ),
    )
    conn.commit()
    conn.close()


def update_deal(deal_id, updates):
    conn = get_connection()
    sets = []
    vals = []
    for key, val in updates.items():
        sets.append(f"{key} = ?")
        vals.append(json.dumps(val) if isinstance(val, list) else val)
    sets.append("updated_at = ?")
    vals.append(datetime.utcnow().isoformat())
    vals.append(deal_id)
    conn.execute(f"UPDATE deals SET {', '.join(sets)} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def get_recent_deals(days=30):
    conn = get_connection()
    rows = conn.execute(
        """SELECT * FROM deals
           WHERE published_date >= date('now', ?)
           ORDER BY published_date DESC""",
        (f"-{days} days",),
    ).fetchall()
    conn.close()
    deals = []
    for r in rows:
        d = dict(r)
        d["lead_investors"] = json.loads(d["lead_investors"] or "[]")
        d["other_investors"] = json.loads(d["other_investors"] or "[]")
        d["source_urls"] = json.loads(d["source_urls"] or "[]")
        d["source_names"] = json.loads(d["source_names"] or "[]")
        deals.append(d)
    return deals


def get_all_deals_for_dedup(days=7):
    conn = get_connection()
    rows = conn.execute(
        """SELECT * FROM deals
           WHERE published_date >= date('now', ?)""",
        (f"-{days} days",),
    ).fetchall()
    conn.close()
    deals = []
    for r in rows:
        d = dict(r)
        d["lead_investors"] = json.loads(d["lead_investors"] or "[]")
        d["other_investors"] = json.loads(d["other_investors"] or "[]")
        d["source_urls"] = json.loads(d["source_urls"] or "[]")
        d["source_names"] = json.loads(d["source_names"] or "[]")
        deals.append(d)
    return deals


if __name__ == "__main__":
    init_db()
    print("Database initialized.")
