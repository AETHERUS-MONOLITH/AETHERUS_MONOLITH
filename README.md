# AETHERUS MONOLITH

AETHERUS MONOLITH is a static, GitHub Pages deployed, browser-side, deterministic, scenario-driven, non-persistent, claim-bounded governance product surface for an AI governance and model-behavior risk architecture. The current interface is centered on a Governance Stack Cutaway that explains how controlled LLM and agent workflow concepts can be framed through authority, evidence, risk classification, state decisions, auditability, and release eligibility.

## Current Status

This repository is a staged governance product surface.

- Static HTML/CSS/vanilla JS
- No backend
- No authentication
- No live telemetry
- No deployed enterprise platform
- No compliance certification
- Pending operational evidence before operational decision-making

The site is designed to communicate an architecture, deterministic governance interface, and evidence model. It should not be interpreted as production software, a certified control framework, proof of enterprise deployment, or proof that operational use has already been reached.

The public Facade is the static claim-bounded surface. Track 3 Conduit work remains local-only evidence and integration-contract work. The current Vault reference is the pinned NEXUS MVP source at `ab95cbbd24df5817c4e363d24b3b199ac8af6c6f`; it is not public NEXUS execution. Palisade is not instantiated, and Weave is specification only, not runnable.

## What The Interface Shows

The interface presents a governance-oriented model for controlled AI behavior concepts, including:

- Governance Stack Cutaway
- Authority boundaries
- Provenance chain
- Risk classification
- Governance gates
- Freeze / Repair / Escalate state chambers
- Audit layer
- Artifact lineage
- Release eligibility
- Research artefact evidence model

The visual system is intended to support comprehension of the architecture, not to imply live execution or operational telemetry.

## Repository Structure

- `index.html` - One-page static interface, page structure, hero, stack cutaway, lower panels, artefact section, and footer boundary language.
- `css/style.css` - Visual system, layout, responsive behavior, cutaway geometry, evidence card styling, and accessibility-oriented presentation states.
- `js/app.js` - Page initialization, reveal behavior, reduced-motion handling, navigation anchors, and static mode controls.
- `js/docs.js` - Local artefact card rendering, detail panels, evidence metadata display, graceful docs failure state, and evidence-binding API.
- `js/pipeline.js` - Stack and pipeline interaction behavior, stage-to-evidence binding, related evidence panel updates, and static explanatory state handling.
- `js/governance-engine.js` - Pure browser-side deterministic evaluator for Intelligence Layer v0 scenarios.
- `js/trace-viewer.js` - UI adapter for scenario selection and deterministic governance trace rendering.
- `js/grid.js` - Ambient grid/canvas visual behavior used as part of the static visual identity.
- `data/docs.json` - Structured local artefact metadata and explanatory content for the research evidence model.
- `data/joint-workflow.manifest.json` - Normalized Joint-Workflow-derived architecture manifest.
- `data/scenarios.json` - Deterministic scenario fixtures for governance trace scenarios.
- `docs/FACADE_REFLECTION_0_4_DIRECT_UI_MEMBRANE_VISUAL_SPEC.md` - Documentation-only visual specification for the planned Direct UI Membrane.
- `docs/FACADE_REFLECTION_0_7_DIRECT_UI_MEMBRANE_IA_SURFACE_TAXONOMY.md` - Documentation-only IA and conceptual surface taxonomy for the planned Direct UI Membrane.
- `docs/FACADE_REFLECTION_0_8_DIRECT_UI_MEMBRANE_INTERACTION_FLOW_SPEC.md` - Documentation-only conceptual interaction-flow specification for the planned Direct UI Membrane.
- `docs/FACADE_REFLECTION_0_9_DIRECT_UI_MEMBRANE_COPY_BOUNDARY_AUDIT.md` - Documentation-only copy and boundary-language audit for the planned Direct UI Membrane.
- `docs/FACADE_REFLECTION_0_10_STATIC_CONCEPT_GALLERY_DECISION.md` - Documentation-only static concept gallery public-display decision for the planned Direct UI Membrane.
- `docs/OPTION_E_0_1_BACKEND_PERSISTENCE_AUTH_ARCHITECTURE_BASELINE.md` - Documentation-only backend, persistence, auth, tenant-isolation, and security architecture-planning baseline for the planned Direct UI Membrane.
- `docs/OPTION_E_0_2_THREAT_MODEL_DATA_BOUNDARY_REGISTER.md` - Documentation-only threat model and data boundary register for future Direct UI Membrane backend, persistence, and auth planning.
- `docs/OPTION_E_0_3_BACKEND_SERVICE_TIER_DECISION_MATRIX.md` - Documentation-only backend service-tier decision matrix for future Direct UI Membrane implementation planning.
- `docs/OPTION_E_0_4_AUTH_TENANT_ISOLATION_REQUIREMENTS_MATRIX.md` - Documentation-only authentication and tenant-isolation requirements matrix for future Direct UI Membrane planning.
- `docs/OPTION_E_0_5_PERSISTENCE_AUDIT_LOG_SCHEMA_PLANNING.md` - Documentation-only persistence and audit-log schema planning baseline for future Direct UI Membrane planning.
- `docs/OPTION_E_0_6_DATABASE_RLS_POLICY_PLANNING_BASELINE.md` - Documentation-only database and Row-Level Security policy planning baseline for future Direct UI Membrane planning.
- `docs/OPTION_E_0_7_AUDIT_LOG_EVENT_CONTRACT_DRAFT.md` - Documentation-only audit-log event contract draft for future Direct UI Membrane planning.
- `docs/OPTION_E_0_8_SECRETS_KEY_MANAGEMENT_BOUNDARY_PLANNING.md` - Documentation-only secrets and key-management boundary planning for future Direct UI Membrane architecture.
- `docs/OPTION_E_0_9_BILLING_STRIPE_BOUNDARY_PLANNING.md` - Documentation-only billing and Stripe boundary planning for future Direct UI Membrane architecture.
- `docs/OPTION_E_0_10_IMPLEMENTATION_READINESS_GATE.md` - Documentation-only implementation-readiness gate for future Direct UI Membrane architecture decisions.

