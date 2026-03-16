import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, MessageCircle, Archive, Sparkles, ExternalLink, MoreHorizontal } from 'lucide-react';
import ScoreBadge from './ScoreBadge';
import SignalTag from './SignalTag';
import { COUNTRY_NAMES, entityUrl } from '../hooks/useData';

const STATUS_ACTIONS = [
  { key: 'new',       Icon: Sparkles,       label: 'New' },
  { key: 'viewed',    Icon: Eye,            label: 'Viewed' },
  { key: 'contacted', Icon: MessageCircle,  label: 'Contacted' },
  { key: 'archived',  Icon: Archive,        label: 'Archived' },
];

const ENTITY_TYPE_STYLES = {
  company:  'bg-blue-50 text-blue-600 border-blue-200',
  investor: 'bg-violet-50 text-violet-600 border-violet-200',
  person:   'bg-emerald-50 text-emerald-600 border-emerald-200',
};

const cardVariants = {
  initial: { opacity: 0, y: 24 },
  animate: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
      delay: i * 0.06,
    },
  }),
  exit: {
    opacity: 0,
    y: -16,
    scale: 0.97,
    transition: { duration: 0.25, ease: 'easeIn' },
  },
};

export default function OpportunityCard({ opportunity, onStatusChange, index = 0 }) {
  const { entity, entity_type, oppSignals, contacts, status, ai_rationale, opportunity_score } = opportunity;
  const name = entity?.name || 'Unknown';
  const url = entityUrl(entity_type, entity);
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.div
      layout
      layoutId={opportunity.id}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      custom={index}
      whileHover={{
        borderColor: '#e2e8f0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
      className={`
        bg-white rounded-bento p-5 cursor-default border border-[#f1f5f9]
        transition-shadow duration-200
        ${status === 'archived' ? 'opacity-40' : ''}
      `}
    >
      {/* Row 1: Name + Score on same line */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0f172a] font-semibold text-lg hover:text-blue-600 transition-colors truncate flex items-center gap-1.5"
            >
              {name}
              <ExternalLink size={13} className="text-slate-300 flex-shrink-0" />
            </a>
          ) : (
            <span className="text-[#0f172a] font-semibold text-lg truncate">{name}</span>
          )}
          <span className={`
            text-[0.6rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex-shrink-0
            ${ENTITY_TYPE_STYLES[entity_type] || 'bg-slate-50 text-slate-500'}
          `}>
            {entity_type}
          </span>
        </div>

        <ScoreBadge score={opportunity_score} />
      </div>

      {/* Row 2: Entity meta */}
      <EntityMeta entity={entity} entityType={entity_type} />

      {/* Row 3: Signal tags */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {oppSignals.map((s, i) => (
          <SignalTag key={i} signalType={s.signal_type} tier={s.signal_tier} />
        ))}
      </div>

      {/* Row 4: AI Rationale */}
      {ai_rationale && (
        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
          {ai_rationale}
        </p>
      )}

      {/* Row 5: Contacts + action toggle */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <div className="flex flex-wrap gap-1.5">
          {contacts.length > 0 ? (
            contacts.map((p, i) => (
              <a
                key={i}
                href={p.linkedin_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-500 hover:text-blue-600 bg-slate-50 px-2 py-1 rounded-md transition-colors"
              >
                {p.name}
                {p.role && <span className="text-slate-300 ml-1">{p.role}</span>}
              </a>
            ))
          ) : (
            <span className="text-xs text-slate-300">No contacts yet</span>
          )}
        </div>

        {/* Action bar: icon-only, reveals on toggle */}
        <div className="flex items-center gap-0.5">
          {showActions ? (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-0.5"
            >
              {STATUS_ACTIONS.map(({ key, Icon, label }) => (
                <button
                  key={key}
                  onClick={() => { onStatusChange(opportunity.id, key); setShowActions(false); }}
                  title={label}
                  className={`
                    p-1.5 rounded-lg transition-all duration-150
                    ${status === key
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'
                    }
                  `}
                >
                  <Icon size={14} />
                </button>
              ))}
            </motion.div>
          ) : (
            <StatusIndicator status={status} />
          )}
          <button
            onClick={() => setShowActions(v => !v)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-all ml-0.5"
            title={showActions ? 'Close' : 'Change status'}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function StatusIndicator({ status }) {
  if (status === 'new') return null;

  const action = STATUS_ACTIONS.find(a => a.key === status);
  if (!action) return null;
  const { Icon, label } = action;

  return (
    <span className="flex items-center gap-1 text-[0.65rem] text-slate-400 px-1.5 py-1 capitalize">
      <Icon size={11} />
      {label}
    </span>
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
          <span key={i} className="text-xs text-slate-400">
            {i > 0 && <span className="mr-2 text-slate-200">&middot;</span>}
            {p}
          </span>
        ))}
      </div>
    );
  }

  if (entityType === 'investor') {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className="text-xs text-slate-400">{entity.type}</span>
        {entity.aum_estimate && (
          <span className="text-xs text-slate-400">
            <span className="text-slate-200 mr-2">&middot;</span>AUM: {entity.aum_estimate}
          </span>
        )}
      </div>
    );
  }

  if (entityType === 'person') {
    return (
      <div className="flex items-center gap-2 mt-1">
        {entity.role && <span className="text-xs text-slate-400">{entity.role}</span>}
        {entity.relevance_tag && (
          <span className="text-xs text-slate-400">
            <span className="text-slate-200 mr-2">&middot;</span>{entity.relevance_tag}
          </span>
        )}
      </div>
    );
  }

  return null;
}
