export const palisadeBundlePath = "palisade/policy-bundle.v0";
export const palisadeManifestPath = "palisade/policy-bundle.v0/manifest.json";
export const palisadePolicyPath = "palisade/policy-bundle.v0/policies/claim-capability-policy.json";
export const palisadeInputSchemaPath = "palisade/policy-bundle.v0/schema/policy-input.schema.json";
export const palisadeDecisionSchemaPath = "palisade/policy-bundle.v0/schema/policy-decision.schema.json";

export const allowedPalisadeDecisions = new Set([
  "allow",
  "deny",
  "requires_evidence",
  "requires_operator_review",
  "runtime_enforcement_unavailable"
]);

export const allowedRuntimeStatuses = new Set(["available", "unavailable", "not_applicable"]);

export function componentState(state, evidence = []) {
  return { state, verified: state === "exists", evidence };
}

export function allComponentsSatisfied(state, components) {
  return components.every((component) => {
    const entry = state[component];
    return entry && entry.state === "exists" && entry.verified === true;
  });
}

export function missingComponents(state, components) {
  return components.filter((component) => {
    const entry = state[component];
    return !entry || entry.state !== "exists" || entry.verified !== true;
  });
}

export function buildCurrentProductionWorkspaceState(policy) {
  const required = policy.production_workspace_threshold.required_components;
  const componentEvidence = {
    real_authenticated_shell: {
      state: "partial",
      evidence: [
        "data/direct-ui-membrane-live-provider-loop-verification.v0.json",
        "data/direct-ui-membrane-auth-storage-implementation.v0.json"
      ]
    },
    applied_live_workspace_data_model: {
      state: "partial",
      evidence: [
        "data/direct-ui-membrane-protected-workspace-persistence.v0.json",
        "supabase/migrations/20260619_0001_tenant_workspace_substrate.sql"
      ]
    },
    server_side_authorization: {
      state: "partial",
      evidence: [
        "data/direct-ui-membrane-protected-workspace-persistence.v0.json",
        "docs/OPTION_E_0_6_DATABASE_RLS_POLICY_PLANNING_BASELINE.md"
      ]
    },
    tenant_scoped_persistence: {
      state: "partial",
      evidence: [
        "data/direct-ui-membrane-protected-workspace-persistence.v0.json",
        "data/direct-ui-membrane-auth-route-callback-contract.v0.json"
      ]
    },
    verified_membership_account_separation: {
      state: "partial",
      evidence: ["data/direct-ui-membrane-protected-workspace-persistence.v0.json"]
    },
    operational_workspace_surfaces_backed_by_capability: {
      state: "partial",
      evidence: [
        "protected-shell.html",
        "data/direct-ui-membrane-protected-workspace-persistence.v0.json"
      ]
    },
    durable_evidence_audit_trail: {
      state: "partial",
      evidence: [
        "data/operational-evidence-packet-contract.v0.json",
        "data/product-negative-space-backlog.v0.json"
      ]
    },
    runtime_governance_path_for_real_user_workspace_input: {
      state: "absent",
      evidence: [
        "palisade/policy-bundle.v0/integration-readiness.v0.json",
        "data/public-surface-execution-audit.v0.json"
      ]
    }
  };

  return Object.fromEntries(
    required.map((component) => {
      const evidence = componentEvidence[component] || { state: "absent", evidence: [] };
      return [component, componentState(evidence.state, evidence.evidence)];
    })
  );
}

export function buildCurrentRuntimeGovernancePathState(policy) {
  const components = policy.runtime_governance_path.ordered_components;
  const stateByComponent = {
    user_workspace_input: componentState("partial", [
      "README.md",
      "data/direct-ui-membrane-live-provider-loop-verification.v0.json",
      "data/direct-ui-membrane-protected-workspace-persistence.v0.json"
    ]),
    Facade: componentState("exists", [
      "index.html",
      "README.md",
      "scripts/validate-product-language-boundary.mjs"
    ]),
    Conduit: componentState("partial", [
      "data/conduit-versioning-policy.v1.json",
      "data/track3-local-report-export-manifest.v1.json"
    ]),
    Palisade_policy_decision: componentState("exists", [
      "palisade/policy-bundle.v0/policies/claim-capability-policy.json",
      "scripts/validate-palisade-policy-bundle.mjs"
    ]),
    Vault_NEXUS_evaluation: componentState("stubbed", [
      "data/nexus-adapter-readiness.v0.json",
      "data/nexus-vault-compatibility-evidence-packet-contract.v1.json",
      "data/nexus-vault-compatibility-pipeline-fixtures.v1.json"
    ]),
    evidence_audit_record: componentState("partial", [
      "data/operational-evidence-packet-contract.v0.json",
      "data/product-negative-space-backlog.v0.json"
    ]),
    release_state_decision: componentState("absent", [
      "data/operational-evidence-packet-contract.v0.json"
    ]),
    surfaced_result: componentState("partial", [
      "README.md",
      "index.html",
      "data/docs.json"
    ])
  };
  return Object.fromEntries(components.map((component) => [component, stateByComponent[component] || componentState("absent")]));
}

