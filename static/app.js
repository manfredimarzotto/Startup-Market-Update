/* Nordic Signal Intelligence — Dashboard Client */
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
    PL: 'Poland', IL: 'Israel', CA: 'Canada'
  };

  const GEO_MAP = {
    Nordics: ['SE', 'DK', 'FI', 'NO'],
    DACH: ['DE', 'AT', 'CH'],
    UK: ['GB'],
    Benelux: ['NL', 'BE'],
    'Southern Europe': ['ES', 'IT', 'PT', 'FR'],
    US: ['US']
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
    const signalTypes = new Set();
    const signalTiers = new Set();

    signals.forEach(s => {
      if (s.geography) geographies.add(s.geography);
      if (s.country) countries.add(s.country);
      if (s.signal_type) signalTypes.add(s.signal_type);
      if (s.signal_tier) signalTiers.add(s.signal_tier);
    });

    return {
      geographies: [...geographies].sort(),
      countries: [...countries].sort(),
      signalTypes: [...signalTypes].sort(),
      signalTiers: [...signalTiers].sort()
    };
  }

  /* ── Build filter sidebar ── */
  function buildFilters() {
    const vals = collectFilterValues();

    // Entity type chips
    const entityContainer = document.getElementById('filter-entity-type');
    ['company', 'investor', 'person'].forEach(t => {
      const chip = document.createElement('label');
      chip.className = 'chip active';
      chip.innerHTML = `<input type="checkbox" value="${t}" checked> ${t}`;
      chip.querySelector('input').addEventListener('change', function () {
        chip.classList.toggle('active', this.checked);
        applyFilters();
      });
      entityContainer.appendChild(chip);
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

    // Signal tier chips
    const tierContainer = document.getElementById('filter-signal-tier');
    vals.signalTiers.forEach(t => {
      const label = t.replace('tier_1_strong', 'Tier 1 — Strong')
                      .replace('tier_2_medium', 'Tier 2 — Medium')
                      .replace('tier_3_weak', 'Tier 3 — Weak');
      const chip = document.createElement('label');
      chip.className = 'chip active';
      chip.innerHTML = `<input type="checkbox" value="${t}" checked> ${label}`;
      chip.querySelector('input').addEventListener('change', function () {
        chip.classList.toggle('active', this.checked);
        applyFilters();
      });
      tierContainer.appendChild(chip);
    });

    // Signal type chips
    const typeContainer = document.getElementById('filter-signal-type');
    vals.signalTypes.forEach(t => {
      const chip = document.createElement('label');
      chip.className = 'chip active';
      chip.innerHTML = `<input type="checkbox" value="${t}" checked> ${formatSignalType(t)}`;
      chip.querySelector('input').addEventListener('change', function () {
        chip.classList.toggle('active', this.checked);
        applyFilters();
      });
      typeContainer.appendChild(chip);
    });

    // Event listeners
    geoSel.addEventListener('change', applyFilters);
    countrySel.addEventListener('change', applyFilters);

    // Recency radios
    document.querySelectorAll('input[name="recency"]').forEach(r => {
      r.addEventListener('change', applyFilters);
    });

    // Reset
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
  }

  /* ── Get current filter state ── */
  function getFilters() {
    const entityChecked = [...document.querySelectorAll('#filter-entity-type input:checked')].map(i => i.value);
    const tierChecked = [...document.querySelectorAll('#filter-signal-tier input:checked')].map(i => i.value);
    const typeChecked = [...document.querySelectorAll('#filter-signal-type input:checked')].map(i => i.value);
    const geo = document.getElementById('filter-geography').value;
    const country = document.getElementById('filter-country').value;
    const recency = document.querySelector('input[name="recency"]:checked')?.value || '45';
    const sort = document.getElementById('sort-select').value;

    return { entityChecked, tierChecked, typeChecked, geo, country, recency: parseInt(recency), sort };
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

    renderResults(results);
    updateSummaryCards(results);
  }

  /* ── Render opportunity cards ── */
  function renderResults(results) {
    const container = document.getElementById('opp-grid');
    const countEl = document.getElementById('results-count');
    const emptyEl = document.getElementById('empty-state');

    countEl.textContent = `${results.length} opportunit${results.length === 1 ? 'y' : 'ies'}`;

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

    const allSignals = new Set();
    results.forEach(o => (o.signal_ids || []).forEach(id => allSignals.add(id)));

    document.getElementById('count-companies').textContent = companyCount;
    document.getElementById('count-investors').textContent = investorCount;
    document.getElementById('count-people').textContent = personCount;
    document.getElementById('count-signals').textContent = allSignals.size;
  }

  /* ── Reset all filters ── */
  function resetFilters() {
    // Re-check all chips
    document.querySelectorAll('.chip input').forEach(i => {
      i.checked = true;
      i.closest('.chip').classList.add('active');
    });
    // Reset dropdowns
    document.getElementById('filter-geography').value = '';
    document.getElementById('filter-country').value = '';
    // Reset recency to 45d
    const radio45 = document.querySelector('input[name="recency"][value="45"]');
    if (radio45) radio45.checked = true;
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

  /* ── Sort control ── */
  function setupSort() {
    const sel = document.getElementById('sort-select');
    if (sel) sel.addEventListener('change', applyFilters);
  }

  /* ── Init ── */
  function init() {
    buildFilters();
    setupGenerateButton();
    setupSidebarToggle();
    setupSort();
    applyFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
