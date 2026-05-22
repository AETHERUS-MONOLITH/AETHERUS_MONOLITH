# Option E 0.6 Database / RLS Policy Planning Baseline

## Purpose

Option E 0.6 defines the database and Row-Level Security planning baseline before any Section 1.2 Direct UI Membrane implementation work.

This pass defines future database ownership assumptions, tenant-scoped table families, RLS policy principles, tenant context propagation requirements, deny-by-default posture, query-safety requirements, testing requirements before implementation, known database/RLS failure modes, and boundaries between database records, audit logs, trace records, billing mappings, and future NEXUS/Vault records.

This is planning and specification only. It does not implement Section 1.2 and does not authorize runtime UI behavior, authentication, backend routes, database behavior, persistence, billing, public gallery behavior, public NEXUS execution, Palisade, Weave, customer data handling, tenant infrastructure, production deployment, operational release authority, runtime monitoring, audit-log infrastructure, ledger infrastructure, or compliance certification.

## Current Object Status

Section 1.2 Direct UI Membrane remains not instantiated.

No authenticated or interactive Direct UI Membrane exists yet.

No backend, authentication system, database, persistence layer, billing integration, tenant infrastructure, RLS, audit-log infrastructure, Palisade runtime, Weave runtime, or public NEXUS runtime exists.

AETHERUS_MONOLITH / Section 1.1 remains the instantiated static public artifact. It is the current static, browser-side, deterministic, scenario-driven, non-persistent, prototype-facing public Facade.

This document is planning only. It is not implementation, not a database schema, not a migration, not an RLS policy set, not tenant infrastructure, and not evidence of an operational database boundary.

## Relationship To Option E 0.1-0.5

Option E 0.1 defined architecture domains.

Option E 0.2 defined threat and data-boundary constraints.

Option E 0.3 recommended hybrid managed data plus explicit service tier as a planning direction.

Option E 0.4 defined authentication and tenant-isolation requirements.

Option E 0.5 defined persistence, audit-log, trace, retention, and ledger boundaries.

Option E 0.6 defines the database/RLS policy planning baseline those prior requirements imply.

This pass does not choose a database, create schemas, create SQL files, create migrations, create RLS policies, create tenant infrastructure, implement tests, or authorize Section 1.2 implementation.

## Database Posture

One database may be used, but tenant isolation must be designed as if each tenant had a separate database.

Database-level RLS is mandatory for tenant-owned data.

Application-level filtering alone is rejected.

Tenant context must be set server-side.

Client-provided tenant context is not trusted.

Every tenant-owned query must be tenant-bound.

No current database exists.

## Future Table-Family Planning Model

This section defines planning-only table families. It does not create schemas, SQL, migrations, RLS policies, or persistence.

| Table family | Future purpose | Tenant-scoped? | RLS relevance | Warning |
|--------------|----------------|----------------|---------------|---------|
| tenants | Stable tenant/workspace boundary root | Root of tenant scoping | Central tenant identity | Not implemented |
| users / identities | Identity records or auth-provider references | No, identity may relate to multiple tenants | Must not grant tenant access by itself | Identity is not membership |
| tenant_memberships | Bind users to tenants | Yes | Primary access bridge | Membership must be server-resolved |
| role_assignments | RBAC role binding within tenant | Yes | Role must be tenant-bound | Role outside tenant scope is rejected |
| workspaces | Tenant-contained review workspace | Yes | Must carry tenant_id | Workspace state is not production authority by itself |
| evidence_artifacts | Artifact/evidence metadata and reviewable records | Yes | Must carry tenant_id | Retention/export/deletion required before storage |
| review_notes | Reviewer notes and concept notes | Yes | Must carry tenant_id | Notes may contain sensitive assessments |
| review_states | Freeze / Repair / Escalate conceptual state records | Yes | Must carry tenant_id | Must not imply operational release authority |
| trace_events | Review-flow progression records if authorized | Yes | Must carry tenant_id | Trace is not audit ledger |
| audit_log_events | Access/action accountability | Yes where applicable | Read access may be more restrictive than ordinary app data | Separate write path from ordinary app records |
| billing_accounts | Tenant/account relationship to billing provider | Yes | Tenant mapping must be protected | Billing authority is not evidence authority |
| webhook_events | Billing or external event receipt | Conditional | Verified server-side mapping required | Webhooks are not trusted until verified |
| service_accounts | Internal non-human identity | Conditional | Tightly scoped and auditable | No broad unlogged access |
| future_nexus_vault_records | Future NEXUS/Vault outputs if public runtime is separately authorized | Yes if persisted | Must never be persisted without explicit runtime authorization | Future-only |

## Tenant Context Propagation Requirements

Tenant context must be resolved server-side from authenticated identity and membership.

