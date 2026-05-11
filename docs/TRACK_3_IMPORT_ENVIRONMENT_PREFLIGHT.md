# Track 3.13 NEXUS Import Environment Preflight

## Purpose

This document describes the local environment and dependency readiness check before any local NEXUS import adapter.

This pass does not import NEXUS, execute NEXUS, execute Python code from NEXUS, install dependencies, mutate the environment, or change public site behavior. It only checks whether local source and environment prerequisites are visible.

## Relationship To Track 3.12

Track 3.12 defined the authorization gates for a future local import adapter.

Track 3.13 checks the local repository, optional NEXUS source path, dependency declarations, command availability, generated-output boundary, and stop conditions against those gates. It remains preflight-only.

## Commands

```bash
node scripts/check-nexus-import-environment.mjs
node scripts/check-nexus-import-environment.mjs --nexus-path /path/to/nexus-mvp
node scripts/check-nexus-import-environment.mjs --nexus-path /path/to/nexus-mvp --require-python
```

## What It Checks

- AETHERUS baseline and working tree status.
- Track 3 preflight JSON existence and parse validity.
- NEXUS path existence when supplied.
- NEXUS git commit when a path is supplied.
- NEXUS working tree cleanliness when a path is supplied.
- NEXUS dependency declaration files by name only.
- Local `node`, `git`, and `python3 --version` availability.
- Boundary flags: not integrated, not executing NEXUS, no Python execution of NEXUS code, no public runtime, no persistence, no ledger, no model execution, no backend, no auth, and no database.
- Generated output ignored status for `.track3-runs/`.

## What It Does Not Check

This preflight does not:

- run `pytest`,
- run `demo_runner.py`,
- run `prove_determinism.py`,
- import NEXUS,
- execute NEXUS,
- execute Python code from NEXUS,
- install dependencies,
- validate runtime adapter behavior.

## Output

The script writes:

```text
.track3-runs/latest-nexus-import-environment-preflight.json
```

The generated report is local output and must remain ignored by git.

## Stop Conditions

The script marks stop conditions when it detects:

- AETHERUS baseline mismatch.
- NEXUS commit mismatch when a path is supplied.
- NEXUS working tree dirty when a path is supplied.
- Required NEXUS file group missing when a path is supplied.
- Python unavailable when `--require-python` is supplied.
- Preflight JSON missing or invalid.
- Boundary flag violation.
- Generated output path not ignored by git.

## Public Claim Boundary

Allowed after Track 3.13:

- “NEXUS import environment preflight script documented”
- “local environment/source prerequisites can be checked”
- “NEXUS remains external and not integrated”

Forbidden after Track 3.13:

- “AETHERUS_MONOLITH runs NEXUS”
- “NEXUS import adapter implemented”
- “NEXUS powers the public interface”
- “NEXUS-integrated system”
- “live governance kernel”
- “persistent NEXUS ledger”
- “production runtime”

## Recommended Next Pass

If environment preflight passes with a supplied NEXUS path, Track 3.14 local import adapter prototype may be considered only if explicitly authorized.

If it does not pass, resolve missing preconditions first.

Default recommendation: do not implement an import adapter unless explicitly authorized.

Track 3.14 source pin resolution for the observed local NEXUS path: see `docs/TRACK_3_NEXUS_SOURCE_PIN_RESOLUTION.md`.

Track 3.15 pinned source preflight: see `docs/TRACK_3_PINNED_NEXUS_SOURCE_PREFLIGHT.md`.
