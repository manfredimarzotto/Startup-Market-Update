/* Shared UI primitives used by both OpportunityCard and TriageTable. */

export const STATUS_COLORS = {
  new:       { bg: '#ecfdf5', color: '#059669' },
  viewed:    { bg: '#eff6ff', color: '#2563eb' },
  contacted: { bg: '#fef3c7', color: '#d97706' },
  archived:  { bg: '#f8fafc', color: '#64748b' },
};

const FIT_COLORS = {
  high:   '#059669',
  medium: '#d97706',
  low:    '#94a3b8',
};

export const TRIGGER_ICONS = {
  // Trigger categories (from pipeline build_triggers)
  funding: '\u{1F4B0}',
  policy: '\u{1F4DC}',
  hiring: '\u{1F464}',
  sector: '\u{1F4C8}',
  competitor: '\u{2694}\u{FE0F}',
  growth: '\u{1F680}',
  // Legacy signal_type keys (fallback for raw signals)
  funding_round: '\u{1F4B0}',
  new_fund: '\u{1F4B0}',
  hiring_wave: '\u{1F464}',
  acquisition: '\u{2694}\u{FE0F}',
  partnership: '\u{1F91D}',
  expansion: '\u{1F680}',
  product_launch: '\u{1F680}',
  media_mention: '\u{1F4F0}',
};

export function scoreColor(s) {
  if (s >= 75) return '#10b981';
  if (s >= 50) return '#d97706';
  return '#94a3b8';
}

export function deriveFit(score) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export function Spark({ data, color = '#10b981', w = 60, h = 18 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 3) - 1.5}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`sp${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`url(#sp${color.slice(1)})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function OwnerBadge({ initials }) {
  if (!initials) return <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }}>unassigned</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: '50%', background: '#0f172a',
      color: '#fff', fontSize: 8.5, fontWeight: 600, letterSpacing: 0.3,
    }}>{initials}</span>
  );
}

export function FitDot({ fit }) {
  const c = FIT_COLORS[fit] || FIT_COLORS.low;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: c, fontWeight: 500 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, opacity: 0.7 }} />
      {fit} fit
    </span>
  );
}

export function TriggerIcon({ type }) {
  return <span style={{ fontSize: 11.5 }}>{TRIGGER_ICONS[type] || '\u{2022}'}</span>;
}
