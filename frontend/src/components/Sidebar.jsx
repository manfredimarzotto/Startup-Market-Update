import { COUNTRY_NAMES } from '../hooks/useData';

const TIER_META = {
  tier_1_strong: { label: 'Tier 1 — Strong', cls: 'tier-1' },
  tier_2_medium: { label: 'Tier 2 — Medium', cls: 'tier-2' },
  tier_3_weak:   { label: 'Tier 3 — Weak',   cls: 'tier-3' },
};

const ENTITY_LABELS = {
  company:  { icon: '\u{1F3E2}', label: 'Companies' },
  investor: { icon: '\u{1F4C8}', label: 'Investors' },
  person:   { icon: '\u{1F464}', label: 'People' },
};

const TYPE_GROUPS = [
  { key: 'funding', label: 'Funding' },
  { key: 'deals',   label: 'Deals' },
  { key: 'growth',  label: 'Growth' },
  { key: 'media',   label: 'Media' },
];

const RECENCY_OPTIONS = [
  { value: 14, label: '0–14 days', cls: 'bg-red-500 shadow-red-500/50' },
  { value: 30, label: '15–30 days', cls: 'bg-amber-500 shadow-amber-500/50' },
  { value: 45, label: '30–45 days', cls: 'bg-slate-500 shadow-slate-500/50' },
];

export default function Sidebar({
  collapsed,
  onToggle,
  filters,
  toggleArrayFilter,
  setFilter,
  resetFilters,
  filterOptions,
  activeFilterCount,
}) {
  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed bottom-4 right-4 z-50 glass-strong px-4 py-2.5 rounded-xl text-white/80 text-sm font-medium shadow-lg"
      >
        {collapsed ? `Filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}` : 'Close'}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          sidebar-enter fixed lg:sticky top-0 left-0 z-40 h-screen
          glass-strong overflow-y-auto
          ${collapsed ? 'w-0 opacity-0 lg:w-64 lg:opacity-100' : 'w-72 opacity-100'}
          flex-shrink-0
        `}
      >
        <div className={`${collapsed ? 'hidden lg:block' : ''} p-5 space-y-5`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/50 tracking-widest">FILTERS</span>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Reset all
              </button>
            )}
          </div>

          {/* Entity Type */}
          <FilterSection label="ENTITY TYPE">
            {['company', 'investor', 'person'].map(t => (
              <CheckboxItem
                key={t}
                checked={filters.entityTypes.includes(t)}
                onChange={() => toggleArrayFilter('entityTypes', t)}
                label={
                  <span className="flex items-center gap-2">
                    <span className="text-sm">{ENTITY_LABELS[t].icon}</span>
                    {ENTITY_LABELS[t].label}
                  </span>
                }
              />
            ))}
          </FilterSection>

          {/* Geography */}
          <FilterSection label="GEOGRAPHY">
            <select
              value={filters.geography}
              onChange={e => setFilter('geography', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/50 transition-colors"
            >
              <option value="">All Geographies</option>
              {filterOptions.geographies.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </FilterSection>

          {/* Country */}
          <FilterSection label="COUNTRY">
            <select
              value={filters.country}
              onChange={e => setFilter('country', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/50 transition-colors"
            >
              <option value="">All Countries</option>
              {filterOptions.countries.map(c => (
                <option key={c} value={c}>{COUNTRY_NAMES[c] || c}</option>
              ))}
            </select>
          </FilterSection>

          {/* Signal Tier */}
          <FilterSection label="SIGNAL TIER">
            {['tier_1_strong', 'tier_2_medium', 'tier_3_weak'].map(t => {
              const meta = TIER_META[t];
              return (
                <CheckboxItem
                  key={t}
                  checked={filters.tiers.includes(t)}
                  onChange={() => toggleArrayFilter('tiers', t)}
                  label={
                    <span className="flex items-center gap-2">
                      <span className={`tier-dot ${meta.cls}`} />
                      {meta.label}
                    </span>
                  }
                />
              );
            })}
          </FilterSection>

          {/* Signal Type */}
          <FilterSection label="SIGNAL TYPE">
            {TYPE_GROUPS.map(g => (
              <CheckboxItem
                key={g.key}
                checked={filters.typeGroups.includes(g.key)}
                onChange={() => toggleArrayFilter('typeGroups', g.key)}
                label={g.label}
              />
            ))}
          </FilterSection>

          {/* Recency */}
          <FilterSection label="RECENCY">
            {RECENCY_OPTIONS.map(opt => (
              <CheckboxItem
                key={opt.value}
                checked={filters.recencyDays.includes(opt.value)}
                onChange={() => toggleArrayFilter('recencyDays', opt.value)}
                label={
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${opt.cls} shadow-sm`} />
                    {opt.label}
                  </span>
                }
              />
            ))}
          </FilterSection>

          {/* Sort */}
          <FilterSection label="SORT BY">
            <select
              value={filters.sort}
              onChange={e => setFilter('sort', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/50 transition-colors"
            >
              <option value="score_desc">Signal Strength</option>
              <option value="score_asc">Score (Low → High)</option>
              <option value="recent">Most Recent</option>
            </select>
          </FilterSection>
        </div>
      </aside>
    </>
  );
}

function FilterSection({ label, children }) {
  return (
    <div className="space-y-2">
      <span className="text-[0.65rem] font-semibold text-white/30 tracking-widest">{label}</span>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

function CheckboxItem({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group py-0.5">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className="w-4 h-4 rounded border border-white/20 bg-white/5 peer-checked:bg-violet-600 peer-checked:border-violet-500 transition-all flex items-center justify-center">
          {checked && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
        {label}
      </span>
    </label>
  );
}
