# Track 3.28 Vault Compatibility Pipeline Stub

## Purpose

Track 3.28 adds a local-only Vault compatibility pipeline stub.

This follows Track 3.25, Track 3.26, and Track 3.27. Track 3.25 defined compatibility evaluation metadata. Track 3.26 froze the evidence packet contract. Track 3.27 added the candidate intake gate. Track 3.28 composes those local-only pieces into an ordered pipeline report.

The pipeline validates process ordering and decision boundaries only. It does not evaluate a real alternate Vault, import or execute alternate NEXUS/Vault sources, switch the active Vault, create runtime multi-Vault routing, or authorize public runtime behavior.

The active supported Vault remains exactly:

```text
ab95cbbd24df5817c4e363d24b3b199ac8af6c6f
```

## Committed Files

- `data/nexus-vault-compatibility-pipeline-fixtures.v1.json`
- `scripts/run-nexus-vault-compatibility-pipeline-stub.mjs`
- `docs/TRACK_3_VAULT_COMPATIBILITY_PIPELINE_STUB.md`

The Track 3 contract validator checks the fixture shape, required pipeline statuses, required fixture coverage, ordered stages, script boundary, documentation presence, and ignored generated-report boundary.

## Generated Report

Running the pipeline stub writes:

```text
.track3-runs/latest-nexus-vault-compatibility-pipeline-report.json
```

The report is ignored local evidence. It must not be committed.

## Ordered Pipeline

The local pipeline order is:

1. `packet_validation`
2. `candidate_intake`
3. `compatibility_evaluation`
4. `pipeline_status_report`

Packet validation checks evidence packet shape and basic contract viability.

Candidate intake checks whether a packet is complete and bounded enough to reach compatibility evaluation.

Compatibility evaluation remains metadata-only. It classifies whether the current pinned Vault is supported, whether a non-pinned candidate remains unsupported, or whether a candidate is blocked. It does not execute Vault code.

## Pipeline Statuses

Allowed pipeline statuses are:

- `current_supported_pass`
- `candidate_pipeline_eligible`
- `blocked_at_packet_validation`
- `blocked_at_intake`
- `blocked_at_compatibility_evaluation`
- `unsupported_candidate`
- `invalid_pipeline_fixture`

Only the pinned Vault commit may end as `current_supported_pass`.

A complete non-pinned candidate can at most end as `candidate_pipeline_eligible` or `unsupported_candidate`. Pipeline eligibility is not support acceptance. The current compatibility policy still supports only the pinned Vault commit.

## Fixture Coverage

The fixture set covers:

- current supported Vault pipeline,
- non-pinned complete candidate pipeline,
- invalid packet pipeline,
- missing packet pipeline,
- intake boundary violation pipeline,
- deterministic identity failure pipeline,
- verdict semantics drift pipeline,
- trace or ledger boundary violation pipeline,
- public claim escalation pipeline,
- unsupported commit without acceptance pipeline.

Blocked candidates include a blocking stage and blocking reasons. No fixture may imply an active Vault switch, runtime multi-Vault support, alternate Vault execution, public runtime support, or committed `.track3-runs/` output.

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
