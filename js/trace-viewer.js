/**
 * trace-viewer.js — Static governance trace renderer
 * Renders the AETHERUS Command Deck from deterministic local scenario fixtures.
 */
(function () {
  const DEFAULT_SCENARIO_ID = 'adapter_failure_escalate';
  const TECHNICAL_TRACE_LABEL = 'Prototype Trace';
  const BOUNDARY_SEGMENTS = [
    'Deterministic prototype trace',
    'Static browser-side evaluation',
    'Local fixture data',
    'Not live AI execution',
    'Not a production audit ledger'
  ];
  const BOUNDARY_COPY = BOUNDARY_SEGMENTS.join(' · ');
  const TABS = [
    { id: 'why-blocked', label: 'WHY BLOCKED' },
    { id: 'required-evidence', label: 'REQUIRED EVIDENCE' },
    { id: 'boundary', label: 'BOUNDARY' },
    { id: 'raw-trace', label: 'RAW TRACE' }
  ];
  const STAGE_LABELS = {
    INPUT_FRAME: '01 Input / Context',
    AUTHORITY_CHECK: '02 Authority',
    RISK_CLASSIFICATION: '03 Risk',
    GATE_DECISION: '04 Gate',
    RECOVERY_PATH: '05 Freeze / Repair',
    AUDIT_RELEASE: '06 Audit / Release',
    WHOLE_SYSTEM: 'Governance Pipeline'
  };
  const REQUIRED_EVIDENCE_ORDER = [
    'Basic ingress payloads',
    'Declared validation logs',
    'Model/API boundary documentation',
    'Persistent trace storage',
    'Adapter implementation',
    'Reproducible parser/normalization test result',
    'Authenticated actor identity',
    'Security review'
  ];
  const BOUNDARY_ROWS = [
    'No live AI execution.',
    'No backend trace service.',
    'No authenticated workflow.',
    'No persistent audit ledger.',
    'No model call.',
    'No operational release decision.',
    'This surface is not a production SaaS dashboard or customer workspace.'
  ];

  let engineRef = null;
  let scenarioOptions = [];
  const state = {
    selectedScenarioId: DEFAULT_SCENARIO_ID,
    activeTab: 'why-blocked'
  };

  function escapeText(value) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(value == null ? '' : String(value)));
    return div.innerHTML;
  }

  function escapeAttr(value) {
    return escapeText(value).replace(/"/g, '&quot;');
  }

  function getMount() {
    return document.getElementById('governance-trace-viewer');
  }

  function titleCase(value) {
    return String(value || '')
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
      .join(' ');
  }

  function displayStage(stageKey) {
    return STAGE_LABELS[stageKey] || stageKey || 'Unavailable';
  }

  function stageShortLabel(stageKey) {
    const label = displayStage(stageKey);
    return label.replace(/^0\d\s+/, '');
  }

  function scenarioAssertion(trace) {
    if (trace.releaseEligibility && trace.releaseEligibility.eligible === false) return 'Does not release';
    if (trace.releaseEligibility && trace.releaseEligibility.eligible === true) return 'Release modeled as eligible';
    return 'No scenario assertion provided';
  }

  function isAdapterFailure(trace) {
    return trace && trace.scenario && trace.scenario.id === DEFAULT_SCENARIO_ID;
  }

  function normalizeVerdict(trace) {
    if (trace.releaseEligibility && trace.releaseEligibility.eligible === false) return 'Blocked';
    const status = trace.verdict && trace.verdict.status ? trace.verdict.status : 'unknown';
    return titleCase(status);
  }

  function outputOrder(trace) {
    return trace.stateChamber && trace.stateChamber.label
      ? trace.stateChamber.label
      : titleCase(trace.verdict && trace.verdict.status ? trace.verdict.status : 'Unavailable');
  }

  function reasonClass(trace) {
    if (isAdapterFailure(trace)) return 'Adapter boundary failure';
    if (trace.decisiveGate && trace.decisiveGate.label) return `${trace.decisiveGate.label} ${normalizeVerdict(trace).toLowerCase()}`;
    return normalizeVerdict(trace) === 'Blocked' ? 'Boundary failure' : 'Fixture verdict';
  }

  function reasonSummary(trace) {
    if (isAdapterFailure(trace)) {
      return 'The modeled release path cannot proceed because adapter-boundary evidence is insufficient.';
    }
    if (trace.releaseEligibility && trace.releaseEligibility.explanation) return trace.releaseEligibility.explanation;
    return trace.verdict && trace.verdict.reason ? trace.verdict.reason : 'No static fixture data available for this field.';
  }

  function failedRuleCount(trace) {
    if (isAdapterFailure(trace)) return 3;
    const gateFailures = Array.isArray(trace.gateResults)
      ? trace.gateResults.filter(result => !/^pass$/i.test(result.status || '')).length
      : 0;
    const receiptFailures = Array.isArray(trace.handoffReceipts)
      ? trace.handoffReceipts.filter(receipt => !/^complete$/i.test(receipt.validation || '')).length
      : 0;
    return Math.max(gateFailures + receiptFailures, normalizeVerdict(trace) === 'Blocked' ? 1 : 0);
  }

  function evidenceLabelFromFixture(item) {
    const text = String(item || '');
    if (/ingress payload|real input\/output artifact|real input/i.test(text)) return 'Basic ingress payloads';
    if (/validation log|backend validation/i.test(text)) return 'Declared validation logs';
    if (/model\/API boundary/i.test(text)) return 'Model/API boundary documentation';
    if (/persistent trace storage/i.test(text)) return 'Persistent trace storage';
    if (/adapter implementation/i.test(text)) return 'Adapter implementation';
    if (/parser|normalization test|test result/i.test(text)) return 'Reproducible parser/normalization test result';
    if (/authenticated actor/i.test(text)) return 'Authenticated actor identity';
    if (/security review/i.test(text)) return 'Security review';
    return text
      .replace(/\s+would be required for operational evidence\./i, '')
      .replace(/\s+would be required if model output is involved\./i, '')
      .replace(/\s+required for operational evidence\./i, '');
  }

  function evidenceItems(trace) {
    const fromFixture = Array.isArray(trace.operationalEvidenceRequired)
      ? trace.operationalEvidenceRequired.map(evidenceLabelFromFixture)
      : [];
    if (isAdapterFailure(trace)) {
      return REQUIRED_EVIDENCE_ORDER.map(label => ({
        label,
        status: 'Missing',
        note: label === 'Model/API boundary documentation'
          ? 'Required if model output is involved; not operationally present in the fixture.'
          : 'Required before operational release eligibility can be asserted.'
      }));
    }

    return fromFixture.map(label => ({
      label: label || 'Unavailable',
      status: 'Missing',
      note: 'Not operationally present in this local static fixture.'
    }));
  }

  function relatedDocs(trace) {
    if (!window.AetherusEvidence || typeof window.AetherusEvidence.findByStageKey !== 'function') return [];
    return window.AetherusEvidence.findByStageKey(trace.activeStageKey);
  }

  function readiness(trace) {
    const required = evidenceItems(trace).length;
    const satisfied = 0;
    const percent = required > 0 ? Math.round((satisfied / required) * 100) : null;
    return {
      required,
      satisfied,
      missing: Math.max(required - satisfied, 0),
      percent,
      conceptualAvailable: relatedDocs(trace).length > 0,
      label: required > 0 ? 'Pending Operational Evidence' : 'Evidence readiness unavailable'
    };
  }

  function sparklinePoints(trace) {
    const events = Array.isArray(trace.traceEvents) ? trace.traceEvents : [];
    if (!events.length) return [];
    const points = events.map((event, index) => {
      const x = events.length === 1 ? 50 : 8 + (index * 84) / (events.length - 1);
      const penalty = /fail|escalate|block|incomplete/i.test(`${event.action_type} ${event.trace_note}`) ? 28 : 8;
      const y = Math.max(18, 70 - (index * 9) - penalty);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    if (points.length === 1) return [`8,62`, points[0], `92,24`];
    return points;
  }

  function renderFailure(mount, message) {
    mount.classList.add('trace-viewer-ready', 'command-deck-ready');
    mount.innerHTML = `
      <div class="command-deck-header">
        <div>
          <span class="command-deck-module">AETHERUS Command Deck</span>
          <strong>AETHERUS &middot; MONOLITH</strong>
        </div>
        <div class="command-deck-context" aria-label="Command Deck context">
          <span>Evidence Surface</span>
          <span>Context: Governance Pipeline</span>
          <span>Mode: Static Evaluation</span>
          <span>Read-only</span>
        </div>
      </div>
      <p class="command-boundary-strip">${escapeText(BOUNDARY_COPY)}</p>
      <div class="command-deck-failure" role="status">
        <strong>Scenario data unavailable.</strong>
        <p>${escapeText(message || 'Static fixture could not be loaded.')}</p>
        <p>The governance evidence surface remains claim-bounded and inactive.</p>
      </div>
    `;
  }

  function renderEmpty(mount) {
    mount.classList.add('trace-viewer-ready', 'command-deck-ready');
    mount.innerHTML = `
      <div class="command-deck-header">
        <div>
          <span class="command-deck-module">AETHERUS Command Deck</span>
          <strong>AETHERUS &middot; MONOLITH</strong>
        </div>
        <div class="command-deck-context" aria-label="Command Deck context">
          <span>Evidence Surface</span>
          <span>Context: Governance Pipeline</span>
          <span>Mode: Static Evaluation</span>
          <span>Read-only</span>
        </div>
      </div>
      <p class="command-boundary-strip">${escapeText(BOUNDARY_COPY)}</p>
      <div class="command-deck-empty" role="status">No deterministic governance scenarios are available.</div>
    `;
  }

  function renderSelector(trace) {
    const options = scenarioOptions.map(scenario => `
      <option value="${escapeAttr(scenario.id)}"${scenario.id === state.selectedScenarioId ? ' selected' : ''}>
        ${escapeText(scenario.title)}
      </option>
    `).join('');

    return `
      <div class="command-selector-shell">
        <label class="command-selector-label" for="trace-scenario-select">
          <span>DETERMINISTIC GOVERNANCE SCENARIO</span>
          <span class="command-selector-control">
            <select id="trace-scenario-select" title="${escapeAttr(trace.scenario.title)}">
              ${options}
            </select>
            <span class="command-selector-chevron" aria-hidden="true">⌄</span>
          </span>
        </label>
      </div>
    `;
  }

  function renderScenarioSignal(trace) {
    const points = sparklinePoints(trace);
    const sparkline = points.length
      ? `<svg viewBox="0 0 100 80" role="img" aria-label="Static fixture-derived signal trace"><polyline points="${escapeAttr(points.join(' '))}" /></svg>`
      : '<p class="command-empty-note">No static signal trace available.</p>';

    return `
      <article class="command-card command-card-signal">
        <div class="command-card-topline">
          <span>Scenario Signal</span>
          <strong>${escapeText(trace.scenario.title)}</strong>
        </div>
        <p>${escapeText(isAdapterFailure(trace)
          ? 'Adapter failure detected before release eligibility can be trusted.'
          : trace.scenario.summary || 'No static fixture data available for this field.')}</p>
        <div class="command-sparkline" data-label="Static fixture-derived">
          ${sparkline}
        </div>
        <dl class="command-card-fields">
          <div><dt>Severity</dt><dd>${escapeText(normalizeVerdict(trace) === 'Blocked' ? 'High' : 'Unclassified')}</dd></div>
          <div><dt>Trigger count</dt><dd>${escapeText(String(failedRuleCount(trace) || (trace.traceEvents || []).length || 'Unavailable'))}</dd></div>
          <div><dt>Selected stack stage</dt><dd>${escapeText(displayStage(trace.activeStageKey))}</dd></div>
          <div><dt>Scenario assertion</dt><dd>${escapeText(scenarioAssertion(trace))}</dd></div>
          <div><dt>Output order</dt><dd>${escapeText(outputOrder(trace))}</dd></div>
        </dl>
      </article>
    `;
  }

  function renderVerdictCore(trace) {
    const verdict = normalizeVerdict(trace);
    return `
      <article class="command-card command-card-verdict" data-verdict="${escapeAttr(verdict.toLowerCase())}">
        <div class="command-card-topline">
          <span>VERDICT CORE</span>
          <strong>Release Gate Decision</strong>
        </div>
        <div class="command-verdict-lock" aria-hidden="true">▣</div>
        <p class="command-verdict-status">${escapeText(verdict.toUpperCase())}</p>
        <dl class="command-verdict-fields">
          <div><dt>Reason class</dt><dd>${escapeText(reasonClass(trace))}</dd></div>
          <div><dt>Decision path</dt><dd>${escapeText(isAdapterFailure(trace)
            ? 'Gate evaluation prevents modeled release progression.'
            : reasonSummary(trace))}</dd></div>
          <div><dt>Where negative properties apply</dt><dd>${escapeText(trace.releaseEligibility && trace.releaseEligibility.label ? trace.releaseEligibility.label : 'Unavailable')}</dd></div>
        </dl>
        <button type="button" class="command-decision-action" data-command-action="decision-path">View Decision Path</button>
      </article>
    `;
  }

  function renderEvidenceReadiness(trace) {
    const counts = readiness(trace);
    const degree = counts.percent == null ? 0 : counts.percent * 3.6;
    const pctLabel = counts.percent == null ? 'N/A' : `${counts.percent}%`;

    return `
      <article class="command-card command-card-readiness">
        <div class="command-card-topline">
          <span>Evidence Readiness</span>
          <strong>${escapeText(counts.label)}</strong>
        </div>
        <div class="command-radial" style="--readiness-deg: ${escapeAttr(String(degree))}deg;" role="img" aria-label="${escapeAttr(`${counts.satisfied} of ${counts.required} operational evidence present`)}">
          <span>${escapeText(pctLabel)}</span>
        </div>
        <dl class="command-card-fields">
          <div><dt>Operational evidence present</dt><dd>${escapeText(String(counts.satisfied))}</dd></div>
          <div><dt>Operational evidence required</dt><dd>${escapeText(String(counts.required))}</dd></div>
          <div><dt>Missing evidence</dt><dd>${escapeText(String(counts.missing))}</dd></div>
          <div><dt>Conceptual artefacts available</dt><dd>${escapeText(counts.conceptualAvailable ? 'available' : 'unavailable')}</dd></div>
        </dl>
        <p class="command-readiness-note">
          ${escapeText(`${counts.satisfied} / ${counts.required} operational evidence present. Conceptual support ${counts.conceptualAvailable ? 'available' : 'pending'}; operational proof missing.`)}
        </p>
      </article>
    `;
  }

  function whyBlockedRows(trace) {
    if (isAdapterFailure(trace)) {
      return [
        ['Adapter Boundary', 'Failed', 'Adapter boundary was not enforced.'],
        ['Evidence Completeness', 'Failed', 'Operational evidence requirements are not satisfied.'],
        ['Authority / Release Eligibility', 'Failed', 'The modeled release path cannot proceed without authority-bearing evidence.']
      ];
    }

    const blocked = normalizeVerdict(trace) === 'Blocked';
    return [
      [
        trace.decisiveGate && trace.decisiveGate.label ? trace.decisiveGate.label : 'Decisive Gate',
        blocked ? 'Failed' : 'Satisfied',
        trace.decisiveGate && trace.decisiveGate.reason ? trace.decisiveGate.reason : reasonSummary(trace)
      ],
      [
        'Evidence Completeness',
        readiness(trace).required ? 'Missing' : 'Unavailable',
        readiness(trace).required ? 'Operational evidence requirements are not satisfied.' : 'Evidence readiness unavailable.'
      ],
      [
        'Authority / Release Eligibility',
        blocked ? 'Failed' : 'Satisfied',
        blocked
          ? 'The modeled release path cannot proceed without authority-bearing evidence.'
          : 'The fixture models eligibility without creating an operational release decision.'
      ]
    ];
  }

  function renderRows(rows, className) {
    return rows.map(([label, status, reason]) => `
      <li class="${className || 'command-detail-row'}">
        <span>${escapeText(label)}</span>
        <strong>${escapeText(status)}</strong>
        <p>${escapeText(reason)}</p>
      </li>
    `).join('');
  }

  function renderWhyBlockedPanel(trace) {
    return `
      <div class="command-panel-copy">
        <span>WHY THIS VERDICT?</span>
        <p>${escapeText(isAdapterFailure(trace)
          ? 'The scenario escalates because the adapter-normalization boundary is unsuccessful.'
          : trace.decisionExplanation && trace.decisionExplanation.why_verdict
            ? trace.decisionExplanation.why_verdict
            : reasonSummary(trace))}</p>
      </div>
      <ul class="command-detail-list">${renderRows(whyBlockedRows(trace), 'command-detail-row command-rule-row')}</ul>
      <p class="command-blocker-chip">Blocked by adapter boundary</p>
    `;
  }

  function renderRequiredEvidencePanel(trace) {
    const rows = evidenceItems(trace).map(item => [item.label, item.status, item.note]);
    return `
      <div class="command-panel-copy">
        <span>OPERATIONAL EVIDENCE NEEDED</span>
        <p>Conceptual research artefacts may exist. Operational evidence remains pending. Static fixture data does not equal production evidence.</p>
      </div>
      <ul class="command-detail-list">${renderRows(rows, 'command-detail-row command-evidence-row')}</ul>
    `;
  }

  function renderBoundaryPanel() {
    return `
      <div class="command-panel-copy">
        <span>NON-OPERATIONAL BOUNDARIES</span>
        <p>This tab states what the current surface does not claim.</p>
      </div>
      <ul class="command-detail-list">
        ${BOUNDARY_ROWS.map(row => `
          <li class="command-detail-row command-boundary-row">
            <span>${escapeText(row)}</span>
            <strong>Not claimed</strong>
          </li>
        `).join('')}
      </ul>
    `;
  }

  function renderRawTracePanel(trace) {
    const fields = [
      ['Scenario fixture metadata', trace.scenario.title],
      ['Static evaluation boundary', 'Static browser-side evaluation'],
      ['Selected stack stage', displayStage(trace.activeStageKey)],
      ['Scenario assertion', scenarioAssertion(trace)],
      ['Output order', outputOrder(trace)],
      ['Evaluation mode', 'Static browser-side evaluation'],
      ['Fixture type', 'Local static fixture'],
      ['Claim boundary', 'Not live AI execution; not a production audit ledger'],
      ['Related artefact references', 'Research Artefacts / Curated research and evidence modules.']
    ];
    const events = Array.isArray(trace.traceEvents) ? trace.traceEvents : [];

    return `
      <div class="command-panel-copy">
        <span>RAW STATIC TRACE</span>
        <p>Compact developer-facing fixture details remain available without becoming the default readout.</p>
      </div>
      <dl class="command-raw-fields">
        ${fields.map(([label, value]) => `
          <div>
            <dt>${escapeText(label)}</dt>
            <dd>${escapeText(value || 'Unavailable')}</dd>
          </div>
        `).join('')}
      </dl>
      <div class="command-trace-events">
        <span>Trace events</span>
        <ul>
          ${events.length ? events.map(event => `
            <li>
              <strong>${escapeText(event.id)}</strong>
              <span>${escapeText(event.action_type)} / ${escapeText(event.agent_id)}</span>
              <p>${escapeText(event.trace_note)}</p>
            </li>
          `).join('') : '<li>No static fixture data available for this field.</li>'}
        </ul>
      </div>
    `;
  }

  function renderTabs(trace) {
    const tabButtons = TABS.map((tab, index) => `
      <button
        type="button"
        id="command-tab-${escapeAttr(tab.id)}"
        class="command-tab${tab.id === state.activeTab ? ' active' : ''}"
        role="tab"
        aria-selected="${tab.id === state.activeTab ? 'true' : 'false'}"
        aria-controls="command-panel-${escapeAttr(tab.id)}"
        tabindex="${tab.id === state.activeTab ? '0' : '-1'}"
        data-command-tab="${escapeAttr(tab.id)}"
        data-tab-index="${escapeAttr(String(index))}">
        ${escapeText(tab.label)}
      </button>
    `).join('');

    const panels = {
      'why-blocked': renderWhyBlockedPanel(trace),
      'required-evidence': renderRequiredEvidencePanel(trace),
      boundary: renderBoundaryPanel(trace),
      'raw-trace': renderRawTracePanel(trace)
    };

    return `
      <div class="command-tab-row" role="tablist" aria-label="Command Deck detail navigation">
        ${tabButtons}
      </div>
      <div class="command-tab-panels" aria-live="polite">
        ${TABS.map(tab => `
          <section
            id="command-panel-${escapeAttr(tab.id)}"
            class="command-tab-panel"
            role="tabpanel"
            tabindex="0"
            aria-labelledby="command-tab-${escapeAttr(tab.id)}"
            ${tab.id === state.activeTab ? '' : 'hidden'}>
            ${panels[tab.id]}
          </section>
        `).join('')}
      </div>
    `;
  }

  function renderFooter(trace) {
    return `
      <footer class="command-deck-footer" aria-label="Command Deck metadata">
        <dl>
          <div><dt>Scenario ID</dt><dd>${escapeText(trace.scenario.id)}</dd></div>
          <div><dt>Selected Stack Stage</dt><dd>${escapeText(displayStage(trace.activeStageKey))}</dd></div>
          <div><dt>Evaluation Mode</dt><dd>Static browser-side evaluation</dd></div>
          <div><dt>Source</dt><dd>Local static fixture</dd></div>
          <div><dt>Claim Boundary</dt><dd>Not live AI execution; not a production audit ledger</dd></div>
          <div><dt>Status</dt><dd>Pending Operational Evidence</dd></div>
        </dl>
      </footer>
    `;
  }

  function activateEvidence(trace) {
    if (window.AetherusPipeline && typeof window.AetherusPipeline.showRelatedByStage === 'function') {
      window.AetherusPipeline.showRelatedByStage(trace.activeStageKey, stageShortLabel(trace.activeStageKey));
      return;
    }

    document.querySelectorAll('[data-stage-key]').forEach(el => {
      const isActive = el.getAttribute('data-stage-key') === trace.activeStageKey;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function getCurrentTrace() {
    if (!engineRef) return null;
    return engineRef.runScenario(state.selectedScenarioId);
  }

  function renderDeck(focusTarget) {
    const mount = getMount();
    if (!mount || !engineRef) return;
    const trace = getCurrentTrace();
    const counts = readiness(trace);

    mount.classList.add('trace-viewer-ready', 'command-deck-ready');
    mount.innerHTML = `
      <div class="command-deck-header">
        <div>
          <span class="command-deck-module">AETHERUS Command Deck</span>
          <strong>AETHERUS &middot; MONOLITH</strong>
        </div>
        <div class="command-deck-context" aria-label="Command Deck context">
          <span>Evidence Surface</span>
          <span>Context: Governance Pipeline</span>
          <span>Mode: Static Evaluation</span>
          <span>Read-only</span>
        </div>
      </div>
      <p class="command-boundary-strip">${escapeText(BOUNDARY_COPY)}</p>
      ${renderSelector(trace)}
      <div class="command-telemetry-grid" aria-label="Command Deck telemetry">
        ${renderScenarioSignal(trace)}
        ${renderVerdictCore(trace)}
        ${renderEvidenceReadiness(trace)}
      </div>
      ${renderTabs(trace)}
      ${renderFooter(trace)}
      <span class="sr-only" data-command-readiness>${escapeText(`Operational readiness: ${counts.satisfied} / ${counts.required}`)}</span>
      <span class="sr-only">${escapeText(TECHNICAL_TRACE_LABEL)}</span>
    `;

    bindInteractions(mount);
    activateEvidence(trace);
    restoreFocus(mount, focusTarget);
  }

  function restoreFocus(mount, focusTarget) {
    if (!focusTarget) return;
    if (focusTarget === 'selector') {
      const select = mount.querySelector('#trace-scenario-select');
      if (select) select.focus();
      return;
    }
    if (focusTarget === 'panel') {
      const panel = mount.querySelector(`#command-panel-${state.activeTab}`);
      if (panel) panel.focus();
      return;
    }
    if (focusTarget.startsWith('tab:')) {
      const tabId = focusTarget.slice(4);
      const tab = mount.querySelector(`[data-command-tab="${CSS.escape(tabId)}"]`);
      if (tab) tab.focus();
    }
  }

  function setActiveTab(tabId, focusTarget) {
    if (!TABS.some(tab => tab.id === tabId)) return;
    state.activeTab = tabId;
    renderDeck(focusTarget || `tab:${tabId}`);
  }

  function nextTabId(currentId, direction) {
    const index = TABS.findIndex(tab => tab.id === currentId);
    if (index < 0) return TABS[0].id;
    const nextIndex = (index + direction + TABS.length) % TABS.length;
    return TABS[nextIndex].id;
  }

  function bindInteractions(mount) {
    const select = mount.querySelector('#trace-scenario-select');
    if (select) {
      select.addEventListener('change', () => {
        state.selectedScenarioId = select.value;
        state.activeTab = 'why-blocked';
        renderDeck('selector');
      });
    }

    mount.querySelectorAll('[data-command-tab]').forEach(tab => {
      tab.addEventListener('click', () => setActiveTab(tab.getAttribute('data-command-tab')));
      tab.addEventListener('keydown', event => {
        const current = tab.getAttribute('data-command-tab');
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          setActiveTab(nextTabId(current, 1), `tab:${nextTabId(current, 1)}`);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setActiveTab(nextTabId(current, -1), `tab:${nextTabId(current, -1)}`);
        } else if (event.key === 'Home') {
          event.preventDefault();
          setActiveTab(TABS[0].id, `tab:${TABS[0].id}`);
        } else if (event.key === 'End') {
          event.preventDefault();
          setActiveTab(TABS[TABS.length - 1].id, `tab:${TABS[TABS.length - 1].id}`);
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setActiveTab(current, `tab:${current}`);
        }
      });
    });

    const decisionPath = mount.querySelector('[data-command-action="decision-path"]');
    if (decisionPath) {
      decisionPath.addEventListener('click', () => {
        state.activeTab = 'why-blocked';
        renderDeck('panel');
      });
    }
  }

  async function init() {
    const mount = getMount();
    if (!mount) return;

    const engine = window.AetherusGovernanceEngine;
    if (!engine) {
      renderFailure(mount, 'Governance engine script is unavailable. The static site remains readable, but scenario traces cannot be shown.');
      return;
    }

    try {
      engineRef = engine;
      await engine.load();
      scenarioOptions = engine.getScenarios();
      if (!scenarioOptions.length) {
        renderEmpty(mount);
        return;
      }

      if (!scenarioOptions.some(scenario => scenario.id === state.selectedScenarioId)) {
        state.selectedScenarioId = scenarioOptions[0].id;
      }

      renderDeck();
      document.addEventListener('aetherus:evidence-ready', () => renderDeck());
    } catch (err) {
      renderFailure(mount, err && err.message ? err.message : 'Static fixture could not be loaded.');
    }
  }

  window.AetherusCommandDeck = {
    getState() {
      return {
        selectedScenarioId: state.selectedScenarioId,
        activeTab: state.activeTab,
        scenarioCount: scenarioOptions.length
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
