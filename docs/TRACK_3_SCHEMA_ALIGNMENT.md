# Track 3 Schema Alignment

## Purpose

This document explains how the current static AETHERUS MONOLITH data model aligns with the first-pass Interface Layer contract in `data/interface-contract.v0.json`.

This pass does not implement runtime behavior. It does not add backend services, authentication, persistence, API calls, model execution, live orchestration, ledger behavior, or NEXUS runtime integration.

## Current Data Sources

| Source | Current purpose | Contract relationship |
| --- | --- | --- |
| `data/scenarios.json` | Deterministic browser-side scenario fixtures for Intelligence Layer v0.1. | Current source for `Scenario`, `GateResult`, `Verdict`, `DecisionExplanation`, `EvidenceRequirement`, `ReleaseEligibility`, `TraceEvent`, and `HandoffReceipt` examples. |
| `data/joint-workflow.manifest.json` | Static Joint-Workflow-derived manifest for joints, pipelines, gates, verdicts, handoff receipt rules, event schema, templates, stack mapping, and claim boundaries. | Current source for `GovernanceManifest`, `Gate`, `RuntimeStatus`, and `JointWorkflowReference` metadata. |
| `data/docs.json` | Static artefact/evidence model for cards, detail panels, and stage-to-evidence binding. | Current source for `ArtifactReference` candidates and evidence-boundary language. |
| `data/interface-contract.v0.json` | Contract shape registry for future Interface Layer alignment. | Planning artifact only; not loaded by the public site. |
| `data/interface-fixture.example.v0.json` | Representative contract-shaped fixture derived from `happy_path_valid_release`. | Example only; not loaded by the public site. |

## Scenario Alignment

The current `data/scenarios.json` fixtures already contain the core fields needed to describe a non-operational governance trace:

- Scenario identity: `id`, `title`, `summary`, `category`.
- Source metadata: `source_document`, `source_section`, `implementation_status`, `operational_status`.
- Gate and stage focus: `stage_key`, `current_gate`, `gate_results`.
- Verdict and state: `verdict`, `state_chamber`, `release_eligibility`.
- Decision legibility: `decision_explanation`, `decisive_gate`, `active_layer_explanation`, `assertions`.
- Evidence boundaries: `operational_evidence_required`, `non_operational_boundaries`, `boundary_copy`.
- Trace-like display data: `events`, `handoff_receipts`, `static_retry_policy`.

The future `Scenario` contract should not replace the current scenarios yet. The current fixture shape is stable and drives the accepted public v0.1 interface. Track 3 alignment should remain additive until a dedicated migration pass is approved.

## Joint-Workflow Manifest Alignment

`data/joint-workflow.manifest.json` maps Joint-Workflow concepts into static Interface Layer vocabulary:

- Joints map to future actor or role references.
- Pipelines map to scenario step ordering and stage focus.
- Gates map to `Gate` and `GateResult` definitions.
- Verdicts map to terminal or branch outcomes.
- Handoff receipt contract maps to future `HandoffReceipt` schema expectations.
- Event ledger schema maps only to illustrative in-memory trace events today.
- Templates map to metadata references only; no executable prompt templates are exposed.
- Stack mapping connects Joint-Workflow concepts to the Governance Stack Cutaway.

The manifest is not an executable workflow engine. It is a static reference source for deterministic browser-side simulation and future contract alignment.

## Static Simulation Versus Executable Runtime

Current deterministic browser-side simulation:

- Loads local JSON with `fetch()`.
- Validates that required static fields exist.
- Returns a trace object selected from fixture data.
- Renders explanation, evidence gaps, gate results, receipts, and illustrative events.
- Activates related evidence through existing static stage keys.

Executable runtime would require additional implementation evidence:

- Actual input artifacts and output artifacts.
- Executable gate validators.
- Reproducible runtime logs.
- Runtime error, retry, cancellation, and escalation semantics.
- Actor identity and authority boundaries if authentication is claimed.
- Persistence and verification semantics if storage or ledger language is claimed.
- A verified NEXUS adapter if NEXUS integration is claimed.

