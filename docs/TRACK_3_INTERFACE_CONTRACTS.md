# Track 3 Interface Contracts

## Purpose

This document defines the first-pass contract surface for evolving AETHERUS MONOLITH from a static governance-interface prototype toward a future runtime-capable Interface Layer over Joint-Workflow execution semantics and NEXUS-style governance logic.

It is a contract-planning document only. The current repository does not implement backend runtime, authentication, database persistence, model calls, live orchestration, NEXUS execution, or an operational audit ledger.

The current static conceptual interface is an implementation boundary, not the permanent ceiling of the project. Any future runtime claim must be backed by implementation evidence before it appears in public interface copy.

## Current Interface-Layer Assets

| Asset | Current role | Static representation | Executable behavior |
| --- | --- | --- | --- |
| `index.html` | Public one-page interface, Governance Stack Cutaway, trace viewer mount, evidence and footer boundary language. | Represents stack layers, state chambers, public claim boundaries, and section hierarchy. | No runtime execution; static DOM plus client-side interaction targets. |
| `data/docs.json` | Artefact/evidence model. | Stores research artefact metadata, evidence boundaries, claim support, and pipeline-stage keys. | Loaded by `js/docs.js` for card rendering and evidence binding. |
| `data/joint-workflow.manifest.json` | Normalized Joint-Workflow-derived architecture manifest. | Stores metadata for joints, gates, verdicts, templates, stack mapping, and claim boundaries. | Validated and read by the deterministic browser engine; not an executable prompt system. |
| `data/scenarios.json` | Deterministic fixture registry. | Stores five scenario traces, assertions, decision explanations, operational evidence gaps, and non-operational boundaries. | Read by `js/governance-engine.js` to produce static trace objects. |
| `js/governance-engine.js` | Deterministic browser-side evaluator. | Encodes validation expectations for local manifests and fixtures. | Produces illustrative in-memory traces from static data only. No persistence, retry loops, model calls, or backend assumptions. |
| `js/trace-viewer.js` | Trace viewer adapter. | Renders scenario summary, verdict explanation, gate results, handoff receipts, and illustrative trace events. | Calls the deterministic engine and existing evidence-binding API. |
| `js/docs.js` | Artefact renderer and evidence API. | Maps artefact metadata to cards, detail panels, and related-evidence lists. | Provides `window.AetherusEvidence` for static stage-to-evidence binding. |
| `js/pipeline.js` | Stack and stage interaction adapter. | Maps visible stage controls to related evidence and explanatory active states. | Provides `window.AetherusPipeline.showRelatedByStage()` for static UI coordination. |
| `README.md` | Repository-level current-state documentation. | Describes static status, claim boundaries, file responsibilities, and verification checks. | Documentation only. |

## Interface Contract Objects

These objects are the first contract vocabulary for future work. They should be treated as boundary objects between public interface state, deterministic fixtures, possible local runtime prototypes, and any later backend/runtime adapter.

