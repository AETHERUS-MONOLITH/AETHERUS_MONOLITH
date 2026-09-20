import assert from "node:assert/strict";
import test from "node:test";

import {
  INTELLIGENCE_CONTRACTS,
  MODEL_NAME,
  NEXUS_COMMIT,
  buildNormalizedResult,
  deriveVerdict,
  extractStructuredOutput,
  intelligenceContractFor,
  modelOutputFormatFor,
  sha256,
  validateNexusHealth,
  validateNexusResult,
  validateRequestBody
} from "../supabase/functions/live-governed-evaluation-v0/lib.mjs";

const intelligenceOutputs = Object.freeze({
  communicator: {
    objective: "Frame one bounded evaluation.",
    activation_recommendation: "mediator",
    constraints_to_resolve: ["Confirm the evidence boundary."]
  },
  mediator: {
    constraints: ["Remain within the bounded input."],
    acceptance_tests: ["A result is persisted."],
    forbidden_patterns: ["No external release action."]
  },
  drafter: {
    content: "A bounded artifact candidate.",
    constraint_acknowledgements: ["No external release action."]
  },
  refiner: {
    verification_verdict: "escalate",
    findings: ["Operator evidence is incomplete."],
    patchlist: ["Add the missing evidence reference."]
  },
  origin: {
    precondition_verdict: "pass",
    artifact_identity: "artifact:test:1",
    delta_brief: "Lineage candidate recorded without exercising commit authority.",
    commit_authority_exercised: false
  }
});

const candidate = Object.freeze({
  summary: "The bounded object can proceed only within the recorded evaluation boundary.",
  candidate_decision: "pass",
  risk_level: "low",
  rationale: "The supplied text does not establish a prohibited action, while external release remains unavailable.",
  evidence_requirements: [{ label: "Operator review", rationale: "A human must inspect the persisted result before any separate action." }],
  intelligence_output: {
    constraints: ["Remain within the bounded input."],
    acceptance_tests: ["A result is persisted."],
    forbidden_patterns: ["No external release action."]
  }
});

const nexusResult = Object.freeze({
  schema_version: "0.1",
  execution_status: "completed",
  adapter_identity: {
    nexus_commit: NEXUS_COMMIT,
    source_modified: false,
    anthropic_invocation: false
  },
  normalized: {
    verdict: "pass",
    gate_results: [
      { gate_id: "alpha_intake", status: "pass", reason: "Alpha complete." },
      { gate_id: "delta_risk_gate", status: "pass", reason: "Delta safe." },
      { gate_id: "omega_decision", status: "pass", reason: "Omega release candidate." }
    ]
  }
});

test("request validation requires per-run non-sensitive classification and OpenAI consent", () => {
  const base = {
    client_request_id: "11111111-1111-4111-8111-111111111111",
    workspace_id: "22222222-2222-4222-8222-222222222222",
    input_text: "Evaluate this bounded, non-sensitive test object.",
    intelligence_id: "mediator",
    data_classification: "non_sensitive",
    external_processing_consent: true
  };
  assert.equal(validateRequestBody(base).input_text, base.input_text);
  assert.throws(() => validateRequestBody({ ...base, external_processing_consent: false }), /external_processing_consent_required/);
  assert.throws(() => validateRequestBody({ ...base, data_classification: "unknown" }), /non_sensitive_classification_required/);
});

test("OpenAI structured output extraction rejects unstructured responses", () => {
  const response = {
    id: "resp_test",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(candidate) }] }]
  };
  assert.deepEqual(extractStructuredOutput(response, "mediator"), candidate);
  assert.throws(() => extractStructuredOutput({ id: "resp_test", output: [] }, "mediator"), /structured_output_missing/);
});