export function buildPolicyInput(mapping, policy, options = {}) {
  const productionState = options.productionWorkspaceThresholdState || buildCurrentProductionWorkspaceState(policy);
  const runtimeState = options.runtimeGovernancePathState || buildCurrentRuntimeGovernancePathState(policy);
  const productionMissing = missingComponents(
    productionState,
    policy.production_workspace_threshold.required_components
  );
  const runtimeMissing = missingComponents(runtimeState, policy.runtime_governance_path.ordered_components);
  const requiredEvidence = new Set(mapping.required_evidence || []);
  const missingEvidence = new Set(mapping.missing_evidence || []);
  const deniedClaims = new Set(mapping.denied_claims || [mapping.claim_class]);

  if (mapping.palisade_claim_id === "production_workspace_claim") {
    requiredEvidence.add("production_workspace_threshold");
    productionMissing.forEach((item) => missingEvidence.add(item));
  }
  if (
    [
      "public_nexus_runtime_execution_claim",
      "model_api_execution_claim",
      "operational_release_authority_claim",
      "staged_surface_advancement",
      "runtime_governance_path_sufficiency"
    ].includes(mapping.palisade_claim_id)
  ) {
    requiredEvidence.add("runtime_governance_path");
    runtimeMissing.forEach((item) => missingEvidence.add(item));
  }
  if (mapping.palisade_claim_id === "operational_release_authority_claim") {
    requiredEvidence.add("release_authority_threshold");
    missingEvidence.add("durable_evidence_audit_trail");
    missingEvidence.add("release_state_decision");
  }
  if (mapping.palisade_claim_id === "operator_review_escalation") {
    requiredEvidence.add("operator_review");
    missingEvidence.add("operator approval record");
  }

  const repositoryStateBasis = [
    ...(options.currentRepositoryStateBasis || []),
    ...(mapping.repository_evidence_sources || [])
  ];

  return {
    surface: options.surface || "validator",
    claim_id: mapping.palisade_claim_id,
    requested_action: mapping.requested_action,
    evidence_state: {
      current_evidence: options.currentEvidence || [
        "current repository validation records",
        "Palisade policy artifact"
      ],
      missing_evidence: Array.from(missingEvidence),
      required_evidence: Array.from(requiredEvidence),
      denied_claims: Array.from(deniedClaims),
      evidence_notes: [
        options.evidenceNote || "Constructed by validator from current repository evidence.",
        "Hypothetical complete-evidence Palisade fixtures are not used as current evidence."
      ]
    },
    production_workspace_threshold_state: productionState,
    runtime_governance_path_state: runtimeState,
    operator_authorization_state: {
      status: mapping.operator_authorization_status || "not_requested",
      review_required: mapping.palisade_claim_id === "operator_review_escalation" || mapping.operator_review_required === true,
      review_reason:
        mapping.palisade_claim_id === "operator_review_escalation" || mapping.operator_review_required === true
          ? mapping.operator_review_reason || "claim-boundary threshold transition"
          : ""
    },
    current_repository_state_basis: Array.from(new Set(repositoryStateBasis))
  };
}

