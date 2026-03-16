import { useState } from 'react';
import { COUNTRY_NAMES, daysSince, formatSignalType } from '../hooks/useData';
import { TRIGGER_ICONS, scoreColor, deriveFit, Spark, OwnerBadge, FitDot } from './shared';

const TH = {
  padding: '7px 6px', fontSize: 9.5, fontWeight: 600, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left',
  borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
};

export default function TriageTable({ opportunities, selected, onSelect, onStatusChange }) {
  const [openRowId, setOpenRowId] = useState(null);

  const allSelected = selected.size === opportunities.length && opportunities.length > 0;
  const toggleAll = () => {
    if (allSelected) {
      opportunities.forEach(o => { if (selected.has(o.id)) onSelect(o.id); });
    } else {
      opportunities.forEach(o => { if (!selected.has(o.id)) onSelect(o.id); });
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ background: '#fafbfc' }}>
            <th style={{ ...TH, width: 26, paddingLeft: 12 }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                style={{ width: 12, height: 12, accentColor: '#0f172a', cursor: 'pointer' }} />
            </th>
            <th style={TH}>Company</th>
            <th style={TH}>Sector</th>
            <th style={TH}>Location</th>
            <th style={TH}>Stage</th>
            <th style={TH}>Signal</th>
            <th style={TH}>Fit</th>
            <th style={TH}>Raised</th>
            <th style={{ ...TH, textAlign: 'center' }}>Owner</th>
            <th style={TH}>Updated</th>
            <th style={TH}></th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opp) => (
            <TriageRow
              key={opp.id}
              opportunity={opp}
              isSelected={selected.has(opp.id)}
              onSelect={onSelect}
              isOpen={openRowId === opp.id}
              onToggle={() => setOpenRowId(openRowId === opp.id ? null : opp.id)}
              onStatusChange={onStatusChange}
            />
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 9.5, color: '#cbd5e1', textAlign: 'center', padding: '6px 0' }}>
        Click any row to inspect triggers and score breakdown
      </div>
    </div>
  );
}

