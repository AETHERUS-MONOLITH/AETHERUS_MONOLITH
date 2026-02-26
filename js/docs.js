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

  function escapeText(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
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
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-expanded', 'false');

    const statusClass = isDelta ? 'doc-card-status' : 'doc-card-status inactive';

    card.innerHTML = `
      <div class="doc-card-layer">${escapeText(doc.layer)}</div>
      <div class="doc-card-name">${escapeText(doc.title)}</div>
      <div class="doc-card-desc">${escapeText(doc.description)}</div>
      <div class="doc-card-meta">
        <span class="doc-card-format">${escapeText(doc.format)}</span>
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
          panel.innerHTML = renderMarkdown(doc.body);
          panel.classList.add('open');
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

      docs.forEach(doc => {
        const target = SECTIONS[doc.section];
        if (!target) return;
        target.appendChild(renderCard(doc));
      });

      if (window.AetherusReveal) {
        window.AetherusReveal.observeNew();
      }

    } catch (err) {
      console.warn('[AETHERUS] docs.json load failed:', err);
    }
  }

  window.AetherusDocs = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
