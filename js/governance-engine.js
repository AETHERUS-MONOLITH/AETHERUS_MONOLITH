/**
 * governance-engine.js — Deterministic AETHERUS Intelligence Layer v0
 * Static browser-side scenario evaluation only. No model calls, persistence,
 * runtime retry loops, telemetry, or operational ledger behavior.
 */
(function () {
  const MANIFEST_URL = 'data/joint-workflow.manifest.json';
  const SCENARIOS_URL = 'data/scenarios.json';
  const BOUNDARY_COPY = 'Deterministic prototype trace. Static browser-side evaluation. Not live AI execution. Not a production audit ledger.';

  let manifest = null;
  let scenarioRegistry = null;
  let loadPromise = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to load ${url}`);
    }
    return response.json();
  }

  function assertMetadata(entity, label) {
    const required = [
      'source_document',
      'source_section',
      'implementation_status',
      'operational_status'
    ];
    required.forEach(key => {
      if (!entity || !entity[key]) {
        throw new Error(`${label} is missing ${key}`);
      }
    });
  }

  function validateMajorItems(collection, label) {
    if (!collection || !Array.isArray(collection.items)) return;
    collection.items.forEach(item => assertMetadata(item, `${label}.${item.id || item.label || 'item'}`));
  }

  function validateManifest(data) {
    assertMetadata(data, 'manifest');

    [
      'joints',
      'pipelines',
      'gates',
      'verdicts',
      'handoff_receipt_contract',
      'authority_ladder',
      'event_ledger_schema',
      'forbidden_patterns',
      'templates',
      'stack_mapping',
      'claim_boundaries'
    ].forEach(key => assertMetadata(data[key], key));

    validateMajorItems(data.joints, 'joints');
    validateMajorItems(data.pipelines, 'pipelines');
    validateMajorItems(data.gates, 'gates');
    validateMajorItems(data.verdicts, 'verdicts');
    validateMajorItems(data.templates, 'templates');
    validateMajorItems(data.stack_mapping, 'stack_mapping');

    const g4 = data.gates.items.find(gate => gate.id === 'G4');
    if (g4 && g4.source === 'joint-workflow') {
      throw new Error('G4 must not be marked as Joint-Workflow-native in v0.');
    }
  }

  function validateScenarios(data) {
    assertMetadata(data, 'scenarios');
    if (!Array.isArray(data.scenarios) || !data.scenarios.length) {
      throw new Error('scenarios.json must contain scenarios.');
    }

    data.scenarios.forEach(scenario => {
      assertMetadata(scenario, `scenario.${scenario.id || 'unknown'}`);
      [
        'id',
        'title',
        'stage_key',
        'current_gate',
        'verdict',
        'state_chamber',
        'release_eligibility',
        'static_retry_policy',
        'gate_results',
        'handoff_receipts',
        'events',
        'decision_explanation',
        'decisive_gate',
        'active_layer_explanation',
        'operational_evidence_required',
        'non_operational_boundaries',
        'assertions'
      ].forEach(key => {
        if (!scenario[key]) {
          throw new Error(`Scenario ${scenario.id || 'unknown'} is missing ${key}`);
        }
      });

      if (!Array.isArray(scenario.operational_evidence_required)) {
        throw new Error(`Scenario ${scenario.id} operational_evidence_required must be an array`);
      }
      if (!Array.isArray(scenario.non_operational_boundaries)) {
        throw new Error(`Scenario ${scenario.id} non_operational_boundaries must be an array`);
      }
      if (scenario.decisive_gate && scenario.decisive_gate.id === 'G4') {
        throw new Error(`Scenario ${scenario.id} must not use G4 as the decisive gate`);
      }
    });
  }

  function getGate(gateId) {
    if (!manifest || !manifest.gates || !Array.isArray(manifest.gates.items)) return null;
    return manifest.gates.items.find(gate => gate.id === gateId) || null;
  }

  function getStackLayer(stageKey) {
    if (!manifest || !manifest.stack_mapping || !Array.isArray(manifest.stack_mapping.items)) return null;
    return manifest.stack_mapping.items.find(item => item.stage_key === stageKey) || null;
  }

  function makeTraceId(scenarioId, sequence) {
    const cleaned = String(scenarioId || 'scenario').replace(/[^a-z0-9]+/gi, '-').toUpperCase();
    return `TRACE-${cleaned}-${String(sequence).padStart(2, '0')}`;
  }

  function normalizeEvent(event, scenarioId) {
    return {
      id: makeTraceId(scenarioId, event.sequence),
      type: 'illustrative in-memory trace event',
      sequence: event.sequence,
      timestamp_label: `T+${String((event.sequence - 1) * 4).padStart(2, '0')}`,
      agent_id: event.agent_id,
      action_type: event.action_type,
      stage_key: event.stage_key,
      input_ref: `${scenarioId}/input`,
      state_ref: `${scenarioId}/state`,
      payload_ref: event.payload_ref,
      trace_note: event.note
    };
  }

  function buildTrace(scenario) {
    const activeStageKey = scenario.stage_key;
    const currentGate = getGate(scenario.current_gate) || {
      id: scenario.current_gate,
      label: scenario.current_gate,
      source: 'scenario-fixture',
      stage_key: activeStageKey
    };
    const activeStackLayer = getStackLayer(activeStageKey);

    return {
      scenario: {
        id: scenario.id,
        title: scenario.title,
        summary: scenario.summary,
        category: scenario.category,
        source_document: scenario.source_document,
        source_section: scenario.source_section,
        implementation_status: scenario.implementation_status,
        operational_status: scenario.operational_status
      },
      verdict: clone(scenario.verdict),
      stateChamber: clone(scenario.state_chamber),
      currentGate: {
        id: currentGate.id,
        label: currentGate.label,
        source: currentGate.source || 'scenario-fixture',
        purpose: currentGate.purpose || '',
        stage_key: currentGate.stage_key || activeStageKey
      },
      activeStageKey,
      activeStackLayer: activeStackLayer ? {
        stack_layer: activeStackLayer.stack_layer,
        stage_key: activeStackLayer.stage_key,
        joint_workflow_concepts: clone(activeStackLayer.joint_workflow_concepts || [])
      } : null,
      releaseEligibility: clone(scenario.release_eligibility),
      decisionExplanation: clone(scenario.decision_explanation),
      decisiveGate: clone(scenario.decisive_gate),
      activeLayerExplanation: clone(scenario.active_layer_explanation),
      operationalEvidenceRequired: clone(scenario.operational_evidence_required),
      nonOperationalBoundaries: clone(scenario.non_operational_boundaries),
      assertions: clone(scenario.assertions),
      gateResults: clone(scenario.gate_results),
      handoffReceipts: clone(scenario.handoff_receipts),
      traceEvents: scenario.events.map(event => normalizeEvent(event, scenario.id)),
      retryPolicy: scenario.static_retry_policy,
      boundaryCopy: scenario.boundary_copy || scenarioRegistry.boundary_copy || BOUNDARY_COPY
    };
  }

  async function load() {
    if (loadPromise) return loadPromise;

    loadPromise = Promise.all([
      fetchJson(MANIFEST_URL),
      fetchJson(SCENARIOS_URL)
    ]).then(([loadedManifest, loadedScenarios]) => {
      validateManifest(loadedManifest);
      validateScenarios(loadedScenarios);
      manifest = loadedManifest;
      scenarioRegistry = loadedScenarios;
      return {
        manifest: clone(manifest),
        scenarios: clone(scenarioRegistry)
      };
    });

    return loadPromise;
  }

  function getScenarios() {
    if (!scenarioRegistry || !Array.isArray(scenarioRegistry.scenarios)) return [];
    return scenarioRegistry.scenarios.map(scenario => ({
      id: scenario.id,
      title: scenario.title,
      summary: scenario.summary,
      category: scenario.category,
      verdict: scenario.verdict.status,
      current_gate: scenario.current_gate,
      state_chamber: scenario.state_chamber.label
    }));
  }

  function runScenario(id) {
    if (!scenarioRegistry || !Array.isArray(scenarioRegistry.scenarios)) {
      throw new Error('Governance engine has not loaded scenario data.');
    }

    const scenario = scenarioRegistry.scenarios.find(item => item.id === id);
    if (!scenario) {
      throw new Error(`Scenario not found: ${id}`);
    }

    return buildTrace(scenario);
  }

  window.AetherusGovernanceEngine = {
    load,
    getScenarios,
    runScenario
  };
})();
