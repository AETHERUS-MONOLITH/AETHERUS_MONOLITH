/**
 * trace-viewer.js — Static governance trace renderer
 * Renders deterministic prototype traces from local scenario fixtures.
 */
(function () {
  const BOUNDARY_COPY = 'Deterministic prototype trace. Static browser-side evaluation. Not live AI execution. Not a production audit ledger.';

  function escapeText(value) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(value == null ? '' : String(value)));
    return div.innerHTML;
  }

  function getMount() {
    return document.getElementById('governance-trace-viewer');
  }

  function verdictLabel(verdict) {
    const status = verdict && verdict.status ? verdict.status.toUpperCase() : 'UNKNOWN';
    return verdict && verdict.subtype ? `${status} / ${verdict.subtype}` : status;
  }

  function renderFailure(mount, message) {
    mount.classList.add('trace-viewer-ready');
    mount.innerHTML = `
      <div class="trace-boundary">${BOUNDARY_COPY}</div>
      <div class="trace-failure" role="status">
        <strong>Prototype trace unavailable</strong>
        <p>${escapeText(message)}</p>
      </div>
    `;
  }

  function renderShell(mount, scenarios) {
    const options = scenarios.map(scenario => `
      <option value="${escapeText(scenario.id)}">${escapeText(scenario.title)}</option>
    `).join('');

    mount.classList.add('trace-viewer-ready');
    mount.innerHTML = `
      <div class="trace-viewer-header">
        <div>
          <span class="section-kicker">Prototype Trace</span>
          <h3>Deterministic governance scenario</h3>
        </div>
        <label class="trace-selector-label" for="trace-scenario-select">
          <span>Scenario</span>
          <select id="trace-scenario-select">${options}</select>
        </label>
      </div>
      <p class="trace-boundary">${BOUNDARY_COPY}</p>
      <div class="trace-readout" id="trace-readout" aria-live="polite" aria-atomic="true"></div>
    `;
  }

  function renderGateResults(results) {
    return results.map(result => `
      <li>
        <span>${escapeText(result.gate_id)}</span>
        <strong>${escapeText(result.status)}</strong>
        <small>${escapeText(result.note)}</small>
      </li>
    `).join('');
  }

  function renderReceipts(receipts) {
    return receipts.map(receipt => {
      const received = Array.isArray(receipt.received) ? receipt.received.join(', ') : 'none';
      const missing = Array.isArray(receipt.missing) && receipt.missing.length
        ? `<small>Missing: ${escapeText(receipt.missing.join(', '))}</small>`
        : '';
      return `
        <li>
          <span>${escapeText(receipt.joint)}</span>
          <strong>${escapeText(receipt.validation)}</strong>
          <small>Received: ${escapeText(received)}</small>
          ${missing}
        </li>
      `;
    }).join('');
  }

  function renderEvents(events) {
    return events.map(event => `
      <li>
        <span>${escapeText(event.id)}</span>
        <strong>${escapeText(event.action_type)} / ${escapeText(event.agent_id)}</strong>
        <small>${escapeText(event.type)}</small>
        <p>${escapeText(event.trace_note)}</p>
      </li>
    `).join('');
  }

  function renderDecisionExplanation(explanation) {
    if (!explanation) return '';

    return `
      <section class="trace-decision">
        <div>
          <span>Decision Explanation</span>
          <strong>Why this verdict?</strong>
          <p>${escapeText(explanation.why_verdict)}</p>
        </div>
        <dl>
          <div>
            <dt>Determining condition</dt>
            <dd>${escapeText(explanation.determining_condition)}</dd>
          </div>
          <div>
            <dt>Decisive rule or gate</dt>
            <dd>${escapeText(explanation.decisive_rule_or_gate)}</dd>
          </div>
          <div>
            <dt>Different verdict requires</dt>
            <dd>${escapeText(explanation.different_verdict_requires)}</dd>
          </div>
        </dl>
      </section>
    `;
  }

  function renderDecisiveGate(gate) {
    if (!gate) return '';

    return `
      <section class="trace-decisive-gate">
        <h4>Decisive Gate</h4>
        <div class="trace-gate-card">
          <span>${escapeText(gate.source)}</span>
          <strong>${escapeText(gate.id)} / ${escapeText(gate.status)}</strong>
          <p>${escapeText(gate.reason)}</p>
          <small>${escapeText(gate.prevents_or_permits)}</small>
        </div>
      </section>
    `;
  }

  function renderOperationalEvidence(items) {
    if (!Array.isArray(items) || !items.length) return '';

    return `
      <section class="trace-operational-evidence">
        <h4>Operational Evidence Required</h4>
        <ul>
          ${items.map(item => `<li>${escapeText(item)}</li>`).join('')}
        </ul>
      </section>
    `;
  }

  function renderNonOperationalBoundaries(items) {
    if (!Array.isArray(items) || !items.length) return '';

    return `
      <section class="trace-boundary-list">
        <h4>Non-Operational Boundaries</h4>
        <ul>
          ${items.map(item => `<li>${escapeText(item)}</li>`).join('')}
        </ul>
      </section>
    `;
  }

  function renderAssertions(assertions) {
    if (!assertions) return '';

    const rows = [
      ['Expected verdict', assertions.expected_verdict],
      ['Expected chamber', assertions.expected_chamber],
      ['Expected decisive gate', assertions.expected_decisive_gate],
      ['Expected active layer', assertions.expected_active_layer],
      ['Expected release eligibility', assertions.expected_release_eligibility],
      ['Expected boundary note', assertions.expected_boundary_note]
    ];

    return `
      <section class="trace-assertions">
        <h4>Scenario Assertions</h4>
        <table>
          <tbody>
            ${rows.map(([label, value]) => `
              <tr>
                <th scope="row">${escapeText(label)}</th>
                <td>${escapeText(value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    `;
  }

  function activateEvidence(trace) {
    if (window.AetherusPipeline && typeof window.AetherusPipeline.showRelatedByStage === 'function') {
      window.AetherusPipeline.showRelatedByStage(trace.activeStageKey);
      return;
    }

    document.querySelectorAll('[data-stage-key]').forEach(el => {
      const isActive = el.getAttribute('data-stage-key') === trace.activeStageKey;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function updateTrace(trace) {
    const readout = document.getElementById('trace-readout');
    if (!readout) return;

    const verdict = trace.verdict || {};
    const release = trace.releaseEligibility || {};
    const chamber = trace.stateChamber || {};
    const gate = trace.currentGate || {};
    const layer = trace.activeStackLayer || {};
    const layerExplanation = trace.activeLayerExplanation || {};

    readout.innerHTML = `
      <div class="trace-summary-grid">
        <div class="trace-metric trace-verdict" data-verdict="${escapeText(verdict.status || 'unknown')}">
          <span>Verdict</span>
          <strong>${escapeText(verdictLabel(verdict))}</strong>
          <small>${escapeText(verdict.reason || '')}</small>
        </div>
        <div class="trace-metric">
          <span>State Chamber</span>
          <strong>${escapeText(chamber.label || 'Unassigned')}</strong>
          <small>${escapeText(chamber.action || '')}</small>
        </div>
        <div class="trace-metric">
          <span>Current Gate</span>
          <strong>${escapeText(gate.id || 'unknown')}</strong>
          <small>${escapeText(gate.label || '')}</small>
        </div>
        <div class="trace-metric">
          <span>Stack Layer</span>
          <strong>${escapeText(layer.stack_layer || trace.activeStageKey)}</strong>
          <small>${escapeText(layerExplanation.reason || trace.activeStageKey)}</small>
        </div>
      </div>

      ${renderDecisionExplanation(trace.decisionExplanation)}

      <div class="trace-release" data-eligible="${release.eligible ? 'true' : 'false'}">
        <span>Release Eligibility</span>
        <strong>${escapeText(release.label || 'Not assessed')}</strong>
        <p>${escapeText(release.explanation || '')}</p>
      </div>

      ${renderOperationalEvidence(trace.operationalEvidenceRequired)}
      ${renderNonOperationalBoundaries(trace.nonOperationalBoundaries)}

      <div class="trace-policy">
        <span>Static Retry Policy</span>
        <p>${escapeText(trace.retryPolicy || 'No runtime retry loop is executed.')}</p>
      </div>

      ${renderAssertions(trace.assertions)}

      <div class="trace-columns">
        <section>
          <h4>Gate Results</h4>
          ${renderDecisiveGate(trace.decisiveGate)}
          <ul class="trace-list">${renderGateResults(trace.gateResults || [])}</ul>
        </section>
        <section>
          <h4>Handoff Receipts</h4>
          <ul class="trace-list">${renderReceipts(trace.handoffReceipts || [])}</ul>
        </section>
      </div>

      <section class="trace-events">
        <h4>Illustrative Trace Events</h4>
        <ul class="trace-event-list">${renderEvents(trace.traceEvents || [])}</ul>
      </section>
    `;

    activateEvidence(trace);
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
      await engine.load();
      const scenarios = engine.getScenarios();
      if (!scenarios.length) {
        renderFailure(mount, 'No deterministic scenarios are available in the local fixture registry.');
        return;
      }

      renderShell(mount, scenarios);

      const select = document.getElementById('trace-scenario-select');
      const runSelected = () => {
        const trace = engine.runScenario(select.value);
        updateTrace(trace);
      };

      select.addEventListener('change', runSelected);
      document.addEventListener('aetherus:evidence-ready', runSelected);
      runSelected();
    } catch (err) {
      renderFailure(mount, err && err.message ? err.message : 'Local governance trace data could not be loaded.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