## Local Development

From the repository root:

```sh
cd /path/to/AETHERUS_MONOLITH
python3 -m http.server 4175
```

Then open:

```text
http://127.0.0.1:4175/
```

A local server is recommended so `data/docs.json` can be loaded through the browser fetch API.

## Evidence Model

`data/docs.json` contains structured artefact metadata used by the artefact cards, detail panels, and stack-to-evidence binding. Each artefact is expected to retain:

- `status`
- `category`
- `claim_supported`
- `evidence_type`
- `boundary`
- `related_pipeline_stage`
- `pipeline_stage_keys`
- `audience`
- `cta_label`

These fields distinguish governance architecture, trace evidence, research artefacts, methodology, and planned interface direction. They also make explicit what each artefact should not be confused with.

## Facade Reflection Documentation

Facade Reflection 0.4 documents the accepted visual direction for the planned Direct UI Membrane in `docs/FACADE_REFLECTION_0_4_DIRECT_UI_MEMBRANE_VISUAL_SPEC.md`.

Facade Reflection 0.7 documents the IA and conceptual surface taxonomy for the same planned membrane in `docs/FACADE_REFLECTION_0_7_DIRECT_UI_MEMBRANE_IA_SURFACE_TAXONOMY.md`.

Facade Reflection 0.8 documents conceptual reviewer journeys and non-operational flow boundaries in `docs/FACADE_REFLECTION_0_8_DIRECT_UI_MEMBRANE_INTERACTION_FLOW_SPEC.md`.

Facade Reflection 0.9 audits accumulated §1.2-facing copy and boundary language in `docs/FACADE_REFLECTION_0_9_DIRECT_UI_MEMBRANE_COPY_BOUNDARY_AUDIT.md`.

Facade Reflection 0.10 records the static concept gallery public-display decision and required non-operational framing in `docs/FACADE_REFLECTION_0_10_STATIC_CONCEPT_GALLERY_DECISION.md`.

Option E 0.1 records the backend, persistence, auth, tenant-isolation, and security architecture-planning baseline required before any future §1.2 implementation work in `docs/OPTION_E_0_1_BACKEND_PERSISTENCE_AUTH_ARCHITECTURE_BASELINE.md`.

Option E 0.2 records the threat model and data boundary register that future backend, persistence, auth, tenant-isolation, audit, billing, Palisade, Weave, and NEXUS runtime decisions must respect in `docs/OPTION_E_0_2_THREAT_MODEL_DATA_BOUNDARY_REGISTER.md`.

Option E 0.3 records a backend service-tier decision matrix and recommends a hybrid managed-data plus explicit service-tier planning direction in `docs/OPTION_E_0_3_BACKEND_SERVICE_TIER_DECISION_MATRIX.md`.

Option E 0.4 records authentication, MFA, session, RBAC, tenant identifier, tenant scoping, RLS, and cross-tenant isolation requirements in `docs/OPTION_E_0_4_AUTH_TENANT_ISOLATION_REQUIREMENTS_MATRIX.md`.

Option E 0.5 records persistence domains, audit-log separation, trace-record boundaries, retention/deletion/export planning, and future ledger boundaries in `docs/OPTION_E_0_5_PERSISTENCE_AUDIT_LOG_SCHEMA_PLANNING.md`.

Option E 0.6 records database posture, tenant-scoped table-family planning, RLS policy principles, tenant context propagation, query safety, and database/RLS failure modes in `docs/OPTION_E_0_6_DATABASE_RLS_POLICY_PLANNING_BASELINE.md`.

Option E 0.7 records a planning-only audit-log event contract draft and future event taxonomy in `docs/OPTION_E_0_7_AUDIT_LOG_EVENT_CONTRACT_DRAFT.md`.

