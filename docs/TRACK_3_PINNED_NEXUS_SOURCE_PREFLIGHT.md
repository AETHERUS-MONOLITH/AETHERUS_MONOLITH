# Track 3.15 Pinned NEXUS Source Preflight

## Purpose

This pass prepares a clean local NEXUS source path at the pinned commit and runs the existing AETHERUS environment preflight against that source.

This pass does not import NEXUS, execute NEXUS, execute Python code from NEXUS, install dependencies, change the public site, or create a public capability.

## Previous Stop Condition

Expected pinned NEXUS commit:

```text
ab95cbbd24df5817c4e363d24b3b199ac8af6c6f
```

Previous non-authoritative path:

```text
/Users/camilocarlone/Documents/Codex/2026-05-06/repository-nexus-mvp-task-audit-only/nexus-mvp
```

Previous path HEAD:

```text
acd8b2abfd3ea66ed6d91fb908c761774bdf110d
```

Track 3.14 confirmed that the previous path had a matching tree but a different commit object. That made the path non-authoritative for import-adapter work.

## Clean Source Strategy Used

Strategy: clean local clone with detached checkout at the pinned commit.

Clean source path:

```text
/Users/camilocarlone/Documents/Codex/2026-05-08/repository-orientation-gpt-handoff-analysis-only/nexus-mvp-pinned-ab95cbb
```

Source properties:

- `.git` metadata exists.
- HEAD commit: `ab95cbbd24df5817c4e363d24b3b199ac8af6c6f`
- Branch state: detached HEAD
- Working tree status: clean
- Pinned commit match: yes

The existing non-authoritative NEXUS path was not checked out, reset, merged, rebased, or otherwise modified.

## Environment Preflight Result

Command run:

```bash
node scripts/check-nexus-import-environment.mjs --nexus-path /Users/camilocarlone/Documents/Codex/2026-05-08/repository-orientation-gpt-handoff-analysis-only/nexus-mvp-pinned-ab95cbb --require-python
```

Result summary:

- Command result: pass
- Python availability: `Python 3.9.6`
- NEXUS path status: provided
- NEXUS commit status: matches pinned commit
- NEXUS working tree: clean
- Required file groups: present
  - README
  - dependency declaration
  - source/module directory
  - tests directory
  - demo runner
  - determinism proof script
- Dependency declaration status: `requirements.txt` present
- Stop conditions: none from the NEXUS source path
- Ready for authorization: false during this pass because the AETHERUS working tree contained Track 3.15 documentation/script changes while the command was run

Interpretation:

The source-path stop condition from Track 3.14 is resolved by the clean pinned source path. Import adapter execution remains unauthorized.

## Boundary Statement

This pass does not authorize import adapter execution.

It does not:

- import NEXUS,
- execute NEXUS,
- execute Python code from NEXUS,
- install dependencies,
- add integration,
- add backend behavior,
- add persistence,
- add ledger behavior,
- add public runtime behavior.

## Next Decision

If the clean pinned path is used again after the AETHERUS working tree is clean and no preflight stop conditions are triggered, Track 3.16 local import-adapter prototype may be considered only if explicitly authorized.

If the preflight does not pass in a clean repository state, resolve the listed preconditions first.

Track 3.16 post-commit readiness refresh: see `docs/TRACK_3_POST_COMMIT_IMPORT_READINESS.md`.

## Public Claim Boundary

Allowed after this pass:

- “clean pinned NEXUS source path prepared”
- “NEXUS source preflight passed/failed”
- “future import adapter remains gated”

Forbidden after this pass:

- “AETHERUS_MONOLITH runs NEXUS”
- “NEXUS import adapter implemented”
- “NEXUS powers the public interface”
- “NEXUS-integrated system”
- “live governance kernel”
- “persistent NEXUS ledger”
- “production runtime”
