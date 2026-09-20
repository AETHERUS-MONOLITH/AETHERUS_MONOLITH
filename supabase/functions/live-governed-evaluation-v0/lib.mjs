export const RUN_TYPE = "live_governed_evaluation_v0";
export const MODEL_PROVIDER = "openai";
export const MODEL_NAME = "gpt-5.6-luna";
export const NEXUS_COMMIT = "ab95cbbd24df5817c4e363d24b3b199ac8af6c6f";
export const GOVERNANCE_MANIFEST_REFERENCE = "data/joint-workflow.manifest.json";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const boundedString = (maxLength) => ({ type: "string", minLength: 1, maxLength });
const boundedStringArray = (maxItems = 8, maxLength = 500) => ({
  type: "array",
  maxItems,
  items: boundedString(maxLength)
});

export const INTELLIGENCE_CONTRACTS = Object.freeze({
  communicator: Object.freeze({
    id: "communicator",
    purpose: "Normalize raw intent into a bounded execution-plan candidate.",
    activation_condition: "A user input needs objective framing and explicit unresolved constraints before another intelligence can act.",
    accepted_input_contract: "One authenticated non-sensitive ScenarioInput text value.",
    produced_output_contract: "execution_plan with objective, activation recommendation, and constraints to resolve.",
    authority_boundary: "May frame and recommend activation; may not impose constraints, draft an artifact, issue a final verdict, commit, release, or act externally.",
    required_resources: ["ScenarioInput", "Joint Workflow communicator semantics"],
    persistence_implication: "Persist model response identity, execution-plan output hash, evidence requirements, and run trace.",
    output_name: "execution_plan",
    output_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        objective: boundedString(700),
        activation_recommendation: { type: "string", enum: ["mediator", "drafter", "refiner", "origin", "human_review"] },
        constraints_to_resolve: boundedStringArray()
      },
      required: ["objective", "activation_recommendation", "constraints_to_resolve"]
    }
  }),
  mediator: Object.freeze({
    id: "mediator",
    purpose: "Generate an enforceable constraints packet for one bounded object or action.",
    activation_condition: "A bounded input needs constraints, acceptance tests, and forbidden-pattern boundaries.",
    accepted_input_contract: "One authenticated non-sensitive ScenarioInput text value.",
    produced_output_contract: "constraints_packet with constraints, acceptance tests, and forbidden patterns.",
    authority_boundary: "May define candidate constraints; may not draft the artifact, certify compliance, commit, release, or act externally.",
    required_resources: ["ScenarioInput", "Joint Workflow mediator semantics", "available policy and forbidden-pattern references"],
    persistence_implication: "Persist model response identity, constraints-packet output hash, evidence requirements, and run trace.",
    output_name: "constraints_packet",
    output_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        constraints: boundedStringArray(),
        acceptance_tests: boundedStringArray(),
        forbidden_patterns: boundedStringArray()
      },
      required: ["constraints", "acceptance_tests", "forbidden_patterns"]
    }
  }),
  drafter: Object.freeze({
    id: "drafter",
    purpose: "Produce one bounded artifact candidate under supplied constraints.",
    activation_condition: "A complete constraints packet and explicit artifact request are present in the bounded input.",
    accepted_input_contract: "One authenticated non-sensitive ScenarioInput containing the requested artifact and its constraints.",
    produced_output_contract: "bounded_artifact with content and constraint acknowledgements.",
    authority_boundary: "May produce a candidate artifact; may not verify its own output, commit, release, or act externally.",
    required_resources: ["ScenarioInput", "explicit constraints in the input", "Joint Workflow drafter semantics"],
    persistence_implication: "Persist model response identity, bounded-artifact output hash, evidence requirements, and run trace.",
    output_name: "bounded_artifact",
    output_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        content: boundedString(5000),
        constraint_acknowledgements: boundedStringArray()
      },
      required: ["content", "constraint_acknowledgements"]
    }
  }),
  refiner: Object.freeze({
    id: "refiner",
    purpose: "Verify a supplied candidate against explicit constraints and produce a bounded patchlist.",
    activation_condition: "The input contains both a candidate artifact and the constraints or acceptance tests used to judge it.",
    accepted_input_contract: "One authenticated non-sensitive ScenarioInput containing candidate material and explicit evaluation criteria.",
    produced_output_contract: "verification with verdict, findings, and minimal patchlist.",
    authority_boundary: "May issue a pass, fail, or escalate verification candidate; may not commit, release, certify compliance, or act externally.",
    required_resources: ["ScenarioInput", "candidate artifact", "explicit constraints", "Joint Workflow refiner semantics"],
    persistence_implication: "Persist model response identity, verification output hash, evidence requirements, and run trace.",
    output_name: "verification",
    output_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        verification_verdict: { type: "string", enum: ["pass", "fail", "escalate"] },
        findings: boundedStringArray(),
        patchlist: boundedStringArray()
      },
      required: ["verification_verdict", "findings", "patchlist"]
    }
  }),
  origin: Object.freeze({
    id: "origin",
    purpose: "Prepare a lineage and delta-brief candidate after a pass-qualified verification.",
    activation_condition: "The input carries a pass-qualified verification identity and an artifact identity.",
    accepted_input_contract: "One authenticated non-sensitive ScenarioInput containing a pass verdict and artifact identity.",
    produced_output_contract: "lineage_record with precondition verdict, artifact identity, delta brief, and an always-false commit-exercised flag.",
    authority_boundary: "May prepare a lineage record only; live_governed_evaluation_v0 cannot commit, publish, release, or act externally.",
    required_resources: ["ScenarioInput", "pass-qualified verification identity", "artifact identity", "Joint Workflow origin semantics"],
    persistence_implication: "Persist model response identity, lineage-record output hash, evidence requirements, and run trace.",
    output_name: "lineage_record",
    output_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        precondition_verdict: { type: "string", enum: ["pass", "fail", "escalate"] },
        artifact_identity: boundedString(300),
        delta_brief: boundedString(1800),
        commit_authority_exercised: { type: "boolean", const: false }
      },
      required: ["precondition_verdict", "artifact_identity", "delta_brief", "commit_authority_exercised"]
    }
  })
});