| Object | Purpose | Current repository source | Current status | Future contract note |
| --- | --- | --- | --- | --- |
| `Scenario` | Named fixture or future run descriptor used to explain a governance path. | `data/scenarios.json` | `deterministic_static_simulation` | May later reference a runtime invocation, but must retain explicit object status. |
| `ScenarioInput` | Bounded input frame for a scenario or future run. | Implied by scenario `events`, `payload_ref`, and manifest pipeline steps. | Currently simulated | Must distinguish user intent, `JobTicketReference`, `constraints_packet`, and model/API boundary material. |
| `GovernanceManifest` | Versioned registry of joints, gates, verdicts, stack mapping, and claim boundaries. | `data/joint-workflow.manifest.json` | Currently static | May become schema-governed reference data; not a runtime engine by itself. |
| `Gate` | Named decision boundary with source, purpose, status, and stage mapping. | Manifest `gates` | Currently static | A future executable gate requires implemented validator code, inputs, failure semantics, and test evidence. |
| `GateResult` | Outcome of a gate for one scenario or run. | Scenario `gate_results` | Currently simulated | Future runtime results must include validator version, input reference, output reference, and reproducibility metadata. |
| `Verdict` | Terminal or intermediate decision status such as pass, fail, escalate, or cache hit. | Scenario `verdict`; manifest `verdicts` | Currently simulated | Future verdicts must be tied to gate results and source artifacts, not UI-only labels. |
| `DecisionExplanation` | Human-readable account of why a verdict occurred. | Scenario `decision_explanation` | Currently static | Future explanations must cite decisive conditions and references without inventing unstored evidence. |
| `EvidenceRequirement` | Missing requirement needed before a trace can become operational evidence. | Scenario `operational_evidence_required` | Currently static | May later become checklist/schema items, but still cannot imply completion unless verified. |
| `ArtifactReference` | Pointer to a supporting artefact, schema, patchlist, origin commit, or evidence module. | `data/docs.json`; scenario `payload_ref` | Currently static and simulated | Runtime references require addressable artifacts, integrity semantics, and retention rules. |
| `ReleaseEligibility` | Explanation of whether a scenario is eligible to proceed toward release. | Scenario `release_eligibility` | Currently simulated | Future eligibility must be derived from executable gates, receipts, and trace evidence. |
| `TraceEvent` | Event-like representation of a scenario step. | Scenario `events`; engine-normalized `traceEvents` | Illustrative in-memory trace event | Not a ledger record unless persistence, append-only, hash-chain, and verification semantics exist. |
| `HandoffReceipt` | Validation record for material passed between joints. | Scenario `handoff_receipts`; manifest `handoff_receipt_contract` | Currently simulated | Future receipts require concrete inputs, validator status, missing-field semantics, actor identity, and timestamping policy. |
| `JobTicketReference` | Reference to a normalized job-ticket payload or fixture boundary. | Manifest pipeline steps; scenario payload references | Currently simulated | Future contract must define canonical format, adapter boundary, validation rules, and failure handling. |
| `RuntimeStatus` | Explicit maturity and operational-status label for a view, trace, or artifact. | `implementation_status`, `operational_status`, README boundary language | Currently static | Must gate public wording and prevent simulated objects from being presented as operational. |

## Joint-Workflow Mapping

The current site uses Joint-Workflow as an execution-semantics reference. It does not execute Joint-Workflow.

