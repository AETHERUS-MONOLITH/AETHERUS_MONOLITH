# Track 3.25 Multi-Vault Compatibility Evaluation Harness Stub

## Purpose

Track 3.25 adds a local-only compatibility-evaluation harness stub for candidate Vault/NEXUS versions.

The harness follows the Track 3.24 Conduit versioning story. It evaluates committed metadata fixtures against the versioning and Vault compatibility policy. It does not import NEXUS, execute NEXUS, clone alternate Vault sources, mutate the pinned Vault, switch the active Vault, create runtime multi-Vault routing, or create public runtime support.

The active supported Vault remains exactly:

```text
ab95cbbd24df5817c4e363d24b3b199ac8af6c6f
```

## Committed Files

- `data/nexus-vault-compatibility-evaluation-fixtures.v1.json`
- `scripts/evaluate-nexus-vault-compatibility-stub.mjs`
- `docs/TRACK_3_MULTI_VAULT_COMPATIBILITY_EVALUATION_HARNESS_STUB.md`

`scripts/validate-track3-contracts.mjs` validates the fixture contract, harness script boundary, documentation presence, required fixture categories, and fixed status enum.

## Generated Report

Running the harness writes:

```text
.track3-runs/latest-nexus-vault-compatibility-evaluation-report.json
```

The report is ignored local evidence. It must not be committed.

## Evaluated Metadata

The harness reads:

- `data/conduit-versioning-policy.v1.json`
- `data/nexus-vault-version-compatibility.v1.json`
- `data/nexus-vault-compatibility-evaluation-fixtures.v1.json`

It evaluates candidate commit metadata, source cleanliness flags, metadata consistency flags, source preflight evidence, import-adapter regression evidence, report validation evidence, failure-injection evidence, deterministic identity status, trace-boundary status, release-eligibility coherence, adapter output contract status, and claim-boundary status.

## Fixture Coverage

The fixture set covers:

- `current_pinned_vault_supported`
- `unknown_candidate_commit`
- `missing_regression_evidence`
- `missing_failure_injection_evidence`
- `deterministic_identity_failure`
- `trace_boundary_violation`
- `verdict_or_eligibility_semantics_drift`
- `dirty_or_mismatched_source`

Allowed evaluation statuses are:

- `supported_current`
- `candidate_not_evaluated`
- `candidate_blocked`
- `candidate_requires_full_evaluation`
- `incompatible`
- `invalid_fixture`

Unsupported candidate commits cannot be marked supported by this harness. A complete evidence packet can only move an alternate commit into evaluation posture; it does not create acceptance while Track 3.24 still states that no other Vault commit is supported.

## What the Stub Proves

The stub proves that candidate Vault compatibility metadata can be classified against the current Conduit policy without touching alternate runtime sources.

It checks that:

- the current pinned Vault commit remains supported,
- unknown candidate commits require full evaluation,
- missing regression evidence blocks compatibility,
- missing failure-injection evidence blocks compatibility,
- deterministic identity failure blocks compatibility,
- persistent-ledger trace claims are incompatible,
- verdict, release eligibility, or report-contract drift is incompatible,
- dirty or mismatched source metadata blocks compatibility.

## What the Stub Does Not Prove

The stub does not prove actual compatibility of any alternate Vault source.

It does not provide:

- multi-Vault runtime support,
- public NEXUS runtime,
- active Vault switching,
- backend services or API routes,
- authentication,
- database use,
- persistence,
- persistent ledger behavior,
- model or API execution,
- live orchestration,
- Palisade implementation,
- Weave implementation,
- production runtime,
- enterprise deployment,
- customer deployment,
- certification,
- external audit.

## Future Real Multi-Vault Support

Future real multi-Vault support would require separate Operator authorization, candidate source preflight, clean source state, adapter output contract comparison, import-adapter regression, report validation, failure injection, deterministic identity checks, trace-boundary checks, claim-boundary checks, runtime routing design, public claim review, and whatever Palisade birth requires before public runtime wiring can be considered.

Public runtime wiring remains unauthorized and blocked pending Palisade birth and separate Operator authorization.

Conduit fail-closed behavior remains Conduit boundary behavior. It is not Palisade work.

