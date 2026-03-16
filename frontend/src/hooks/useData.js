import { useState, useEffect, useMemo } from 'react';

const COUNTRY_NAMES = {
  SE: 'Sweden', DK: 'Denmark', FI: 'Finland', NO: 'Norway',
  DE: 'Germany', GB: 'United Kingdom', NL: 'Netherlands', FR: 'France',
  US: 'United States', IE: 'Ireland', EE: 'Estonia', CH: 'Switzerland',
  AT: 'Austria', BE: 'Belgium', ES: 'Spain', IT: 'Italy', PT: 'Portugal',
  PL: 'Poland', IL: 'Israel', CA: 'Canada', LU: 'Luxembourg',
  LV: 'Latvia', LT: 'Lithuania', CZ: 'Czech Republic', RO: 'Romania',
  HU: 'Hungary', BG: 'Bulgaria', HR: 'Croatia',
  Other: 'Other',
};

const GEO_MAP = {
  Nordics: ['SE', 'DK', 'FI', 'NO'],
  DACH: ['DE', 'AT', 'CH'],
  UK: ['GB'],
  Benelux: ['NL', 'BE', 'LU'],
  'Southern Europe': ['ES', 'IT', 'PT', 'FR'],
  US: ['US'],
};

const SIGNAL_TYPE_GROUPS = {
  funding: ['funding_round', 'new_fund'],
  deals: ['acquisition', 'partnership'],
  growth: ['hiring_wave', 'expansion', 'product_launch'],
  media: ['media_mention'],
};

export { COUNTRY_NAMES, GEO_MAP, SIGNAL_TYPE_GROUPS };

export function useData() {
  const [data, setData] = useState({
    opportunities: [],
    signals: [],
    companies: [],
    investors: [],
    people: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Try window.__NSI_DATA first (Jinja2 embed), then fetch JSON files
    if (window.__NSI_DATA) {
      const d = window.__NSI_DATA;
      setData({
        opportunities: d.opportunities || [],
        signals: d.signals || [],
        companies: d.companies || [],
        investors: d.investors || [],
        people: d.people || [],
        loading: false,
        error: null,
      });
      return;
    }

    // Fetch from JSON files
    Promise.all([
      fetch('./data/opportunities.json').then(r => r.ok ? r.json() : []),
      fetch('./data/signals.json').then(r => r.ok ? r.json() : []),
      fetch('./data/companies.json').then(r => r.ok ? r.json() : []),
      fetch('./data/investors.json').then(r => r.ok ? r.json() : []),
      fetch('./data/people.json').then(r => r.ok ? r.json() : []),
    ])
      .then(([opportunities, signals, companies, investors, people]) => {
        setData({ opportunities, signals, companies, investors, people, loading: false, error: null });
      })
      .catch(err => {
        setData(prev => ({ ...prev, loading: false, error: err.message }));
      });
  }, []);

  const lookups = useMemo(() => ({
    signalMap: Object.fromEntries(data.signals.map(s => [s.id, s])),
    companyMap: Object.fromEntries(data.companies.map(c => [c.id, c])),
    investorMap: Object.fromEntries(data.investors.map(i => [i.id, i])),
    personMap: Object.fromEntries(data.people.map(p => [p.id, p])),
  }), [data.signals, data.companies, data.investors, data.people]);

  return { ...data, ...lookups };
}

export function enrichOpportunity(opp, lookups, getStatus) {
  const { signalMap, companyMap, investorMap, personMap } = lookups;
  const entity =
    opp.entity_type === 'company' ? companyMap[opp.company_id] :
    opp.entity_type === 'investor' ? investorMap[opp.investor_id] :
    personMap[opp.person_id];
  const oppSignals = (opp.signal_ids || []).map(id => signalMap[id]).filter(Boolean);
  const contacts = (opp.contact_ids || []).map(id => personMap[id]).filter(Boolean);
  return { ...opp, entity: entity || null, oppSignals, contacts, status: getStatus(opp.id) };
}

export function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function formatSignalType(t) {
  return (t || '').replace(/_/g, ' ');
}

export function entityUrl(entityType, entity) {
  if (!entity) return '';
  if (entityType === 'company' && entity.domain) return 'https://' + entity.domain;
  if (entityType === 'person' && entity.linkedin_url) return entity.linkedin_url;
  if (entityType === 'investor' && entity.website) return entity.website;
  return '';
}
