# Option E 0.7 Audit Log Event Contract Draft

## Purpose

Option E 0.7 is a planning-only audit-log event contract draft for future Section 1.2 Direct UI Membrane architecture.

This pass refines the audit-log taxonomy introduced in Option E 0.5 into structured future event-contract expectations. It does not implement audit infrastructure, persistence, a ledger, backend services, authentication, database behavior, routes, or runtime behavior.

## Current Object Status

Section 1.2 Direct UI Membrane remains not instantiated.

No authenticated or interactive Direct UI Membrane exists yet.

No backend, authentication system, database, persistence layer, audit-log infrastructure, audit ledger, Palisade runtime, Weave runtime, or public NEXUS runtime exists.

This document is not implementation. It is planning only.

## Relationship To Option E 0.5 And 0.6

Option E 0.5 defined persistence and audit-log planning, including audit-log separation, event taxonomy, minimum fields, trace boundaries, retention/deletion/export planning, and ledger boundaries.

Option E 0.6 defined database/RLS planning, including tenant context propagation, tenant-scoped table families, RLS principles, query-safety requirements, and database/RLS failure modes.

Option E 0.7 defines event-contract expectations that future audit-log infrastructure must satisfy if implementation is later authorized.

## Audit-Log Event Contract Principles

Future audit-log event planning must follow these principles:

- audit logs are separate from application logs
- audit events must include actor, tenant, action, target, timestamp, result, and correlation context
- tenant-scoped events must include `tenant_id`
- audit events must not be editable through ordinary application flows
- immutability/hash-chain claims are future-only
- audit logs are not implemented in this pass

Application debug logs, local reports, and trace records must not be reclassified as production audit logs.

## Event Envelope Draft

The future planning-only event envelope contains:

- event_id
- event_type
- occurred_at
- actor_type
- actor_id
- tenant_id
- workspace_id, if applicable
- target_type
- target_id
- action
- result
- request_context
- auth_session_reference
- correlation_id
- redaction_status
- retention_class
- payload_hash, future only
- previous_event_hash, future only

`payload_hash` and `previous_event_hash` are future-only. They must not be used to imply immutability or hash-chain behavior before an actual ledger/tamper model is designed and implemented.

## Event Taxonomy

The following event classes are planning-only. No event emitter, audit store, schema, table, route, or service is implemented.

| Event class | Purpose | Minimum fields | Tenant-bound? | Current status |
|-------------|---------|----------------|---------------|----------------|
| AUTH_LOGIN_SUCCESS | Record successful authentication | envelope plus actor, result, request_context, auth_session_reference | no, unless tenant is resolved | not implemented / planning only |
| AUTH_LOGIN_FAILURE | Record failed authentication attempt | envelope plus actor if known, result, request_context, correlation_id | no, unless tenant is resolved | not implemented / planning only |
| MFA_CHALLENGE | Record MFA challenge presentation/result | envelope plus actor, result, auth_session_reference | no, unless tenant is resolved | not implemented / planning only |
| MFA_RECOVERY_USED | Record use of MFA recovery path | envelope plus actor, action, result, request_context | no, unless tenant is resolved | not implemented / planning only |
| SESSION_REVOKED | Record session revocation | envelope plus actor, target session, result, auth_session_reference | no, unless tenant is resolved | not implemented / planning only |
| TENANT_MEMBER_ADDED | Record tenant membership addition | envelope plus actor, tenant_id, target user, action, result | yes | not implemented / planning only |
| TENANT_MEMBER_REMOVED | Record tenant membership removal | envelope plus actor, tenant_id, target user, action, result | yes | not implemented / planning only |
| ROLE_ASSIGNED | Record tenant-bound role assignment | envelope plus actor, tenant_id, target user, role target, result | yes | not implemented / planning only |
| ROLE_REVOKED | Record tenant-bound role revocation | envelope plus actor, tenant_id, target user, role target, result | yes | not implemented / planning only |
| EVIDENCE_RECORD_CREATED | Record evidence/artifact creation | envelope plus actor, tenant_id, workspace_id, target record, result | yes | not implemented / planning only |
| EVIDENCE_RECORD_VIEWED | Record access to evidence/artifact record | envelope plus actor, tenant_id, workspace_id, target record, request_context | yes | not implemented / planning only |
| EVIDENCE_RECORD_UPDATED | Record evidence/artifact update | envelope plus actor, tenant_id, workspace_id, target record, result | yes | not implemented / planning only |
| REVIEW_STATE_MARKED | Record conceptual review-state marking | envelope plus actor, tenant_id, workspace_id, target state, result | yes | not implemented / planning only |
| REVIEW_NOTE_RECORDED | Record reviewer note creation | envelope plus actor, tenant_id, workspace_id, target note, redaction_status | yes | not implemented / planning only |
| TRACE_EVENT_RECORDED | Record future trace event write if authorized | envelope plus actor/service, tenant_id, target trace event, classification | yes | not implemented / planning only |
| EXPORT_REQUESTED | Record tenant data export request | envelope plus actor, tenant_id, target export scope, result | yes | not implemented / planning only |
| DELETE_REQUESTED | Record tenant data deletion request | envelope plus actor, tenant_id, target deletion scope, result | yes | not implemented / planning only |
| BILLING_CUSTOMER_LINKED | Record billing customer-to-tenant link | envelope plus actor, tenant_id, billing target, result | yes | not implemented / planning only |
| BILLING_WEBHOOK_RECEIVED | Record verified billing webhook receipt | envelope plus service actor, tenant_id if resolved, webhook target, result | conditional | not implemented / planning only |
| SERVICE_ACCOUNT_ACTION | Record scoped service identity action | envelope plus service actor, target, action, result | conditional | not implemented / planning only |
| FUTURE_NEXUS_VERDICT_RECORDED | Record future authorized NEXUS/Vault verdict | envelope plus actor/service, tenant_id, workspace_id, verdict target, result | yes, future only | not implemented / planning only |
| FUTURE_PALISADE_DECISION_RECORDED | Record future authorized Palisade decision | envelope plus actor/service, tenant_id if applicable, policy target, result | conditional, future only | not implemented / planning only |
| FUTURE_WEAVE_WORKFLOW_EVENT_RECORDED | Record future authorized Weave workflow event | envelope plus actor/service, tenant_id if applicable, workflow target, result | conditional, future only | not implemented / planning only |

