# Option E 0.5 Persistence / Audit Log Schema Planning

## Purpose

Option E 0.5 defines the planning baseline for persistence, audit-log separation, trace records, retention, deletion, export, and future ledger boundaries before any Section 1.2 Direct UI Membrane implementation work.

This pass distinguishes future application data, tenant-owned records, review-state records, trace records, audit logs, local `.track3-runs/` outputs, and any future ledger-like infrastructure.

This is planning and specification only. It does not implement Section 1.2 and does not authorize runtime UI behavior, authentication, backend routes, database behavior, persistence, billing, public gallery behavior, public NEXUS execution, Palisade, Weave, customer data handling, tenant infrastructure, production deployment, operational release authority, runtime monitoring, audit-log infrastructure, ledger infrastructure, or compliance certification.

## Current Object Status

Section 1.2 Direct UI Membrane remains not instantiated.

No authenticated or interactive Direct UI Membrane exists yet.

No backend, authentication system, database, persistence layer, billing integration, tenant infrastructure, audit-log infrastructure, Palisade runtime, Weave runtime, or public NEXUS runtime exists.

AETHERUS_MONOLITH / Section 1.1 remains the instantiated static public artifact. It is the current static, browser-side, deterministic, scenario-driven, non-persistent, prototype-facing public Facade.

This document is planning only. It is not implementation, not a database schema, not an audit-log system, not a ledger, and not evidence of an operational persistence boundary.

## Relationship To Option E 0.1-0.4

Option E 0.1 defined the architecture domains and unresolved implementation questions required before any future Section 1.2 implementation work.

Option E 0.2 defined threat and data-boundary constraints that any future architecture must respect.

Option E 0.3 evaluated backend service-tier options.

Option E 0.4 defined authentication and tenant-isolation requirements.

Option E 0.5 defines persistence and audit-log requirements that any future implementation must respect.

This pass does not choose a database, create schemas, create migrations, create RLS policies, create audit-log infrastructure, create ledger infrastructure, implement retention/deletion/export flows, or authorize Section 1.2 implementation.

## Persistence Domains

### A. Static Public Metadata

Examples: docs cards, public concept-copy metadata.

Current storage: static repo/site.

Future status: remains public/static unless explicitly changed.

Risk: claim escalation if wording implies live capability, authenticated product behavior, tenant data, public runtime execution, or compliance evidence.

### B. Tenant-Owned Application Data

Examples: workspace metadata, evidence/artifact records, review states, reviewer notes.

Future storage: tenant-scoped database only.

Risk: cross-tenant leakage, unclear retention, unauthorized access, or durable storage before deletion/export requirements are defined.

### C. Identity And Access Data

Examples: users, auth-provider IDs, tenant memberships, role assignments, session metadata.

Future storage: auth/provider plus tenant-scoped access-control records.

Risk: stale access, account compromise, role confusion, or tenant membership ambiguity.

### D. Review-State Records

Examples: Freeze, Repair, Escalate, Mark State, Required Proof, Boundary Conflict.

Future storage: tenant-scoped persistence only if authorized.

Risk: review state mistaken for operational release authority.

### E. Trace Records

Examples: reviewer flow transitions, state markings, evidence-review steps.

Future storage: separate trace store if authorized.

Risk: trace records mistaken for immutable audit ledger or compliance evidence.

### F. Audit Logs

Examples: who accessed what tenant data and when, role changes, export/deletion events.

Future storage: separate audit-log write path.

Risk: tampering, incomplete write path, missing actor/tenant context, or compliance overclaim.

### G. Billing Records

Examples: Stripe customer IDs, subscription state, checkout session references, webhook events.

Future storage: billing integration and tenant/account mapping.

Risk: billing-to-tenant mismatch, webhook spoofing, overcollection, or unauthorized subscription-state changes.

### H. Secrets And Key Metadata

Examples: key references, tenant-key identifiers, secrets metadata.

Future storage: secrets/key-management system, not repo.

Risk: repository exposure, weak key separation, raw database exposure, or key metadata misclassified as ordinary tenant data.

### I. Conduit / Vault Runtime Records, Future Only

Examples: future NEXUS adapter outputs, risk verdicts, governance classifications.

Future storage: only if public runtime is separately authorized.

Risk: confusing local evidence with production runtime or storing NEXUS/Vault output without a tenant boundary.

