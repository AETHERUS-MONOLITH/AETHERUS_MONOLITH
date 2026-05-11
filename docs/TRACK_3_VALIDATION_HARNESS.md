# Track 3 Validation Harness

## Purpose

The Track 3 validation harness checks the static Interface Layer contract and fixture-alignment files before any future runtime prototype is built. It is intended to make contract drift visible while the project remains static, browser-side, deterministic, and non-operational.

The harness does not execute Joint-Workflow. It does not execute NEXUS. It does not call models, create backend services, write databases, persist traces, authenticate users, transmit telemetry, or create ledger behavior.

## Command

Run from the repository root:

```sh
node scripts/validate-track3-contracts.mjs
```

The script uses only built-in Node modules. No package manager, build framework, or runtime service is required.

## What It Validates

The harness validates:

- JSON parse validity for all `data/*.json` files, including:
  - `data/docs.json`
  - `data/scenarios.json`
  - `data/joint-workflow.manifest.json`
  - `data/interface-contract.v0.json`
  - `data/interface-fixture.example.v0.json`
- Required top-level structure in `data/interface-contract.v0.json`.
- Required contract sections for scenario, gate, verdict, decision explanation, evidence requirement, artifact reference, release eligibility, trace event, handoff receipt, Joint-Workflow reference, and NEXUS adapter boundary.
- Field maturity labels against the approved vocabulary:
  - `current_static`
  - `current_simulated`
  - `future_local_runtime`
  - `future_backend`
  - `future_authenticated`
  - `future_nexus_adapter`
  - `not_currently_implemented`
- Alignment between the example fixture and an existing scenario id in `data/scenarios.json`.
- Full scenario-to-suite coverage in `data/interface-fixtures.v0.json`.
- Boundary language around illustrative trace events.
- Runtime boundary flags for fixture-driven local reports.
- Verdict vocabulary invariants for `pass`, `fail`, and `escalate`.
- Release eligibility coherence against gate results, evidence requirements, verdict, and decision explanation.
- Trace status invariants requiring `local_dry_run_not_persistent_not_ledger`.
- Bounded use of Joint-Workflow and NEXUS references.
- Potential unbounded operational claims in Track 3 JSON and documentation files.

## What It Does Not Validate

The harness does not validate:

- Runtime correctness.
- Backend behavior.
- Authentication or authorization.
- Database persistence.
- API behavior.
- Model-call behavior.
- NEXUS integration.
- Ledger integrity.
- Compliance status.
- Production readiness.

Passing validation means the static contract files are internally aligned enough for planning and future implementation work. It does not prove operational capability.

## Boundary Statement

The validation harness is a repository-local development check. It is not part of the public website runtime and is not loaded by `index.html`.

It does not create or prove:

- Backend runtime.
- Authentication.
- Persistence.
- Ledger behavior.
- NEXUS integration.
- Model execution.
- Live orchestration.
- Operational decision-making authority.

Future passes may expand the validator, but any runtime, backend, database, authentication, model-call, or NEXUS-adapter implementation requires a separate planning and authorization step.
