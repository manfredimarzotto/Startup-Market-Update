import { useState, useMemo, useCallback } from 'react';
import { daysSince, enrichOpportunity, SIGNAL_TYPE_GROUPS, GEO_MAP } from './useData';

const DEFAULT_FILTERS = {
  entityTypes: ['company', 'investor', 'person'],
  tiers: ['tier_1_strong', 'tier_2_medium', 'tier_3_weak'],
  typeGroups: ['funding', 'deals', 'growth', 'media'],
  geography: '',
  country: '',
  recencyDays: [14, 30, 45],
  sort: 'score_desc',
};

export function useFilters(opportunities, lookups, getStatus) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const toggleArrayFilter = useCallback((key, value) => {
    setFilters(prev => {
      const arr = prev[key];
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
  }, []);

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const filteredOpportunities = useMemo(() => {
    const typeChecked = filters.typeGroups.flatMap(g => SIGNAL_TYPE_GROUPS[g] || []);
    const maxRecency = filters.recencyDays.length > 0 ? Math.max(...filters.recencyDays) : 45;

    let results = opportunities.map(opp => enrichOpportunity(opp, lookups, getStatus));

    // Entity type
    results = results.filter(o => filters.entityTypes.includes(o.entity_type));

    // Geography
    if (filters.geography) {
      const allowedCountries = GEO_MAP[filters.geography] || [];
      results = results.filter(o =>
        o.oppSignals.some(s => s.geography === filters.geography || allowedCountries.includes(s.country))
      );
    }

    // Country
    if (filters.country) {
      results = results.filter(o => {
        if (o.entity_type === 'company' && o.entity) return o.entity.hq_country === filters.country;
        return o.oppSignals.some(s => s.country === filters.country);
      });
    }

    // Signal tier
    results = results.filter(o =>
      o.oppSignals.some(s => filters.tiers.includes(s.signal_tier))
    );

    // Signal type
    results = results.filter(o =>
      o.oppSignals.some(s => typeChecked.includes(s.signal_type))
    );

    // Recency
    results = results.filter(o =>
      o.oppSignals.some(s => daysSince(s.published_at) <= maxRecency)
    );

    // Sort
    switch (filters.sort) {
      case 'score_asc':
        results.sort((a, b) => a.opportunity_score - b.opportunity_score);
        break;
      case 'recent':
        results.sort((a, b) => {
          const aMax = a.oppSignals.length > 0 ? Math.max(...a.oppSignals.map(s => new Date(s.published_at).getTime())) : 0;
          const bMax = b.oppSignals.length > 0 ? Math.max(...b.oppSignals.map(s => new Date(s.published_at).getTime())) : 0;
          return bMax - aMax;
        });
        break;
      default:
        results.sort((a, b) => b.opportunity_score - a.opportunity_score);
    }

    return results;
  }, [opportunities, lookups, getStatus, filters]);

  // Collect available filter values from signals
  const filterOptions = useMemo(() => {
    const geographies = new Set();
    const countries = new Set();
    // Use lookups to get all signals
    const allSignals = Object.values(lookups.signalMap);
    allSignals.forEach(s => {
      if (s.geography) geographies.add(s.geography);
      if (s.country) countries.add(s.country);
    });
    return {
      geographies: [...geographies].sort(),
      countries: [...countries].sort(),
    };
  }, [lookups.signalMap]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.geography) count++;
    if (filters.country) count++;
    if (filters.entityTypes.length < 3) count++;
    if (filters.tiers.length < 3) count++;
    if (filters.typeGroups.length < 4) count++;
    if (filters.recencyDays.length < 3) count++;
    return count;
  }, [filters]);

  return {
    filters,
    toggleArrayFilter,
    setFilter,
    resetFilters,
    filteredOpportunities,
    filterOptions,
    activeFilterCount,
  };
}
