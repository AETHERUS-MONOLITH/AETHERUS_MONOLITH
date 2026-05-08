/**
 * docs.js — Documentation Card Registry + Renderer
 * AETHERUS MONOLITH
 * Renders Glass Monolith Cards from data/docs.json
 */
(function() {
  const SECTIONS = {
    governance: document.getElementById('docs-governance'),
    pipeline:   document.getElementById('docs-pipeline'),
    artifacts:  document.getElementById('docs-artifacts')
  };

  const PANELS = {
    governance: document.getElementById('detail-governance'),
    pipeline:   document.getElementById('detail-pipeline'),
    artifacts:  document.getElementById('detail-artifacts')
  };

  let registry = [];

  function escapeText(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function renderMetaRow(label, value) {
    if (!value) return '';
    return `
      <div class="evidence-row">
        <dt>${escapeText(label)}</dt>
        <dd>${escapeText(value)}</dd>
      </div>
    `;
  }

  function renderEvidencePanel(doc) {
    const rows = [
      ['Status', doc.status],
      ['Category', doc.category],
      ['Claim supported', doc.claim_supported],
      ['Evidence type', doc.evidence_type],
      ['Boundary', doc.boundary],
      ['Pipeline relation', doc.related_pipeline_stage],
      ['Audience', doc.audience]
    ].map(([label, value]) => renderMetaRow(label, value)).join('');

    if (!rows) return '';

    return `
      <section class="evidence-panel" aria-label="Evidence metadata">
        <div class="evidence-panel-kicker">Evidence Model</div>
        <dl class="evidence-grid">${rows}</dl>
      </section>
    `;
  }

  function getStageKeys(doc) {
    return Array.isArray(doc.pipeline_stage_keys) ? doc.pipeline_stage_keys : [];
  }

  function findByStageKey(stageKey, fallbackIds = []) {
    const matched = registry.filter(doc => getStageKeys(doc).includes(stageKey));
    const byId = fallbackIds
      .map(id => registry.find(doc => doc.id === id))
      .filter(Boolean);
    const merged = [...matched, ...byId];
    return merged.filter((doc, index) => merged.findIndex(d => d.id === doc.id) === index);
  }

  function highlightEvidence(docIds) {
    const ids = new Set(docIds);
    document.querySelectorAll('.doc-card').forEach(card => {
      const isMatch = ids.has(card.getAttribute('data-doc-id'));
      card.classList.toggle('evidence-match', isMatch);
    });
  }

  function renderRelatedEvidence(docs, label) {
    const panel = document.getElementById('pipeline-related-evidence');
    const list = document.getElementById('related-evidence-list');
    if (!panel || !list) return;

    const panelTitle = panel.querySelector('.related-evidence-copy strong');
    const panelText = panel.querySelector('.related-evidence-copy p');
    if (panelTitle) panelTitle.textContent = label ? `Related evidence: ${label}` : 'Pipeline-to-evidence binding';
    if (panelText) {
      panelText.textContent = docs.length
        ? 'These artefacts support the selected part of the governance model. The binding is explanatory metadata, not live execution.'
        : label
          ? 'No artefact is currently mapped to this part of the static governance model. This is an evidence-boundary gap, not a runtime failure.'
          : 'Select a control stage or HUD node to see which research artefacts support that part of the governance model.';
    }

    if (!docs.length) {
      list.innerHTML = '<li>No related artefact metadata is currently available for this selection.</li>';
      return;
    }

    list.innerHTML = docs.map(doc => `
      <li>
        <span>${escapeText(doc.status || 'Evidence')}</span>
        <strong>${escapeText(doc.title)}</strong>
        <small>${escapeText(doc.related_pipeline_stage || 'Pipeline relation pending')}</small>
      </li>
    `).join('');
  }

  function showRelatedByStage(stageKey, label, fallbackIds = []) {
    const docs = findByStageKey(stageKey, fallbackIds);
    highlightEvidence(docs.map(doc => doc.id));
    renderRelatedEvidence(docs, label || stageKey);
    return docs;
  }

  // ── Minimal Markdown → HTML (no libraries) ──────────────────
  function renderMarkdown(md) {
    const lines = md.split('\n');
    let html = '';
    let inUl    = false;
    let inOl    = false;
    let inTable = false;

    function flushUl()    { if (inUl)    { html += '</ul>';              inUl    = false; } }
    function flushOl()    { if (inOl)    { html += '</ol>';              inOl    = false; } }
    function flushTable() { if (inTable) { html += '</tbody></table>';   inTable = false; } }
    function flush()      { flushUl(); flushOl(); flushTable(); }

    // HTML-escape then apply inline markdown
    function inline(t) {
      return t
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g,     '<code>$1</code>');
    }

    const isSepLine = (s) => /^\|[\s\-:|]+\|/.test(s);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/^Object status:/.test(line)) {
        flush();
        continue;
      }

      if (/^### /.test(line)) {
        flush();
        html += `<h3>${inline(line.slice(4))}</h3>`;

      } else if (/^## /.test(line)) {
        flush();
        html += `<h2>${inline(line.slice(3))}</h2>`;

      } else if (/^# /.test(line)) {
        flush();
        html += `<h1>${inline(line.slice(2))}</h1>`;

      } else if (/^\|/.test(line)) {
        if (isSepLine(line)) {
          // Separator consumed by the header-row look-ahead below; skip orphans
        } else {
          const cells = line.split('|').slice(1, -1).map(c => c.trim());
          const next  = lines[i + 1] || '';
          if (!inTable && isSepLine(next)) {
            // Header row: open table, consume separator
            flushUl(); flushOl();
            html += '<table><thead><tr>';
            cells.forEach(c => { html += `<th>${inline(c)}</th>`; });
            html += '</tr></thead><tbody>';
            inTable = true;
            i++; // skip separator line
          } else if (inTable) {
            html += '<tr>';
            cells.forEach(c => { html += `<td>${inline(c)}</td>`; });
            html += '</tr>';
          } else {
            flush();
            html += `<p>${inline(line)}</p>`;
          }
        }

      } else if (/^- /.test(line)) {
        flushOl(); flushTable();
        if (!inUl) { html += '<ul>'; inUl = true; }
        html += `<li>${inline(line.slice(2))}</li>`;

      } else if (/^\d+\) /.test(line)) {
        flushUl(); flushTable();
        if (!inOl) { html += '<ol>'; inOl = true; }
        html += `<li>${inline(line.replace(/^\d+\) /, ''))}</li>`;

      } else if (line.trim() === '') {
        flush();

      } else {
        flush();
        html += `<p>${inline(line)}</p>`;
      }
    }

    flush();
    return html;
  }

  // ── Card renderer ────────────────────────────────────────────
  function renderCard(doc) {
    const card = document.createElement('div');
    const isDelta = doc.isDeltaBrief === true;

    let classes = 'doc-card reveal';
    if (doc.card_variant) classes += ' ' + doc.card_variant;
    card.className = classes;
    card.setAttribute('data-doc-id', doc.id);
    card.setAttribute('data-stage-keys', getStageKeys(doc).join(' '));
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-expanded', 'false');
    card.setAttribute('aria-controls', `detail-${doc.section}`);
    card.setAttribute('aria-label', `${doc.title}. ${doc.status || 'Evidence item'}. ${doc.cta_label || 'Inspect evidence'}.`);

    const statusClass = isDelta ? 'doc-card-status' : 'doc-card-status inactive';
    const cardStatus = doc.status ? `<span>${escapeText(doc.status)}</span>` : '';
    const evidenceType = doc.evidence_type ? `<span>${escapeText(doc.evidence_type)}</span>` : '';
    const stage = doc.related_pipeline_stage
      ? `<div><span>Stage</span>${escapeText(doc.related_pipeline_stage)}</div>`
      : '';
    const boundary = doc.boundary
      ? `<div><span>Boundary</span>${escapeText(doc.boundary)}</div>`
      : '';
    const linkage = (stage || boundary)
      ? `<div class="doc-card-linkage">${stage}${boundary}</div>`
      : '';
    const claim = doc.claim_supported
      ? `<div class="doc-card-claim"><span>Supports</span>${escapeText(doc.claim_supported)}</div>`
      : '';
    const cta = doc.cta_label ? escapeText(doc.cta_label) : 'Inspect evidence';

    card.innerHTML = `
      <div class="doc-card-layer">${escapeText(doc.layer)}</div>
      <div class="doc-card-name">${escapeText(doc.title)}</div>
      <div class="doc-card-desc">${escapeText(doc.description)}</div>
      <div class="doc-card-evidence">
        ${cardStatus}
        ${evidenceType}
      </div>
      ${linkage}
      ${claim}
      <div class="doc-card-meta">
        <span class="doc-card-format">${escapeText(doc.format)}</span>
        <span class="doc-card-cta">${cta}</span>
        <div class="${statusClass}"></div>
      </div>
    `;

    function toggleExpand(e) {
      e.stopPropagation();
      const panel    = PANELS[doc.section];
      const isActive = card.classList.contains('active');

      // Collapse everything across all sections
      document.querySelectorAll('.doc-detail-panel').forEach(p => p.classList.remove('open'));
      document.querySelectorAll('.doc-card').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-expanded', 'false');
        const dot = c.querySelector('.doc-card-status');
        if (dot && !c.classList.contains('delta-brief')) dot.classList.add('inactive');
      });

      if (!isActive) {
        // Activate card
        card.classList.add('active');
        card.setAttribute('aria-expanded', 'true');
        const dot = card.querySelector('.doc-card-status');
        if (dot) dot.classList.remove('inactive');

        // Populate and open the section detail panel
        if (panel) {
          panel.innerHTML = renderEvidencePanel(doc) + renderMarkdown(doc.body);
          panel.classList.add('open');
          if (e.type === 'keydown') {
            panel.focus({ preventScroll: true });
          }
        }
      }
    }

    card.addEventListener('click', toggleExpand);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleExpand(e);
      }
    });

    return card;
  }

  // ── Architecture tree ────────────────────────────────────────
  function renderArchitectureTree() {
    const treeContainer = document.getElementById('doc-tree');
    if (!treeContainer) return;

    const tree = `SYSTEM_DOCUMENTATION/
├── README.md
├── GOVERNANCE/
│   ├── AUTHORITY_MODEL.md
│   ├── VERSION_LIFECYCLE.md
│   └── FREEZE_SEMANTICS.md
├── PIPELINE/
│   ├── PIPELINE_OVERVIEW.md
│   ├── JOINT_SPECIFICATIONS.md
│   ├── GATE_SPECIFICATIONS.md
│   └── ORCHESTRATION_MANUAL.md
├── ARTIFACTS/
│   ├── ARTIFACT_CATALOG.md
│   ├── SCHEMA_DEFINITIONS/ (XSD)
│   └── EXAMPLES/ (XML)
├── PROTOCOLS/
│   ├── PROTOCOL_CATALOG.md
│   ├── SKELETON_POPULATION_v1.0.md
│   ├── SESSION_STATE_GENERATOR_v1.0.md
│   └── UNIVERSAL_PROJECT_BRIEF_v1.4.md
├── TEMPLATES/
│   └── TEMPLATE_INDEX.md
└── CHANGELOG/
    └── v4.x.md`;

    treeContainer.textContent = tree;
  }

  // ── Init ─────────────────────────────────────────────────────
  async function init() {
    renderArchitectureTree();

    try {
      const res  = await fetch('data/docs.json');
      const data = await res.json();
      const docs = data.documents;
      registry = docs;

      docs.forEach(doc => {
        const target = SECTIONS[doc.section];
        if (!target) return;
        target.appendChild(renderCard(doc));
      });

      if (window.AetherusReveal) {
        window.AetherusReveal.observeNew();
      }

      window.AetherusEvidence = {
        docs: registry,
        findByStageKey,
        highlightEvidence,
        renderRelatedEvidence,
        showRelatedByStage
      };

      document.dispatchEvent(new CustomEvent('aetherus:evidence-ready'));

    } catch (err) {
      Object.values(SECTIONS).forEach(target => {
        if (!target) return;
        target.innerHTML = `
          <div class="docs-fallback" role="status">
            Artefact metadata could not be loaded. The governance interface remains static, but the local evidence model is unavailable for this view.
          </div>
        `;
      });

      const panel = document.getElementById('pipeline-related-evidence');
      const list = document.getElementById('related-evidence-list');
      const panelTitle = panel ? panel.querySelector('.related-evidence-copy strong') : null;
      const panelText = panel ? panel.querySelector('.related-evidence-copy p') : null;
      if (panelTitle) panelTitle.textContent = 'Evidence metadata unavailable';
      if (panelText) {
        panelText.textContent = 'The local artefact registry could not be loaded. Pipeline interactions remain explanatory and do not represent live execution.';
      }
      if (list) {
        list.innerHTML = '<li>Unable to load local artefact metadata for this static page.</li>';
      }

      window.AetherusEvidence = {
        docs: [],
        findByStageKey: () => [],
        highlightEvidence: () => {},
        renderRelatedEvidence,
        showRelatedByStage(stageKey, label) {
          renderRelatedEvidence([], label || stageKey);
          return [];
        }
      };

      console.error('[AETHERUS] docs.json load failed:', err);
    }
  }

  window.AetherusDocs = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
