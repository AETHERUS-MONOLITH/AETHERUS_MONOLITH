# Track 3.23 Local Report Export Bundle

## Purpose

Track 3.23 adds a reproducible local-only export process for ignored Track 3 reports and evidence outputs.

The export process packages local Conduit evidence under `.track3-runs/` into a non-committed archive. It does not change runtime behavior, public UI wiring, backend behavior, authentication, database use, persistence, ledger behavior, model execution, live orchestration, Palisade, Weave, production operation, enterprise deployment, customer deployment, or certification.

## Committed Files

- `scripts/export-track3-local-report-bundle.mjs`
- `data/track3-local-report-export-manifest.v1.json`
- `docs/TRACK_3_LOCAL_REPORT_EXPORT_BUNDLE.md`

`scripts/validate-track3-contracts.mjs` validates the export manifest contract and exporter boundary.

## Generated Files

Running the exporter writes ignored local files under `.track3-runs/`:

- `.track3-runs/track3-local-report-export-<timestamp>.tar.gz`
- `.track3-runs/latest-track3-local-report-export-manifest.json`
- `.track3-runs/latest-track3-local-report-export-summary.json`

These generated files remain ignored and must not be committed.

## Bundle Contents

The bundle includes the current local evidence surface when present:

- latest single-run NEXUS import-adapter report,
- latest regression-suite report,
- latest failure-injection suite report,
- all 15 failure-injection detail reports,
- local JSONL audit-output references from the adapter runs,
- local fixture, suite, environment-preflight, or normalizer summaries when present,
- report-validator and Track 3 contract-validator command summaries generated during export,
- pinned AETHERUS commit metadata,
- pinned NEXUS commit and source-path metadata,
- boundary summary.

The exporter fails if the three core adapter reports are missing or if fewer than 15 failure-injection detail reports are available after the standard suites have been run. Optional evidence files may be absent without failing the export.

## Determinism and Auditability

The exporter uses stable file-selection rules from `data/track3-local-report-export-manifest.v1.json`.

The generated manifest records each included file path, archive path, inclusion category, required status, size in bytes, and SHA256 hash. Export timestamp and run id are recorded separately from content hashes.

Archive entries are sorted by archive path and written with stable tar metadata. The archive is an evidence package, not repository source of truth.

## How to Generate

Run the standard Track 3 suites first, then run:

```bash
node scripts/export-track3-local-report-bundle.mjs
```

The script also runs:

```bash
node scripts/validate-nexus-import-adapter-reports.mjs
node scripts/validate-track3-contracts.mjs
```

Those command results are captured into the export metadata. If either validation command fails, the export fails.

## Relationship to Track 3.22

Track 3.22 froze the v1 Conduit contract artifacts:

- `data/interface-contract.v1.json`
- `data/nexus-adapter-contract.v1.json`
- `data/nexus-import-adapter-report-contract.v1.json`

Track 3.23 does not change those contracts. It packages the ignored local reports that demonstrate the current evidence surface under the Track 3.22 freeze.

## Boundary

The export archive is local evidence packaging only.

It is not:

- public runtime behavior,
- public UI wiring,
- backend infrastructure,
- authentication,
- database use,
- storage or persistence,
- a persistent ledger,
- production audit infrastructure,
- public NEXUS runtime,
- live orchestration,
- Palisade implementation,
- Weave implementation,
- enterprise deployment,
- customer deployment,
- certification evidence.

Public runtime wiring remains unauthorized and blocked pending Palisade birth and separate Operator authorization.

Conduit fail-closed behavior remains Conduit boundary behavior. It is not Palisade work.

