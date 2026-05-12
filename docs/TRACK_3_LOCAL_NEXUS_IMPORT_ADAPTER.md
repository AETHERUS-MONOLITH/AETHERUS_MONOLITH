# Track 3.17 Local NEXUS Import Adapter

## Purpose

Track 3.17 adds a local-only import-adapter prototype for the pinned NEXUS MVP source.

This is the first authorized local execution pass against the clean pinned source path. It maps an AETHERUS fixture-derived input into the verified NEXUS Alpha, Delta, and Omega surface, captures the local result, and normalizes it into an AETHERUS Interface Layer-shaped report.

This pass does not change public site behavior. It does not add public runtime wiring, backend behavior, authentication, persistence, ledger behavior, model execution, live orchestration, production operation, enterprise deployment, or compliance certification.

## Authorization Boundary

The user explicitly authorized Track 3.17 only for this local pinned source:

- NEXUS source path: `/Users/camilocarlone/Documents/Codex/2026-05-08/repository-orientation-gpt-handoff-analysis-only/nexus-mvp-pinned-ab95cbb`
- NEXUS commit: `ab95cbbd24df5817c4e363d24b3b199ac8af6c6f`

The authorization does not extend to non-pinned NEXUS paths, public UI wiring, backend routes, authentication, database use, API calls, model execution, dependency installation, persistent storage, ledger behavior, live orchestration, production browser JavaScript, `index.html`, README marketing language, or production/runtime claims.

## Inputs

- Pinned NEXUS source path
- Pinned NEXUS commit
- AETHERUS fixture from `data/interface-fixtures.v0.json`
- Adapter contract stub in `data/nexus-adapter-contract.stub.v0.json`
- Interface contract in `data/interface-contract.v0.json`
- Pinned source preflight record in `data/nexus-pinned-source-preflight.v0.json`

## Command

```bash
node scripts/run-nexus-import-adapter-local.mjs --nexus-path /Users/camilocarlone/Documents/Codex/2026-05-08/repository-orientation-gpt-handoff-analysis-only/nexus-mvp-pinned-ab95cbb
```

Optional fixture selection:

```bash
node scripts/run-nexus-import-adapter-local.mjs --nexus-path /Users/camilocarlone/Documents/Codex/2026-05-08/repository-orientation-gpt-handoff-analysis-only/nexus-mvp-pinned-ab95cbb --fixture-id happy_path_valid_release
```

## Execution Boundary

The adapter uses a temporary Python runner generated under `.track3-runs/`. The runner points `sys.path` at the pinned NEXUS source and imports only the verified Alpha, Delta, and Omega execution surface needed for the local prototype.

The adapter unsets `ANTHROPIC_API_KEY` for the subprocess so the Alpha stage uses the deterministic fallback path instead of a model API.

The adapter does not modify NEXUS source files. It does not install dependencies. It does not call network services. It does not write application state. JSONL output produced by the pinned NEXUS Omega path is treated only as local audit-log output under `.track3-runs/`, not as a persistent ledger.

## Output

The generated report is written to:

```text
.track3-runs/latest-nexus-import-adapter-local-report.json
```

Generated reports, temporary runners, and local JSONL audit-log output remain ignored by git.

## What It Proves

- AETHERUS fixture-derived input can be mapped into pinned local NEXUS execution.
- A raw local NEXUS result can be captured through a bounded subprocess.
- The result can be normalized into an AETHERUS Interface Layer-shaped local report.
- Boundary flags can remain explicit through local execution and normalization.
- Decision-relevant normalized fields can be compared for deterministic identity across repeated runs.

## What It Does Not Prove

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

## Claim Boundary

Allowed after Track 3.17:

- “local NEXUS import-adapter prototype”
- “pinned local NEXUS execution tested through adapter”
- “NEXUS remains not wired into public site”

Forbidden after Track 3.17:

- “AETHERUS_MONOLITH runs NEXUS publicly”
- “NEXUS powers the public interface”
- “NEXUS-integrated live system”
- “live governance kernel”
- “persistent NEXUS ledger”
- “production runtime”
- “enterprise deployment”

## Next Candidate Pass

The safest next pass is Track 3.18 adapter regression suite over multiple fixtures or Track 3.18 import-adapter boundary hardening.

Public UI wiring should remain out of scope until the local adapter behavior, mismatch handling, boundary enforcement, and generated report semantics are hardened further.
