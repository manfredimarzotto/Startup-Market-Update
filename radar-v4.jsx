import { useState, useCallback } from "react";

/* ─── DATA (aligned to real scoring model) ─── */
const COMPANIES = [
  {
    id: "frank",
    name: "Frankenburg Technologies",
    tags: ["DeepTech", "Defence Tech"],
    location: "Estonia",
    stage: "Series A",
    signal: "funding",
    score: 81,
    percentile: 94,
    raised: "€30M",
    sources: 4,
    updatedAgo: "3h",
    thesisFit: "high",
    summary: "€30M Series A closed · defence procurement subsystems · 4 independent sources · NATO 3.5% GDP mandate in effect.",
    full: "Frankenburg Technologies closed a €30M Series A led by a consortium of Nordic defence-focused funds. The round values the company at approximately €120M post-money. Estonia-based, the firm builds missile guidance subsystems for NATO-aligned procurement channels.",
    status: "new",
    owner: "MR",
    lastTouch: null,
    crmSync: false,
    trend: [44, 52, 58, 61, 65, 72, 78, 81],
    scoreBreakdown: { events: 17, capital: 22, momentum: 22, sources: 20 },
    triggers: [
      { type: "funding", text: "€30M Series A closed; Nordic defence fund consortium lead", time: "3h ago" },
      { type: "policy", text: "NATO defence spending mandate raised to 3.5% GDP (binding)", time: "2d ago" },
      { type: "hiring", text: "3 senior procurement roles posted — Tallinn, Brussels", time: "5d ago" },
      { type: "sector", text: "European defence tech VC volume +140% YoY (Dealroom)", time: "1w ago" },
    ],
  },
  {
    id: "photo",
    name: "Photoncycle",
    tags: ["CleanTech", "Energy Storage"],
    location: "Norway, Oslo",
    stage: "Series A",
    signal: "funding",
    score: 80,
    percentile: 91,
    raised: "€15M",
    sources: 3,
    updatedAgo: "6h",
    thesisFit: "medium",
    summary: "€15M Series A · seasonal hydrogen storage · NL + DK market entry · 3 sources · EU grid spend forecast +€4.2B.",
    full: "Photoncycle raised €15M in a Series A to scale proprietary seasonal hydrogen storage technology. Converts excess renewable energy into stored hydrogen for winter grid balancing. Netherlands and Denmark as first expansion markets.",
    status: "new",
    owner: null,
    lastTouch: null,
    crmSync: false,
    trend: [50, 55, 58, 62, 68, 72, 76, 80],
    scoreBreakdown: { events: 14, capital: 20, momentum: 24, sources: 22 },
    triggers: [
      { type: "funding", text: "€15M Series A closed; expansion capital for NL/DK", time: "6h ago" },
      { type: "sector", text: "EU grid balancing spend forecast +€4.2B by 2028 (EC report)", time: "3d ago" },
      { type: "competitor", text: "HydrogenPro delayed IPO — reduced competitive pressure", time: "1w ago" },
    ],
  },
  {
    id: "skysel",
    name: "SkySelect",
    tags: ["AI/ML", "Logistics", "Aviation"],
    location: "Estonia",
    stage: "Growth",
    signal: "funding",
    score: 62,
    percentile: 68,
    raised: "$9M",
    sources: 2,
    updatedAgo: "1d",
    thesisFit: "medium",
    summary: "$9M round · AI parts procurement for MRO · 2 sources only · investor undisclosed.",
    full: "SkySelect raised $9M to expand its AI-driven aviation parts procurement platform. Automates RFQ processes for MRO providers, reducing procurement cycle times by ~60%. Focus on North American and European carriers.",
    status: "new",
    owner: "MR",
    lastTouch: "Reviewed 3d ago",
    crmSync: true,
    trend: [40, 45, 50, 52, 54, 56, 59, 62],
    scoreBreakdown: { events: 12, capital: 18, momentum: 20, sources: 12 },
    triggers: [
      { type: "funding", text: "$9M round closed; investor undisclosed", time: "1d ago" },
      { type: "sector", text: "Global MRO spend projected $115B by 2029 (Oliver Wyman)", time: "4d ago" },
    ],
  },
  {
    id: "bliss",
    name: "Bliss",
    tags: ["HealthTech", "Mental Health AI"],
    location: "Finland, Helsinki",
    stage: "Seed",
    signal: "funding",
    score: 31,
    percentile: 28,
    raised: "€270K",
    sources: 2,
    updatedAgo: "2d",
    thesisFit: "low",
    summary: "€270K across 3 angel closes · culturally-localised AI therapy · 2 sources · no lead investor identified.",
    full: "Bliss has raised approximately €270K across multiple angel closes for its culturally-adapted AI therapy platform. Localises therapeutic frameworks for non-English-speaking markets, starting with Finnish and Arabic language support.",
    status: "new",
    owner: null,
    lastTouch: null,
    crmSync: false,
    trend: [10, 14, 18, 20, 22, 25, 28, 31],
    scoreBreakdown: { events: 6, capital: 8, momentum: 10, sources: 7 },
    triggers: [
      { type: "funding", text: "Third angel close (€83K); cumulative €270K", time: "2d ago" },
      { type: "sector", text: "Digital mental health TAM revised to $5.2B (Grand View)", time: "1w ago" },
    ],
  },
  {
    id: "cosuno",
    name: "Cosuno",
    tags: ["PropTech", "Construction"],
    location: "Germany, Berlin",
    stage: "Series B",
    signal: "growth",
    score: 58,
    percentile: 62,
    raised: "—",
    sources: 3,
    updatedAgo: "4h",
    thesisFit: "high",
    summary: "No new round · hiring surge (+40% QoQ) · 3 sources · German construction digitisation mandate effective Q3 2026.",
    full: "Cosuno's construction procurement platform showing accelerating growth across DACH region. General contractors increasingly mandating digital subcontractor management, creating network effects and high switching costs.",
    status: "viewed",
    owner: "MR",
    lastTouch: "Intro sent 1w ago",
    crmSync: true,
    trend: [35, 40, 44, 48, 50, 52, 55, 58],
    scoreBreakdown: { events: 16, capital: 0, momentum: 24, sources: 18 },
    triggers: [
      { type: "growth", text: "Job postings +40% QoQ; 12 new engineering roles", time: "4h ago" },
      { type: "policy", text: "German construction digitisation mandate effective Q3 2026", time: "2d ago" },
      { type: "competitor", text: "PlanRadar acquired by RIB Software — consolidation signal", time: "1w ago" },
    ],
  },
];

