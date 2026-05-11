# Track 3.9 NEXUS Adapter Mismatch Tests

## Purpose

This pass adds local-only mismatch tests for the NEXUS adapter contract stub.

It does not import NEXUS. It does not execute NEXUS. It does not change public site behavior or create any public capability. The tests exercise contract-level failure modes before any real import adapter is attempted.

## Relationship To Track 3.8

Track 3.8 defined the NEXUS adapter contract stub and its `mismatch_policy` in `data/nexus-adapter-contract.stub.v0.json`.

Track 3.9 turns that mismatch policy into fixture-backed validation:

- fixture data: `data/nexus-adapter-mismatch-fixtures.v0.json`
- validator: `scripts/validate-nexus-adapter-mismatches.mjs`

## Mismatch Categories Covered

- `unknown_nexus_verdict`
- `unknown_risk_level`
- `missing_omega_decision`
- `audit_log_present_but_not_ledger_valid`
- `missing_regulatory_context`
- `missing_manifest_mapping`
- `unsupported_scenario_domain`
- `non_deterministic_output`
- `nexus_execution_failure`
- `malformed_alpha_delta_omega_shape`

## Expected Fail-Safe Behavior

- Unknown verdict normalizes to `escalate`.
- Unknown risk normalizes to `escalate` or an equivalent explicit fail-safe.
- Missing Omega decision normalizes to `escalate`.
- Audit-log output that is not ledger-valid must not produce a ledger claim.
- Missing context, missing manifest mapping, or unsupported domain blocks normalization and normalizes to `escalate`.
- Nondeterministic output normalizes to `escalate` and must not be treated as stable release.
- Simulated execution failure normalizes to `escalate`.
- Malformed Alpha/Delta/Omega shape normalizes to `escalate`.

All mismatch fixtures must block release eligibility.

## Command

```bash
node scripts/validate-nexus-adapter-mismatches.mjs
```

The broader Track 3 validator also parses the mismatch fixtures and invokes the mismatch validator.

## What This Proves

This proves that:

- adapter mismatch policy is locally testable,
- future adapter work must fail closed on unknown, missing, malformed, or nondeterministic outputs,
- mismatch fixtures preserve non-integration boundaries,
- trace boundaries remain non-persistent and non-ledger,
- release eligibility is blocked for mismatch cases.

## What This Does Not Prove

This does not prove:

- NEXUS integration,
- live NEXUS execution,
- backend behavior,
- persistence,
- ledger behavior,
- authentication,
- model execution,
- production runtime.

## Next Candidate Pass

Recommended next pass: Track 3.10 local adapter normalizer stub without NEXUS import.

That pass can implement deterministic normalization over the mismatch fixtures while still avoiding actual NEXUS imports or runtime execution.
