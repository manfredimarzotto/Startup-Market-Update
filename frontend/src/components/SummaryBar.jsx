const CARDS = [
  { key: 'company', label: 'COMPANIES', icon: '\u{1F3E2}', gradient: 'from-blue-500/10 to-cyan-500/10', border: 'border-blue-500/20' },
  { key: 'investor', label: 'INVESTORS', icon: '\u{1F4C8}', gradient: 'from-violet-500/10 to-purple-500/10', border: 'border-violet-500/20' },
  { key: 'person', label: 'PEOPLE', icon: '\u{1F464}', gradient: 'from-emerald-500/10 to-teal-500/10', border: 'border-emerald-500/20' },
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
          className={`glass rounded-bento p-4 flex items-center gap-4 bg-gradient-to-br ${card.gradient} border ${card.border}`}
        >
          <span className="text-2xl">{card.icon}</span>
          <div>
            <div className="text-2xl font-bold text-white font-mono">{counts[card.key]}</div>
            <div className="text-[0.65rem] text-white/40 font-semibold tracking-widest">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