### J. Local Evidence Outputs

Examples: `.track3-runs/` reports, local validation output.

Current storage: ignored local output only.

Risk: treating local reports as production audit infrastructure, tenant production evidence, or an immutable ledger.

## Data Classification Table

| Data class | Example records | Tenant-scoped? | Audit-required? | Retention-sensitive? | Export/delete requirement? | Current status | Required future control |
|------------|-----------------|----------------|-----------------|----------------------|----------------------------|----------------|-------------------------|
| Public docs metadata | docs cards, public concept copy | no | no | low | repository change control only | static repo/site exists | Claim-boundary review |
| User identity records | users, email, auth-provider ID | yes, through account/tenant linkage | yes | high | account export/deletion rules required | not implemented | Auth provider/model decision |
| Tenant/workspace records | tenant ID, workspace name | yes | yes | high | tenant export/deletion strategy required | not implemented | Tenant schema and RLS model |
| Tenant membership records | user-to-tenant membership | yes | yes | high | membership history rules required | not implemented | Membership table and audit path |
| RBAC role assignments | Owner, Admin, Reviewer, Viewer | yes | yes | high | role-change history rules required | not implemented | Role assignment table and RBAC checks |
| Evidence/artifact records | uploaded artifact metadata, proof status | yes | yes | high | export/deletion strategy required | not implemented | Tenant-scoped persistence and retention class |
| Review notes | reviewer comments, boundary notes | yes | yes | high | export/deletion strategy required | not implemented | Tenant-scoped note model and audit path |
| Review-state records | Freeze, Repair, Escalate, Mark State | yes | yes | medium to high | export/deletion rules required | not implemented | Tenant-scoped state model |
| Trace records | flow transitions, state markings | yes, if persisted | maybe, depending on event | medium to high | retention rules required | not implemented | Trace-store authorization and classification |
| Audit logs | access/action accountability events | yes | intrinsic | high | separate retention rules required | not implemented | Separate audit-log write path |
| Billing references | Stripe customer ID, subscription ID | yes, through account/tenant mapping | yes | high | payment/legal rules may apply | not implemented | Billing mapping model |
| Webhook events | Stripe webhook receipt, event ID | yes, through resolved tenant/account | yes | high | retention rules required | not implemented | Signature verification and idempotency model |
| Secrets/key references | tenant-key ID, secret reference | tenant-aware | yes | critical | not ordinary exportable data | not implemented | Secret/key-management system |
| NEXUS/Vault outputs, future only | verdicts, classifications, adapter outputs | yes, if authorized | yes | medium to high | retention rules required | not implemented | Authorized runtime boundary and tenant scoping |
| Local `.track3-runs/` outputs | local reports, local validation output | no production tenant scope | no production audit claim | local-only | not production export/delete artifact | ignored local output only | Preserve local evidence boundary |

## Audit-Log Separation Requirements

Future audit-log planning requires:

- audit logs must be separate from ordinary application logs
- audit logs must include actor, tenant, action, target, timestamp, and source context
- role changes must be auditable
- access to tenant-owned records must be auditable
- export/deletion events must be auditable
- billing mapping changes must be auditable
- audit logs must not be editable through ordinary application flows
- audit-log design must not be called immutable unless an actual immutability/hash-chain design exists
- no current audit-log infrastructure exists

Application logs may support debugging and operations. They must not be presented as compliance-grade audit records without a separate audit-log design.

## Draft Audit-Log Event Taxonomy

This taxonomy is planning-only. No event emitter, schema, table, store, or audit infrastructure is implemented.

