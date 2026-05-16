# Track 3.26 Vault Compatibility Evidence Packet Contract

## Purpose

Track 3.26 defines the evidence packet shape required before any future non-pinned Vault/NEXUS candidate may be considered by the Track 3 compatibility evaluation harness.

This follows Track 3.25. The harness can classify candidate metadata, but it needs a stable packet contract that says which evidence must exist before a candidate can even enter meaningful compatibility review.

This pass is local-only Conduit governance. It does not evaluate a real alternate Vault, switch the active Vault, import or execute alternate NEXUS/Vault sources, create runtime multi-Vault support, or authorize public runtime behavior.

The active supported Vault remains exactly:

```text
ab95cbbd24df5817c4e363d24b3b199ac8af6c6f
```

## Committed Files

- `data/nexus-vault-compatibility-evidence-packet-contract.v1.json`
- `data/nexus-vault-compatibility-evidence-packet-fixtures.v1.json`
- `scripts/validate-nexus-vault-compatibility-evidence-packet.mjs`
- `docs/TRACK_3_VAULT_COMPATIBILITY_EVIDENCE_PACKET_CONTRACT.md`

The Track 3 contract validator also checks these files and their boundary invariants.

## Generated Report

Running the packet validator writes:

```text
.track3-runs/latest-nexus-vault-compatibility-evidence-packet-validation-report.json
```

The report is ignored local evidence and must not be committed.

## Required Packet Evidence

A future candidate Vault packet must include:

- `candidate_vault_commit`
- `candidate_source_status`
- `source_cleanliness`
- `source_origin_match`
- `import_adapter_regression_result`
- `failure_injection_result`
- `report_contract_validation_result`
- `deterministic_identity_result`
- `verdict_semantics_result`
- `release_eligibility_semantics_result`
- `trace_boundary_result`
- `ledger_boundary_result`
- `generated_artifacts_boundary_result`
- `public_claim_boundary_result`
- `compatibility_decision`
- `blocking_reasons`
- `evaluator_notes`

Allowed compatibility decisions are:

- `accepted_current_supported`
- `candidate_packet_valid_but_not_supported`
- `candidate_packet_incomplete`
- `candidate_blocked`
- `candidate_incompatible`
- `invalid_packet`

## Complete Packet Is Not Acceptance

A complete non-pinned candidate packet is not the same as support acceptance.

During Track 3.26, a non-pinned candidate with all required evidence can only be classified as `candidate_packet_valid_but_not_supported`. The current compatibility policy still supports only the pinned Vault commit. Any future support acceptance requires separate Operator authorization and the broader compatibility process described in Track 3.24 and Track 3.25.

## Fixture Coverage

The fixture suite covers:

- current supported Vault packet,
- complete non-pinned candidate packet that remains unsupported,
- missing regression result,
- missing failure-injection result,
- deterministic identity failure,
- verdict semantics drift,
- release eligibility drift,
- trace boundary violation,
- ledger boundary violation,
- dirty source packet,
- generated artifacts staged,
- public claim escalation.

## What Future Real Multi-Vault Support Would Require

Future real multi-Vault support would require separate Operator authorization, candidate source preflight, clean source state, adapter output contract comparison, import-adapter regression, report validation, failure injection, deterministic identity checks, trace-boundary checks, ledger-boundary checks, claim-boundary checks, runtime routing design, public claim review, and Palisade birth requirements before public runtime wiring can be considered.

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