export function intelligenceContractFor(intelligenceId) {
  const contract = INTELLIGENCE_CONTRACTS[intelligenceId];
  if (!contract) throw new Error("intelligence_id_invalid");
  return contract;
}
export function modelOutputFormatFor(intelligenceId) {
  const contract = intelligenceContractFor(intelligenceId);
  return {
    type: "json_schema",
    name: `aetherus_${intelligenceId}_invocation_v0`,
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: boundedString(1200),
        candidate_decision: { type: "string", enum: ["pass", "fail", "escalate"] },
        risk_level: { type: "string", enum: ["low", "moderate", "high", "critical"] },
        rationale: boundedString(1800),
        evidence_requirements: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: boundedString(240),
              rationale: boundedString(500)
            },
            required: ["label", "rationale"]
          }
        },
        intelligence_output: contract.output_schema
      },
      required: ["summary", "candidate_decision", "risk_level", "rationale", "evidence_requirements", "intelligence_output"]
    }
  };
}

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isPlainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : stableStringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validateRequestBody(body) {
  if (!isPlainObject(body)) throw new Error("invalid_request_body");
  const allowed = ["client_request_id", "data_classification", "external_processing_consent", "input_text", "intelligence_id", "workspace_id"];
  if (JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(allowed)) throw new Error("request_fields_mismatch");
  if (!UUID_PATTERN.test(String(body.client_request_id || ""))) throw new Error("invalid_client_request_id");
  if (!UUID_PATTERN.test(String(body.workspace_id || ""))) throw new Error("invalid_workspace_id");
  intelligenceContractFor(body.intelligence_id);
  if (body.data_classification !== "non_sensitive") throw new Error("non_sensitive_classification_required");
  if (body.external_processing_consent !== true) throw new Error("external_processing_consent_required");
  if (typeof body.input_text !== "string") throw new Error("invalid_input_text");
  const inputText = body.input_text.trim();
  if (inputText.length < 20 || inputText.length > 4000) throw new Error("input_length_out_of_bounds");
  return {
    client_request_id: body.client_request_id.toLowerCase(),
    workspace_id: body.workspace_id.toLowerCase(),
    intelligence_id: body.intelligence_id,
    input_text: inputText,
    data_classification: "non_sensitive",
    external_processing_consent: true
  };
}