const STATUSES = ["new", "viewed", "contacted", "archived"];
const SIGNALS = ["all", "funding", "growth", "deals", "media"];
const FIT_OPTIONS = ["all", "high", "medium", "low"];

/* ─── MICRO COMPONENTS ─── */

function Spark({ data, color = "#10b981", w = 60, h = 18 }) {
  const max = Math.max(...data), min = Math.min(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 3) - 1.5}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sp${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={`url(#sp${color.slice(1)})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FitDot({ fit }) {
  const c = { high: "#059669", medium: "#d97706", low: "#94a3b8" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: c[fit] || c.low, fontWeight: 500 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c[fit] || c.low, opacity: 0.7 }} />
      {fit} fit
    </span>
  );
}

function OwnerBadge({ initials }) {
  if (!initials) return <span style={{ fontSize: 10, color: "#cbd5e1", fontStyle: "italic" }}>unassigned</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 20, height: 20, borderRadius: "50%", background: "#0f172a",
      color: "#fff", fontSize: 8.5, fontWeight: 600, letterSpacing: 0.3,
    }}>{initials}</span>
  );
}

function TriggerIcon({ type }) {
  const m = { funding: "💰", policy: "📜", hiring: "👤", sector: "📈", competitor: "⚔️", growth: "🚀" };
  return <span style={{ fontSize: 11.5 }}>{m[type] || "•"}</span>;
}

function ScoreBar({ label, value, max = 25, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 10, color: "#94a3b8", width: 56, textAlign: "right", fontWeight: 450, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: "#f1f5f9", borderRadius: 2, overflow: "hidden", minWidth: 36 }}>
        <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 9, color: "#64748b", width: 16, fontVariantNumeric: "tabular-nums", flexShrink: 0, fontWeight: 550 }}>{value}</span>
    </div>
  );
}

function scoreColor(s) {
  if (s >= 75) return "#10b981";
  if (s >= 50) return "#d97706";
  return "#94a3b8";
}

/* ─── WHY SURFACED DRAWER ─── */
function WhySurfaced({ triggers, breakdown, score, pct, color, onClose }) {
  return (
    <div style={{
      marginTop: 12, padding: "14px 16px", borderRadius: 8,
      background: "#f8fafc", border: "1px solid #f1f5f9",
      animation: "slideDown 0.2s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 0.6 }}>Why surfaced</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#94a3b8", padding: "0 2px", lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {/* Triggers */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
          {triggers.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <TriggerIcon type={t.type} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.35 }}>{t.text}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{t.time}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Score breakdown */}
        <div style={{ width: 180, flexShrink: 0, borderLeft: "1px solid #e2e8f0", paddingLeft: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{score}</span>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>/100</span>
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>Top {100 - pct}% activity this week</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ScoreBar label="Events" value={breakdown.events} color={color} />
            <ScoreBar label="Capital" value={breakdown.capital} color={color} />
            <ScoreBar label="Momentum" value={breakdown.momentum} color={color} />
            <ScoreBar label="Sources" value={breakdown.sources} color={color} />
          </div>
          <div style={{ fontSize: 9, color: "#cbd5e1", marginTop: 6, lineHeight: 1.4, fontStyle: "italic" }}>
            Measures observable activity intensity over 45 days. Not an investment recommendation.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DISCOVERY CARD ─── */
function DiscoveryCard({ company, index, selected, onSelect }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const sc = scoreColor(company.score);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "15px 18px",
        borderRadius: 10,
        background: selected ? "#fafeff" : "#fff",
        border: "1px solid",
        borderColor: selected ? "#bae6fd" : hovered ? "#e2e8f0" : "#f1f5f9",
        transition: "all 0.2s ease",
        boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.04)" : "none",
        animation: `fadeIn 0.3s ease ${index * 0.04}s both`,
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Checkbox */}
        <div style={{ paddingTop: 2, flexShrink: 0 }}>
          <input type="checkbox" checked={selected} onChange={() => onSelect(company.id)}
            style={{ width: 14, height: 14, accentColor: "#0f172a", cursor: "pointer" }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: Name + badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", letterSpacing: -0.2 }}>{company.name}</span>
            <span style={{
              padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 500,
              background: company.status === "new" ? "#ecfdf5" : company.status === "viewed" ? "#eff6ff" : "#f8fafc",
              color: company.status === "new" ? "#059669" : company.status === "viewed" ? "#2563eb" : "#64748b",
            }}>{company.status}</span>
            {company.crmSync && (
              <span style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M2 8.5l4 4 8-9" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                CRM
              </span>
            )}
            {/* Fit badge — clearly separate from score */}
            <FitDot fit={company.thesisFit} />
          </div>

          {/* Row 2: Tags */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, flexWrap: "wrap" }}>
            {company.tags.map((t) => (
              <span key={t} style={{ padding: "1px 6px", borderRadius: 3, fontSize: 10.5, color: "#64748b", background: "#f8fafc", fontWeight: 450 }}>{t}</span>
            ))}
            <span style={{ color: "#e2e8f0" }}>·</span>
            <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{company.location}</span>
            <span style={{ color: "#e2e8f0" }}>·</span>
            <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{company.stage}</span>
          </div>

          {/* Row 3: Summary (factual compression) */}
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: "#475569", fontWeight: 420 }}>
            {company.summary}
          </p>

          {/* Row 4: Evidence metadata */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 7, fontSize: 10.5, color: "#94a3b8" }}>
            {company.raised !== "—" && (
              <><span style={{ fontWeight: 550, color: "#64748b" }}>{company.raised}</span><span style={{ margin: "0 6px", color: "#e2e8f0" }}>·</span></>
            )}
            <span>{company.sources} source{company.sources !== 1 ? "s" : ""}</span>
            <span style={{ margin: "0 6px", color: "#e2e8f0" }}>·</span>
            <span>{company.updatedAgo}</span>
            <span style={{ margin: "0 6px", color: "#e2e8f0" }}>·</span>
            <OwnerBadge initials={company.owner} />
            {company.lastTouch && (
              <><span style={{ margin: "0 6px", color: "#e2e8f0" }}>·</span><span style={{ fontSize: 10, fontStyle: "italic" }}>{company.lastTouch}</span></>
            )}
          </div>

          {/* Drawer */}
          {drawerOpen && (
            <WhySurfaced
              triggers={company.triggers}
              breakdown={company.scoreBreakdown}
              score={company.score}
              pct={company.percentile}
              color={sc}
              onClose={() => setDrawerOpen(false)}
            />
          )}
        </div>

        {/* Right: Score */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Spark data={company.trend} color={sc} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: sc, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5, lineHeight: 1 }}>
                {company.score}
              </div>
              <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>Top {100 - company.percentile}%</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              style={{
                padding: "4px 9px", borderRadius: 5, fontSize: 10, fontWeight: 500,
                border: "1px solid", cursor: "pointer", transition: "all 0.12s ease",
                borderColor: drawerOpen ? "#0f172a" : "#e2e8f0",
                background: drawerOpen ? "#0f172a" : "#fff",
                color: drawerOpen ? "#fff" : "#64748b",
              }}
            >{drawerOpen ? "Close" : "Why surfaced"}</button>
            <button style={{
              padding: "4px 9px", borderRadius: 5, fontSize: 10, fontWeight: 500,
              border: "none", background: "#0f172a", color: "#fff",
              cursor: "pointer", transition: "opacity 0.12s ease",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >Review</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── TRIAGE ROW ─── */
function TriageRow({ company, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const sc = scoreColor(company.score);
  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        style={{
          cursor: "pointer",
          background: selected ? "#fafeff" : open ? "#f8fafc" : "#fff",
          transition: "background 0.1s ease",
        }}
        onMouseEnter={(e) => { if (!open && !selected) e.currentTarget.style.background = "#fafbfc"; }}
        onMouseLeave={(e) => { if (!open && !selected) e.currentTarget.style.background = "#fff"; }}
      >
        <td style={{ padding: "9px 6px 9px 12px", width: 26 }}>
          <input type="checkbox" checked={selected} onChange={(e) => { e.stopPropagation(); onSelect(company.id); }}
            style={{ width: 13, height: 13, accentColor: "#0f172a", cursor: "pointer" }} />
        </td>
        <td style={{ padding: "9px 6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>{company.name}</span>
            <span style={{
              padding: "0 5px", borderRadius: 3, fontSize: 9, fontWeight: 500,
              background: company.status === "new" ? "#ecfdf5" : "#f8fafc",
              color: company.status === "new" ? "#059669" : "#64748b",
            }}>{company.status}</span>
          </div>
        </td>
        <td style={{ padding: "9px 6px", fontSize: 10.5, color: "#64748b" }}>{company.tags.slice(0, 2).join(", ")}</td>
        <td style={{ padding: "9px 6px", fontSize: 10.5, color: "#64748b" }}>{company.location}</td>
        <td style={{ padding: "9px 6px", fontSize: 10.5, color: "#64748b" }}>{company.stage}</td>
        <td style={{ padding: "9px 6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: sc, fontVariantNumeric: "tabular-nums" }}>{company.score}</span>
            <Spark data={company.trend} color={sc} w={44} h={14} />
            <span style={{ fontSize: 9, color: "#94a3b8" }}>Top {100 - company.percentile}%</span>
          </div>
        </td>
        <td style={{ padding: "9px 6px" }}><FitDot fit={company.thesisFit} /></td>
        <td style={{ padding: "9px 6px", fontSize: 11, fontWeight: 550, color: "#475569" }}>{company.raised}</td>
        <td style={{ padding: "9px 6px", textAlign: "center" }}><OwnerBadge initials={company.owner} /></td>
        <td style={{ padding: "9px 6px", fontSize: 10, color: "#94a3b8" }}>{company.updatedAgo}</td>
        <td style={{ padding: "9px 6px 9px 2px" }}>
          <button style={{
            padding: "3px 9px", borderRadius: 5, border: "none",
            background: "#0f172a", color: "#fff", fontSize: 10, fontWeight: 500, cursor: "pointer",
          }}>Review</button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={11} style={{ padding: "0 12px 10px 42px", background: "#f8fafc" }}>
            <div style={{ display: "flex", gap: 16, padding: "10px 0", flexWrap: "wrap" }}>
              {company.triggers.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 5, alignItems: "flex-start", maxWidth: 260 }}>
                  <TriggerIcon type={t.type} />
                  <div>
                    <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.3 }}>{t.text}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8" }}>{t.time}</div>
                  </div>
                </div>
              ))}
              <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 14, minWidth: 140 }}>
                <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 4 }}>Top {100 - company.percentile}% activity</div>
                {Object.entries(company.scoreBreakdown).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 9, color: "#94a3b8", width: 50, textAlign: "right", textTransform: "capitalize" }}>{k}</span>
                    <div style={{ width: 44, height: 3, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${(v / 25) * 100}%`, height: "100%", background: sc, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 9, color: "#64748b", fontWeight: 550 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── BULK BAR ─── */
function BulkBar({ count, onClear }) {
  if (count === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 18px", borderRadius: 10,
      background: "#0f172a", color: "#fff",
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      fontSize: 12, fontWeight: 500, zIndex: 20,
      animation: "slideUp 0.2s ease",
    }}>
      <span>{count} selected</span>
      <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)" }} />
      {["Mark viewed", "Assign to me", "Export", "Archive"].map((a) => (
        <button key={a} style={{
          padding: "4px 10px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.12)",
          background: "transparent", color: "#fff", fontSize: 10.5, fontWeight: 500,
          cursor: "pointer", transition: "background 0.1s ease",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >{a}</button>
      ))}
      <button onClick={onClear} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 15, padding: "0 3px" }}>×</button>
    </div>
  );
}

