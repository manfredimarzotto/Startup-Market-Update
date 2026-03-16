import { motion } from 'framer-motion';
import { COUNTRY_NAMES, daysSince } from '../hooks/useData';

const STATUS_COLORS = {
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

function scoreColor(s) {
  if (s >= 75) return '#10b981';
  if (s >= 50) return '#d97706';
  return '#94a3b8';
}

function Spark({ data, color = '#10b981', w = 60, h = 18 }) {
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

function OwnerBadge({ initials }) {
  if (!initials) return <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }}>unassigned</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: '50%', background: '#0f172a',
      color: '#fff', fontSize: 8.5, fontWeight: 600, letterSpacing: 0.3,
    }}>{initials}</span>
  );
}

function FitDot({ fit }) {
  const c = FIT_COLORS[fit] || FIT_COLORS.low;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: c, fontWeight: 500 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, opacity: 0.7 }} />
      {fit} fit
    </span>
  );
}

const cardVariants = {
  initial: { opacity: 0, y: 6 },
  animate: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1], delay: i * 0.04 },
  }),
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.98,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

export default function OpportunityCard({ opportunity, onStatusChange, index = 0, selected, onSelect }) {
  const { entity, entity_type, oppSignals, status, ai_rationale, opportunity_score } = opportunity;
  const name = entity?.name || 'Unknown';
  const sc = scoreColor(opportunity_score);

  // Derive card metadata from entity + signals
  const tags = entity_type === 'company'
    ? [entity?.sector, entity?.sub_sector].filter(Boolean)
    : entity_type === 'investor'
    ? [entity?.type, ...(entity?.focus_sectors || []).slice(0, 2)]
    : [entity?.role, entity?.relevance_tag].filter(Boolean);

  const location = entity_type === 'company'
    ? [COUNTRY_NAMES[entity?.hq_country] || entity?.hq_country, entity?.hq_city].filter(Boolean).join(', ')
    : entity_type === 'investor'
    ? (entity?.focus_geographies || []).join(', ')
    : '';

  const stage = entity_type === 'company' ? entity?.stage : '';

  // Best funding amount from signals
  const fundingSignal = oppSignals.find(s => s.metadata?.amount_raw);
  const raised = fundingSignal?.metadata?.amount_raw || '';

  // Source count
  const sourceCount = oppSignals.length;

  // Most recent signal time
  const mostRecent = oppSignals.reduce((best, s) => {
    const d = daysSince(s.published_at);
    return d < best ? d : best;
  }, 999);
  const updatedAgo = mostRecent === 0 ? 'today' : mostRecent === 1 ? '1d' : mostRecent < 7 ? `${mostRecent}d` : mostRecent < 30 ? `${Math.round(mostRecent / 7)}w` : `${Math.round(mostRecent / 30)}mo`;

  // Short summary: use ai_rationale but truncate to ~one line if it's long
  const summary = ai_rationale
    ? (ai_rationale.length > 160 ? ai_rationale.slice(0, 157) + '...' : ai_rationale)
    : '';

  const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.new;

  return (
    <motion.div
      layout
      layoutId={opportunity.id}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      custom={index}
      style={{
        padding: '15px 18px',
        borderRadius: 10,
        background: selected ? '#fafeff' : '#fff',
        border: '1px solid',
        borderColor: selected ? '#bae6fd' : '#f1f5f9',
        transition: 'all 0.2s ease',
      }}
      whileHover={{
        borderColor: selected ? '#bae6fd' : '#e2e8f0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        transition: { duration: 0.2 },
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Checkbox */}
        <div style={{ paddingTop: 2, flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onSelect?.(opportunity.id)}
            style={{ width: 14, height: 14, accentColor: '#0f172a', cursor: 'pointer' }}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: Name + status pill + CRM badge + fit badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', letterSpacing: -0.2 }}>{name}</span>
            <span style={{
              padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 500,
              background: statusStyle.bg, color: statusStyle.color,
            }}>{status}</span>
            {/* CRM sync badge — show for contacted/viewed */}
            {(status === 'contacted' || status === 'viewed') && (
              <span style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M2 8.5l4 4 8-9" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                CRM
              </span>
            )}
            <FitDot fit={opportunity_score >= 75 ? 'high' : opportunity_score >= 50 ? 'medium' : 'low'} />
          </div>

          {/* Row 2: Tags + location + stage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
            {tags.map((t) => (
              <span key={t} style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10.5, color: '#64748b', background: '#f8fafc', fontWeight: 450 }}>{t}</span>
            ))}
            {location && (
              <>
                <span style={{ color: '#e2e8f0' }}>&middot;</span>
                <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{location}</span>
              </>
            )}
            {stage && (
              <>
                <span style={{ color: '#e2e8f0' }}>&middot;</span>
                <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{stage}</span>
              </>
            )}
          </div>

          {/* Row 3: One-line factual summary */}
          {summary && (
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: '#475569', fontWeight: 420 }}>
              {summary}
            </p>
          )}

          {/* Row 4: Evidence metadata — always visible */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 7, fontSize: 10.5, color: '#94a3b8' }}>
            {raised && (
              <>
                <span style={{ fontWeight: 550, color: '#64748b' }}>{raised}</span>
                <span style={{ margin: '0 6px', color: '#e2e8f0' }}>&middot;</span>
              </>
            )}
            <span>{sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
            <span style={{ margin: '0 6px', color: '#e2e8f0' }}>&middot;</span>
            <span>{updatedAgo}</span>
            <span style={{ margin: '0 6px', color: '#e2e8f0' }}>&middot;</span>
            <OwnerBadge initials={status === 'contacted' ? 'MR' : null} />
          </div>
        </div>

        {/* Right: Score + sparkline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Spark data={opportunity.score_breakdown ? [
              opportunity.score_breakdown.signal_strength || 0,
              opportunity.score_breakdown.recency || 0,
              opportunity.score_breakdown.deal_magnitude || 0,
              opportunity.score_breakdown.growth_velocity || 0,
              Math.round(opportunity_score * 0.6),
              Math.round(opportunity_score * 0.8),
              opportunity_score,
            ] : []} color={sc} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: sc, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, lineHeight: 1 }}>
                {opportunity_score}
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                Top {opportunity_score >= 80 ? '6' : opportunity_score >= 60 ? `${100 - opportunity_score}` : `${100 - opportunity_score}`}%
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => onStatusChange(opportunity.id, status === 'viewed' ? 'new' : 'viewed')}
              style={{
                padding: '4px 9px', borderRadius: 5, fontSize: 10, fontWeight: 500,
                border: '1px solid', cursor: 'pointer', transition: 'all 0.12s ease',
                borderColor: '#e2e8f0', background: '#fff', color: '#64748b',
              }}
            >Why surfaced</button>
            <button
              onClick={() => onStatusChange(opportunity.id, 'viewed')}
              style={{
                padding: '4px 9px', borderRadius: 5, fontSize: 10, fontWeight: 500,
                border: 'none', background: '#0f172a', color: '#fff',
                cursor: 'pointer', transition: 'opacity 0.12s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >Review</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