Option E 0.8 records secrets classes, key-management principles, tenant-aware key planning, and secret lifecycle boundaries in `docs/OPTION_E_0_8_SECRETS_KEY_MANAGEMENT_BOUNDARY_PLANNING.md`.

Option E 0.9 records billing and Stripe boundary assumptions, future billing data classes, webhook boundaries, tenant/billing relationships, and rejected billing patterns in `docs/OPTION_E_0_9_BILLING_STRIPE_BOUNDARY_PLANNING.md`.

Option E 0.10 records the implementation-readiness gate and concludes that §1.2 is not yet implementation-ready in `docs/OPTION_E_0_10_IMPLEMENTATION_READINESS_GATE.md`.

These specifications are staged construction records, documentation-only, and pending operational attachment. They are not an implemented authenticated surface and do not add §1.2 runtime UI behavior, public NEXUS execution, Palisade, Weave, backend routes, auth, database behavior, persistence, tenant infrastructure, or billing. They carry the same explicit runtime boundary: no live AI execution, no customer data, no production deployment, no operational release authority, and no compliance certification.

AETHERUS_MONOLITH / §1.1 remains the instantiated static public artifact. The §1.2 Direct UI Membrane remains planned and specified only until a separate authorized implementation pass exists.

## AETHERUS Intelligence Layer v0

AETHERUS Intelligence Layer v0 is a deterministic browser-side governance trace surface derived from the Joint-Workflow architecture.

It loads a static manifest and static scenario fixtures, evaluates bounded rule-based gates, activates the Governance Stack Cutaway, and renders deterministic in-memory trace events. The layer is designed to demonstrate how authority, provenance, risk classification, governance gates, state chambers, audit traceability, artifact lineage, and release eligibility can be represented in a deterministic governance interface.

It does not execute AI, call models, persist data, authenticate users, transmit telemetry, operate a production audit ledger, or perform live orchestration.

### Intelligence Layer Files

- `data/joint-workflow.manifest.json` - Normalized Joint-Workflow-derived architecture manifest.
- `data/scenarios.json` - Deterministic scenario fixtures.
- `js/governance-engine.js` - Pure browser-side deterministic evaluator.
- `js/trace-viewer.js` - UI adapter for scenario selection and trace rendering.

### Intelligence Layer Boundary

The trace layer is deterministic and scenario-facing. Generated trace events are in-memory browser artifacts, not persistent ledger records or operational audit evidence.

### Intelligence Layer v0.1

Intelligence Layer v0.1 adds decision-legibility explanations to the deterministic scenarios. Each scenario can describe why a verdict was produced, which gate was decisive, which stack layer is active, what operational evidence would be required, and what remains non-operational.

v0.1 remains static, browser-side, deterministic, scenario-facing, and pending operational attachment. It does not add backend logic, authentication, persistence, model calls, telemetry, live orchestration, or operational audit evidence.

## Claim Boundaries

This project does not claim to be:

- A production SaaS platform
- Deployed enterprise software
- A certified compliance product
- A live audit ledger
- An authenticated dashboard
- Customer-validated deployment proof

All governance, pipeline, audit, and release concepts shown in the interface are staged product-surface representations unless explicitly documented otherwise.

## Recommended Use

This repository is intended for:

- Research presentation
- Governance architecture communication
- Model-behavior risk framing
- Artefact/evidence navigation
- Product-surface and construction-threshold discussion

Operational use is a legitimate future threshold event only after runtime, evidence, audit, auth, and release-authority requirements are implemented and validated. This repository must not be used as the basis for operational decision-making or production governance enforcement until that threshold is reached.

## Verification

The current accepted verification checks are:

```sh
node --check js/app.js
node --check js/docs.js
node --check js/pipeline.js
node --check js/governance-engine.js
node --check js/trace-viewer.js
node --check scripts/validate-product-language-boundary.mjs
node scripts/validate-product-language-boundary.mjs
node -e 'JSON.parse(require("fs").readFileSync("data/docs.json","utf8")); console.log("data/docs.json parses")'
node -e 'JSON.parse(require("fs").readFileSync("data/joint-workflow.manifest.json","utf8")); console.log("data/joint-workflow.manifest.json parses")'
node -e 'JSON.parse(require("fs").readFileSync("data/scenarios.json","utf8")); console.log("data/scenarios.json parses")'
node -e 'JSON.parse(require("fs").readFileSync("data/product-negative-space-backlog.v0.json","utf8")); console.log("data/product-negative-space-backlog.v0.json parses")'
git diff --check
```

These checks validate JavaScript syntax, product-language boundary discipline, local evidence and scenario metadata parseability, negative-space backlog parseability, and diff whitespace integrity. Browser review should also confirm that the Governance Stack Cutaway, Intelligence Layer scenarios, evidence binding, artefact cards, detail panels, and responsive layouts render without console errors.