/* ─── MAIN ─── */
export default function StartupRadar() {
  const [view, setView] = useState("discovery");
  const [signalFilter, setSignalFilter] = useState("all");
  const [fitFilter, setFitFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const filtered = COMPANIES
    .filter((c) => signalFilter === "all" || c.signal === signalFilter)
    .filter((c) => fitFilter === "all" || c.thesisFit === fitFilter)
    .sort((a, b) => b.score - a.score);

  const avgScore = Math.round(COMPANIES.reduce((a, c) => a + c.score, 0) / COMPANIES.length);

  const th = {
    padding: "7px 6px", fontSize: 9.5, fontWeight: 600, color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left",
    borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fafbfc", fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing:border-box; margin:0; }
        button { font-family:inherit; }
        table { border-collapse:collapse; width:100%; }
        tbody tr { border-bottom:1px solid #f1f5f9; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:4px; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "11px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid #f1f5f9",
        background: "rgba(250,251,252,0.88)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 5, background: "#0f172a",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 10, fontWeight: 700,
          }}>S</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", letterSpacing: -0.2 }}>Startup Intelligence Radar</span>
          <span style={{ fontSize: 9, fontWeight: 550, color: "#94a3b8", background: "#f1f5f9", padding: "1px 5px", borderRadius: 3 }}>beta</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* View toggle */}
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 5, padding: 1.5 }}>
            {[
              { key: "discovery", label: "Discovery", icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2"/></svg> },
              { key: "triage", label: "Triage", icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M1 3h14M1 8h14M1 13h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
            ].map(({ key, label, icon }) => (
              <button key={key} onClick={() => setView(key)} style={{
                padding: "3px 9px", borderRadius: 4, border: "none", cursor: "pointer",
                background: view === key ? "#fff" : "transparent",
                color: view === key ? "#0f172a" : "#94a3b8",
                boxShadow: view === key ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 500,
                transition: "all 0.12s ease",
              }}>{icon}{label}</button>
            ))}
          </div>
          <span style={{ fontSize: 10.5, color: "#cbd5e1" }}>
            {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <button style={{
            padding: "4px 10px", borderRadius: 5, border: "1px solid #e2e8f0",
            background: "#fff", color: "#475569", fontSize: 11, fontWeight: 500,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            transition: "border-color 0.12s ease",
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = "#cbd5e1"}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = "#e2e8f0"}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M14 8A6 6 0 114.8 3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M5 1l-1 3 3 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 20px 80px" }}>
        {/* KPI strip */}
        <div style={{ display: "flex", gap: 16, marginBottom: 14, padding: "0 2px" }}>
          {[
            { l: "Companies", v: COMPANIES.length, s: "+3 wk" },
            { l: "Avg signal", v: avgScore, s: null },
            { l: "New signals", v: 23, s: "+8 today" },
            { l: "Contacted", v: 4 },
          ].map((m, i) => (
            <div key={m.l} style={{ display: "flex", alignItems: "baseline", gap: 5, animation: `fadeIn 0.25s ease ${i * 0.03}s both` }}>
              <span style={{ fontSize: 9.5, fontWeight: 550, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{m.l}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{m.v}</span>
              {m.s && <span style={{ fontSize: 10, color: "#10b981", fontWeight: 500 }}>{m.s}</span>}
            </div>
          ))}
        </div>

        {/* Filters: signal type + fit */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, padding: "0 2px", flexWrap: "wrap" }}>
          {SIGNALS.map((s) => (
            <button key={s} onClick={() => setSignalFilter(s)} style={{
              padding: "3px 10px", borderRadius: 999, border: "1px solid",
              borderColor: signalFilter === s ? "#0f172a" : "#e2e8f0",
              background: signalFilter === s ? "#0f172a" : "#fff",
              color: signalFilter === s ? "#fff" : "#64748b",
              fontSize: 10.5, fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
              transition: "all 0.1s ease",
            }}>{s === "all" ? "All signals" : s}</button>
          ))}

          <span style={{ width: 1, height: 14, background: "#e2e8f0", margin: "0 4px" }} />

          {/* Fit filter — visually distinct as separate dimension */}
          {FIT_OPTIONS.map((f) => (
            <button key={f} onClick={() => setFitFilter(f)} style={{
              padding: "3px 10px", borderRadius: 999, border: "1px solid",
              borderColor: fitFilter === f ? "#059669" : "#e2e8f0",
              background: fitFilter === f ? "#ecfdf5" : "#fff",
              color: fitFilter === f ? "#059669" : "#94a3b8",
              fontSize: 10.5, fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
              transition: "all 0.1s ease",
            }}>{f === "all" ? "Any fit" : f + " fit"}</button>
          ))}

          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#94a3b8" }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ─── DISCOVERY ─── */}
        {view === "discovery" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {filtered.length > 0 ? filtered.map((c, i) => (
              <DiscoveryCard key={c.id} company={c} index={i} selected={selected.has(c.id)} onSelect={toggleSelect} />
            )) : (
              <div style={{ padding: 36, textAlign: "center", color: "#94a3b8", fontSize: 12.5, background: "#fff", borderRadius: 10, border: "1px solid #f1f5f9" }}>
                No companies match these filters.
              </div>
            )}
          </div>
        )}

        {/* ─── TRIAGE ─── */}
        {view === "triage" && (
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #f1f5f9", overflow: "hidden" }}>
            <table>
              <thead>
                <tr style={{ background: "#fafbfc" }}>
                  <th style={{ ...th, width: 26, paddingLeft: 12 }}>
                    <input type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={() => { selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map(c => c.id))); }}
                      style={{ width: 12, height: 12, accentColor: "#0f172a", cursor: "pointer" }} />
                  </th>
                  <th style={th}>Company</th>
                  <th style={th}>Sector</th>
                  <th style={th}>Location</th>
                  <th style={th}>Stage</th>
                  <th style={th}>Signal</th>
                  <th style={th}>Fit</th>
                  <th style={th}>Raised</th>
                  <th style={{ ...th, textAlign: "center" }}>Owner</th>
                  <th style={th}>Updated</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <TriageRow key={c.id} company={c} selected={selected.has(c.id)} onSelect={toggleSelect} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Methodology footer */}
        <div style={{
          marginTop: 14, padding: "8px 14px", borderRadius: 6,
          background: "#fff", border: "1px solid #f1f5f9",
          fontSize: 10.5, color: "#94a3b8", lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 600, color: "#64748b" }}>Signal Strength</span> = Events (observable company actions, 0–25) + Capital (funding signals, 0–25) + Momentum (sector tailwinds, 0–25) + Sources (independent corroboration, 0–25). 45-day decay window. Not an investment recommendation. <span style={{ fontWeight: 600, color: "#64748b" }}>Thesis Fit</span> is a separate, user-configured filter.
        </div>

        {view === "triage" && (
          <div style={{ marginTop: 8, fontSize: 9.5, color: "#cbd5e1", textAlign: "center" }}>Click any row to inspect triggers and score breakdown</div>
        )}
      </div>

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())} />
    </div>
  );
}
