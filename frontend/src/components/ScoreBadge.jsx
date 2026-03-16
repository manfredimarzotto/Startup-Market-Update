import { useMemo } from 'react';

const BAR_COUNT = 7;

function getScoreColor(score) {
  if (score >= 75) return { text: 'text-emerald-600', glow: 'score-glow-emerald', bar: '#10b981', barDim: '#10b98130' };
  if (score >= 50) return { text: 'text-amber-600', glow: 'score-glow-amber', bar: '#d97706', barDim: '#d9770630' };
  return { text: 'text-slate-400', glow: 'score-glow-slate', bar: '#94a3b8', barDim: '#94a3b830' };
}

export default function ScoreBadge({ score }) {
  const colors = getScoreColor(score);

  // Generate bar heights: rises toward the active level then drops off
  const bars = useMemo(() => {
    const activeBars = Math.round((score / 100) * BAR_COUNT);
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const isActive = i < activeBars;
      // Taper heights: bars get taller toward the peak
      const baseHeight = isActive
        ? 40 + (i / (BAR_COUNT - 1)) * 60
        : 15 + Math.random() * 10;
      return { height: Math.min(100, baseHeight), active: isActive };
    });
  }, [score]);

  return (
    <div className="flex items-center gap-2.5 flex-shrink-0">
      {/* Level meter */}
      <div className="flex items-end gap-[3px] h-7">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full transition-all duration-500"
            style={{
              height: `${bar.height}%`,
              backgroundColor: bar.active ? colors.bar : colors.barDim,
            }}
          />
        ))}
      </div>
      {/* Score number */}
      <span
        className={`text-2xl font-extrabold font-mono tabular-nums ${colors.text} ${colors.glow}`}
      >
        {score}
      </span>
    </div>
  );
}
