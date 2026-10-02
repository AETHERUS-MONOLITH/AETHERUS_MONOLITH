# Production GitHub Pages: fixed-Operator approval runbook

Verified against repository implementation on 2026-10-02.

Repository: `AETHERUS-MONOLITH/AETHERUS_MONOLITH`.
Verified main commit: `5d0e1734f89ed8c50873cc9019a01935567be967`.
Verified tree: `8b7e219363ff6b191d3673686a3b059d01426790`.
Verified live deployment: **Deploy Pages with runtime config**, [run #54](https://github.com/AETHERUS-MONOLITH/AETHERUS_MONOLITH/actions/runs/36990187471), successful on that exact commit, attempt 1.

This document records the existing production procedure. Creating this runbook does not dispatch, approve, consume, deploy, merge, or change the verified main/live baseline. Repository execution belongs to Codex, not AETHERUS; the fixed human Operator supplies the separate authorization decision.

## Fixed identities and workflow gates

The production workflow is **Deploy Pages with runtime config** in [pages-runtime-config.yml](../../.github/workflows/pages-runtime-config.yml). Dispatch it as GitHub actor `AETHERUS-MONOLITH` on branch `main` only.

The workflow explicitly verifies:

| Field | Required value |
| --- | --- |
| actor | `AETHERUS-MONOLITH` |
| actor_id | `264210171` |
| triggering_actor | Equal to actor |
| run_attempt | `1` |
| repository | `AETHERUS-MONOLITH/AETHERUS_MONOLITH` |
| repository_id | `1167751543` |
| repository_owner_id | `264210171` |
| ref | `refs/heads/main` |
| workflow | `Deploy Pages with runtime config` |
| event | `workflow_dispatch` |

It checks out `github.sha`, checks that HEAD equals that SHA, and requires a clean tracked checkout. The authorization and Conduit paths also bind the run, workflow, source, artifact, and first attempt; a decision for one execution cannot authorize a different execution.

The fixed Supabase Operator session must resolve to user `4702d528-f7a7-4a04-a991-3176bec69f52`, principal `e438b03c-c708-4cba-94e4-e106ee9958c4`, workspace `9abed891-7950-4937-a2aa-4b957d8a4bd1`. The database requires exactly one active applicable workspace Operator and verifies the approved identity again at consumption. The GitHub requester act and the authenticated human decision are distinct acts even where self-authorization is permitted.

## Procedure for a separately authorized production deployment

1. Prepare a terminal authenticated with the fixed-Operator Supabase session before dispatch. Use that session's current **access token** for the decision. A GitHub token, workflow OIDC token, Supabase publishable key, or service-role key is not the fixed-Operator session access token. Keep the token out of logs, committed files, and shell history; disable shell tracing.

2. Confirm the GitHub session is `AETHERUS-MONOLITH`. Start a **fresh workflow dispatch** of **Deploy Pages with runtime config**, selecting `main`. Record its run ID, SHA, and attempt. Do not use **Re-run jobs** or **Re-run failed jobs** after a timeout or failure: production explicitly requires `run_attempt = 1`. For this bounded documentation task, no dispatch is authorized or performed.

3. Watch that run's live Actions logs until **Create action-specific authorization request**. Capture the emitted line:

   ```text
   request_id=<UUID>
   ```

   Use the UUID from this new run, not a previous run or an example. The create script validates a pending receipt bound to the final action manifest, writes `authorization-request-receipt.json` in runner evidence, and emits the request ID. If creation fails, there is no valid new request to approve.

4. Submit the fixed-Operator decision promptly, **within the 900-second decision window**. The database sets `request_expires_at = min(request creation time + 900 seconds, artifact expiry)`; the window can therefore be shorter. It starts at request creation, not when the Operator reads the log. The await script polls every five seconds with fresh workflow OIDC tokens. Its local 900-second polling deadline and the workflow step's `timeout-minutes: 16` do not extend the database deadline.

5. From the prepared terminal, POST to this exact endpoint, without a query string and with **no `Origin` header**:

   ```text
   https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-authorization-decision-v0
   ```

   Include:

   ```text
   Authorization: Bearer <fixed-Operator session access token>
   Content-Type: application/json
   ```

   The JSON object has **exactly** `request_id`, `decision`, and `reason`. Approval uses `decision: "authorize"`. `reason` must be present and may be `null` or an explanatory string of at most 500 JavaScript string code units. Do not add identity, manifest, run, or token fields. Example body:

   ```json
   {
     "request_id": "<UUID from this run>",
     "decision": "authorize",
     "reason": null
   }
   ```

   Bash terminal example, to be used only during a separately authorized dispatch:

   ```bash
   set +x
   read -r -p 'New run request UUID: ' REQUEST_ID
   read -r -s -p 'Fixed-Operator session access token: ' FIXED_OPERATOR_ACCESS_TOKEN
   printf '\n'
   DECISION_BODY=$(python3 - "$REQUEST_ID" <<'PY'
   import json, sys, uuid
   request_id = str(uuid.UUID(sys.argv[1]))
   print(json.dumps({"request_id": request_id, "decision": "authorize", "reason": None}))
   PY
   )
   curl -q --fail-with-body --silent --show-error \
     --request POST \
     --header 'Origin:' \
     --header "Authorization: Bearer ${FIXED_OPERATOR_ACCESS_TOKEN}" \
     --header 'Content-Type: application/json' \
     --data-binary "$DECISION_BODY" \
     'https://hdakjutdomuvyiohxzeb.supabase.co/functions/v1/github-pages-authorization-decision-v0'
   unset FIXED_OPERATOR_ACCESS_TOKEN DECISION_BODY
   ```

   `curl -q` disables curlrc configuration; `--header 'Origin:'` suppresses that header rather than sending an empty Origin value. Do not add `Origin`, including `Origin: null`, or use a browser-origin request. The Edge Function rejects any request containing the header. It authenticates the session through Supabase `/auth/v1/user`, then checks the fixed user and database Operator authority. The decision body is bounded to 4096 bytes by the declared content-length check.

6. Read the response. HTTP success alone is insufficient: require the same `request_id` and `status: "authorized"`, and note `issued_at`, `not_before`, and `expires_at`. An expired request can return HTTP 200 with `status: "expired"`; that is not approval. The await step must observe `authorization_status=authorized`.

7. Keep watching the same run. Authorization lasts **at most 300 seconds after issuance**, further bounded by artifact expiry: `expires_at = min(issued_at + 300 seconds, artifact expiry)`. The workflow must consume it within that interval. The human decision does not itself deploy the site. The workflow obtains the Palisade decision, invokes the fixed Conduit route, and requires a successful consumption and deployment permit before **Deploy the bound Pages artifact** can run. Record the final run conclusion and deployment result.

## Timeout, cancellation, failure, and replay rules

If the 900-second decision window expires, or the workflow is cancelled or fails, abandon that request and run attempt. Start a **new workflow dispatch** and use its newly generated `request_id`. Do not submit a late decision, reuse an old UUID, or re-run the old workflow attempt. The same rule applies when the authorization's shorter 300-second lifetime or artifact lifetime expires, or approval becomes non-consumable.

Do not treat cancelling GitHub Actions as revoking or deleting a database authorization record. The record remains subject to expiry, terminal-state, and replay checks; leave it unused. Authorization is action-specific, terminal states are immutable, and the database-derived execution identity allows one consumption attempt. A consumed authorization cannot be reused to repair a later deployment failure.

## Current consumption path reconciled with the repository

The production workflow does **not** call `scripts/consume-github-pages-publication-authorization.mjs` directly. That separate script and `github-pages-authorization-consumption-v0` endpoint remain in the repository, but current production uses:

```text
Await fixed Operator decision
  -> Evaluate and persist exact Palisade decision
  -> Invoke fixed Conduit route and require deployment permit
  -> scripts/invoke-github-pages-conduit.mjs
  -> Conduit runtime -> github-pages-conduit-invocation-v0
  -> private.consume_github_pages_publication_authorization_v0
  -> Phase 5 binding checks + Phase 4 core consumption checks
  -> consumed receipt and validated deployment permit
  -> Deploy the bound Pages artifact
```

The Phase 5 migration wraps the corrective Phase 4 core. Consumption rechecks authorization and artifact expiry, exact Operator cardinality and approved identity, OIDC/run/source/manifest/artifact bindings, and same-invocation Palisade/Conduit evidence. Missing or invalid evidence fails closed; no deployment permit is issued. Operator approval is necessary but does not replace these checks.

## Historical operational lesson and evidence correction

The supplied operational summary grouped runs #47 through #50 and #52 as failures caused by missing the 900-second decision window. GitHub's historical logs confirm that timeout lesson for **#47, #48, #49, and #52**, but contradict that attribution for **#50**. Preserve the verified distinction:

| Run | Observed result |
| --- | --- |
| [#47](https://github.com/AETHERUS-MONOLITH/AETHERUS_MONOLITH/actions/runs/35502824706) | Failed awaiting the fixed-Operator decision: `authorization decision wait exceeded 900 seconds`. Deployment skipped. |
| [#48](https://github.com/AETHERUS-MONOLITH/AETHERUS_MONOLITH/actions/runs/35712325718) | Same 900-second wait failure. Deployment skipped. |
| [#49](https://github.com/AETHERUS-MONOLITH/AETHERUS_MONOLITH/actions/runs/35714563681) | Same 900-second wait failure. Deployment skipped. |
| [#50](https://github.com/AETHERUS-MONOLITH/AETHERUS_MONOLITH/actions/runs/35877396979) | Decision was observed: `authorization_status=authorized` at `2026-09-23T14:54:29.9594830Z`. Failed later: `Conduit invocation failed with 503: conduit_prepare_unavailable` at `2026-09-23T14:54:37.4611997Z`. Deployment skipped. This was not a decision-window timeout. |
| [#52](https://github.com/AETHERUS-MONOLITH/AETHERUS_MONOLITH/actions/runs/36540896429) | Failed awaiting the decision: `authorization terminal without consumable approval: expired`. Deployment skipped. |
| [#53](https://github.com/AETHERUS-MONOLITH/AETHERUS_MONOLITH/actions/runs/36861006687) | Cancelled during the decision wait, without consumption or deployment effect. Request creation had succeeded; cancellation is not record deletion. |
| [#54](https://github.com/AETHERUS-MONOLITH/AETHERUS_MONOLITH/actions/runs/36990187471) | Succeeded on the verified main SHA, including authorization, Conduit consumption/permit, and bound-artifact deployment. |

The operational lesson is to have the fixed-Operator terminal session ready before dispatch and submit the decision promptly for the current request. Recovery always starts with a fresh dispatch and UUID; first-attempt semantics prohibit workflow re-runs.

## Implementation sources checked before committing

These sources were read at the verified baseline; the runbook adds no runtime or authorization changes.

| Source | Reconciled behavior |
| --- | --- |
| [Production workflow](../../.github/workflows/pages-runtime-config.yml) | Fixed actor/IDs, triggering actor, first attempt, main ref, dispatch event, step order, Conduit permit before deployment. |
| [Authorization contract](../../contracts/github-pages-publication-authorization-v0.json) and [shared constants](../../scripts/lib/github-pages-governable.mjs) | Fixed identities, 900-second request wait, 300-second authorization TTL, replay and terminal states. |
| [Request script](../../scripts/request-github-pages-publication-authorization.mjs) and [request Edge Function](../../supabase/functions/github-pages-authorization-request-v0/index.ts) | Current-run request creation, emitted UUID, manifest-bound receipt, status polling and refreshed OIDC. |
| [Decision Edge Function](../../supabase/functions/github-pages-authorization-decision-v0/index.ts) and [decision library](../../supabase/functions/github-pages-authorization-decision-v0/lib.ts) | POST/no query/no Origin, fixed session authentication, exactly three fields, reason bound. |
| [Corrective authorization migration](../../supabase/migrations/20260717122122_github_pages_publication_authorization_v0_corrective_closure.sql) | Database request and approval deadlines bounded by artifact expiry, Operator cardinality, terminality and core consumption. |
| [Palisade/Conduit integration migration](../../supabase/migrations/20260717140755_github_pages_palisade_conduit_runtime_integration_v0.sql) | Current consumption wrapper, same-invocation evidence, core checks and deployment permit. |
| [Conduit invocation script](../../scripts/invoke-github-pages-conduit.mjs), [Conduit runtime](../../conduit/runtime/v0/conduit-github-pages-outward-publication-v0.mjs), and [Conduit Edge Function](../../supabase/functions/github-pages-conduit-invocation-v0/index.ts) | Production consumption transport and permit validation. |
| [Separate consumption script](../../scripts/consume-github-pages-publication-authorization.mjs) and [consumption Edge Function](../../supabase/functions/github-pages-authorization-consumption-v0/index.ts) | Existing separate path distinguished from the current workflow's Conduit path. |

Historical run conclusions, steps, and error lines above were checked through read-only GitHub Actions queries on 2026-10-02. No deployment or authorization request was made to validate this documentation.
