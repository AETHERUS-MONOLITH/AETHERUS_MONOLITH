# Track 3.20 NEXUS Import Adapter Failure Injection

## Purpose

Track 3.20 adds a local-only failure-injection validation pass for the NEXUS import adapter report contract.

The pass intentionally constructs selected adapter failure conditions and verifies that each generated report remains fail-closed under the Track 3.19 report contract. It does not execute NEXUS, modify NEXUS source files, change public site behavior, or create a public capability.

## Relationship to Track 3.19

Track 3.19 defined the stable local report contract for successful adapter reports, regression-suite reports, fail-closed failure reports, and stop-condition reports.

Track 3.20 exercises that failure-report surface directly by generating local injected failure reports under `.track3-runs/` and validating that each report:

- uses an allowed failure category,
- blocks release eligibility,
- preserves local trace boundaries,
- preserves non-persistence and non-ledger boundaries,
- preserves public claim boundaries,
- records a stop condition.

## Covered Failure Categories

This pass covers:

- `nexus_path_missing`
- `nexus_commit_mismatch`
- `nexus_working_tree_dirty`
- `fixture_mapping_missing`
- `regulatory_context_missing`
- `malformed_nexus_result`
- `unknown_nexus_verdict`
- `unknown_risk_level`
- `missing_omega_decision`
- `nondeterministic_output`
- `release_eligibility_incoherent`
- `trace_boundary_violation`
- `claim_boundary_violation`

`nexus_working_tree_dirty` is simulated only as a report injection. The pinned NEXUS source is not modified.

## Deferred Categories

Deferred from this pass:

- `manifest_mapping_missing`
- `nexus_execution_failure`

Those remain valid Track 3.19 failure categories, but this pass focuses on the selected import-adapter failure and boundary-incoherence cases.

## Outputs

The runner writes ignored local reports under `.track3-runs/`:

- `.track3-runs/latest-nexus-import-adapter-failure-injection-suite-report.json`
- `.track3-runs/nexus-import-adapter-failure-injection-*.json`

These outputs are local evidence only. They are not committed and are not production records.

## Command

```bash
node scripts/run-nexus-import-adapter-failure-injection-suite.mjs
```

## Validation

Expected validation commands:

```bash
node scripts/run-nexus-import-adapter-failure-injection-suite.mjs
node scripts/validate-nexus-import-adapter-reports.mjs
node scripts/validate-track3-contracts.mjs
```

The existing local adapter regression suite should still pass separately against the clean pinned NEXUS source.

## Boundary

This pass does not add:

- public runtime behavior,
- public UI wiring,
- backend behavior,
- authentication,
- database use,
- persistence,
- ledger behavior,
- model or API execution,
- live orchestration,
- production operation,
- enterprise deployment,
- compliance certification.

JSONL audit-log output remains local-only and must not be treated as a production ledger.
