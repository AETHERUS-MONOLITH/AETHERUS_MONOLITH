# Track 3.31 Vault Compatibility Pipeline Failure-Injection Report Contract

## Purpose

Track 3.31 adds a committed report contract and validator for the Track 3.30 Vault compatibility pipeline failure-injection report.

This follows Track 3.30. The failure-injection suite already injects invalid compatibility pipeline and report states. Track 3.31 freezes the generated report shape and adds a validator for injection categories, expected and actual outcomes, fail-closed semantics, blocking reason semantics, supported Vault pinning, and local-only boundary assertions.

The active supported Vault remains exactly:

```text
ab95cbbd24df5817c4e363d24b3b199ac8af6c6f
```

## Committed Files

- `data/nexus-vault-compatibility-pipeline-failure-injection-report-contract.v1.json`
- `data/nexus-vault-compatibility-pipeline-failure-injection-report-fixtures.v1.json`
- `scripts/validate-nexus-vault-compatibility-pipeline-failure-injection-report.mjs`
- `docs/TRACK_3_VAULT_COMPATIBILITY_PIPELINE_FAILURE_INJECTION_REPORT_CONTRACT.md`

The Track 3 contract validator checks the contract, fixtures, validator script, documentation, category coverage, outcome enums, supported Vault pin, and ignored generated-report boundary.

## Generated Validation Report

Running the report validator writes:

```text
.track3-runs/latest-nexus-vault-compatibility-pipeline-failure-injection-report-validation-report.json
```

The validation report is ignored local evidence. It must not be committed.

## Required Report Fields

The failure-injection report contract requires:

- `report_version`
- `suite_version`
- `meta.generated_at`
- `source.aetherus_commit`
- `source.supported_vault_commit`
- `summary.injection_count`
- `summary.passed_count`
- `summary.failed_count`
- `injection_results`
- per-injection `category`
- per-injection `invalid_state_summary`
- per-injection `expected_outcome`
- per-injection `actual_outcome`
- per-injection `blocking_reason`
- `boundary_summary`
- `generated_output_boundary`

## Allowed Categories

Allowed injection categories are the Track 3.30 categories, including non-pinned support promotion, skipped pipeline stages, stage order failures, missing blocking information, supported Vault pin drift, alternate Vault execution claims, active Vault switch claims, runtime multi-Vault support claims, public runtime wiring claims, metadata-only assertion drift, generated `.track3-runs/` boundary drift, local report ledger-boundary drift, verdict and release eligibility drift, trace boundary drift, and dirty or mismatched source drift.

## Allowed Outcomes

Allowed expected and actual outcomes are:

- `injected_failure_blocked`
- `injected_failure_rejected`
- `invalid_injection_fixture`
- `injection_expectation_failed`

For a valid runtime report, each injected invalid state must end as `injected_failure_blocked` or `injected_failure_rejected`. `injection_expectation_failed` is an allowed enum value only so the report contract can reject it explicitly.

## Fail-Closed Validation

Fail-closed report validation means every injected invalid state must be blocked or rejected and must carry a blocking or rejection reason.

The validator rejects reports that:

- allow a non-pinned candidate to become supported,
- treat `candidate_pipeline_eligible` as support acceptance,
- allow stage-order failures through,
- omit blocking or rejection reasons,
- claim alternate Vault execution,
- claim an active Vault switch,
- claim runtime multi-Vault support,
- claim public runtime wiring,
- treat generated `.track3-runs/` output as source of truth,
- treat local report output as ledger infrastructure.

## What The Validator Proves

The validator proves that the generated Track 3.30 failure-injection report and committed report fixtures conform to the Track 3.31 report contract.

It checks report shape, supported Vault pinning, category enums, outcome enums, fail-closed result semantics, blocking reason semantics, metadata-only boundary assertions, no alternate Vault execution assertion, no active Vault switch assertion, no runtime multi-Vault support assertion, no public runtime wiring assertion, and `.track3-runs/` ignored-output boundary.

## What The Validator Does Not Prove

This validator does not evaluate a real alternate Vault. It does not import NEXUS, execute NEXUS, clone alternate Vault sources, mutate the pinned Vault, switch the active Vault, create runtime multi-Vault routing, or authorize public runtime behavior.

This is local-only Conduit governance, not production infrastructure.

It does not provide:

- public UI wiring,
- backend services or API routes,
- authentication,
- database use,
- storage or persistence,
- ledger behavior,
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