| Event class | Purpose | Minimum fields | Current status |
|-------------|---------|----------------|----------------|
| AUTH_LOGIN_SUCCESS | Record successful authentication | event_id, event_type, timestamp, actor_type, actor_id, tenant_id if resolved, result, source context, correlation_id, redaction_status, retention_class | not implemented / planning only |
| AUTH_LOGIN_FAILURE | Record failed authentication attempt | event_id, event_type, timestamp, actor_type, actor_id if known, result, source context, correlation_id, redaction_status, retention_class | not implemented / planning only |
| MFA_CHALLENGE | Record MFA challenge event | event_id, event_type, timestamp, actor_type, actor_id, result, auth/session reference, correlation_id, redaction_status, retention_class | not implemented / planning only |
| MFA_RECOVERY_USED | Record MFA recovery path use | event_id, event_type, timestamp, actor_type, actor_id, result, source context, correlation_id, redaction_status, retention_class | not implemented / planning only |
| SESSION_REVOKED | Record session revocation | event_id, event_type, timestamp, actor_type, actor_id, target_type, target_id, action, result, auth/session reference, correlation_id, retention_class | not implemented / planning only |
| TENANT_MEMBER_ADDED | Record tenant membership addition | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| TENANT_MEMBER_REMOVED | Record tenant membership removal | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| ROLE_ASSIGNED | Record role assignment | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| ROLE_REVOKED | Record role revocation | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| EVIDENCE_RECORD_CREATED | Record evidence/artifact record creation | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, workspace_id, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| EVIDENCE_RECORD_VIEWED | Record access to evidence/artifact record | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, workspace_id, target_type, target_id, action, result, source context, correlation_id, retention_class | not implemented / planning only |
| EVIDENCE_RECORD_UPDATED | Record evidence/artifact update | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, workspace_id, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| REVIEW_STATE_MARKED | Record review-state marking | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, workspace_id, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| REVIEW_NOTE_RECORDED | Record reviewer note creation | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, workspace_id, target_type, target_id, action, result, correlation_id, redaction_status, retention_class | not implemented / planning only |
| EXPORT_REQUESTED | Record export request | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, workspace_id if applicable, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| DELETE_REQUESTED | Record deletion request | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, workspace_id if applicable, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| BILLING_CUSTOMER_LINKED | Record billing customer-to-tenant/account link | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| BILLING_WEBHOOK_RECEIVED | Record billing webhook receipt | event_id, event_type, timestamp, actor_type, actor_id if applicable, tenant_id if resolved, target_type, target_id, action, result, source context, correlation_id, retention_class | not implemented / planning only |
| SERVICE_ACCOUNT_ACTION | Record scoped service identity action | event_id, event_type, timestamp, actor_type, actor_id, tenant_id if applicable, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| FUTURE_NEXUS_VERDICT_RECORDED | Record future authorized NEXUS/Vault verdict | event_id, event_type, timestamp, actor_type, actor_id, tenant_id, workspace_id, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| FUTURE_PALISADE_DECISION_RECORDED | Record future authorized Palisade decision | event_id, event_type, timestamp, actor_type, actor_id, tenant_id if applicable, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |
| FUTURE_WEAVE_WORKFLOW_EVENT_RECORDED | Record future authorized Weave workflow event | event_id, event_type, timestamp, actor_type, actor_id, tenant_id if applicable, workspace_id if applicable, target_type, target_id, action, result, correlation_id, retention_class | not implemented / planning only |

## Minimum Audit-Log Fields

Future audit-log events require these minimum fields:

- event_id
- event_type
- timestamp
- actor_type
- actor_id
- tenant_id
- workspace_id, if applicable
- target_type
- target_id
- action
- result
- source_ip or request context, if applicable
- auth/session reference, if applicable
- correlation_id
- previous_state_hash, optional/future only
- payload_hash, optional/future only
- redaction_status
- retention_class

Hash-chain or immutability fields are future-only and are not currently implemented.

## Trace Record Boundary

Trace records explain review progression.

Audit logs record access/action accountability.

Trace records are not automatically compliance evidence.

Trace records are not an immutable ledger.

Trace records require tenant scoping if persisted.

No current trace store exists.

## Retention / Deletion / Export Planning

Future retention, deletion, and export planning requires:

- retention classes must be specified before persistence
- tenant-owned records require export/deletion strategy
- audit logs may require separate retention rules
- billing records may be governed by payment/legal obligations
- secrets/key records are not ordinary exportable data
- local `.track3-runs/` reports are not production-retention artifacts
- no retention/deletion/export system exists

Retention cannot be inferred from display state or local evidence output. It must be designed as part of future persistence work.

## Ledger Boundary

A production audit ledger does not exist.

`.track3-runs/` is not a persistent audit ledger.

JSONL/local reports are not production audit infrastructure.

Any future immutable or hash-chained ledger requires explicit design, threat model, storage decision, tamper model, and validation tests.

Do not claim ledger immutability before implementation.

## Persistence Failure Modes