## Redaction And Retention Rules

Future redaction and retention planning requires:

- no raw secrets in audit logs
- no raw customer documents in audit logs by default
- sensitive payloads require references/hashes rather than full content
- retention class required
- deletion/export events auditable
- audit log retention may differ from application data retention

Redaction status must be explicit. Audit events must not become a side channel for secret exposure or raw customer data retention.

## Failure Modes

| Failure mode | Risk | Required future control | Current status |
|--------------|------|-------------------------|----------------|
| Audit event missing actor | Accountability cannot be established | Required actor_type and actor_id validation | not implemented / planning only |
| Audit event missing tenant_id | Tenant-scoped event cannot be investigated safely | Tenant_id required for tenant-scoped events | not implemented / planning only |
| Event editable through app path | Audit record can be casually altered | Separate audit write path and restricted mutation model | not implemented / planning only |
| Audit logs mixed with application logs | Debug records are overclaimed as audit evidence | Separate audit-log store/schema and claim boundary | not implemented / planning only |
| Event payload stores raw sensitive data | Audit log becomes uncontrolled sensitive-data store | Redaction rules and payload reference/hash model | not implemented / planning only |
| Hash-chain fields claimed before implementation | Immutability is overclaimed | Future-only hash fields and explicit ledger design gate | not implemented / planning only |
| Local `.track3-runs/` mistaken for audit log | Local evidence is misclassified as production audit infrastructure | Preserve ignored/local evidence boundary | not implemented / planning only |
| Palisade/Weave/NEXUS event claimed before systems exist | Runtime/enforcement/orchestration is overclaimed | Future-only event classes and explicit authorization boundary | not implemented / planning only |

## Required Future Tests

Future implementation work must define and pass:

- event schema validation tests
- missing actor negative tests
- missing tenant negative tests
- redaction tests
- retention-class tests
- role-change audit tests
- export/delete audit tests
- service-account audit tests

No tests are implemented in this pass.

## Non-Implementation Declaration

Option E 0.7 does not implement:

- Section 1.2
- audit logs
- persistence
- audit ledger
- backend
- auth
- database
- Palisade
- Weave
- public NEXUS runtime

It also does not create routes, runtime UI behavior, JavaScript behavior, CSS behavior, public gallery behavior, audit-log infrastructure, ledger infrastructure, database migrations, RLS policies, SQL files, API endpoints, server files, package dependencies, or customer workspace behavior.

## Next Pass Relationship

Option E 0.8 follows with secrets / key-management boundary planning.