`tenant_id` must not be accepted as authoritative from the browser.

Tenant context must be bound to each request before data access.

Tenant context must be propagated to database session/policy context.

Every tenant-owned table must carry `tenant_id` or an equivalent enforceable tenant boundary.

All writes to tenant-owned records must bind `tenant_id` server-side.

No current tenant context mechanism exists.

## RLS Policy Principles

Future RLS planning must follow these principles:

- deny by default
- tenant-owned rows visible only to authorized tenant members
- role-sensitive access layered on top of tenant membership
- write policies stricter than read policies
- admin rights are tenant-bound, not global by default
- service accounts have explicit least-privilege scopes
- audit-log read/write policy is stricter than ordinary app data
- billing mappings require server-verified tenant linkage
- future NEXUS/Vault output rows, if authorized, must be tenant-scoped
- no RLS policies are implemented in this pass

## RLS Policy Matrix

| Table family | tenant_id required? | Read policy principle | Write policy principle | Admin exception? | Service-account exception? | Audit requirement | Current status |
|--------------|---------------------|-----------------------|------------------------|------------------|----------------------------|-------------------|----------------|
| tenants | yes, as root identity | Authorized tenant members may resolve allowed tenant metadata | Creation/update only through authorized service/admin path | Tenant-bound only; no global bypass by default | Explicit provisioning scope only | Tenant create/update auditable | not implemented / planning only |
| users / identities | no direct tenant_id required | User may read own identity; tenant access requires membership | Identity changes through auth/provider boundary | No tenant data access from identity alone | Explicit identity sync scope only | Identity-sensitive changes auditable | not implemented / planning only |
| tenant_memberships | yes | Tenant members/admins may read according to role | Admin/service-only membership changes | Tenant-bound admin only | Explicit membership management scope | Add/remove auditable | not implemented / planning only |
| role_assignments | yes | Tenant admins may read role assignments within tenant | Role changes through authorized tenant admin/service path | Tenant-bound admin only | Explicit role management scope | Assign/revoke auditable | not implemented / planning only |
| workspaces | yes | Authorized tenant members may read assigned workspace records | Writes require tenant role authorization | Tenant-bound admin/owner only | Explicit workspace service scope | Workspace create/update auditable | not implemented / planning only |
| evidence_artifacts | yes | Authorized reviewers/members may read within tenant/workspace scope | Writes require evidence-specific role and tenant binding | Tenant-bound admin only with audit | Explicit artifact service scope | Create/view/update auditable | not implemented / planning only |
| review_notes | yes | Authorized reviewers/members may read according to role | Writes require reviewer/admin role and tenant binding | Tenant-bound admin only with audit | Explicit note service scope | Note create/update auditable | not implemented / planning only |
| review_states | yes | Authorized reviewers/members may read within tenant/workspace scope | State changes require explicit role authorization | Tenant-bound admin/owner only with audit | Explicit state service scope | State marking auditable | not implemented / planning only |
| trace_events | yes | Authorized tenant readers may read if trace store is authorized | Writes through service path only | Tenant-bound admin read only if authorized | Explicit trace writer scope | Trace writes classified and auditable as needed | not implemented / planning only |
| audit_log_events | yes where applicable | More restrictive than ordinary app data; likely owner/admin/security role | Writes only through audit write path | No ordinary admin edit path | Explicit audit writer scope only | Intrinsic audit record | not implemented / planning only |
| billing_accounts | yes | Billing admins and authorized owners may read billing mapping | Writes through verified billing/admin service path | Tenant-bound billing/admin only | Explicit billing service scope | Link/change auditable | not implemented / planning only |
| webhook_events | conditional | Restricted operational/admin read after verification | Writes through verified webhook handler only | No ordinary app edit path | Explicit webhook handler scope | Receipt/result auditable | not implemented / planning only |
| service_accounts | conditional | Restricted security/admin read | Changes through privileged service-management path | No unlogged global admin bypass | Explicit scoped service identity | Create/update/use auditable | not implemented / planning only |
| future_nexus_vault_records | yes if authorized | Authorized tenant members may read only if runtime is authorized | Writes through authorized runtime integration only | Tenant-bound admin read only if authorized | Explicit NEXUS/Vault integration scope | Verdict/output record auditable | not implemented / planning only |

## Query Safety Requirements

Future query safety requires:

- every query touching tenant-owned data must bind tenant context
- no broad `SELECT` over tenant-owned data without tenant filter and RLS enforcement
- no client-controlled tenant switching
- no cross-tenant joins over raw tenant data unless explicitly authorized and anonymized
- no analytics over raw cross-tenant records
- no direct browser-to-database authority without server-side enforcement model
- query builders/service methods must make missing tenant context hard to express
- all tenant-bound repository/service methods must be testable