function requireString(value, name, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) throw new Error(`model_${name}_invalid`);
  return value.trim();
}

function requireStringArray(value, name, maxItems = 8, maxLength = 500) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`model_${name}_invalid`);
  return value.map((item) => requireString(item, name, maxLength));
}

function validateIntelligenceOutput(value, intelligenceId) {
  if (!isPlainObject(value)) throw new Error("model_intelligence_output_invalid");
  const contract = intelligenceContractFor(intelligenceId);
  const expected = contract.output_schema.required.slice().sort();
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expected)) throw new Error("model_intelligence_output_fields_mismatch");
  if (intelligenceId === "communicator") {
    if (!["mediator", "drafter", "refiner", "origin", "human_review"].includes(value.activation_recommendation)) throw new Error("model_activation_recommendation_invalid");
    return {
      objective: requireString(value.objective, "objective", 700),
      activation_recommendation: value.activation_recommendation,
      constraints_to_resolve: requireStringArray(value.constraints_to_resolve, "constraints_to_resolve")
    };
  }
  if (intelligenceId === "mediator") {
    return {
      constraints: requireStringArray(value.constraints, "constraints"),
      acceptance_tests: requireStringArray(value.acceptance_tests, "acceptance_tests"),
      forbidden_patterns: requireStringArray(value.forbidden_patterns, "forbidden_patterns")
    };
  }
  if (intelligenceId === "drafter") {
    return {
      content: requireString(value.content, "content", 5000),
      constraint_acknowledgements: requireStringArray(value.constraint_acknowledgements, "constraint_acknowledgements")
    };
  }
  if (intelligenceId === "refiner") {
    if (!["pass", "fail", "escalate"].includes(value.verification_verdict)) throw new Error("model_verification_verdict_invalid");
    return {
      verification_verdict: value.verification_verdict,
      findings: requireStringArray(value.findings, "findings"),
      patchlist: requireStringArray(value.patchlist, "patchlist")
    };
  }
  if (value.commit_authority_exercised !== false) throw new Error("model_origin_authority_violation");
  if (!["pass", "fail", "escalate"].includes(value.precondition_verdict)) throw new Error("model_origin_precondition_invalid");
  return {
    precondition_verdict: value.precondition_verdict,
    artifact_identity: requireString(value.artifact_identity, "artifact_identity", 300),
    delta_brief: requireString(value.delta_brief, "delta_brief", 1800),
    commit_authority_exercised: false
  };
}

