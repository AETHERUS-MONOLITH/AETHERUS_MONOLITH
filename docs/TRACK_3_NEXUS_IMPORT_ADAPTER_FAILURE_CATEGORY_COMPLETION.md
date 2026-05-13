# Track 3.21 NEXUS Import Adapter Failure Category Completion

## Purpose

Track 3.21 completes the deferred local NEXUS import-adapter failure categories from Track 3.20.

This pass extends the existing local failure-injection suite. It does not add a public capability, execute NEXUS publicly, modify NEXUS source files, install dependencies, or change public site behavior.

## Relationship to Track 3.20

Track 3.20 covered thirteen failure-injection categories and intentionally deferred:

- `manifest_mapping_missing`
- `nexus_execution_failure`

Track 3.21 adds those two categories to the same local failure-injection runner so the report contract covers all currently listed failure categories.

## Added Categories

### `manifest_mapping_missing`

The suite simulates an adapter input with no resolvable manifest mapping. The generated report must fail closed, record a stop condition, and block release eligibility.

### `nexus_execution_failure`

The suite simulates a controlled local NEXUS execution failure without running, corrupting, or modifying the pinned NEXUS source. The generated report must fail closed, record a stop condition, and block release eligibility.

## Outputs

Generated reports remain ignored local artifacts under `.track3-runs/`:

- `.track3-runs/latest-nexus-import-adapter-failure-injection-suite-report.json`
- `.track3-runs/nexus-import-adapter-failure-injection-*.json`

These files are not committed and are not production records.

## Command

```bash
node scripts/run-nexus-import-adapter-failure-injection-suite.mjs
```

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
