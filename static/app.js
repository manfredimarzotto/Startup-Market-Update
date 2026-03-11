/* Startup Intelligence Radar — Dashboard Client */
(function () {
  'use strict';

  /* ── Data (injected by Jinja2 build) ── */
  const DATA = window.__NSI_DATA || {};
  const opportunities = DATA.opportunities || [];
  const signals = DATA.signals || [];
  const companies = DATA.companies || [];
  const investors = DATA.investors || [];
  const people = DATA.people || [];

  /* ── Lookup maps ── */
  const signalMap = Object.fromEntries(signals.map(s => [s.id, s]));
  const companyMap = Object.fromEntries(companies.map(c => [c.id, c]));
  const investorMap = Object.fromEntries(investors.map(i => [i.id, i]));
  const personMap = Object.fromEntries(people.map(p => [p.id, p]));

  /* ── Status persistence (localStorage) ── */
  const STATUS_KEY = 'nsi_opportunity_status';
  function loadStatuses() {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY)) || {}; } catch { return {}; }
  }
  function saveStatuses(map) {
    localStorage.setItem(STATUS_KEY, JSON.stringify(map));
  }
  let statusMap = loadStatuses();

  function getStatus(oppId) {
    return statusMap[oppId] || 'new';
  }
  function setStatus(oppId, status) {
    statusMap[oppId] = status;
    saveStatuses(statusMap);
  }

  /* ── Helpers ── */
  const COUNTRY_NAMES = {
    SE: 'Sweden', DK: 'Denmark', FI: 'Finland', NO: 'Norway',
    DE: 'Germany', GB: 'United Kingdom', NL: 'Netherlands', FR: 'France',
    US: 'United States', IE: 'Ireland', EE: 'Estonia', CH: 'Switzerland',
    AT: 'Austria', BE: 'Belgium', ES: 'Spain', IT: 'Italy', PT: 'Portugal',
    PL: 'Poland', IL: 'Israel', CA: 'Canada',
    Other: 'Other'
  };

  const GEO_MAP = {
    Nordics: ['SE', 'DK', 'FI', 'NO'],
    DACH: ['DE', 'AT', 'CH'],
    UK: ['GB'],
    Benelux: ['NL', 'BE'],
    'Southern Europe': ['ES', 'IT', 'PT', 'FR'],
    US: ['US']
  };

  const ENTITY_ICONS = {
    company: '\u{1F3E2}',
    investor: '\u{1F4C8}',
    person: '\u{1F464}'
  };

  const SIGNAL_TYPE_GROUPS = {
    funding: ['funding_round', 'new_fund'],
    deals: ['acquisition', 'partnership'],
    growth: ['hiring_wave', 'expansion', 'product_launch'],
    media: ['media_mention']
  };

  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function daysSince(dateStr) {
    if (!dateStr) return 999;
    return Math.floor((new Date() - new Date(dateStr)) / 86400000);
  }

  function formatSignalType(t) {
    return (t || '').replace(/_/g, ' ');
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function scoreClass(s) {
    if (s >= 75) return 'score-high';
    if (s >= 50) return 'score-mid';
    return 'score-low';
  }

  function scoreBarColor(s) {
    if (s >= 75) return 'var(--green)';
    if (s >= 50) return 'var(--amber)';
    return 'var(--text-dim)';
  }

  /* ── Get enriched opportunity data ── */
  function enrichOpp(opp) {
    const entity = opp.entity_type === 'company' ? companyMap[opp.company_id]
      : opp.entity_type === 'investor' ? investorMap[opp.investor_id]
      : personMap[opp.person_id];
    const oppSignals = (opp.signal_ids || []).map(id => signalMap[id]).filter(Boolean);
    const contacts = (opp.contact_ids || []).map(id => personMap[id]).filter(Boolean);
    return { ...opp, entity, oppSignals, contacts, status: getStatus(opp.id) };
  }

  /* ── Collect unique filter values from signals ── */
  function collectFilterValues() {
    const geographies = new Set();
    const countries = new Set();
    const signalTiers = new Set();

    signals.forEach(s => {
      if (s.geography) geographies.add(s.geography);
      if (s.country) countries.add(s.country);
      if (s.signal_tier) signalTiers.add(s.signal_tier);
    });

    return {
      geographies: [...geographies].sort(),
      countries: [...countries].sort(),
      signalTiers: [...signalTiers].sort()
    };
  }

  /* ── Build filter sidebar ── */
  function buildFilters() {
    const vals = collectFilterValues();

    // Entity type checkboxes
    const entityContainer = document.getElementById('filter-entity-type');
    ['company', 'investor', 'person'].forEach(t => {
      const label = document.createElement('label');
      label.className = 'cb-option';
      const ENTITY_LABELS = { company: 'Companies', investor: 'Investors', person: 'People' };
      label.innerHTML = `<input type="checkbox" value="${t}" checked><span class="entity-icon">${ENTITY_ICONS[t]}</span> ${ENTITY_LABELS[t] || capitalize(t)}`;
      label.querySelector('input').addEventListener('change', applyFilters);
      entityContainer.appendChild(label);
    });

    // Geography dropdown
    const geoSel = document.getElementById('filter-geography');
    vals.geographies.forEach(g => {
      const o = document.createElement('option');
      o.value = g; o.textContent = g;
      geoSel.appendChild(o);
    });

    // Country dropdown
    const countrySel = document.getElementById('filter-country');
    vals.countries.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = COUNTRY_NAMES[c] || c;
      countrySel.appendChild(o);
    });

    // Signal tier checkboxes
    const tierContainer = document.getElementById('filter-signal-tier');
    const tierMeta = {
      tier_1_strong: { label: 'Tier 1 \u2014 Strong', cls: 'tier-1' },
      tier_2_medium: { label: 'Tier 2 \u2014 Medium', cls: 'tier-2' },
      tier_3_weak: { label: 'Tier 3 \u2014 Weak', cls: 'tier-3' }
    };
    vals.signalTiers.forEach(t => {
      const meta = tierMeta[t] || { label: t, cls: '' };
      const label = document.createElement('label');
      label.className = 'cb-option';
      label.innerHTML = `<input type="checkbox" value="${t}" checked><span class="tier-indicator ${meta.cls}"></span> ${meta.label}`;
      label.querySelector('input').addEventListener('change', applyFilters);
      tierContainer.appendChild(label);
    });

    // Signal type group checkboxes (static in HTML)
    document.querySelectorAll('#filter-signal-type input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', applyFilters);
    });

    // Recency checkboxes
    document.querySelectorAll('#filter-recency input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', applyFilters);
    });

    // Event listeners
    geoSel.addEventListener('change', applyFilters);
    countrySel.addEventListener('change', applyFilters);

    // Reset
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
  }

  /* ── Get current filter state ── */
  function getFilters() {
    const entityChecked = [...document.querySelectorAll('#filter-entity-type input:checked')].map(i => i.value);
    const tierChecked = [...document.querySelectorAll('#filter-signal-tier input:checked')].map(i => i.value);
    const typeGroupsChecked = [...document.querySelectorAll('#filter-signal-type input:checked')].map(i => i.value);
    const typeChecked = typeGroupsChecked.flatMap(g => SIGNAL_TYPE_GROUPS[g] || []);
    const geo = document.getElementById('filter-geography').value;
    const country = document.getElementById('filter-country').value;
    const sort = document.getElementById('sort-select').value;

    // Recency: collect all checked recency values, use the max
    const recencyChecked = [...document.querySelectorAll('#filter-recency input:checked')].map(i => parseInt(i.value));
    const recency = recencyChecked.length > 0 ? Math.max(...recencyChecked) : 45;

    return { entityChecked, tierChecked, typeChecked, geo, country, recency, sort };
  }

  /* ── Build active filter chips ── */
  function renderActiveFilters(f) {
    const container = document.getElementById('active-filters');
    container.innerHTML = '';
    const chips = [];

    if (f.geo) {
      chips.push({ label: f.geo, clear: () => { document.getElementById('filter-geography').value = ''; applyFilters(); } });
    }
    if (f.country) {
      const name = COUNTRY_NAMES[f.country] || f.country;
      chips.push({ label: name, clear: () => { document.getElementById('filter-country').value = ''; applyFilters(); } });
    }

    chips.forEach(chip => {
      const el = document.createElement('span');
      el.className = 'filter-chip';
      el.innerHTML = `${esc(chip.label)} <span class="chip-remove">&times;</span>`;
      el.querySelector('.chip-remove').addEventListener('click', chip.clear);
      container.appendChild(el);
    });

    if (chips.length > 0) {
      const resetLink = document.createElement('span');
      resetLink.className = 'filter-reset-link';
      resetLink.textContent = 'Reset all';
      resetLink.addEventListener('click', resetFilters);
      container.appendChild(resetLink);
    }
  }

  /* ── Filter + sort opportunities ── */
  function applyFilters() {
    const f = getFilters();
    let results = opportunities.map(enrichOpp);

    // Entity type
    results = results.filter(o => f.entityChecked.includes(o.entity_type));

    // Geography — check if any signal matches
    if (f.geo) {
      const allowedCountries = GEO_MAP[f.geo] || [];
      results = results.filter(o => {
        return o.oppSignals.some(s => s.geography === f.geo || allowedCountries.includes(s.country));
      });
    }

    // Country
    if (f.country) {
      results = results.filter(o => {
        if (o.entity_type === 'company' && o.entity) return o.entity.hq_country === f.country;
        return o.oppSignals.some(s => s.country === f.country);
      });
    }

    // Signal tier
    results = results.filter(o => {
      return o.oppSignals.some(s => f.tierChecked.includes(s.signal_tier));
    });

    // Signal type
    results = results.filter(o => {
      return o.oppSignals.some(s => f.typeChecked.includes(s.signal_type));
    });

    // Recency
    results = results.filter(o => {
      return o.oppSignals.some(s => daysSince(s.published_at) <= f.recency);
    });

    // Sort
    switch (f.sort) {
      case 'score_desc':
        results.sort((a, b) => b.opportunity_score - a.opportunity_score);
        break;
      case 'score_asc':
        results.sort((a, b) => a.opportunity_score - b.opportunity_score);
        break;
      case 'recent':
        results.sort((a, b) => {
          const aMax = Math.max(...a.oppSignals.map(s => new Date(s.published_at).getTime()));
          const bMax = Math.max(...b.oppSignals.map(s => new Date(s.published_at).getTime()));
          return bMax - aMax;
        });
        break;
      default:
        results.sort((a, b) => b.opportunity_score - a.opportunity_score);
    }

    renderActiveFilters(f);
    renderResults(results);
    updateSummaryCards(results);
  }

  /* ── Render opportunity cards ── */
  function renderResults(results) {
    const container = document.getElementById('opp-grid');
    const countEl = document.getElementById('results-count');
    const emptyEl = document.getElementById('empty-state');

    countEl.textContent = `${results.length} RESULT${results.length === 1 ? '' : 'S'}`;

    if (results.length === 0) {
      container.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';

    container.innerHTML = results.map(o => {
      const name = o.entity ? (o.entity.name || 'Unknown') : 'Unknown';
      const sClass = scoreClass(o.opportunity_score);
      const barColor = scoreBarColor(o.opportunity_score);
      const status = o.status;

      // Entity details
      let metaHtml = '';
      if (o.entity_type === 'company' && o.entity) {
        const c = o.entity;
        metaHtml = `
          <span class="opp-detail"><strong>${esc(c.sector)}</strong></span>
          <span class="opp-detail">${esc(c.sub_sector || '')}</span>
          <span class="opp-detail">${esc(COUNTRY_NAMES[c.hq_country] || c.hq_country)}, ${esc(c.hq_city)}</span>
          <span class="opp-detail">${esc(c.stage || '')}</span>
        `;
      } else if (o.entity_type === 'investor' && o.entity) {
        const inv = o.entity;
        metaHtml = `
          <span class="opp-detail"><strong>${esc(inv.type)}</strong></span>
          <span class="opp-detail">AUM: ${esc(inv.aum_estimate || 'N/A')}</span>
          <span class="opp-detail">${esc((inv.focus_geographies || []).join(', '))}</span>
        `;
      } else if (o.entity_type === 'person' && o.entity) {
        const p = o.entity;
        metaHtml = `
          <span class="opp-detail"><strong>${esc(p.role || '')}</strong></span>
          <span class="opp-detail">${esc(p.relevance_tag || '')}</span>
        `;
      }

      // Signal badges
      const badgesHtml = o.oppSignals.map(s => {
        const tierClass = s.signal_tier || '';
        return `<span class="signal-badge ${esc(s.signal_type)}"><span class="tier-dot ${esc(tierClass)}"></span>${esc(formatSignalType(s.signal_type))}</span>`;
      }).join('');

      // Contacts
      const contactsHtml = o.contacts.map(p => {
        return `<a class="contact-chip" href="${esc(p.linkedin_url)}" target="_blank" rel="noopener">
          ${esc(p.name)} <span class="contact-role">${esc(p.role)}</span>
        </a>`;
      }).join('');

      // Status buttons
      const statuses = ['new', 'viewed', 'contacted', 'archived'];
      const statusHtml = statuses.map(s => {
        return `<button class="status-btn ${status === s ? 'active-status' : ''}" data-opp="${esc(o.id)}" data-status="${s}">${s}</button>`;
      }).join('');

      return `
        <div class="opp-card status-${esc(status)}" data-opp-id="${esc(o.id)}">
          <div class="opp-top">
            <div class="opp-name-block">
              <span class="opp-name">${esc(name)}</span>
              <span class="opp-entity-badge ${esc(o.entity_type)}">${esc(o.entity_type)}</span>
            </div>
            <div class="opp-score">
              <div class="score-bar"><div class="score-bar-fill" style="width:${o.opportunity_score}%;background:${barColor}"></div></div>
              <span class="score-number ${sClass}">${o.opportunity_score}</span>
            </div>
          </div>
          <div class="opp-meta">${metaHtml}</div>
          <div class="opp-badges">${badgesHtml}</div>
          <div class="opp-rationale">${esc(o.ai_rationale)}</div>
          <div class="opp-bottom">
            <div class="opp-contacts">${contactsHtml || '<span class="opp-detail">No contacts yet</span>'}</div>
            <div class="status-toggle">${statusHtml}</div>
          </div>
        </div>
      `;
    }).join('');

    // Bind status buttons
    container.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const oppId = this.dataset.opp;
        const newStatus = this.dataset.status;
        setStatus(oppId, newStatus);
        applyFilters();
      });
    });
  }

  /* ── Update summary cards ── */
  function updateSummaryCards(results) {
    const companyCount = results.filter(o => o.entity_type === 'company').length;
    const investorCount = results.filter(o => o.entity_type === 'investor').length;
    const personCount = results.filter(o => o.entity_type === 'person').length;

    document.getElementById('count-companies').textContent = companyCount;
    document.getElementById('count-investors').textContent = investorCount;
    document.getElementById('count-people').textContent = personCount;
  }

  /* ── Reset all filters ── */
  function resetFilters() {
    // Re-check all checkboxes
    document.querySelectorAll('.checkbox-list input[type="checkbox"], #filter-recency input[type="checkbox"]').forEach(i => {
      i.checked = true;
    });
    // Reset dropdowns
    document.getElementById('filter-geography').value = '';
    document.getElementById('filter-country').value = '';
    // Reset sort
    document.getElementById('sort-select').value = 'score_desc';

    applyFilters();
  }

  /* ── Generate button → triggers GitHub Actions workflow_dispatch ── */
  const GITHUB_REPO = 'manfredimarzotto/Startup-Market-Update';
  const WORKFLOW_FILE = 'pipeline.yml';
  const ACTIONS_URL = `https://github.com/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}`;

  function setupGenerateButton() {
    const btn = document.getElementById('generate-btn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      btn.classList.add('loading');
      btn.disabled = true;

      // Open GitHub Actions dispatch page (secure — no token exposure)
      window.open(ACTIONS_URL, '_blank', 'noopener');

      // Reset button after short delay
      setTimeout(function () {
        btn.classList.remove('loading');
        btn.disabled = false;
      }, 2000);
    });
  }

  /* ── Mobile sidebar toggle ── */
  function setupSidebarToggle() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      toggle.textContent = sidebar.classList.contains('open') ? 'Close Filters' : 'Filters';
    });
  }

  /* ── Init ── */
  function init() {
    buildFilters();
    setupGenerateButton();
    setupSidebarToggle();
    applyFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
