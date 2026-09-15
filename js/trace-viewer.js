/**
 * trace-viewer.js — static AETHERUS Proof Object renderer.
 * Uses the existing deterministic local scenario engine and keeps technical
 * provenance behind native disclosures instead of mounting a peer dashboard.
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
  const state = { selectedScenarioId: DEFAULT_SCENARIO_ID, activeTab: 'why-blocked' };

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
    return displayStage(stageKey).replace(/^0\d\s+/, '');
  }

  function isAdapterFailure(trace) {
    return trace && trace.scenario && trace.scenario.id === DEFAULT_SCENARIO_ID;
  }

  function normalizeVerdict(trace) {
    if (trace.releaseEligibility && trace.releaseEligibility.eligible === false) return 'Blocked';
    return titleCase(trace.verdict && trace.verdict.status ? trace.verdict.status : 'unknown');
  }

  function scenarioAssertion(trace) {
    if (trace.releaseEligibility && trace.releaseEligibility.eligible === false) return 'Does not release';
    if (trace.releaseEligibility && trace.releaseEligibility.eligible === true) return 'Release modeled as eligible';
    return 'No scenario assertion provided';
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
    if (isAdapterFailure(trace)) return 'The modeled release path cannot proceed because adapter-boundary evidence is insufficient.';
    if (trace.releaseEligibility && trace.releaseEligibility.explanation) return trace.releaseEligibility.explanation;
    return trace.verdict && trace.verdict.reason ? trace.verdict.reason : 'No static fixture data available for this field.';
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
    const labels = isAdapterFailure(trace) ? REQUIRED_EVIDENCE_ORDER : fromFixture;
    return labels.map(label => ({
      label: label || 'Unavailable',
      status: 'Missing',
      note: label === 'Model/API boundary documentation'
        ? 'Required if model output is involved; not operationally present in the fixture.'
        : 'Required before operational release eligibility can be asserted.'
    }));
  }

  function relatedDocs(trace) {
    if (!window.AetherusEvidence || typeof window.AetherusEvidence.findByStageKey !== 'function') return [];
    return window.AetherusEvidence.findByStageKey(trace.activeStageKey);
  }

  function readiness(trace) {
    const required = evidenceItems(trace).length;
    return {
      required,
      satisfied: 0,
      missing: required,
      conceptualAvailable: relatedDocs(trace).length > 0,
      label: required > 0 ? 'Pending operational evidence' : 'Evidence readiness unavailable'
    };
  }

  function whyBlockedRows(trace) {
    if (isAdapterFailure(trace)) {
      return [
        ['Adapter boundary', 'Adapter boundary was not enforced.', 'Failed'],
        ['Evidence completeness', 'Operational evidence requirements are not satisfied.', 'Failed'],
        ['Authority / release eligibility', 'The modeled release path cannot proceed without authority-bearing evidence.', 'Failed']
      ];
    }
    const blocked = normalizeVerdict(trace) === 'Blocked';
    return [
      [trace.decisiveGate && trace.decisiveGate.label ? trace.decisiveGate.label : 'Decisive gate', trace.decisiveGate && trace.decisiveGate.reason ? trace.decisiveGate.reason : reasonSummary(trace), blocked ? 'Failed' : 'Satisfied'],
      ['Evidence completeness', readiness(trace).required ? 'Operational evidence requirements are not satisfied.' : 'Evidence readiness unavailable.', readiness(trace).required ? 'Missing' : 'Unavailable'],
      ['Authority / release eligibility', blocked ? 'The modeled release path cannot proceed without authority-bearing evidence.' : 'The fixture models eligibility without creating an operational release decision.', blocked ? 'Failed' : 'Satisfied']
    ];
  }

  function renderRows(rows, className) {
    return rows.map(([label, reason, status]) => `
      <li>
        <span>${escapeText(label)}</span>
        <p>${escapeText(reason)}</p>
        <strong>${escapeText(status)}</strong>
      </li>
    `).join('');
  }

  function renderSelector(trace) {
    const options = scenarioOptions.map(scenario => `
      <option value="${escapeAttr(scenario.id)}"${scenario.id === state.selectedScenarioId ? ' selected' : ''}>${escapeText(scenario.title)}</option>
    `).join('');
    return `
      <div class="proof-object__selector">
        <label for="trace-scenario-select">Deterministic governance scenario
          <span class="proof-object__selector-control">
            <select id="trace-scenario-select" title="${escapeAttr(trace.scenario.title)}">${options}</select>
          </span>
        </label>
      </div>
    `;
  }

  function renderRawTrace(trace) {
    const fields = [
      ['Scenario ID', trace.scenario.id],
      ['Selected stack stage', displayStage(trace.activeStageKey)],
      ['Scenario assertion', scenarioAssertion(trace)],
      ['Output order', outputOrder(trace)],
      ['Evaluation mode', 'Static browser-side evaluation'],
      ['Source', 'Local static fixture'],
      ['Claim boundary', 'Not live AI execution; not a production audit ledger']
    ];
    const events = Array.isArray(trace.traceEvents) ? trace.traceEvents : [];
    return `
      <p><strong>RAW STATIC TRACE.</strong> Compact developer-facing fixture details remain available without becoming the default readout.</p>
      <dl class="proof-raw-fields">
        ${fields.map(([label, value]) => `<div><dt>${escapeText(label)}</dt><dd>${escapeText(value || 'Unavailable')}</dd></div>`).join('')}
      </dl>
      <ul class="proof-trace-events">
        ${events.length ? events.map(event => `<li><strong>${escapeText(event.id)}</strong> · ${escapeText(event.action_type)} / ${escapeText(event.agent_id)}<br>${escapeText(event.trace_note)}</li>`).join('') : '<li>No static fixture data available for this field.</li>'}
      </ul>
    `;
  }

  function renderFallback(mount, heading, message) {
    mount.classList.add('trace-viewer-ready');
    mount.innerHTML = `<div class="proof-object-fallback" role="status"><strong>${escapeText(heading)}</strong><p>${escapeText(message)}</p><p>The evidence surface remains claim-bounded and inactive.</p></div>`;
  }

  function renderProof(focusTarget) {
    const mount = getMount();
    if (!mount || !engineRef) return;
    const trace = engineRef.runScenario(state.selectedScenarioId);
    const counts = readiness(trace);
    const verdict = normalizeVerdict(trace);
    const evidence = evidenceItems(trace);

    mount.classList.add('trace-viewer-ready');
    mount.innerHTML = `
      <article class="proof-object" aria-labelledby="proof-object-title">
        <header class="proof-object__header">
          <div class="proof-object__folio">
            <span>Proof object · ${escapeText(displayStage(trace.activeStageKey).split(' ')[0])}</span>
            <strong id="proof-object-title">AETHERUS evidence artifact</strong>
          </div>
          ${renderSelector(trace)}
        </header>

        <div class="proof-object__boundary">
          <span>Claim boundary</span>
          <p>${escapeText(BOUNDARY_COPY)}</p>
        </div>

        <div class="proof-object__body">
          <section class="proof-object__statement" aria-label="Scenario summary">
            <span class="proof-object__label">Scenario</span>
            <h3>${escapeText(trace.scenario.title)}</h3>
            <p>${escapeText(isAdapterFailure(trace) ? 'Adapter failure detected before release eligibility can be trusted.' : trace.scenario.summary || 'No static fixture data available for this field.')}</p>
            <dl class="proof-object__register">
              <div><dt>Stage</dt><dd>${escapeText(displayStage(trace.activeStageKey))}</dd></div>
              <div><dt>Assertion</dt><dd>${escapeText(scenarioAssertion(trace))}</dd></div>
              <div><dt>Output</dt><dd>${escapeText(outputOrder(trace))}</dd></div>
            </dl>
          </section>
          <aside class="proof-object__verdict" aria-label="Modeled verdict">
            <span class="proof-object__label">Modeled result</span>
            <strong>${escapeText(verdict)}</strong>
            <p>${escapeText(reasonClass(trace))}. ${escapeText(reasonSummary(trace))}</p>
            <div class="proof-readiness">
              <span>Evidence state</span>
              <strong>${escapeText(`${counts.satisfied} of ${counts.required} operational requirements present`)}</strong>
              <small>${escapeText(counts.conceptualAvailable ? 'Conceptual support available; operational proof missing.' : 'Conceptual support and operational proof pending.')}</small>
            </div>
          </aside>
        </div>

        <div class="proof-object__layers">
          <details class="proof-layer" open>
            <summary><span>01</span><span><small>Decision basis</small><strong>Why this result</strong></span></summary>
            <div class="proof-layer__body">
              <p><strong>WHY THIS VERDICT?</strong> ${escapeText(isAdapterFailure(trace) ? 'The scenario escalates because the adapter-normalization boundary is unsuccessful.' : reasonSummary(trace))}</p>
              <ul class="proof-rule-list">${renderRows(whyBlockedRows(trace))}</ul>
            </div>
          </details>
          <details class="proof-layer">
            <summary><span>02</span><span><small>Evidence register</small><strong>Required evidence (${escapeText(String(counts.required))})</strong></span></summary>
            <div class="proof-layer__body">
              <p><strong>OPERATIONAL EVIDENCE NEEDED.</strong> Conceptual research artefacts may exist. Static fixture data does not equal production evidence.</p>
              <ul class="proof-evidence-list">${renderRows(evidence.map(item => [item.label, item.note, item.status]))}</ul>
            </div>
          </details>
          <details class="proof-layer">
            <summary><span>03</span><span><small>Claim discipline</small><strong>Surface boundaries</strong></span></summary>
            <div class="proof-layer__body">
              <p><strong>NON-OPERATIONAL BOUNDARIES.</strong> This layer states what the current surface does not claim.</p>
              <ul class="proof-boundary-list">${BOUNDARY_ROWS.map(row => `<li><span>${escapeText(row)}</span><p></p><strong>Not claimed</strong></li>`).join('')}</ul>
            </div>
          </details>
          <details class="proof-layer">
            <summary><span>04</span><span><small>Developer provenance</small><strong>Technical trace</strong></span></summary>
            <div class="proof-layer__body">${renderRawTrace(trace)}</div>
          </details>
        </div>
        <span class="sr-only" data-command-readiness>${escapeText(`Operational readiness: ${counts.satisfied} / ${counts.required}`)}</span>
        <span class="sr-only">${escapeText(TECHNICAL_TRACE_LABEL)}</span>
      </article>
    `;

    const select = mount.querySelector('#trace-scenario-select');
    select?.addEventListener('change', () => {
      state.selectedScenarioId = select.value;
      renderProof('selector');
    });
    if (focusTarget === 'selector') mount.querySelector('#trace-scenario-select')?.focus();
    if (window.AetherusPipeline && typeof window.AetherusPipeline.showRelatedByStage === 'function') {
      window.AetherusPipeline.showRelatedByStage(trace.activeStageKey, stageShortLabel(trace.activeStageKey));
    }
  }

  async function init() {
    const mount = getMount();
    if (!mount) return;
    const engine = window.AetherusGovernanceEngine;
    if (!engine) {
      renderFallback(mount, 'Scenario data unavailable.', 'Governance engine script is unavailable. The static site remains readable, but scenario traces cannot be shown.');
      return;
    }
    try {
      engineRef = engine;
      await engine.load();
      scenarioOptions = engine.getScenarios();
      if (!scenarioOptions.length) {
        renderFallback(mount, 'No scenarios available.', 'No deterministic governance scenarios are available.');
        return;
      }
      if (!scenarioOptions.some(scenario => scenario.id === state.selectedScenarioId)) state.selectedScenarioId = scenarioOptions[0].id;
      renderProof();
      document.addEventListener('aetherus:evidence-ready', () => renderProof());
    } catch (error) {
      renderFallback(mount, 'Scenario data unavailable.', error && error.message ? error.message : 'Static fixture could not be loaded.');
    }
  }

  window.AetherusCommandDeck = {
    getState() {
      return { selectedScenarioId: state.selectedScenarioId, activeTab: state.activeTab, scenarioCount: scenarioOptions.length };
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