export function validateModelCandidate(candidate, intelligenceId) {
  if (!isPlainObject(candidate)) throw new Error("model_candidate_invalid");
  const requiredKeys = ["candidate_decision", "evidence_requirements", "intelligence_output", "rationale", "risk_level", "summary"];
  if (JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(requiredKeys)) throw new Error("model_candidate_fields_mismatch");
  if (!["pass", "fail", "escalate"].includes(candidate.candidate_decision)) throw new Error("model_candidate_decision_invalid");
  if (!["low", "moderate", "high", "critical"].includes(candidate.risk_level)) throw new Error("model_risk_level_invalid");
  if (!Array.isArray(candidate.evidence_requirements) || candidate.evidence_requirements.length > 8) throw new Error("model_evidence_requirements_invalid");
  const evidenceRequirements = candidate.evidence_requirements.map((requirement) => {
    if (!isPlainObject(requirement) || JSON.stringify(Object.keys(requirement).sort()) !== JSON.stringify(["label", "rationale"])) throw new Error("model_evidence_requirement_fields_invalid");
    return {
      label: requireString(requirement.label, "evidence_requirement_label", 240),
      rationale: requireString(requirement.rationale, "evidence_requirement_rationale", 500)
    };
  });
  return {
    summary: requireString(candidate.summary, "summary", 1200),
    candidate_decision: candidate.candidate_decision,
    risk_level: candidate.risk_level,
    rationale: requireString(candidate.rationale, "rationale", 1800),
    evidence_requirements: evidenceRequirements,
    intelligence_output: validateIntelligenceOutput(candidate.intelligence_output, intelligenceId)
  };
}

export function extractStructuredOutput(response, intelligenceId) {
  if (!isPlainObject(response) || typeof response.id !== "string" || !Array.isArray(response.output)) throw new Error("openai_response_shape_invalid");
  const text = response.output
    .filter((item) => isPlainObject(item) && item.type === "message")
    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
    .find((item) => isPlainObject(item) && item.type === "output_text" && typeof item.text === "string")?.text;
  if (!text) throw new Error("openai_structured_output_missing");
  try {
    return validateModelCandidate(JSON.parse(text), intelligenceId);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("openai_structured_output_invalid_json");
    throw error;
  }
}

export function validateNexusHealth(value) {
  if (!isPlainObject(value) || value.ready !== true) throw new Error("nexus_host_not_ready");
  if (value.nexus_commit !== NEXUS_COMMIT) throw new Error("nexus_commit_mismatch");
  if (value.source_clean !== true || value.anthropic_enabled !== false) throw new Error("nexus_boundary_invalid");
  return value;
}

export function validateNexusResult(value) {
  if (!isPlainObject(value) || value.schema_version !== "0.1" || value.execution_status !== "completed") throw new Error("nexus_result_invalid");
  if (!isPlainObject(value.adapter_identity) || value.adapter_identity.nexus_commit !== NEXUS_COMMIT) throw new Error("nexus_result_commit_mismatch");
  if (value.adapter_identity.anthropic_invocation !== false || value.adapter_identity.source_modified !== false) throw new Error("nexus_result_boundary_invalid");
  if (!isPlainObject(value.normalized) || !["pass", "fail", "escalate"].includes(value.normalized.verdict)) throw new Error("nexus_normalized_result_invalid");
  if (!Array.isArray(value.normalized.gate_results) || value.normalized.gate_results.length < 3) throw new Error("nexus_gate_results_invalid");
  for (const gate of value.normalized.gate_results) {
    if (!isPlainObject(gate) || typeof gate.gate_id !== "string" || !["pass", "fail", "escalate"].includes(gate.status) || typeof gate.reason !== "string") throw new Error("nexus_gate_result_invalid");
  }
  return value;
}

export function deriveVerdict(modelCandidate, nexusResult) {
  const decisions = [modelCandidate.candidate_decision, nexusResult.normalized.verdict];
  if (decisions.includes("fail")) return "fail";
  if (decisions.includes("escalate")) return "escalate";
  return "pass";
}

