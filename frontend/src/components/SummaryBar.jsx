const CompanyIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M9 22V12h6v10" />
    <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" />
  </svg>
);

const InvestorIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const PeopleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CARDS = [
  { key: 'company', label: 'COMPANIES', Icon: CompanyIcon, bg: 'bg-blue-50', border: 'border-blue-100', iconColor: 'text-blue-500' },
  { key: 'investor', label: 'INVESTORS', Icon: InvestorIcon, bg: 'bg-violet-50', border: 'border-violet-100', iconColor: 'text-violet-500' },
  { key: 'person', label: 'PEOPLE', Icon: PeopleIcon, bg: 'bg-emerald-50', border: 'border-emerald-100', iconColor: 'text-emerald-500' },
];

export default function SummaryBar({ opportunities }) {
  const counts = {};
  CARDS.forEach(c => { counts[c.key] = 0; });
  opportunities.forEach(o => {
    if (counts[o.entity_type] !== undefined) counts[o.entity_type]++;
  });

  return (
    <div className="grid grid-cols-3 gap-4 px-6 py-4">
      {CARDS.map(card => (
        <div
          key={card.key}
          className={`rounded-bento p-4 flex items-center gap-4 ${card.bg} border ${card.border}`}
        >
          <div className={`${card.iconColor} p-2 rounded-lg bg-white`}>
            <card.Icon />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#0f172a] font-mono">{counts[card.key]}</div>
            <div className="text-[0.65rem] text-slate-400 font-semibold tracking-widest">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