function TriageRow({ opportunity, isSelected, onSelect, isOpen, onToggle, onStatusChange }) {
  const { entity, entity_type, oppSignals, status, opportunity_score } = opportunity;
  const name = entity?.name || 'Unknown';
  const sc = scoreColor(opportunity_score);

  const sector = entity_type === 'company'
    ? [entity?.sector, entity?.sub_sector].filter(Boolean).slice(0, 2).join(', ')
    : entity_type === 'investor' ? entity?.type || '' : entity?.role || '';

  const location = entity_type === 'company'
    ? [COUNTRY_NAMES[entity?.hq_country] || entity?.hq_country, entity?.hq_city].filter(Boolean).join(', ')
    : '';

  const stage = entity_type === 'company' ? entity?.stage || '' : '';

  const fundingSignal = oppSignals.find(s => s.metadata?.amount_raw);
  const raised = fundingSignal?.metadata?.amount_raw || '—';

  const mostRecent = oppSignals.reduce((best, s) => {
    const d = daysSince(s.published_at);
    return d < best ? d : best;
  }, 999);
  const updatedAgo = mostRecent === 0 ? 'today' : mostRecent === 1 ? '1d' : mostRecent < 7 ? `${mostRecent}d` : mostRecent < 30 ? `${Math.round(mostRecent / 7)}w` : `${Math.round(mostRecent / 30)}mo`;

  const fit = deriveFit(opportunity_score);
  const percentile = opportunity.percentile;

  // Sparkline data from score_breakdown
  const bd = opportunity.score_breakdown || {};
  const sparkData = [
    bd.signal_strength || 0, bd.recency || 0, bd.deal_magnitude || 0,
    bd.growth_velocity || 0, Math.round(opportunity_score * 0.6),
    Math.round(opportunity_score * 0.8), opportunity_score,
  ];

  // Use pre-built triggers from pipeline if available
  const triggers = opportunity.triggers && opportunity.triggers.length > 0
    ? opportunity.triggers
    : oppSignals.map(s => ({
        type: s.signal_type,
        text: s.headline || formatSignalType(s.signal_type),
        time: daysSince(s.published_at) === 0 ? 'today'
          : daysSince(s.published_at) === 1 ? '1d ago'
          : daysSince(s.published_at) < 7 ? `${daysSince(s.published_at)}d ago`
          : `${Math.round(daysSince(s.published_at) / 7)}w ago`,
      }));

  const breakdown = {
    Events: bd.events || 0,
    Capital: bd.capital || 0,
    Momentum: bd.momentum || 0,
    Sources: bd.sources || 0,
  };

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          background: isSelected ? '#fafeff' : isOpen ? '#f8fafc' : '#fff',
          transition: 'background 0.1s ease',
          borderBottom: isOpen ? 'none' : '1px solid #f1f5f9',
        }}
        onMouseEnter={(e) => { if (!isOpen && !isSelected) e.currentTarget.style.background = '#fafbfc'; }}
        onMouseLeave={(e) => { if (!isOpen && !isSelected) e.currentTarget.style.background = '#fff'; }}
      >
        <td style={{ padding: '9px 6px 9px 12px', width: 26 }}>
          <input type="checkbox" checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onSelect(opportunity.id); }}
            style={{ width: 13, height: 13, accentColor: '#0f172a', cursor: 'pointer' }} />
        </td>
        <td style={{ padding: '9px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{name}</span>
            <span style={{
              padding: '0 5px', borderRadius: 3, fontSize: 9, fontWeight: 500,
              background: status === 'new' ? '#ecfdf5' : '#f8fafc',
              color: status === 'new' ? '#059669' : '#64748b',
            }}>{status}</span>
          </div>
        </td>
        <td style={{ padding: '9px 6px', fontSize: 10.5, color: '#64748b' }}>{sector}</td>
        <td style={{ padding: '9px 6px', fontSize: 10.5, color: '#64748b' }}>{location}</td>
        <td style={{ padding: '9px 6px', fontSize: 10.5, color: '#64748b' }}>{stage}</td>
        <td style={{ padding: '9px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: sc, fontVariantNumeric: 'tabular-nums' }}>{opportunity_score}</span>
            <Spark data={sparkData} color={sc} w={44} h={14} />
            <span style={{ fontSize: 9, color: '#94a3b8' }}>Top {percentile}%</span>
          </div>
        </td>
        <td style={{ padding: '9px 6px' }}><FitDot fit={fit} /></td>
        <td style={{ padding: '9px 6px', fontSize: 11, fontWeight: 550, color: '#475569' }}>{raised}</td>
        <td style={{ padding: '9px 6px', textAlign: 'center' }}>
          <OwnerBadge initials={opportunity.owner || null} />
        </td>
        <td style={{ padding: '9px 6px', fontSize: 10, color: '#94a3b8' }}>{updatedAgo}</td>
        <td style={{ padding: '9px 6px 9px 2px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(opportunity.id, 'viewed'); }}
            style={{
              padding: '3px 9px', borderRadius: 5, border: 'none',
              background: '#0f172a', color: '#fff', fontSize: 10, fontWeight: 500, cursor: 'pointer',
            }}
          >Review</button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={11} style={{ padding: '0 12px 10px 42px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', gap: 16, padding: '10px 0', flexWrap: 'wrap' }}>
              {triggers.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', maxWidth: 260 }}>
                  <span style={{ fontSize: 11.5 }}>{TRIGGER_ICONS[t.type] || '\u{2022}'}</span>
                  <div>
                    <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.3 }}>{t.text}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>{t.time}</div>
                  </div>
                </div>
              ))}
              {triggers.length === 0 && (
                <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>No trigger details</div>
              )}
              <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 14, minWidth: 140 }}>
                <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4 }}>Top {percentile}% activity</div>
                {Object.entries(breakdown).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 9, color: '#94a3b8', width: 50, textAlign: 'right' }}>{k}</span>
                    <div style={{ width: 44, height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(v / 25) * 100}%`, height: '100%', background: sc, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 9, color: '#64748b', fontWeight: 550 }}>{v}</span>
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