| Joint-Workflow component | Interface Layer object(s) | Current mapping status | Future executable candidate |
| --- | --- | --- | --- |
| Orchestrator | `GovernanceManifest`, `ScenarioInput`, `TraceEvent`, `RuntimeStatus` | Currently static in manifest and simulated in scenario events. | Candidate for local runtime coordination only after invocation boundaries and authority semantics are implemented. |
| Communicator | `GateResult`, `HandoffReceipt`, `JobTicketReference` | Currently static/simulated through manifest joint metadata and scenario receipts. | Candidate after execution-plan schema and adapter validation are implemented. |
| Mediator | `EvidenceRequirement`, `HandoffReceipt`, `ArtifactReference` | Currently static/simulated through constraints and receipt fields. | Candidate after constraints-packet validation and testable missing-input semantics exist. |
| Drafter | `ArtifactReference`, `TraceEvent`, `GateResult` | Currently static/simulated as fixture output references. | Candidate only with bounded generation or deterministic fixture output and explicit model/API boundary documentation. |
| Refiner | `Verdict`, `GateResult`, `DecisionExplanation` | Currently simulated through static verdict, safety, and schema fixture results. | Candidate after executable validators, forbidden-pattern checks, and reproducible patchlist semantics exist. |
| Origin | `ReleaseEligibility`, `ArtifactReference`, `HandoffReceipt` | Currently simulated through release eligibility and origin receipt fixtures. | Candidate after origin commit rules, no-mutating-commit semantics, and artifact-retention boundaries exist. |
| `JobTicket` | `ScenarioInput`, `JobTicketReference`, `GateResult` | Currently simulated by fixture payload references and manifest metadata. | Candidate after canonical schema, adapter input/output tests, and validation failure cases are present. |
| `constraints_packet` | `ScenarioInput`, `EvidenceRequirement`, `HandoffReceipt` | Currently simulated through missing-constraints and valid-release scenarios. | Candidate after schema, validator behavior, and handoff receipt enforcement are implemented. |
| `patchlist` | `ArtifactReference`, `Verdict`, `HandoffReceipt` | Not implemented as an artifact; referenced in scenarios and manifest. | Candidate after patchlist schema, diff semantics, and refiner output validation are present. |
| `origin_commit` | `ArtifactReference`, `ReleaseEligibility`, `TraceEvent` | Not implemented as a commit artifact; referenced in scenarios and manifest. | Candidate after commit contract, immutability policy, and reproducible output references exist. |
| `handoff_receipt` | `HandoffReceipt`, `GateResult` | Currently simulated in `data/scenarios.json`. | Candidate after receipt schema validation and actor/source identity are implemented. |
| `event_ledger` | `TraceEvent`, `RuntimeStatus` | Currently simulated as illustrative in-memory trace events. | Candidate only after ledger semantics exist; see Trace and Ledger Boundary. |
| Adapter boundary | `ScenarioInput`, `JobTicketReference`, `Gate`, `GateResult` | Currently simulated through `G1A` and adapter-failure scenario data. | Candidate after canonical adapter inputs, outputs, parser errors, and normalization tests are implemented. |
| Idempotency gate | `Gate`, `GateResult`, `Verdict`, `TraceEvent` | Currently simulated through `G_IDEMPOTENCY` manifest metadata and cache-hit fixture behavior. | Candidate after input/session-state fingerprints, cache-reference rules, and replay prevention semantics exist. |
| Forbidden pattern policy | `Gate`, `GateResult`, `Verdict`, `DecisionExplanation` | Currently simulated through `VAL-SAFE-001`, GF-pattern metadata, and critical safety fixture data. | Candidate after executable policy checks, severity rules, and non-excludable critical pattern enforcement are implemented. |
| Terminal verdict model | `Verdict`, `ReleaseEligibility`, `RuntimeStatus` | Currently simulated through pass, fail, escalate, and cache-hit scenario outcomes. | Candidate after verdicts are derived from executable gate and receipt evidence rather than fixture selection. |

## NEXUS Integration Boundary

NEXUS MVP is not currently assumed to be integrated into this repository. The public website does not run NEXUS, does not call a NEXUS adapter, and does not present NEXUS execution as implemented behavior.

A future NEXUS adapter would be a boundary layer that translates between AETHERUS Interface Layer contract objects and verified NEXUS runtime inputs, outputs, verdicts, and trace events. That adapter is only a future concept in this document.

Before any integration work, the following information must be verified from the NEXUS MVP repository or source package:

- Repository location, authoritative branch, and pinned commit or release.
- Runtime entry points and supported execution modes.
- Input and output data contracts.
- Whether a `JobTicket`, `constraints_packet`, patchlist, verdict, or receipt equivalent exists.
- Error, retry, cancellation, and escalation semantics.
- Event, log, trace, or ledger-like output format.
- Persistence model, if any, including update/delete behavior.
- Authentication, actor identity, and authorization boundaries, if any.
- Model/API call boundaries and how model output is distinguished from deterministic runtime output.
- Security assumptions, dependency footprint, and test fixtures.
- License and redistribution constraints.
- Existing evidence that the runtime behavior matches the contract labels the public site might use.

No public interface wording should imply NEXUS integration until those facts are verified and implementation evidence exists in this repository.

## Runtime Maturity Stages

These labels define the minimum evidence required before the public site may use stronger language.

