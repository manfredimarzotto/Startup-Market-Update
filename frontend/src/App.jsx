import { useState, useMemo } from 'react';
import Header from './components/Header';
import SummaryBar from './components/SummaryBar';
import Sidebar from './components/Sidebar';
import OpportunityCard from './components/OpportunityCard';
import { useData } from './hooks/useData';
import { useFilters } from './hooks/useFilters';
import { useStatus } from './hooks/useStatus';

export default function App() {
  const { opportunities, signals, companies, investors, people, loading, error, signalMap, companyMap, investorMap, personMap } = useData();
  const lookups = useMemo(() => ({ signalMap, companyMap, investorMap, personMap }), [signalMap, companyMap, investorMap, personMap]);
  const { getStatus, setStatus } = useStatus();
  const {
    filters, toggleArrayFilter, setFilter, resetFilters,
    filteredOpportunities, filterOptions, activeFilterCount,
  } = useFilters(opportunities, lookups, getStatus);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-white/40 text-sm">Loading intelligence data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-bento p-8 max-w-md text-center">
          <p className="text-red-400 font-medium">Failed to load data</p>
          <p className="text-white/40 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Header />
      <SummaryBar opportunities={filteredOpportunities} />

      <div className="flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          filters={filters}
          toggleArrayFilter={toggleArrayFilter}
          setFilter={setFilter}
          resetFilters={resetFilters}
          filterOptions={filterOptions}
          activeFilterCount={activeFilterCount}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 pb-8">
          {/* Content header */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-bold text-white/50 tracking-widest">TOP OPPORTUNITIES</h2>
              <span className="text-white/15">&middot;</span>
              <span className="text-xs text-white/30 font-mono">
                {filteredOpportunities.length} RESULT{filteredOpportunities.length !== 1 ? 'S' : ''}
              </span>
            </div>
            <span className="text-xs text-white/20 font-mono">{today}</span>
          </div>

          {/* Active filter chips */}
          <ActiveFilters filters={filters} setFilter={setFilter} resetFilters={resetFilters} />

          {/* Cards feed */}
          {filteredOpportunities.length > 0 ? (
            <div className="space-y-4">
              {filteredOpportunities.map(opp => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onStatusChange={setStatus}
                />
              ))}
            </div>
          ) : (
            <div className="glass rounded-bento p-12 text-center mt-4">
              <p className="text-white/30">No opportunities match the current filters.</p>
              <button
                onClick={resetFilters}
                className="mt-3 text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Reset filters
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ActiveFilters({ filters, setFilter, resetFilters }) {
  const chips = [];
  if (filters.geography) {
    chips.push({ label: filters.geography, clear: () => setFilter('geography', '') });
  }
  if (filters.country) {
    chips.push({ label: filters.country, clear: () => setFilter('country', '') });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {chips.map((chip, i) => (
        <span key={i} className="glass inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-white/60">
          {chip.label}
          <button onClick={chip.clear} className="text-white/30 hover:text-white/60 transition-colors ml-1">&times;</button>
        </span>
      ))}
      <button
        onClick={resetFilters}
        className="text-xs text-violet-400 hover:text-violet-300 transition-colors ml-1"
      >
        Reset all
      </button>
    </div>
  );
}