The current public site must continue to describe the trace layer as deterministic, browser-side, scenario-driven, illustrative, prototype-facing, and non-operational.

## Field Maturity Boundaries

| Field or object family | Can be represented statically now | Requires local runtime | Requires backend persistence | Requires authentication | Requires NEXUS adapter |
| --- | --- | --- | --- | --- | --- |
| `Scenario` identity and explanatory copy | Yes | No | No | No | No |
| `ScenarioInput` as fixture reference | Yes | For real runtime inputs | If inputs are stored | If actor-bound | If sourced from NEXUS |
| `GovernanceManifest` metadata | Yes | If manifest drives executable validation | If versioned server-side | No by itself | If mapped into NEXUS |
| `Gate` definition | Yes | For executable validators | If gate evidence is stored | If actor-authorized | If NEXUS owns validation |
| `GateResult` fixture outcome | Yes | For calculated results | If persisted as trace evidence | If actor-bound | If generated by NEXUS |
| `Verdict` fixture outcome | Yes | For derived verdicts | If persisted as operational evidence | If approval identity is required | If emitted by NEXUS |
| `DecisionExplanation` | Yes | If citing runtime conditions | If citing stored evidence | If reviewer identity is included | If explaining NEXUS output |
| `EvidenceRequirement` | Yes | No | No | No | No |
| `ArtifactReference` to docs metadata | Yes | For real artifacts | For durable pointers and retention | If actor-owned | If artifacts originate in NEXUS |
| `ReleaseEligibility` fixture explanation | Yes | For calculated eligibility | If eligibility record is stored | If release authority is actor-bound | If eligibility depends on NEXUS |
| `TraceEvent` illustrative event | Yes | For local runtime events | For stored trace events | For actor attribution | If emitted by NEXUS |
| `HandoffReceipt` fixture receipt | Yes | For real handoff validation | If persisted | If signed or actor-bound | If handoff originates in NEXUS |
| `RuntimeStatus` | Yes | Yes | Yes | Yes | Yes |

## Public Claim-Language Triggers

The following implementation evidence would be required before public wording can change:

- `local_runtime_prototype`: local executable runtime entry point, test fixtures, implemented gate validators, and no-production boundary copy.
- `nexus_adapter_local_prototype`: pinned NEXUS source, adapter mapping tests, input/output transformation evidence, and explicit non-operational status.
- `backend_trace_prototype`: backend entry point, API schema, storage design, security boundary, and no-ledger claim unless ledger semantics exist.
- `authenticated_runtime_interface`: authentication implementation, access-control model, actor identity in receipts/events, and security review.
- `enterprise_capable_governance_system`: production deployment architecture, operational controls, customer/deployment evidence if claimed, validation suite, retention model, security review, and compliance/legal review.

Without that evidence, public copy must remain within current allowed wording:

- Static governance-interface prototype.
- Deterministic browser-side simulation.
- Public seed of the AETHERUS Interface Layer.
- Claim-bounded representation of governance stack, evidence modules, and scenario-based decision explanation.

## Non-Claim Boundaries

The schema and example fixture added in Track 3.2 do not claim:

- Production SaaS.
- Deployed enterprise platform.
- Authenticated dashboard.
- Live AI execution.
- Live orchestration.
- Persistent audit ledger.
- Database-backed trace storage.
- Model API execution.
- Compliance certification.
- Customer deployment.
- Operational decision-making.

## Future Alignment Sequence

Recommended next passes, if separately authorized:

1. Add a development-only validation script that compares `data/scenarios.json` to the contract vocabulary without changing public behavior.
2. Normalize scenario fixture references into a contract-shaped companion file while preserving the accepted v0.1 UI.
3. Add JSON-schema files only after the contract vocabulary stabilizes.
4. Plan local runtime prototype boundaries before any runtime implementation.
5. Verify NEXUS MVP source and contracts before any NEXUS adapter planning moves beyond documentation.

Each pass should state whether it changes documentation, static data, public UI rendering, or runtime behavior.
