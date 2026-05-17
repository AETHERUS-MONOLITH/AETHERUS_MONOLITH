# Track 3.29 Vault Compatibility Pipeline Report Contract

## Purpose

Track 3.29 adds a committed report contract and validator for the Track 3.28 Vault compatibility pipeline report.

This follows Track 3.28. The pipeline stub already composes packet validation, candidate intake, compatibility evaluation, and final status reporting. Track 3.29 freezes the generated report shape and adds a validator for report fields, allowed statuses, stage ordering, blocking semantics, supported Vault pinning, and local-only boundary assertions.

The active supported Vault remains exactly:

```text
ab95cbbd24df5817c4e363d24b3b199ac8af6c6f
```

## Committed Files

- `data/nexus-vault-compatibility-pipeline-report-contract.v1.json`
- `data/nexus-vault-compatibility-pipeline-report-fixtures.v1.json`
- `scripts/validate-nexus-vault-compatibility-pipeline-report.mjs`
- `docs/TRACK_3_VAULT_COMPATIBILITY_PIPELINE_REPORT_CONTRACT.md`

The Track 3 contract validator checks the contract, fixtures, validator script, documentation, status enum, stage order, and ignored generated-report boundary.

## Generated Validation Report

Running the report validator writes:

```text
.track3-runs/latest-nexus-vault-compatibility-pipeline-report-validation-report.json
```

The validation report is ignored local evidence. It must not be committed.

## Required Report Fields

The pipeline report contract requires:

- `report_version`
- `meta.generated_at`
- `source.aetherus_commit`
- `source.supported_vault_commit`
- `summary.pipeline_fixture_count`
- `summary.passed_count`
- `summary.failed_count`
- `fixture_results`
- per-fixture `stage_results`
- per-fixture `final_pipeline_status`
- `blocking_stage` where applicable
- `blocking_reasons` where applicable
- `boundary_summary`
- `generated_output_boundary`

## Allowed Statuses

Allowed final pipeline statuses are:

- `current_supported_pass`
- `candidate_pipeline_eligible`
- `blocked_at_packet_validation`
- `blocked_at_intake`
- `blocked_at_compatibility_evaluation`
- `unsupported_candidate`
- `invalid_pipeline_fixture`

Only the pinned Vault commit may end as `current_supported_pass`.

`candidate_pipeline_eligible` is not support acceptance. It means a non-pinned packet has passed local metadata gates and can be considered by the compatibility discipline. It does not make the candidate supported.

`unsupported_candidate` is also not support acceptance. It records that a non-pinned candidate lacks separate acceptance under the current compatibility policy.

## Stage Ordering

Required pipeline stage order is:

1. `packet_validation`
2. `candidate_intake`
3. `compatibility_evaluation`
4. `final_pipeline_status`

Stage order matters because a candidate cannot be evaluated before its evidence packet shape is valid, and intake must block invalid, incomplete, drifting, or boundary-violating packets before any compatibility classification.

## What The Validator Proves

The validator proves that the generated report and committed report fixtures conform to the Track 3.29 report contract.

It checks:

- supported Vault pinning,
- allowed status enum,
- ordered stages,
- blocking-stage and blocking-reason semantics,
- non-support semantics for non-pinned candidates,
- metadata-only boundary assertions,
- no alternate Vault execution assertion,
- no active Vault switch assertion,
- no runtime multi-Vault support assertion,
- no public runtime wiring assertion,
- `.track3-runs/` ignored-output boundary.

## What The Validator Does Not Prove

This validator does not evaluate a real alternate Vault. It does not import NEXUS, execute NEXUS, clone alternate Vault sources, mutate the pinned Vault, switch the active Vault, create runtime multi-Vault routing, or authorize public runtime behavior.

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