| Status label | Meaning | Evidence required before public use |
| --- | --- | --- |
| `static_interface_seed` | Static public interface representing governance concepts and evidence modules. | Static files, claim-boundary copy, and documented non-operational status. This is already present. |
| `deterministic_static_simulation` | Browser-side fixture evaluation using local JSON and pure deterministic JavaScript. | Local manifest, scenarios, deterministic engine, syntax/JSON checks, browser verification, and no runtime/deployment claims. This is already present. |
| `local_runtime_prototype` | Local-only executable prototype that processes contract objects without backend persistence or public operational claims. | Local runtime entry point, schemas, test fixtures, executable gate results, clear no-production boundary, and documented setup. |
| `nexus_adapter_local_prototype` | Local adapter between AETHERUS contract objects and verified NEXUS MVP semantics. | Pinned NEXUS source, adapter contract, transformation tests, failure tests, and explicit statement that it is local/non-operational. |
| `backend_trace_prototype` | Backend prototype that can receive or produce trace events. | Backend entry point, API schema, storage design, security boundary, test logs, and public wording that avoids operational ledger claims. |
| `authenticated_runtime_interface` | Interface with actor identity and authenticated workflow controls. | Auth implementation, access-control model, actor identity in receipts/events, security review, and audit of public claims. |
| `enterprise_capable_governance_system` | Integrated system with runtime governance, persistence, verification, security, and deployment evidence. | Production architecture, operational controls, customer/deployment evidence if claimed, independent security review, validation test suite, retention model, incident process, and legal/compliance review for any compliance language. |

## Trace and Ledger Boundary

`trace_event` currently means an illustrative in-memory browser artifact generated from deterministic scenario fixtures. It is not a persistent record, audit artifact, or ledger entry.

The word `ledger` is not permitted for public runtime claims until all of the following exist and are verified:

- Append-only write semantics.
- Hash-chain or equivalent tamper-evidence.
- No-update and no-delete behavior for committed events.
- Artifact-pointer semantics that bind events to stored inputs, outputs, receipts, or patches.
- Verification tooling or documented verification procedure.
- Storage, retention, and recovery model.
- Actor identity and source attribution.
- Failure and replay semantics.

Until those requirements are implemented, acceptable terms are `illustrative trace event`, `in-memory trace`, `static trace fixture`, or `prototype trace explanation`.

## Public Claim Discipline

Current allowed wording:

- Static governance-interface prototype.
- Deterministic browser-side simulation.
- Public seed of the AETHERUS Interface Layer.
- Claim-bounded representation of governance stack, evidence modules, and scenario-based decision explanation.

Current forbidden wording:

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

Public copy may discuss future architecture as future architecture only. It must not imply current implementation, current deployment, or current operational authority.

## Next Implementation Candidate

The recommended next technical pass is contract-aligned fixture/schema preparation:

- Define JSON-schema-style shapes for `Scenario`, `ScenarioInput`, `Gate`, `GateResult`, `Verdict`, `HandoffReceipt`, `TraceEvent`, `ArtifactReference`, and `RuntimeStatus`.
- Align existing `data/scenarios.json` and `data/joint-workflow.manifest.json` fields to those documented shapes without changing behavior.
- Add validation documentation or a local validation script only if it remains static and development-facing.
- Keep public wording explicit that these are schemas and fixtures, not backend runtime or operational controls.

Out of scope for the next pass unless separately authorized:

- Backend service.
- Authentication.
- Persistence or database writes.
- Model calls.
- Live orchestration.
- NEXUS adapter execution.
- Public dashboard/product language.

## Verification Checklist

Future Codex passes should complete this checklist before implementation work:

- Confirm current branch, HEAD commit, `origin/main` relationship, and working tree status.
- List every affected file before editing.
- State whether the pass changes documentation only, static data only, UI rendering, or runtime behavior.
- Confirm whether public claim language changes.
- Confirm whether any new capability is documented only or actually implemented.
- Confirm whether any new wording implies backend, auth, persistence, model execution, telemetry, NEXUS integration, compliance, customer deployment, or operational decision-making.
- Run the accepted static checks when JavaScript or JSON can be affected:
  - `node --check js/app.js`
  - `node --check js/docs.js`
  - `node --check js/pipeline.js`
  - `node --check js/governance-engine.js`
  - `node --check js/trace-viewer.js`
  - Parse `data/docs.json`
  - Parse `data/joint-workflow.manifest.json`
  - Parse `data/scenarios.json`
  - `git diff --check`
- Browser-check the public interface when HTML, CSS, or JavaScript behavior changes.
- Do not claim runtime maturity unless the implementation evidence for the relevant status label is present in the repository.
