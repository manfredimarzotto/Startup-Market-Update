import ScoreBadge from './ScoreBadge';
import { COUNTRY_NAMES, formatSignalType, entityUrl } from '../hooks/useData';

const STATUS_OPTIONS = ['new', 'viewed', 'contacted', 'archived'];

const SIGNAL_TYPE_COLORS = {
  funding_round:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  new_fund:       'bg-teal-500/15 text-teal-400 border-teal-500/20',
  acquisition:    'bg-rose-500/15 text-rose-400 border-rose-500/20',
  partnership:    'bg-blue-500/15 text-blue-400 border-blue-500/20',
  hiring_wave:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
  expansion:      'bg-violet-500/15 text-violet-400 border-violet-500/20',
  product_launch: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  media_mention:  'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

const ENTITY_TYPE_STYLES = {
  company:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  investor: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  person:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

export default function OpportunityCard({ opportunity, onStatusChange }) {
  const { entity, entity_type, oppSignals, contacts, status, ai_rationale, opportunity_score } = opportunity;
  const name = entity?.name || 'Unknown';
  const url = entityUrl(entity_type, entity);

  return (
    <div className={`
      glass glass-hover rounded-bento p-5 transition-all duration-300
      ${status === 'archived' ? 'opacity-40' : ''}
    `}>
      {/* Top row: name + entity badge + score */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white font-semibold text-lg hover:text-violet-300 transition-colors truncate"
              >
                {name}
                <span className="text-white/30 ml-1 text-sm">&#x2197;</span>
              </a>
            ) : (
              <span className="text-white font-semibold text-lg truncate">{name}</span>
            )}
            <span className={`
              text-[0.6rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border
              ${ENTITY_TYPE_STYLES[entity_type] || 'bg-white/10 text-white/60'}
            `}>
              {entity_type}
            </span>
          </div>

          {/* Entity meta */}
          <EntityMeta entity={entity} entityType={entity_type} />
        </div>

        <ScoreBadge score={opportunity_score} />
      </div>

      {/* Signal pills */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {oppSignals.map((s, i) => {
          const tierCls = s.signal_tier === 'tier_1_strong' ? 'tier-1'
                        : s.signal_tier === 'tier_2_medium' ? 'tier-2' : 'tier-3';
          return (
            <span
              key={i}
              className={`
                signal-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border
                ${SIGNAL_TYPE_COLORS[s.signal_type] || 'bg-white/5 text-white/50 border-white/10'}
              `}
            >
              <span className={`tier-dot ${tierCls}`} />
              {formatSignalType(s.signal_type)}
            </span>
          );
        })}
      </div>

      {/* AI Rationale */}
      {ai_rationale && (
        <p className="mt-3 text-sm text-white/50 leading-relaxed">
          {ai_rationale}
        </p>
      )}

      {/* Bottom: contacts + status */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
        <div className="flex flex-wrap gap-1.5">
          {contacts.length > 0 ? (
            contacts.map((p, i) => (
              <a
                key={i}
                href={p.linkedin_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/40 hover:text-violet-300 bg-white/5 px-2 py-1 rounded-md transition-colors"
              >
                {p.name}
                {p.role && <span className="text-white/20 ml-1">{p.role}</span>}
              </a>
            ))
          ) : (
            <span className="text-xs text-white/20">No contacts yet</span>
          )}
        </div>

        <div className="flex gap-1">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => onStatusChange(opportunity.id, s)}
              className={`
                text-[0.65rem] px-2.5 py-1 rounded-lg transition-all duration-200 capitalize
                ${status === s
                  ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30'
                  : 'text-white/25 hover:text-white/50 hover:bg-white/5 border border-transparent'
                }
              `}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EntityMeta({ entity, entityType }) {
  if (!entity) return null;

  if (entityType === 'company') {
    const parts = [
      entity.sector,
      entity.sub_sector,
      [COUNTRY_NAMES[entity.hq_country] || entity.hq_country, entity.hq_city].filter(Boolean).join(', '),
      entity.stage,
    ].filter(Boolean);

    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
        {parts.map((p, i) => (
          <span key={i} className="text-xs text-white/30">
            {i > 0 && <span className="mr-2 text-white/10">&middot;</span>}
            {p}
          </span>
        ))}
      </div>
    );
  }

  if (entityType === 'investor') {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className="text-xs text-white/30">{entity.type}</span>
        {entity.aum_estimate && (
          <span className="text-xs text-white/30">
            <span className="text-white/10 mr-2">&middot;</span>AUM: {entity.aum_estimate}
          </span>
        )}
      </div>
    );
  }

  if (entityType === 'person') {
    return (
      <div className="flex items-center gap-2 mt-1">
        {entity.role && <span className="text-xs text-white/30">{entity.role}</span>}
        {entity.relevance_tag && (
          <span className="text-xs text-white/30">
            <span className="text-white/10 mr-2">&middot;</span>{entity.relevance_tag}
          </span>
        )}
      </div>
    );
  }

  return null;
}
