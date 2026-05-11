# Track 3.8 NEXUS Adapter Contract Stub

## Purpose

This document defines a local-only adapter contract stub for a future connection between AETHERUS Interface Layer fixtures and the verified NEXUS MVP input/output surface.

This pass does not integrate NEXUS. It does not execute NEXUS. It does not change the public site, add runtime behavior, or create a public capability. It only defines boundaries, field mappings, mismatch handling, and stub objects that a future pass can test.

## Verified NEXUS Surface From Track 3.7

Track 3.7 inspected `AETHERUS-MONOLITH/nexus-mvp` at commit `ab95cbbd24df5817c4e363d24b3b199ac8af6c6f`.

Verified execution surfaces:

- Python import surfaces for `alpha_operator`, `delta_operator`, `OmegaOperator`, `ARBOverlay`, and `LEDGEROverlay`
- CLI/demo surface through `demo_runner.py`

Verified input contract:

- query string
- regulatory context dictionary

Verified output contract:

- Alpha result dictionary
- Delta result dictionary
- Omega result dictionary
- JSONL audit-log output when Omega runs

Verification results:

- NEXUS tests: `97 passed`
- Determinism proof: passed
- Demo runner: passed in `--mode nexus` with deterministic Alpha fallback

Ledger boundary:

- NEXUS JSONL output is audit-log output.
- Track 3.7 verified that hash-chaining is not implemented.
- AETHERUS must not represent that output as a persistent production ledger.

## Adapter Boundary

The future adapter boundary is:

```text
AETHERUS fixture / Interface Layer contract
  -> adapter normalization
  -> future NEXUS payload
  -> future NEXUS result
  -> normalized AETHERUS interface result
```

Current status:

- The adapter is not implemented.
- No NEXUS code is imported by AETHERUS_MONOLITH.
- No NEXUS code is executed by AETHERUS_MONOLITH.
- No public browser JavaScript calls NEXUS.
- No backend or service wrapper exists.

The stub contract lives in `data/nexus-adapter-contract.stub.v0.json`.

## Field Mapping Table

| AETHERUS object | Future adapter role | NEXUS mapping target | Status |
|---|---|---|---|
| `Scenario` | Selects a local fixture case | Query/context generation source | Stub only |
| `ScenarioInput` | Supplies normalized input frame | NEXUS query string and context dict | Stub only |
| `GovernanceManifest` | Supplies AETHERUS-side manifest reference | NEXUS risk manifest or adapter manifest mapping | Unresolved mapping |
| `Gate` | Identifies AETHERUS governance boundary | Delta hard gate or ARB reason code | Partial semantic match |
| `GateResult` | Records normalized gate outcome | Delta status, risk score, ARB level/reason | Future normalization |
| `Verdict` | AETHERUS terminal/result vocabulary | Omega decision plus Delta status | Requires mapping |
| `ReleaseEligibility` | Release/readiness explanation | Omega `release` plus gate support | Requires evidence boundary |
| `EvidenceRequirement` | Missing evidence required for higher maturity | Adapter mismatch and operational evidence gaps | Stub only |
| `TraceEvent` placeholder | Local adapter event shape | NEXUS JSONL audit-log reference or adapter-local event | Not ledger-valid |
| NEXUS query string | Native NEXUS input | `alpha_operator(query, context)` | Verified surface |
| NEXUS regulatory context dict | Native NEXUS context | Alpha context and Omega regulatory context | Verified surface |
| Alpha output | Intake/decomposition result | Cell dictionary | Verified surface |
| Delta output | Risk/gate evaluation result | Mutated Cell dictionary | Verified surface |
| Omega output | Decision result | Omega result dictionary | Verified surface |
| Audit-log output | Local NEXUS JSONL output | Bounded local reference only | Not production ledger |

## Mismatch Policy

### Unknown NEXUS Verdict

The adapter must not silently convert an unknown NEXUS decision into AETHERUS release eligibility. The local stub policy is fail-closed to an escalation-style result with a mismatch note.

### Unknown Risk Level

If a risk score, risk class, or ARB reason cannot be mapped, the adapter must mark the gate result unresolved and emit an evidence requirement for risk-classification mapping.

### Missing Omega Decision

If Omega output is absent or malformed, the adapter must return an adapter failure result. It must not produce release eligibility.

### Audit Log Present But Not Ledger-Valid

If NEXUS emits JSONL audit-log output, the adapter may reference it only as bounded local audit-log output. It must not call it a persistent ledger, immutable ledger, production ledger, or operational audit evidence.

### Missing Regulatory Context

If jurisdiction or framework context is unavailable, the adapter must reject the fixture input and report a missing-context evidence requirement.

### Missing Manifest Mapping

If the AETHERUS manifest cannot be mapped to NEXUS risk manifest expectations, the adapter must reject the fixture input and report a manifest-mapping evidence requirement.

### Unsupported Scenario Domain

If a scenario cannot be represented in the NEXUS MVP FinTech/risk-class model, the adapter must return an unsupported-domain mismatch and make no NEXUS execution claim.

### Non-Deterministic Output

If repeated local adapter runs over the same input produce mismatched normalized decision fields, validation must fail and release eligibility must not be claimed.

### NEXUS Execution Failure

If a future local adapter run fails during NEXUS execution, the output must remain a local adapter failure report. It must not be represented as public operational behavior.

### Malformed Alpha / Delta / Omega Shape

If Alpha, Delta, or Omega result structures are missing or not object-shaped, the adapter must return an adapter failure result. It must not infer a verdict from malformed structures.

## Ledger Boundary

NEXUS MVP includes JSONL audit-log output through `LEDGEROverlay`, but Track 3.7 verified that hash-chaining is not implemented.

The adapter must not represent NEXUS JSONL output as a persistent ledger unless all of the following are implemented and testable:

- append-only semantics
- hash-chain verification
- no-update/no-delete enforcement
- artifact-pointer semantics
- verification routines
- retention and storage boundary documentation

Until those conditions exist, NEXUS audit-log output may only be referenced as bounded local audit-log output.

## Joint-Workflow Boundary

This adapter contract does not execute Joint-Workflow.

It does not execute:

- Communicator
- Mediator
- Drafter
- Refiner
- Origin
- JobTicket
- `constraints_packet`
- `patchlist`
- `origin_commit`
- `event_ledger`

The contract only prepares a future mapping surface between AETHERUS fixture objects and NEXUS MVP governance-kernel inputs/outputs.

## Public Claim Boundary

Allowed after this pass:

- “NEXUS adapter contract stub documented.”
- “Future import-adapter boundary defined.”
- “NEXUS remains external and not integrated.”

Forbidden after this pass:

- “AETHERUS_MONOLITH runs NEXUS.”
- “NEXUS powers the public interface.”
- “Live governance kernel.”
- “Persistent NEXUS ledger.”
- “Production runtime.”

## Next Candidate Pass

Recommended next pass: Track 3.9 adapter mismatch tests.

This is safer than immediately executing NEXUS because it can validate mapping behavior, unsupported domains, missing context, missing manifest mapping, and verdict vocabulary boundaries without importing NEXUS code.

Track 3.9 should remain:

- local-only
- deterministic
- non-persistent
- non-ledger
- non-authenticated
- non-backend
- not public site behavior

Actual local import-adapter execution should require a separate authorization after mismatch tests are defined.

Track 3.9 follow-up: see `docs/TRACK_3_NEXUS_ADAPTER_MISMATCH_TESTS.md` for local-only mismatch fixtures and validation. Those tests preserve the same no-import and no-execution boundary.
