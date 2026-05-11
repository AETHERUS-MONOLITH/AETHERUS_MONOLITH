# Track 3 Fixture Suite

## Purpose

The Track 3 fixture suite expands the single Track 3.4 local dry-run into a deterministic local suite over all current Intelligence Layer scenarios. It improves contract coverage while preserving the same object boundary: local-only, fixture-driven, non-persistent, non-ledger, non-authenticated, non-backend, non-NEXUS-integrated, non-model-executing, and not wired into the public site.

The suite does not execute Joint-Workflow, NEXUS, model calls, backend orchestration, or live governance behavior.

## Single Fixture Versus Suite Fixture

`data/interface-fixture.example.v0.json` remains the single representative example fixture derived from `happy_path_valid_release`.

`data/interface-fixtures.v0.json` is the multi-fixture suite. It reshapes each current scenario from `data/scenarios.json` into the same future Interface Layer vocabulary so local validation and dry-run reporting can cover more than one path.

## Commands

Run the single fixture dry-run:

```sh
node scripts/run-track3-local-fixture.mjs
```

Run the full fixture suite:

```sh
node scripts/run-track3-local-fixture.mjs --suite
```

## Inputs

Suite mode reads:

- `data/interface-contract.v0.json`
- `data/interface-fixtures.v0.json`
- `data/scenarios.json`
- `data/joint-workflow.manifest.json`

It also invokes:

- `scripts/validate-track3-contracts.mjs`

## Outputs

Single mode writes:

```text
.track3-runs/latest-local-fixture-report.json
```

Suite mode writes:

```text
.track3-runs/latest-local-fixture-suite-report.json
```

The `.track3-runs/` directory is ignored by git. Generated reports should remain local and should not be committed.

## What Suite Mode Validates

Suite mode validates:

- The suite file parses.
- Each fixture references an existing scenario id.
- Every existing scenario has a suite fixture.
- Each fixture contains scenario input, gate or gate-result data, verdict, decision explanation, evidence requirements, release eligibility, runtime status, and trace-event policy.
- Trace-like events are marked as local dry-run placeholders.
- Fixture boundaries state no backend, no persistence, no ledger, no NEXUS execution, no model execution, and no public operational behavior.

## What Suite Mode Does Not Prove

Suite mode does not prove:

- Backend runtime.
- Authentication.
- Database storage.
- Persistence.
- Ledger behavior.
- NEXUS execution.
- Model execution.
- Live orchestration.
- Production operation.
- Enterprise deployment.
- Operational decision-making.

The suite report is a local planning artifact, not audit evidence or a live runtime trace.

## Claim Boundary

Allowed language:

- Local fixture suite.
- Deterministic local dry-run over Track 3 fixtures.
- Contract-aligned fixture coverage.

Not allowed from this pass:

- Runtime platform.
- Persistent audit ledger.
- NEXUS-integrated system.
- Live orchestration.
- Authenticated dashboard.
- Enterprise-capable governance system.

## Next Candidate

Possible next passes, if separately authorized:

- Add fixture-generation tooling that derives suite fixtures from `data/scenarios.json` with reviewable diffs.
- Harden schema validation for the fixture suite.
- Add more scenario variants.
- Plan an optional local-only adapter design for NEXUS after separate source verification.

Any future runtime, backend, persistence, authentication, NEXUS adapter, model-call, or ledger behavior requires a separate planning and authorization step.
