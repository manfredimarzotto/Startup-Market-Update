import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Header from './components/Header';
import OpportunityCard from './components/OpportunityCard';
import TriageTable from './components/TriageTable';
import { useData } from './hooks/useData';
import { useFilters } from './hooks/useFilters';
import { useStatus } from './hooks/useStatus';

const SIGNAL_OPTIONS = ['all', 'funding', 'growth', 'deals', 'media'];
const FIT_OPTIONS = ['all', 'high', 'medium', 'low'];

export default function App() {
  const { opportunities, signals, companies, investors, people, loading, error, signalMap, companyMap, investorMap, personMap } = useData();
  const lookups = useMemo(() => ({ signalMap, companyMap, investorMap, personMap }), [signalMap, companyMap, investorMap, personMap]);
  const { getStatus, setStatus } = useStatus();
  const {
    filters, toggleArrayFilter, setFilter, resetFilters,
    filteredOpportunities, filterOptions, activeFilterCount,
  } = useFilters(opportunities, lookups, getStatus);

  // View toggle
  const [view, setView] = useState('discovery');
  // Signal type chip filter (maps to typeGroups)
  const [signalFilter, setSignalFilter] = useState('all');
  // Fit filter (local — thesis fit is not in data model, so this is a UI-only placeholder)
  const [fitFilter, setFitFilter] = useState('all');
  // Bulk selection
  const [selected, setSelected] = useState(new Set());
  const toggleSelect = useCallback((id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  // Only one drawer open at a time
  const [openDrawerId, setOpenDrawerId] = useState(null);

  const handleSignalFilter = useCallback((value) => {
    setSignalFilter(value);
    if (value === 'all') {
      setFilter('typeGroups', ['funding', 'deals', 'growth', 'media']);
    } else {
      setFilter('typeGroups', [value]);
    }
  }, [setFilter]);

  // KPI computations
  const avgScore = useMemo(() => {
    if (filteredOpportunities.length === 0) return 0;
    return Math.round(filteredOpportunities.reduce((a, o) => a + o.opportunity_score, 0) / filteredOpportunities.length);
  }, [filteredOpportunities]);

  const contactedCount = useMemo(() => {
    return filteredOpportunities.filter(o => o.status === 'contacted').length;
  }, [filteredOpportunities]);

  const newSignalCount = useMemo(() => {
    return signals.length;
  }, [signals]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Loading intelligence data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-bento p-8 max-w-md text-center">
          <p className="text-red-500 font-medium">Failed to load data</p>
          <p className="text-slate-400 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Companies', value: companies.length },
    { label: 'Avg signal', value: avgScore },
    { label: 'New signals', value: newSignalCount },
    { label: 'Contacted', value: contactedCount },
  ];

  return (
    <div className="min-h-screen text-[#0f172a]">
      <Header view={view} onViewChange={setView} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 20px 80px' }}>
        {/* KPI strip */}
        <div className="flex gap-4 mb-3.5 px-0.5">
          {kpis.map((m) => (
            <div key={m.label} className="flex items-baseline gap-1.5">
              <span className="text-[9.5px] font-medium text-[#94a3b8] uppercase tracking-wide">{m.label}</span>
              <span className="text-[15px] font-bold text-[#0f172a] tabular-nums">{m.value}</span>
            </div>
          ))}
        </div>

        {/* Filter chips: signal type + fit */}
        <div className="flex items-center gap-1 mb-3 px-0.5 flex-wrap">
          {SIGNAL_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSignalFilter(s)}
              className="transition-all duration-100 capitalize"
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid',
                borderColor: signalFilter === s ? '#0f172a' : '#e2e8f0',
                background: signalFilter === s ? '#0f172a' : '#fff',
                color: signalFilter === s ? '#fff' : '#64748b',
                fontSize: '10.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {s === 'all' ? 'All signals' : s}
            </button>
          ))}

          {/* Separator */}
          <span className="w-px h-3.5 bg-[#e2e8f0] mx-1" />

          {/* Fit filter — green-tinted */}
          {FIT_OPTIONS.map((f) => (
            <button
              key={f}
              onClick={() => setFitFilter(f)}
              className="transition-all duration-100 capitalize"
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid',
                borderColor: fitFilter === f ? '#059669' : '#e2e8f0',
                background: fitFilter === f ? '#ecfdf5' : '#fff',
                color: fitFilter === f ? '#059669' : '#94a3b8',
                fontSize: '10.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? 'Any fit' : f + ' fit'}
            </button>
          ))}

          <span className="ml-auto text-[10.5px] text-[#94a3b8]">
            {filteredOpportunities.length} result{filteredOpportunities.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Discovery view */}
        {view === 'discovery' && (
          filteredOpportunities.length > 0 ? (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredOpportunities.map((opp, i) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onStatusChange={setStatus}
                    index={i}
                    selected={selected.has(opp.id)}
                    onSelect={toggleSelect}
                    drawerOpen={openDrawerId === opp.id}
                    onToggleDrawer={setOpenDrawerId}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState onReset={() => { resetFilters(); setSignalFilter('all'); setFitFilter('all'); }} />
          )
        )}

        {/* Triage view */}
        {view === 'triage' && (
          filteredOpportunities.length > 0 ? (
            <TriageTable
              opportunities={filteredOpportunities}
              selected={selected}
              onSelect={toggleSelect}
              onStatusChange={setStatus}
            />
          ) : (
            <EmptyState onReset={() => { resetFilters(); setSignalFilter('all'); setFitFilter('all'); }} />
          )
        )}

        {/* Methodology footer */}
        <div
          className="mt-3.5 rounded-md text-[10.5px] text-[#94a3b8] leading-relaxed"
          style={{ padding: '8px 14px', background: '#fff', border: '1px solid #f1f5f9' }}
        >
          <span className="font-semibold text-[#64748b]">Signal Strength</span> = Events (observable company actions, 0–25) + Capital (funding signals, 0–25) + Momentum (sector tailwinds, 0–25) + Sources (independent corroboration, 0–25). 45-day decay window. Not an investment recommendation. <span className="font-semibold text-[#64748b]">Thesis Fit</span> is a separate, user-configured filter.
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 18px', borderRadius: 10,
          background: '#0f172a', color: '#fff',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          fontSize: 12, fontWeight: 500, zIndex: 20,
        }}>
          <span>{selected.size} selected</span>
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
          {['Mark viewed', 'Assign to me', 'Export', 'Archive'].map((a) => (
            <button key={a} style={{
              padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent', color: '#fff', fontSize: 10.5, fontWeight: 500,
              cursor: 'pointer',
            }}>{a}</button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 15, padding: '0 3px' }}
          >&times;</button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onReset }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-bento border border-[#f1f5f9] p-12 text-center mt-4"
    >
      <p className="text-slate-400">No opportunities match the current filters.</p>
      <button onClick={onReset} className="mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        Reset filters
      </button>
    </motion.div>
  );
}
