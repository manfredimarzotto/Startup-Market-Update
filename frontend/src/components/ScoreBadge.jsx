export default function ScoreBadge({ score }) {
  let colorClass, glowClass, barColor;
  if (score >= 80) {
    colorClass = 'text-emerald-400';
    glowClass = 'score-glow-emerald';
    barColor = 'bg-emerald-500';
  } else if (score >= 70) {
    colorClass = 'text-amber-400';
    glowClass = 'score-glow-amber';
    barColor = 'bg-amber-500';
  } else {
    colorClass = 'text-slate-400';
    glowClass = 'score-glow-slate';
    barColor = 'bg-slate-500';
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className={`text-3xl font-extrabold font-mono ${colorClass} ${glowClass}`}>
        {score}
      </span>
      <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