export function evaluatePalisadeDecision(policy, input) {
  const productionComplete = allComponentsSatisfied(
    input.production_workspace_threshold_state,
    policy.production_workspace_threshold.required_components
  );
  const runtimeComplete = allComponentsSatisfied(
    input.runtime_governance_path_state,
    policy.runtime_governance_path.ordered_components
  );
  const missingProduction = missingComponents(
    input.production_workspace_threshold_state,
    policy.production_workspace_threshold.required_components
  );
  const missingRuntime = missingComponents(
    input.runtime_governance_path_state,
    policy.runtime_governance_path.ordered_components
  );
  const reasons = [];
  let decision = "deny";
  let operatorReviewRequired = false;
  let nextThreshold = [...missingProduction, ...missingRuntime];

  const policyRule = (policy.rules || []).find((rule) => rule.claim_id === input.claim_id);

  if (input.evidence_state.denied_claims.includes("runtime_enforcement")) {
    decision = "runtime_enforcement_unavailable";
    reasons.push(policy.runtime_enforcement.current_state_basis);
    nextThreshold = ["runtime enforcement integration"];
  } else if (
    input.operator_authorization_state.review_required &&
    input.operator_authorization_state.status !== "approved"
  ) {
    decision = "requires_operator_review";
    operatorReviewRequired = true;
    reasons.push("Operator review is required by the Palisade policy rule.");
    nextThreshold = ["operator approval record"];
  } else if (input.claim_id === "production_workspace_claim") {
    if (productionComplete && runtimeComplete) {
      decision = "allow";
      reasons.push(policy.production_workspace_threshold.allow_rule);
      nextThreshold = [];
    } else {
      decision = policyRule?.incomplete_decision || "deny";
      reasons.push(policy.production_workspace_threshold.allow_rule);
    }
  } else if (
    input.claim_id === "public_nexus_runtime_execution_claim" ||
    input.claim_id === "model_api_execution_claim"
  ) {
    if (runtimeComplete) {
      decision = "allow";
      reasons.push(policy.runtime_governance_path.nexus_runtime_rule);
      nextThreshold = [];
    } else {
      decision = policyRule?.incomplete_decision || "deny";
      reasons.push(policy.runtime_governance_path.nexus_runtime_rule);
      nextThreshold = missingRuntime;
    }
  } else if (input.claim_id === "operational_release_authority_claim") {
    const releaseComplete = allComponentsSatisfied(input.runtime_governance_path_state, [
      "evidence_audit_record",
      "release_state_decision"
    ]);
    if (runtimeComplete && releaseComplete) {
      decision = "allow";
      reasons.push("Release authority threshold is complete under Palisade policy.");
      nextThreshold = [];
    } else {
      decision = policyRule?.incomplete_decision || "deny";
      reasons.push("Operational release authority requires durable evidence audit and release-state decision capability.");
      nextThreshold = missingComponents(input.runtime_governance_path_state, [
        "evidence_audit_record",
        "release_state_decision"
      ]);
    }
  } else if (input.claim_id === "staged_surface_advancement") {
    if (productionComplete && runtimeComplete) {
      decision = "allow";
      reasons.push("Surface advancement threshold is complete under Palisade policy.");
      nextThreshold = [];
    } else {
      decision = policyRule?.partial_evidence_decision || "requires_evidence";
      reasons.push("Partial evidence exists, but stronger product language requires threshold completion.");
    }
  } else if (input.claim_id === "runtime_governance_path_sufficiency") {
    if (runtimeComplete) {
      decision = "allow";
      reasons.push("Every runtime governance path component exists and is verified.");
      nextThreshold = [];
    } else {
      decision = policyRule?.incomplete_decision || "requires_evidence";
      reasons.push(policy.runtime_governance_path.sufficiency_rule.type);
      nextThreshold = missingRuntime;
    }
  } else if (input.claim_id === "operator_review_escalation") {
    decision = policyRule?.review_decision || "requires_operator_review";
    operatorReviewRequired = true;
    reasons.push("Operator review is required for structurally significant threshold transitions.");
    nextThreshold = ["operator approval record"];
  } else {
    reasons.push(`No Palisade policy rule exists for ${input.claim_id}.`);
  }

  return {
    decision,
    claim_id: input.claim_id,
    surface: input.surface,
    requested_action: input.requested_action,
    allowed: decision === "allow",
    reasons,
    required_evidence: input.evidence_state.required_evidence,
    missing_evidence: input.evidence_state.missing_evidence,
    operator_review_required: operatorReviewRequired,
    runtime_enforcement_status: decision === "allow" ? "available" : input.claim_id === "operator_review_escalation" ? "not_applicable" : "unavailable",
    current_state_basis: input.current_repository_state_basis,
    next_evidence_threshold: {
      description:
        nextThreshold.length === 0
          ? "No additional evidence required for this policy decision."
          : "Complete these current repository evidence components before public claim advancement.",
      components: nextThreshold
    }
  };
}

export function decisionShapeErrors(decision, requiredFields) {
  const errors = [];
  for (const field of requiredFields) {
    if (!(field in decision)) {
      errors.push(`Palisade decision for ${decision.claim_id || "unknown"} missing ${field}`);
    }
  }
  if (!allowedPalisadeDecisions.has(decision.decision)) {
    errors.push(`${decision.claim_id}: invalid Palisade decision ${decision.decision}`);
  }
  if (decision.allowed !== (decision.decision === "allow")) {
    errors.push(`${decision.claim_id}: allowed conflicts with decision ${decision.decision}`);
  }
  if (!Array.isArray(decision.reasons) || decision.reasons.length === 0) {
    errors.push(`${decision.claim_id}: decision reasons must be non-empty`);
  }
  if (!Array.isArray(decision.required_evidence)) {
    errors.push(`${decision.claim_id}: required_evidence must be an array`);
  }
  if (!Array.isArray(decision.missing_evidence)) {
    errors.push(`${decision.claim_id}: missing_evidence must be an array`);
  }
  if (!allowedRuntimeStatuses.has(decision.runtime_enforcement_status)) {
    errors.push(`${decision.claim_id}: invalid runtime_enforcement_status`);
  }
  if (!Array.isArray(decision.current_state_basis) || decision.current_state_basis.length === 0) {
    errors.push(`${decision.claim_id}: current_state_basis must be a non-empty array`);
  }
  return errors;
}