export function buildNormalizedResult({ runId, workspaceId, userId, intelligenceId, inputText, inputSha256, modelResponseId, modelOutputSha256, modelCandidate, nexusResult, nexusEvidenceSha256, traceEvents }) {
  const contract = intelligenceContractFor(intelligenceId);
  const verdict = deriveVerdict(modelCandidate, nexusResult);
  const gateResults = [
    { gate_id: "identity_binding", status: "pass", source: "supabase_authenticated_workspace", reason: "The authenticated user is an active member of the bound workspace." },
    { gate_id: "external_processing_authorization", status: "pass", source: "per_run_user_confirmation", reason: "The user classified this bounded input as non-sensitive and authorized OpenAI processing for this run." },
    { gate_id: "intelligence_activation", status: "pass", source: `intelligence_contract:${intelligenceId}`, reason: `Exactly one independently invokable intelligence was activated: ${intelligenceId}.` },
    { gate_id: "model_execution", status: "pass", source: `${MODEL_PROVIDER}:${MODEL_NAME}`, reason: "A structured server-side model response was received and hashed." },
    { gate_id: "nexus_source_pin", status: "pass", source: "pinned_nexus_execution_host", reason: `The execution host proved clean source at ${NEXUS_COMMIT}.` },
    ...nexusResult.normalized.gate_results.map((gate) => ({ ...gate })),
    { gate_id: "run_state_persistence", status: "pass", source: "supabase_live_governed_evaluation_runs", reason: "Run identity and execution evidence were persisted before a result was returned." }
  ];
  const evidenceRequirements = modelCandidate.evidence_requirements.map((requirement, index) => ({
    id: `model-requirement-${index + 1}`,
    label: requirement.label,
    rationale: requirement.rationale,
    evidence_present: false,
    source: `${intelligenceId}_intelligence_candidate`
  }));
  evidenceRequirements.push({
    id: "external-release-authority",
    label: "External release authority",
    rationale: "This bounded run evaluates and records a result; it cannot authorize an external release.",
    evidence_present: false,
    source: "aetherus_runtime_boundary"
  });
  return {
    schema_version: "0.1",
    run_type: RUN_TYPE,
    IntelligenceInvocation: {
      intelligence_id: intelligenceId,
      purpose: contract.purpose,
      activation_condition: contract.activation_condition,
      output_contract: contract.produced_output_contract,
      authority_boundary: contract.authority_boundary,
      independently_invokable: true,
      orchestrated_sequence_active: false
    },
    ScenarioInput: {
      run_id: runId,
      workspace_id: workspaceId,
      user_id: userId,
      intelligence_id: intelligenceId,
      input_text: inputText,
      input_sha256: inputSha256,
      data_classification: "non_sensitive",
      external_processing_consent: true,
      governance_manifest_reference: GOVERNANCE_MANIFEST_REFERENCE
    },
    GateResult: gateResults,
    Verdict: {
      status: verdict,
      source: "live_governed_evaluation_v0_policy_boundary",
      intelligence_id: intelligenceId,
      model_candidate_decision: modelCandidate.candidate_decision,
      nexus_verdict: nexusResult.normalized.verdict,
      rationale: modelCandidate.rationale
    },
    EvidenceRequirement: evidenceRequirements,
    ArtifactReference: [
      { artifact_type: "scenario_input", identity: inputSha256, storage: "live_governed_evaluation_runs.input_payload" },
      { artifact_type: `${intelligenceId}_output`, identity: modelOutputSha256, external_id: modelResponseId, storage: "live_governed_evaluation_runs.model_evidence" },
      { artifact_type: "nexus_execution", identity: nexusEvidenceSha256, storage: "live_governed_evaluation_runs.nexus_evidence" }
    ],
    ReleaseEligibility: {
      eligible: false,
      status: "blocked",
      reason: "live_governed_evaluation_v0 has no external release authority."
    },
    TraceEvent: traceEvents,
    HandoffReceipt: {
      run_id: runId,
      intelligence_id: intelligenceId,
      status: "completed",
      persisted: true,
      external_release_action_performed: false,
      production_ledger_claim: false,
      compliance_certification_claim: false
    },
    result: {
      summary: modelCandidate.summary,
      risk_level: modelCandidate.risk_level,
      decision: verdict,
      intelligence_id: intelligenceId,
      intelligence_output: modelCandidate.intelligence_output
    }
  };
}