Missing tenant context must be treated as a security failure.

## Migration And Schema-Change Requirements

Future migration and schema-change planning requires:

- migrations must not create tenant-owned tables without `tenant_id` or equivalent boundary
- migrations must not disable RLS without explicit documented exception
- RLS policies require negative tests before production use
- schema changes affecting tenant data must include audit/retention review
- role/permission schema changes must include stale-permission analysis
- no migrations are created in this pass

## Database/RLS Failure-Mode Matrix

| Failure mode | Risk | Affected boundary | Required future control | Current status |
|--------------|------|-------------------|-------------------------|----------------|
| Tenant-owned table missing tenant_id | Rows cannot be reliably tenant-isolated | Database, tenant persistence | Schema rule requiring tenant_id or enforceable tenant boundary | not implemented / planning only |
| RLS disabled on tenant-owned table | Application bug can expose cross-tenant data | Database/RLS | RLS mandatory on tenant-owned tables, migration review, tests | not implemented / planning only |
| Permissive fallback policy | Deny-by-default posture is defeated | Database/RLS | Explicit deny-by-default policy model and negative tests | not implemented / planning only |
| Client-supplied tenant_id trusted | User can request another tenant's scope | Service tier, tenant context | Server-side tenant resolution and validated policy context | not implemented / planning only |
| Admin policy crosses tenant boundary | Admin affects another tenant | Authorization, RLS | Tenant-bound admin policy and audited exceptions | not implemented / planning only |
| Service account overbroad | Internal identity can access all tenant data | Service identity, RLS | Least-privilege service scopes and audit trail | not implemented / planning only |
| Audit-log write path bypassed | Sensitive action lacks accountability | Audit boundary, database | Mandatory audit writer for sensitive actions | not implemented / planning only |
| Trace event stored without tenant scope | Review trace leaks or loses ownership | Trace boundary, tenant persistence | Tenant-scoped trace schema if trace store is authorized | not implemented / planning only |
| Billing mapping writes wrong tenant_id | Billing state affects wrong workspace | Billing, tenant mapping | Verified billing mapping and reconciliation tests | not implemented / planning only |
| Webhook event accepted without verification | Spoofed event mutates tenant state | Webhook, billing, service tier | Signature verification, idempotency, replay handling | not implemented / planning only |
| User identity treated as tenant membership | Identity alone grants tenant data access | Auth, tenant membership | Membership bridge required for tenant access | not implemented / planning only |
| Role assignment stale after membership removal | Removed user retains access | RBAC, tenant membership | Membership removal invalidates roles/sessions, stale-permission tests | not implemented / planning only |
| Public docs metadata mixed with tenant data | Static concept data is confused with customer data | Public/concept boundary, persistence | Separate storage/classification and claim-boundary review | not implemented / planning only |
| `.track3-runs/` treated as database evidence | Local reports are misclassified as production records | Local evidence boundary, persistence | Preserve ignored/local status and separate production schema design | not implemented / planning only |
| Future NEXUS output persisted before runtime authorization | Unscoped runtime output becomes production data | NEXUS/Vault, tenant persistence | Separate runtime authorization and tenant-scoped storage design | not implemented / planning only |

## Test Requirements Before Implementation

Future implementation work must define and pass tests for:

- RLS positive tests
- RLS negative tests
- cross-tenant read denial tests
- cross-tenant write denial tests
- membership removal tests
- stale permission tests
- service-account scope tests
- billing tenant mapping tests
- webhook verification tests
- audit-log write-path tests
- tenant context missing tests
- future NEXUS/Vault persistence authorization tests, if runtime authorized

No tests are implemented in this pass.

## Rejected Patterns

The following patterns are rejected:

- application-only tenant filtering
- UI-only authorization
- trusting browser-provided `tenant_id`
- tenant-owned tables without enforceable tenant boundary
- RLS disabled by default
- global admin bypass without audit and authorization model
- service accounts with broad unlogged access
- audit logs stored only as ordinary app logs
- `.track3-runs/` treated as production database data
- direct browser-to-Vault persistence
- persisting NEXUS/Vault runtime output before explicit authorization

## Current Non-Implementation Declaration

Option E 0.6 does not implement or instantiate:

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

It also does not add routes, runtime UI behavior, JavaScript behavior, CSS behavior, public gallery behavior, database migrations, RLS policies, SQL files, Stripe integration, API endpoints, server files, package dependencies, ledger infrastructure, or customer workspace behavior.

## Relationship To Next Option E Pass

The natural next pass after Option E 0.6 may be:

- Option E 0.7 - Audit Log Event Contract Draft
- Option E 0.7 - Secrets / Key Management Boundary Planning

This document does not start Option E 0.7.
