# Track 3.12 NEXUS Import Adapter Preflight

## Purpose

This document defines the gate before any local NEXUS import adapter may be attempted.

This pass does not import NEXUS, execute NEXUS, integrate NEXUS, run Python, or change public site behavior. It defines the conditions that must be true before a future pass may be authorized to call a pinned local NEXUS source from AETHERUS_MONOLITH.

## Current Readiness Summary

- NEXUS MVP was verified at commit `ab95cbbd24df5817c4e363d24b3b199ac8af6c6f`.
- Track 3.7 classified the verified surface as `import_adapter_ready`.
- AETHERUS_MONOLITH integration status remains `not_integrated`.
- The NEXUS adapter contract stub exists in `data/nexus-adapter-contract.stub.v0.json`.
- Adapter mismatch tests exist in `data/nexus-adapter-mismatch-fixtures.v0.json` and `scripts/validate-nexus-adapter-mismatches.mjs`.
- The local adapter normalizer stub exists in `scripts/run-nexus-adapter-normalizer-stub.mjs`.
- The positive/negative normalizer suite exists in `scripts/validate-nexus-adapter-normalizer-suite.mjs`.
- No NEXUS import or execution exists in AETHERUS_MONOLITH.
- No Python execution exists in AETHERUS_MONOLITH Track 3 scripts.

## Import Adapter Authorization Conditions

All conditions in this section must be true before a future pass may import and execute NEXUS locally.

### Repository Condition

- AETHERUS_MONOLITH working tree is clean.
- The accepted AETHERUS baseline is explicitly named.
- NEXUS MVP commit is pinned to the reviewed commit.
- NEXUS MVP working tree is clean, or an archived source at the exact reviewed commit is used.
- No unverified NEXUS branch or local dirty state is used for adapter execution.

### Dependency Condition

- Python version is identified.
- NEXUS requirements are identified.
- Dependency installation method is documented.
- No global dependency mutation occurs without explicit authorization.
- No hidden package installation occurs.
- No network dependency occurs during validation unless explicitly approved.

### Execution Condition

- Execution is local-only.
- No public UI wiring is added.
- No backend is added.
- No authentication is added.
- No persistence is added.
- No ledger behavior is added.
- No model calls are added.
- No API calls are added.
- No live orchestration is added.
- No production browser JavaScript changes are added.

### Adapter Contract Condition

- Adapter input maps to NEXUS query string plus regulatory context dictionary.
- NEXUS result maps back to a normalized AETHERUS result.
- Mismatch policy remains fail-closed.
- Normalizer suite passes before and after any adapter prototype.
- Release eligibility coherence is preserved.

### Boundary Condition

- Public claim language remains bounded.
- The live site does not claim NEXUS integration.
- README language is not escalated into marketing or operational claims.
- No operational decision-making claim is introduced.
- JSONL audit-log output is not represented as a ledger.

### Security Condition

- No secrets are introduced.
- No API keys are introduced.
- No user data is used.
- No external calls are made.
- No sensitive prompts are used.
- No artifact leakage occurs.
- Generated outputs remain ignored.
- Logs remain local only.

### Rollback Condition

- Adapter prototype changes are reversible.
- Existing Track 3 validators are not weakened.
- Live behavior is not modified.
- Public files are not wired to the import adapter.
- Failure leaves the repository clean or clearly revertible.

## Proposed Future Import Adapter Scope

Allowed in a later pass only if explicitly authorized:

- Create a local-only script such as `scripts/run-nexus-import-adapter-local.mjs`.
- Spawn a Python subprocess or use a documented local bridge only if explicitly authorized.
- Call pinned NEXUS source locally.
- Pass fixture-derived query/context to NEXUS.
- Normalize NEXUS output through the existing normalizer contract.
- Write generated reports to `.track3-runs/`.
- Keep generated outputs ignored.

Forbidden unless separately authorized:

- Public UI wiring.
- Backend route.
- Deployed endpoint.
- Authentication.
- Database.
- Persistence.
- Ledger claim.
- Model/API execution.
- Production runtime claim.

## Required Future Import Adapter Report Shape

A future local import adapter report must include:

- `meta`
  - `track_phase`
  - `run_mode`
  - `integration_status`
  - `nexus_execution`
  - `public_runtime`
  - `persistence`
  - `ledger`
  - `model_execution`
  - `backend`
- `source`
  - AETHERUS commit
  - NEXUS commit
  - adapter contract file
  - fixture id
- `adapter_input`
- `nexus_invocation_boundary`
- `raw_nexus_result_boundary`
- `normalized_interface_result`
- `release_eligibility`
- `trace_boundary`
- `claim_boundary`
- `failure_mode`, if any

## Required Future Validation Commands

A future import-adapter prototype must run at minimum:

- `node scripts/validate-track3-contracts.mjs`
- `node scripts/validate-nexus-adapter-mismatches.mjs`
- `node scripts/run-nexus-adapter-normalizer-stub.mjs`
- `node scripts/validate-nexus-adapter-normalizer-suite.mjs`
- `node scripts/run-track3-local-fixture.mjs`
- `node scripts/run-track3-local-fixture.mjs --suite`
- the future import adapter local runner
- JSON parse validation for `data/*.json`
- `node --check` for all JavaScript and MJS files
- `git diff --check`
- generated output ignored check
- NEXUS test command if NEXUS source is touched or revalidated

## Stop Conditions

A future import-adapter pass must abort if any of these occur:

- NEXUS commit mismatch.
- Test failures.
- Nondeterministic decision-relevant output.
- Unknown verdict or risk value.
- Missing Omega decision.
- Missing regulatory context.
- Malformed Alpha/Delta/Omega shape.
- JSONL audit output treated as ledger.
- Release eligibility true after fail/escalate.
- Public claim escalation.
- Dependency or environment uncertainty.
- Any need for backend, auth, persistence, model calls, or API calls.

## Public Claim Boundary

Allowed after Track 3.12:

- “import-adapter preflight checklist documented”
- “local NEXUS import prerequisites defined”
- “NEXUS remains external and not integrated”

Forbidden after Track 3.12:

- “AETHERUS_MONOLITH runs NEXUS”
- “NEXUS powers the public interface”
- “NEXUS-integrated system”
- “live governance kernel”
- “persistent NEXUS ledger”
- “production runtime”

## Recommended Next Pass

Recommended default: Track 3.13 dependency/environment preflight script.

A local NEXUS import adapter prototype should require separate explicit authorization. The conservative next gate is to verify local dependency and environment conditions without importing or executing NEXUS.

Track 3.13 environment preflight: see `docs/TRACK_3_IMPORT_ENVIRONMENT_PREFLIGHT.md`.

Track 3.14 source pin resolution: see `docs/TRACK_3_NEXUS_SOURCE_PIN_RESOLUTION.md`.