| Failure mode | Risk | Affected boundary | Required future control | Current status |
|--------------|------|-------------------|-------------------------|----------------|
| Tenant-owned record missing tenant_id | Record cannot be safely scoped or isolated | Tenant persistence, database, RLS | Required tenant_id, schema constraints, RLS tests | not implemented / planning only |
| Audit log missing actor | Accountability cannot be established | Audit-log boundary | Required actor_type and actor_id fields | not implemented / planning only |
| Audit log missing tenant_id | Tenant-scoped investigation fails | Audit-log boundary, tenant boundary | Required tenant_id when event is tenant-scoped | not implemented / planning only |
| Review trace mistaken for audit log | Review progression is overclaimed as accountability evidence | Trace boundary, audit boundary | Separate trace/audit schemas and claim language | not implemented / planning only |
| Local `.track3-runs/` treated as production ledger | Local evidence is misrepresented as durable audit infrastructure | Local evidence boundary, ledger boundary | Preserve ignored/local status and separate future ledger design | not implemented / planning only |
| Deletion request not propagated | Tenant-owned data remains after deletion workflow | Persistence, retention/deletion boundary | Deletion request model, propagation tracking, audit event | not implemented / planning only |
| Export includes another tenant's records | Cross-tenant data leakage through export | Tenant persistence, export boundary | Tenant-scoped export queries, RLS tests, negative tests | not implemented / planning only |
| Billing webhook writes wrong tenant mapping | Subscription state affects wrong tenant/workspace | Billing, tenant mapping | Signature verification, idempotency, reconciliation, tenant mapping checks | not implemented / planning only |
| Service account writes unaudited data | Internal action avoids accountability | Service identity, audit boundary | Scoped service accounts and mandatory audit write path | not implemented / planning only |
| NEXUS/Vault output persisted without authorization | Local/future runtime output becomes unscoped production data | Conduit/Vault, persistence, tenant boundary | Runtime authorization, tenant-scoped storage, audit event | not implemented / planning only |
| Palisade decision claimed before Palisade exists | Policy enforcement is overclaimed | Palisade boundary, public claim boundary | Separate Palisade authorization and decision/audit design | not implemented / planning only |
| Weave workflow event claimed before Weave exists | Orchestration durability is overclaimed | Weave boundary, trace boundary | Separate Weave authorization and workflow event model | not implemented / planning only |
| Secrets stored in repo | Secrets leak through source control | Secrets/key boundary | External secret store, secret scanning, rotation procedure | not implemented / planning only |
| Raw customer document stored without retention model | Sensitive data becomes durable without governance | Tenant persistence, retention boundary | Storage authorization, retention/deletion/export model | not implemented / planning only |
| Audit log editable through normal application path | Accountability records can be altered casually | Audit-log boundary | Separate write path, restricted modification semantics, tamper model | not implemented / planning only |

## Required Future Schema Decisions

The following decisions are required before implementation:

- database type and ownership model
- tenant table and workspace table relationship
- user/identity table relationship
- tenant membership table
- role assignment table
- evidence/artifact table
- review-state table
- review-note table
- trace-event table, if authorized
- audit-log table/store
- billing mapping table
- export/deletion request table
- service-account identity model
- retention-class model
- redaction model
- hash/payload reference model, future only

## Rejected Patterns

The following patterns are rejected:

- using application logs as audit logs
- claiming immutable ledger before ledger design exists
- treating `.track3-runs/` as production persistence
- persisting tenant data without tenant_id
- relying on client-provided tenant ID
- storing secrets in repo
- storing raw customer documents before retention/deletion model
- storing NEXUS runtime outputs before runtime authorization
- conflating trace records with compliance evidence
- using UI state as persistence authority

## Current Non-Implementation Declaration

Option E 0.5 does not implement or instantiate:

- Section 1.2
- backend
- auth
- database
- persistence
- billing
- tenant infrastructure
- RLS
- audit-log infrastructure
- audit ledger
- Palisade
- Weave
- public NEXUS runtime
- production deployment
- compliance certification

It also does not add routes, runtime UI behavior, JavaScript behavior, CSS behavior, public gallery behavior, database migrations, RLS policies, Stripe integration, API endpoints, server files, package dependencies, ledger infrastructure, or customer workspace behavior.

## Relationship To Next Option E Pass

The natural next pass after Option E 0.5 may be:

- Option E 0.6 - Database / RLS Policy Planning Baseline
- Option E 0.6 - Audit Log Event Contract Draft

This document does not start Option E 0.6.
