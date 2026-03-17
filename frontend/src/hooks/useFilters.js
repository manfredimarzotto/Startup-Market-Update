import { useState, useMemo, useCallback } from 'react';
import { daysSince, enrichOpportunity, SIGNAL_TYPE_GROUPS, GEO_MAP } from './useData';
import { deriveFit } from '../components/shared';

const DEFAULT_FILTERS = {
  entityTypes: ['company', 'investor', 'person'],
  tiers: ['tier_1_strong', 'tier_2_medium', 'tier_3_weak'],
  typeGroups: ['funding', 'deals', 'growth', 'media'],
  geography: '',
  country: '',
  recencyDays: [14, 30, 45],
  sort: 'score_desc',
  fit: 'all',
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

  // Enrich once, then compute percentile ranks before filtering
  const enrichedOpportunities = useMemo(() => {
    const enriched = opportunities.map(opp => enrichOpportunity(opp, lookups, getStatus));
    // Sort by score to compute percentile rank
    const sorted = [...enriched].sort((a, b) => a.opportunity_score - b.opportunity_score);
    const total = sorted.length;
    sorted.forEach((opp, idx) => {
      // Percentile = % of opportunities this one scores above
      opp.percentile = total > 1 ? Math.round(((idx + 1) / total) * 100) : 1;
      opp.fit = deriveFit(opp.opportunity_score);
    });
    return enriched;
  }, [opportunities, lookups, getStatus]);

  const filteredOpportunities = useMemo(() => {
    const typeChecked = filters.typeGroups.flatMap(g => SIGNAL_TYPE_GROUPS[g] || []);
    const maxRecency = filters.recencyDays.length > 0 ? Math.max(...filters.recencyDays) : 45;

    let results = enrichedOpportunities;

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

    // Fit filter
    if (filters.fit !== 'all') {
      results = results.filter(o => o.fit === filters.fit);
    }

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
      case 'funding_recent': {
        const fundingTypes = ['funding_round', 'new_fund'];
        results.sort((a, b) => {
          const aFunding = a.oppSignals.filter(s => fundingTypes.includes(s.signal_type));
          const bFunding = b.oppSignals.filter(s => fundingTypes.includes(s.signal_type));
          const aMax = aFunding.length > 0 ? Math.max(...aFunding.map(s => new Date(s.published_at).getTime())) : 0;
          const bMax = bFunding.length > 0 ? Math.max(...bFunding.map(s => new Date(s.published_at).getTime())) : 0;
          return bMax - aMax;
        });
        break;
      }
      default:
        results.sort((a, b) => b.opportunity_score - a.opportunity_score);
    }

    return results;
  }, [enrichedOpportunities, filters]);

  // Collect available filter values from signals
  const filterOptions = useMemo(() => {
    const geographies = new Set();
    const countries = new Set();
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
    if (filters.fit !== 'all') count++;
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
