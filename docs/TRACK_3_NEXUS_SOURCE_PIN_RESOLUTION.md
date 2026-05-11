# Track 3.14 NEXUS Source Pin Resolution

## Purpose

This pass resolves the NEXUS source and commit precondition before any import-adapter prototype may be considered.

This pass does not import NEXUS, execute NEXUS, execute Python code from NEXUS, install dependencies, change the public site, or create a public capability. It only documents the observed source mismatch and the source strategy required before any future local import-adapter execution can be authorized.

## Current Stop Condition

Expected pinned NEXUS commit:

```text
ab95cbbd24df5817c4e363d24b3b199ac8af6c6f
```

Observed local NEXUS path:

```text
/Users/camilocarlone/Documents/Codex/2026-05-06/repository-nexus-mvp-task-audit-only/nexus-mvp
```

Observed local NEXUS HEAD:

```text
acd8b2abfd3ea66ed6d91fb908c761774bdf110d
```

Result: the import adapter remains unauthorized. The supplied path does not currently point at the pinned verified commit.

## NEXUS Path Inspection

Path inspected:

```text
/Users/camilocarlone/Documents/Codex/2026-05-06/repository-nexus-mvp-task-audit-only/nexus-mvp
```

Inspection summary:

- Current branch: `codex/add-license-contributing-security`
- Current HEAD: `acd8b2abfd3ea66ed6d91fb908c761774bdf110d`
- Remote: `https://github.com/AETHERUS-MONOLITH/nexus-mvp.git`
- Working tree: clean
- Branch status: local branch is behind its upstream by one commit
- Expected commit exists locally: yes
- Expected commit location: `origin/main` / `origin/HEAD`
- Current HEAD contains expected commit: no
- Diff from pinned commit to observed HEAD: no file diff observed
- Tree identity: observed HEAD and expected commit have the same tree hash

Interpretation:

The local path appears to be a working branch or pre-merge branch with equivalent file contents to the pinned commit, but it is not the pinned commit object. Because future adapter work is explicitly commit-pinned, this path should not be treated as authoritative for import-adapter execution unless the user explicitly accepts that source strategy or supplies a clean checkout/archive at the pinned commit.

## Source Strategy Options

### Option A — Use Clean Archive/Checkout Of Pinned Commit

Preferred if the goal is reproducible adapter work against the verified source.

- Requires no change to the pinned commit.
- Future import adapter should point to a clean source path at `ab95cbbd24df5817c4e363d24b3b199ac8af6c6f`.
- The preflight script must pass against that path before import execution is considered.

### Option B — Update Pin To Newer NEXUS Commit

Only appropriate if the newer commit is deliberately accepted.

- Requires re-running the NEXUS verification suite.
- Requires updating all pinned commit references and validator expectations.
- Not authorized by default.

### Option C — Keep Local Path As Working Branch But Do Not Use It For Import Adapter

Acceptable if the local path is not intended to be the verified source.

- Current path can remain untouched.
- Import adapter remains blocked until a clean source is supplied.

### Option D — Create Separate Local Archive Directory For Pinned Commit

Recommended practical path if Codex can create or read an archive safely without modifying the current NEXUS path.

- Must still not execute NEXUS in this pass unless separately authorized.
- Future adapter preflight should target the archive path.

## Recommendation

Use or create a clean source path at the pinned commit `ab95cbbd24df5817c4e363d24b3b199ac8af6c6f` for future adapter work.

Keep the current local path treated as non-authoritative unless it is explicitly accepted for import-adapter work. Even though the observed tree is equivalent to the pinned commit tree, the commit object differs, and Track 3 import-adapter readiness is pinned to the verified commit.

## Required Next Authorization

A future import adapter prototype remains blocked until:

- the preflight script is run against a NEXUS path at the pinned commit,
- the path is clean,
- dependency declarations are identified,
- no stop conditions are triggered,
- the user explicitly authorizes local NEXUS import execution.

## Public Claim Boundary

Allowed after this pass:

- “NEXUS source pin resolution documented”
- “current local NEXUS path mismatch identified”
- “future import adapter remains gated”

Forbidden after this pass:

- “AETHERUS_MONOLITH runs NEXUS”
- “NEXUS import adapter implemented”
- “NEXUS powers the public interface”
- “NEXUS-integrated system”
- “live governance kernel”
- “persistent NEXUS ledger”
- “production runtime”
