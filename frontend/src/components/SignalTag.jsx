import {
  DollarSign, Users, Handshake, Rocket, TrendingUp, Newspaper, Landmark, MapPin,
} from 'lucide-react';

const TAG_CONFIG = {
  funding_round:  { label: 'FUNDING',     color: '#3b82f6', Icon: DollarSign },
  new_fund:       { label: 'NEW FUND',    color: '#6366f1', Icon: Landmark },
  acquisition:    { label: 'ACQUISITION', color: '#f43f5e', Icon: TrendingUp },
  partnership:    { label: 'PARTNERSHIP',  color: '#06b6d4', Icon: Handshake },
  hiring_wave:    { label: 'HIRING',      color: '#a855f7', Icon: Users },
  expansion:      { label: 'EXPANSION',   color: '#f59e0b', Icon: MapPin },
  product_launch: { label: 'LAUNCH',      color: '#10b981', Icon: Rocket },
  media_mention:  { label: 'MEDIA',       color: '#64748b', Icon: Newspaper },
};

export default function SignalTag({ signalType, tier }) {
  const config = TAG_CONFIG[signalType] || TAG_CONFIG.media_mention;
  const { label, color, Icon } = config;

  const tierCls =
    tier === 'tier_1_strong' ? 'tier-1' :
    tier === 'tier_2_medium' ? 'tier-2' : 'tier-3';

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md text-[0.6rem] font-bold tracking-wider uppercase"
      style={{
        color,
        backgroundColor: `${color}15`,
        border: `1px solid ${color}25`,
        boxShadow: `0 0 8px ${color}15`,
      }}
    >
      <span className={`tier-dot ${tierCls}`} />
      <Icon size={10} strokeWidth={2.5} />
      {label}
    </span>
  );
}
