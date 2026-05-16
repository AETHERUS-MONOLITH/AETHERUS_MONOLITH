# Track 3.27 Vault Candidate Intake Gate Stub

## Purpose

Track 3.27 adds a local-only Vault candidate intake gate stub.

This follows Track 3.25 and Track 3.26. Track 3.25 defined the compatibility evaluation discipline, and Track 3.26 defined the evidence packet contract. Track 3.27 connects them by checking whether a candidate packet is complete and bounded enough to proceed to compatibility evaluation.

This pass does not evaluate a real alternate Vault, import or execute alternate NEXUS/Vault sources, switch the active Vault, create runtime multi-Vault routing, or authorize public runtime behavior.

The active supported Vault remains exactly:

```text
ab95cbbd24df5817c4e363d24b3b199ac8af6c6f
```

## Committed Files

- `data/nexus-vault-candidate-intake-fixtures.v1.json`
- `scripts/run-nexus-vault-candidate-intake-gate-stub.mjs`
- `docs/TRACK_3_VAULT_CANDIDATE_INTAKE_GATE_STUB.md`

The Track 3 contract validator checks the fixture shape, required intake decisions, required fixture coverage, script boundary, documentation presence, and ignored generated-report boundary.

## Generated Report

Running the intake gate writes:

```text
.track3-runs/latest-nexus-vault-candidate-intake-gate-report.json
```

The report is ignored local evidence. It must not be committed.

## Intake Versus Compatibility Evaluation

Intake is a gate before compatibility evaluation.

The intake gate reads committed fixture packets and validates them against the Track 3.26 evidence packet contract. It decides whether a packet is missing evidence, has failed evidence, drifts from v1 semantics, violates local Conduit boundaries, has source mismatch, represents the currently supported Vault, or may proceed to compatibility evaluation.

Compatibility evaluation is a later classification step. Intake eligibility does not prove compatibility and does not accept support for a non-pinned commit.

## Intake Decisions

Allowed intake decisions are:

- `accepted_current_supported`
- `eligible_for_compatibility_evaluation`
- `blocked_missing_evidence`
- `blocked_failed_evidence`
- `blocked_semantic_drift`
- `blocked_boundary_violation`
- `blocked_source_mismatch`
- `invalid_intake_fixture`

Only the pinned Vault commit may receive `accepted_current_supported`.

A complete non-pinned candidate can at most receive `eligible_for_compatibility_evaluation`. That means the packet is ready for the compatibility harness discipline. It does not mean the candidate is supported.

## Fixture Coverage

The fixture set covers:

- current supported Vault intake,
- complete non-pinned candidate intake,
- missing packet,
- incomplete packet,
- failed deterministic identity,
- verdict semantics drift,
- release eligibility semantics drift,
- trace boundary violation,
- ledger boundary violation,
- dirty or mismatched source,
- public claim escalation.

Blocked candidates must include blocking reasons. No fixture may imply an active Vault switch, runtime multi-Vault support, alternate Vault execution, public runtime support, or committed `.track3-runs/` output.

## Future Real Multi-Vault Support

Future real multi-Vault support would require separate Operator authorization, candidate source preflight, clean source state, evidence packet validation, intake gate passage, compatibility evaluation, import-adapter regression, report validation, failure injection, deterministic identity checks, trace-boundary checks, ledger-boundary checks, claim-boundary checks, runtime routing design, public claim review, and Palisade birth requirements before public runtime wiring can be considered.

## Boundary

This is local-only Conduit governance, not production infrastructure.

It does not provide:

- public UI wiring,
- backend services or API routes,
- authentication,
- database use,
- storage or persistence,
- persistent ledger behavior,
- alternate Vault execution,
- active Vault switching,
- multi-Vault runtime support,
- Palisade implementation,
- Weave implementation,
- production runtime,
- enterprise deployment,
- customer deployment,
- certification,
- external audit.

Public runtime wiring remains unauthorized and blocked pending Palisade birth and separate Operator authorization.

Conduit fail-closed behavior remains Conduit boundary behavior. It is not Palisade work.
