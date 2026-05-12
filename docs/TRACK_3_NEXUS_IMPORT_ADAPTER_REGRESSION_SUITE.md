# Track 3.18 NEXUS Import Adapter Regression Suite

## Purpose

Track 3.18 adds a local-only regression suite for the Track 3.17 local NEXUS import adapter.

The suite expands coverage from a single pinned-source adapter run to multiple existing AETHERUS fixtures. It does not change public site behavior, add public UI wiring, or create any public capability.

## Relationship to Track 3.17

Track 3.17 proved that one AETHERUS fixture-derived input could be mapped into the pinned local NEXUS Alpha, Delta, and Omega execution surface, captured, normalized, and reported with explicit boundaries.

Track 3.18 runs the same bounded adapter over the current fixture set and records a combined local regression report.

## Command

```bash
node scripts/run-nexus-import-adapter-regression-suite.mjs --nexus-path /Users/camilocarlone/Documents/Codex/2026-05-08/repository-orientation-gpt-handoff-analysis-only/nexus-mvp-pinned-ab95cbb
```

## Fixture Classification

- `executable_adapter_case`: the fixture has a supported local adapter mapping and can be executed against the pinned source.
- `unsupported_mapping_case`: the fixture does not have a safe query/context mapping and must not be forced through the adapter.
- `expected_fail_closed_case`: the fixture is intentionally treated as a blocking or fail-closed local adapter case.

## What It Validates

- Local adapter execution over multiple fixtures.
- Deterministic identity where feasible.
- Release eligibility coherence.
- Fail-closed handling for unsupported or malformed mappings.
- Trace and ledger boundary preservation.
- Claim-boundary preservation.
- Pinned source and pinned commit enforcement.

## What It Does Not Validate

- No public integration.
- No live site behavior.
- No backend.
- No persistence.
- No ledger.
- No authentication.
- No model execution.
- No live orchestration.
- No enterprise deployment.
- No compliance certification.
- No production runtime.

## Output

The generated suite report is written to:

```text
.track3-runs/latest-nexus-import-adapter-regression-suite-report.json
```

Generated reports, temporary runners, and local JSONL audit-log output remain ignored by git.

## Public Claim Boundary

Allowed after Track 3.18:

- “local NEXUS import-adapter regression suite”
- “multiple fixture runs against pinned local NEXUS source”
- “NEXUS remains not wired into public site”

Forbidden after Track 3.18:

- “AETHERUS_MONOLITH runs NEXUS publicly”
- “NEXUS powers the public interface”
- “NEXUS-integrated live system”
- “live governance kernel”
- “persistent NEXUS ledger”
- “production runtime”
- “enterprise deployment”

## Next Candidate Pass

The safest next pass is Track 3.19 adapter boundary hardening and failure-report schema.

A public documentation boundary update may also be considered, but public UI wiring should remain out of scope until the local adapter suite and failure reporting are hardened further.
