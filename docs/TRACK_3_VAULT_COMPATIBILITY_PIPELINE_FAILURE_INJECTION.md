# Track 3.30 Vault Compatibility Pipeline Failure Injection

## Purpose

Track 3.30 adds a local-only failure-injection suite for the Track 3.28 Vault compatibility pipeline stub and the Track 3.29 compatibility pipeline report contract.

This follows Track 3.29. The report contract freezes the generated pipeline report shape, allowed statuses, stage ordering, blocking semantics, supported Vault pinning, and local-only boundary assertions. Track 3.30 injects invalid pipeline and report states to verify that those boundaries fail closed.

The active supported Vault remains exactly:

```text
ab95cbbd24df5817c4e363d24b3b199ac8af6c6f
```

## Committed Files

- `data/nexus-vault-compatibility-pipeline-failure-injection-fixtures.v1.json`
- `scripts/run-nexus-vault-compatibility-pipeline-failure-injection-suite.mjs`
- `docs/TRACK_3_VAULT_COMPATIBILITY_PIPELINE_FAILURE_INJECTION.md`

The Track 3 contract validator checks the fixture coverage, allowed expected outcomes, script boundary, documentation presence, supported Vault pin, and ignored generated-report boundary.

## Generated Report

Running the suite writes:

```text
.track3-runs/latest-nexus-vault-compatibility-pipeline-failure-injection-report.json
```

The report is ignored local evidence. It must not be committed, and it is not a persistent ledger or repository source of truth.

## Fail-Closed Coverage

The suite injects invalid states covering:

- non-pinned candidate promoted to `current_supported_pass`,
- unsupported candidate marked supported,
- `candidate_pipeline_eligible` treated as support acceptance,
- skipped packet validation, intake, or compatibility stages,
- invalid stage order,
- blocked statuses without blocking reasons or blocking stage,
- missing or wrong supported Vault commit,
- alternate Vault execution claim,
- active Vault switch claim,
- runtime multi-Vault support claim,
- public runtime wiring claim,
- missing metadata-only assertion,
- generated `.track3-runs/` output treated as committable,
- local report treated as persistent ledger evidence,
- verdict semantics drift not blocked,
- release eligibility drift not blocked,
- trace boundary violation not blocked,
- dirty or mismatched source not blocked.

Fail-closed means every injected invalid state must be rejected by report-contract checks or blocked before it can become support acceptance. No injected invalid state may produce `current_supported_pass`, and no non-pinned candidate may become supported.

## Eligibility Is Not Acceptance

`candidate_pipeline_eligible` remains a non-supporting status. It only means metadata has passed the local intake shape required to proceed through the compatibility discipline. It does not switch the active Vault, does not make a candidate supported, and does not authorize runtime multi-Vault behavior.

## What This Suite Proves

The suite proves that committed metadata fixtures can inject known invalid compatibility pipeline and report states, and that the local Conduit report boundary rejects or blocks those states.

It verifies:

- supported Vault pin assertions,
- non-support semantics for non-pinned candidates,
- required stage ordering,
- required blocking stage and reasons,
- metadata-only boundary assertions,
- no alternate Vault execution assertion,
- no active Vault switch assertion,
- no runtime multi-Vault support assertion,
- no public runtime wiring assertion,
- `.track3-runs/` ignored-output boundary,
- local report output is not persistent ledger infrastructure.

## What This Suite Does Not Prove

This suite does not evaluate a real alternate Vault. It does not import NEXUS, execute NEXUS, clone alternate Vault sources, mutate the pinned Vault, switch the active Vault, create runtime multi-Vault routing, or authorize public runtime behavior.

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

Future real multi-Vault support would require separate Operator authorization, candidate source preflight, clean source state, evidence packet validation, intake gate passage, compatibility evaluation, import-adapter regression, report validation, failure injection, deterministic identity checks, trace-boundary checks, ledger-boundary checks, claim-boundary checks, runtime routing design, public claim review, and Palisade birth requirements before public runtime wiring can be considered.

Public runtime wiring remains unauthorized and blocked pending Palisade birth and separate Operator authorization.

Conduit fail-closed behavior remains Conduit boundary behavior. It is not Palisade work.