test("five Intelligences expose distinct independently invokable contracts", () => {
  assert.deepEqual(Object.keys(INTELLIGENCE_CONTRACTS), ["communicator", "mediator", "drafter", "refiner", "origin"]);
  for (const intelligenceId of Object.keys(INTELLIGENCE_CONTRACTS)) {
    const body = {
      client_request_id: "11111111-1111-4111-8111-111111111111",
      workspace_id: "22222222-2222-4222-8222-222222222222",
      input_text: "Evaluate this bounded, non-sensitive test object.",
      intelligence_id: intelligenceId,
      data_classification: "non_sensitive",
      external_processing_consent: true
    };
    assert.equal(validateRequestBody(body).intelligence_id, intelligenceId);
    const format = modelOutputFormatFor(intelligenceId);
    assert.equal(format.name, `aetherus_${intelligenceId}_invocation_v0`);
    assert.equal(format.schema.properties.intelligence_output, intelligenceContractFor(intelligenceId).output_schema);
    const response = {
      id: `resp_${intelligenceId}`,
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ ...candidate, intelligence_output: intelligenceOutputs[intelligenceId] }) }] }]
    };
    assert.deepEqual(extractStructuredOutput(response, intelligenceId).intelligence_output, intelligenceOutputs[intelligenceId]);
  }
});

test("Intelligence output contracts cannot be substituted and Origin cannot exercise commit authority", () => {
  const communicatorResponse = {
    id: "resp_wrong_contract",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(candidate) }] }]
  };
  assert.throws(() => extractStructuredOutput(communicatorResponse, "communicator"), /model_intelligence_output_fields_mismatch/);
  const originResponse = {
    id: "resp_origin_authority",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
      ...candidate,
      intelligence_output: { ...intelligenceOutputs.origin, commit_authority_exercised: true }
    }) }] }]
  };
  assert.throws(() => extractStructuredOutput(originResponse, "origin"), /model_origin_authority_violation/);
});

test("NEXUS evidence must prove the pinned clean non-model boundary", () => {
  assert.equal(validateNexusHealth({ ready: true, nexus_commit: NEXUS_COMMIT, source_clean: true, anthropic_enabled: false }).ready, true);
  assert.throws(() => validateNexusHealth({ ready: true, nexus_commit: "wrong", source_clean: true, anthropic_enabled: false }), /commit_mismatch/);
  assert.equal(validateNexusResult(nexusResult).normalized.verdict, "pass");
});

test("normalized result preserves interface objects and never grants release eligibility", async () => {
  const result = buildNormalizedResult({
    runId: "33333333-3333-4333-8333-333333333333",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    userId: "44444444-4444-4444-8444-444444444444",
    intelligenceId: "mediator",
    inputText: "Evaluate this bounded, non-sensitive test object.",
    inputSha256: await sha256("Evaluate this bounded, non-sensitive test object."),
    modelResponseId: "resp_test",
    modelOutputSha256: await sha256(candidate),
    modelCandidate: candidate,
    nexusResult,
    nexusEvidenceSha256: await sha256(nexusResult),
    traceEvents: [{ sequence: 1, event_type: "run_accepted" }]
  });
  for (const key of ["ScenarioInput", "GateResult", "Verdict", "EvidenceRequirement", "ArtifactReference", "ReleaseEligibility", "TraceEvent", "HandoffReceipt"]) {
    assert.ok(Object.hasOwn(result, key), `missing ${key}`);
  }
  assert.equal(result.ReleaseEligibility.eligible, false);
  assert.equal(result.HandoffReceipt.external_release_action_performed, false);
  assert.equal(result.HandoffReceipt.production_ledger_claim, false);
  assert.equal(result.ScenarioInput.external_processing_consent, true);
  assert.equal(result.Verdict.status, "pass");
  assert.equal(result.IntelligenceInvocation.intelligence_id, "mediator");
  assert.equal(MODEL_NAME, "gpt-5.6-luna");
});

test("fail and escalate dominate a passing candidate", () => {
  assert.equal(deriveVerdict(candidate, { normalized: { verdict: "escalate" } }), "escalate");
  assert.equal(deriveVerdict({ ...candidate, candidate_decision: "fail" }, nexusResult), "fail");
});
