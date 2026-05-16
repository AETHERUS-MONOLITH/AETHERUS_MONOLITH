# Track 3.24 Conduit Versioning Story v1

## Purpose

Track 3.24 defines the v1 versioning and migration story for the Track 3 Conduit contract surface.

Versioning is needed after the Track 3.22 freeze because the Conduit now has explicit v1 artifacts, validator expectations, report semantics, and a pinned Vault/NEXUS source boundary. Future changes need a shared policy for deciding whether they are clarifications, compatible additions, or breaking changes.

This pass is documentation and contract policy only. It does not add runtime behavior, public UI wiring, backend behavior, authentication, database use, persistence, ledger behavior, model execution, live orchestration, Palisade, Weave, multi-Vault runtime support, production operation, customer deployment, or certification.

## Relationship to Tracks 3.22 and 3.23

Track 3.22 froze the v1 Conduit contracts:

- `data/interface-contract.v1.json`
- `data/nexus-adapter-contract.v1.json`
- `data/nexus-import-adapter-report-contract.v1.json`

Track 3.23 added local-only ignored report export packaging:

- `data/track3-local-report-export-manifest.v1.json`
- `scripts/export-track3-local-report-bundle.mjs`
- `.track3-runs/track3-local-report-export-<timestamp>.tar.gz`

Track 3.24 adds the policy layer that explains how those frozen surfaces can evolve and how future Vault/NEXUS commits would be evaluated before acceptance.

## Currently Versioned Surface

The Conduit v1 surface is:

- Interface contract v1.
- NEXUS adapter contract v1.
- Import-adapter report contract v1.
- Local report export manifest v1.
- Track 3 contract validator expectations.
- Pinned Vault/NEXUS metadata for `ab95cbbd24df5817c4e363d24b3b199ac8af6c6f`.

The current supported Vault/NEXUS commit is exactly:

```text
ab95cbbd24df5817c4e363d24b3b199ac8af6c6f
```

No other Vault/NEXUS commit is supported yet.

## Version Change Categories

Patch changes clarify documentation or validator checks without changing contract semantics. Examples include clearer local-only wording, stricter validation of an existing invariant, or a typo fix.

Minor changes are additive and backward-compatible. Examples include optional metadata fields or an added failure category that preserves fail-closed behavior, release eligibility rules, and trace-boundary semantics.

Major changes are breaking or semantic changes. A major change includes breaking schema changes, changed verdict semantics, changed release eligibility semantics, changed trace-boundary semantics, changed Vault adapter assumptions, required field removal, required field rename, or replacing the accepted Vault commit.

## Migration States

The migration states are:

- `proposed`
- `locally_validated`
- `regression_validated`
- `failure_injection_validated`
- `accepted`
- `deprecated`
- `unsupported`

A proposed change is not accepted evidence. Acceptance requires validation evidence and separate Operator acceptance.

## Vault/NEXUS Compatibility

The compatibility policy is intentionally single-commit:

- Vault name: `nexus-mvp`
- Supported commit: `ab95cbbd24df5817c4e363d24b3b199ac8af6c6f`
- Supported scope: local pinned source only

The compatibility matrix does not imply multi-Vault runtime support. It records the only currently accepted pinned Vault/NEXUS source for local Conduit evidence.

Future Vault commits require:

- separate Operator authorization,
- source preflight,
- clean source working tree,
- adapter output contract comparison,
- import-adapter regression pass,
- report validation pass,
- failure-injection pass,
- deterministic identity checks,
- trace boundary checks,
- claim boundary checks,
- confirmation that `.track3-runs/` generated artifacts remain ignored and uncommitted.

## Stop Conditions

The Conduit versioning policy stops on:

- NEXUS source commit mismatch,
- dirty pinned NEXUS source,
- adapter output contract drift,
- verdict enum drift,
- release eligibility incoherence,
- deterministic identity failure,
- trace boundary treated as persistent ledger,
- generated `.track3-runs/` artifacts staged,
- public runtime claim escalation,
- Palisade runtime dependency introduced without authorization,
- Weave runtime dependency introduced without authorization,
- Facade runtime dependency introduced without authorization.

## What Remains Unsupported

The following remain unsupported:

- public UI wiring,
- backend services or API routes,
- authentication,
- database use,
- storage or persistence,
- persistent ledger behavior,
- model or API execution,
- live orchestration,
- Palisade implementation,
- Weave implementation,
- multi-Vault runtime support,
- production runtime,
- enterprise deployment,
- customer deployment,
- certification.

## Boundary

This is local-only Conduit governance. It is not production infrastructure.

Public runtime wiring remains unauthorized and blocked pending Palisade birth and separate Operator authorization.

Conduit fail-closed behavior remains Conduit boundary behavior. It is not Palisade work.

