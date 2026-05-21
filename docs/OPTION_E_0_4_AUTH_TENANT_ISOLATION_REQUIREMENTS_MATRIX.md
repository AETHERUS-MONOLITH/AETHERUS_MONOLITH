# Option E 0.4 Auth / Tenant Isolation Requirements Matrix

## Purpose

Option E 0.4 defines authentication and tenant-isolation requirements before any future Section 1.2 Direct UI Membrane backend/auth implementation work.

This pass defines the authentication, MFA, session, RBAC, tenant identifier, tenant scoping, RLS, and cross-tenant isolation requirements that a future Section 1.2 implementation must satisfy before any backend, auth, persistence, or tenant-infrastructure work can be authorized.

This is planning and specification only. It does not implement Section 1.2 and does not authorize runtime UI behavior, authentication, backend routes, database behavior, persistence, billing, public gallery behavior, public NEXUS execution, Palisade, Weave, customer data handling, tenant infrastructure, production deployment, operational release authority, runtime monitoring, or compliance certification.

## Current Object Status

Section 1.2 Direct UI Membrane remains not instantiated.

No authenticated or interactive Direct UI Membrane exists yet.

No backend, authentication system, database, persistence layer, billing integration, Palisade runtime, Weave runtime, tenant infrastructure, or public NEXUS runtime exists.

AETHERUS_MONOLITH / Section 1.1 remains the instantiated static public artifact. It is the current static, browser-side, deterministic, scenario-driven, non-persistent, prototype-facing public Facade.

This document is planning only. It is not implementation, not an auth design selection, not tenant infrastructure, not an RLS policy set, and not evidence of an operational security boundary.

## Relationship To Option E 0.1-0.3

Option E 0.1 defined the architecture domains and unresolved implementation questions required before any future Section 1.2 implementation work.

Option E 0.2 defined threat and data-boundary constraints that any future architecture must respect.

Option E 0.3 evaluated backend service-tier options and recommended hybrid managed data plus explicit service tier as a planning direction.

Option E 0.4 defines the authentication and tenant-isolation requirements that any future service-tier choice must satisfy.

This pass does not choose an auth provider, create tenant infrastructure, define database migrations, implement RLS policies, create sessions, or authorize Section 1.2 implementation.

## Authentication Requirements

| Requirement | Risk addressed | Future control | Current status |
|-------------|----------------|----------------|----------------|
| Email/password baseline | No consistent baseline identity model for reviewer accounts | Select an auth model that supports secure email/password account lifecycle | not implemented / planning only |
| MFA required | Compromised password grants account access | Require MFA enrollment and verification for accounts | not implemented / planning only |
| Secure session lifecycle | Long-lived or unmanaged sessions remain valid after risk changes | Define expiry, rotation, revocation, device visibility, and high-risk action handling | not implemented / planning only |
| Password policy | Weak credentials increase compromise risk | Define password strength, reset, lockout, and breached-password handling expectations | not implemented / planning only |
| Account recovery boundary | Recovery path bypasses MFA or tenant controls | Design recovery flows that preserve MFA and administrative review boundaries | not implemented / planning only |
| Suspicious-activity detection requirement | Account compromise remains unnoticed | Define future detection, alerting, lockout, and review requirements | not implemented / planning only |
| Service-side session validation | Client-only session state is trusted | Validate identity and session state server-side for every sensitive request | not implemented / planning only |
| No UI-only authentication state | UI display is mistaken for authentication | Treat browser state as display-only, never as proof of identity | not implemented / planning only |
| No auth secrets in repository | Secrets leak through source control | Store secrets only in a future secret-management system | not implemented / planning only |
| Social login optional | External identity providers complicate account linking | Defer social login unless it strengthens the selected auth model | not implemented / planning only |
| SAML SSO / directory sync deferred | B2B identity requirements are assumed too early | Treat SAML SSO and directory sync as later B2B maturity requirements | not implemented / planning only |

## MFA Requirements

MFA is required for future accounts.

Recovery flows must not weaken MFA. A recovery path must not become an unreviewed bypass around account security, tenant boundaries, or administrative oversight.

High-risk actions should require step-up authentication in a future design. Candidate high-risk actions include role changes, tenant membership changes, billing administration, evidence export, audit-log access, destructive data actions, and security setting changes.

MFA state must be server-side verifiable. Browser-visible MFA state is not a security control.

Current status: no MFA implementation exists.

## Session Requirements

Future sessions require:

- server-side session validation
- session expiry and rotation requirements
- device/session revocation requirement
- secure cookie/token handling requirement
- session-to-tenant binding requirement

Session-to-tenant binding means a session must not grant ambient access across all possible tenants. Tenant membership, active tenant context, and role scope must be resolved server-side.

Current status: no session implementation exists.

## Authorization Requirements

Future authorization requires:

- server-side RBAC
- no UI-only authorization
- least-privilege default
- explicit role assignment
- role changes audited
- stale permission mitigation
- administrative action boundary

Authorization must be enforced in the future service tier and database boundary. UI affordances may hide unavailable actions, but hidden UI controls are not authorization.

Current status: no authorization implementation exists.

## Role Taxonomy Draft

This is a planning-only draft role taxonomy. It is not implemented.

### A. Owner

Owner is the future highest workspace-level administrative role.

Owner cannot bypass tenant isolation.

All high-risk Owner actions must be auditable.

### B. Admin

Admin is a future workspace administration role.

Admin manages users and roles within a tenant boundary.

Admin does not imply cross-tenant power.

### C. Reviewer

Reviewer is a future human review role.

Reviewer can inspect evidence and review states within an assigned tenant/workspace.

Reviewer authority is bounded by tenant membership and assigned role.

### D. Viewer

Viewer is a future read-only role.

Viewer has no state-change authority.

Viewer access remains tenant-scoped.

### E. Billing Admin

Billing Admin is a future billing/subscription role.

Billing Admin does not receive evidence access unless separately assigned.

Billing authority and evidence authority must be separable.

### F. System / Service Account

System / Service Account is a future internal service identity.

It must be tightly scoped and auditable.

It must not provide human impersonation by default.

## Tenant Model Requirements

Future tenant isolation requires:

- every persisted tenant-owned record must carry tenant context
- every server-side query must bind tenant context explicitly
- database-level RLS required
- application-level filtering alone is rejected
- tenant ID must not be user-controlled from client
- tenant membership must be resolved server-side
- cross-tenant analytics on raw data rejected
- no current tenant infrastructure

Tenant scoping must be a server-side and database-level invariant, not a UI convention.

## Tenant Identifier Requirements

Future tenant identifier planning requires:

- stable tenant ID
- workspace/account relationship
- tenant membership table requirement
- tenant-bound role assignment
- tenant-aware audit logs
- tenant-aware encryption/key strategy, deferred to key-management pass
- no current tenant identifier implementation

Tenant identifiers must not be treated as user-selectable client input. The future service tier must resolve and validate tenant context before data access.

## RLS Requirements

Future database planning requires:

- database-level Row-Level Security required
- deny-by-default posture
- tenant context must be set server-side
- tests required before implementation
- migrations/policies not created in this pass
- no RLS implementation exists

RLS must be treated as a core tenant-isolation control, not an optional hardening layer.

## Cross-Tenant Isolation Failure Modes

| Failure mode | Risk | Required future control | Current status |
|--------------|------|-------------------------|----------------|
| Missing tenant context in query | Query returns unscoped or wrong-tenant data | Mandatory server-side tenant context, deny-by-default RLS, query tests | not implemented / planning only |
| User-supplied tenant ID accepted from client | User switches into unauthorized tenant scope | Server-side tenant membership resolution and signed/validated active tenant context | not implemented / planning only |
| Application-only filtering bypass | Query or endpoint bypasses app filter and exposes data | Database-level RLS plus server-side authorization | not implemented / planning only |
| Stale membership/role state | Removed access remains effective | Session invalidation, permission refresh, role-change audit | not implemented / planning only |
| Role escalation across tenant boundary | Role in one tenant grants power in another tenant | Tenant-bound role assignment and per-tenant authorization checks | not implemented / planning only |
| Billing account mapped to wrong tenant | Subscription state affects wrong workspace | Billing-to-tenant mapping model, reconciliation, webhook verification | not implemented / planning only |
| Audit logs lacking tenant ID | Access events cannot be scoped or investigated | Tenant-aware audit schema and write path | not implemented / planning only |
| Admin action crossing tenant boundary | Admin affects data outside assigned tenant | Admin boundary checks, tenant-scoped admin roles, audit trail | not implemented / planning only |
| Service account overbroad permissions | Internal identity accesses too much data | Least-privilege service identities, scoped credentials, audit logging | not implemented / planning only |
| Public concept data confused with tenant data | Static concept material is mistaken for customer workspace data | Claim-boundary copy and public/concept data separation | not implemented / planning only |
| Local Track 3 evidence treated as tenant production evidence | Local reports are misclassified as production tenant records | Preserve local-only evidence boundary and separate future persistence design | not implemented / planning only |
| NEXUS/Vault outputs persisted without tenant boundary, future only | Future integration writes unscoped output | Authorized integration boundary, tenant-scoped persistence, audit write path | not implemented / planning only |

## Auth / Tenant Requirements Matrix

| Requirement area | Minimum requirement | Threat addressed | Required future control | Implementation dependency | Current status |
|------------------|---------------------|------------------|-------------------------|---------------------------|----------------|
| Identity proofing | Defined account identity source | Unverified or ambiguous reviewer identity | Auth provider or custom auth decision | Auth model selection | not implemented / planning only |
| MFA | MFA required for accounts | Password compromise | MFA enrollment, verification, recovery, and step-up design | Auth provider capabilities | not implemented / planning only |
| Session lifecycle | Expiry, rotation, revocation, and device visibility | Stale or stolen sessions | Server-side session validation and revocation model | Auth/session architecture | not implemented / planning only |
| RBAC | Server-side role checks | UI-only or inconsistent authorization | Role taxonomy and authorization middleware/service checks | Service-tier design | not implemented / planning only |
| Tenant membership | Server-resolved tenant membership | Unauthorized tenant access | Tenant membership table and membership resolution | Database schema and auth linkage | not implemented / planning only |
| Tenant-scoped queries | Every tenant query binds tenant context | Cross-tenant data leakage | Server-side tenant context binding | Service tier and database access pattern | not implemented / planning only |
| RLS | Database-level deny-by-default RLS | Application filter bypass | RLS policy model and tests | Database choice and schema | not implemented / planning only |
| Audit logging | Tenant-aware access/action logs | Uninvestigable access or role changes | Separate audit schema/write path | Persistence and audit planning | not implemented / planning only |
| Secrets/key management | No secrets in repo; tenant-aware key strategy | Secret exposure and weak tenant data protection | Secret store and key-management model | Key-management pass | not implemented / planning only |
| Billing-to-tenant mapping | Billing state maps to correct tenant/account | Wrong workspace billing effects | Stripe customer mapping, webhook verification, reconciliation | Billing model | not implemented / planning only |
| Reviewer access | Assigned-tenant evidence access only | Unauthorized evidence review | RBAC plus tenant membership check | Auth, service tier, database | not implemented / planning only |
| Service accounts | Scoped internal identities | Overbroad internal access | Least-privilege service account model and audit trail | Service and secret-management design | not implemented / planning only |
| Public/concept data separation | Static public docs remain separate from tenant data | Claim escalation and data-class confusion | Copy boundary and storage boundary review | Documentation and persistence planning | not implemented / planning only |
| NEXUS runtime boundary, future only | No public runtime without authorization | Local evidence reclassified as public execution | Authorized integration boundary and tenant-scoped output model | Future NEXUS runtime decision | not implemented / planning only |
| Palisade policy enforcement, future only | No enforcement claims before Palisade exists | Policy enforcement overclaim | Separate Palisade integration point and audit path | Future Palisade authorization | not implemented / planning only |
| Weave orchestration identity, future only | Workflow/activity identity must be scoped | Orchestration acts without tenant/user boundary | Workflow identity and activity authorization model | Future Weave authorization | not implemented / planning only |

## Rejected Patterns

The following patterns are rejected:

- UI-only auth
- UI-only RBAC
- application-only tenant filtering
- user-controlled tenant switching without server verification
- shared global admin powers without audit trail
- cross-tenant analytics on raw data
- storing secrets in repo
- treating `.track3-runs/` as production tenant evidence
- treating local NEXUS outputs as public runtime outputs
- implying Palisade or Weave enforcement before those systems exist

## Required Future Tests Before Implementation

Future implementation work must define and pass tests for:

- auth/session tests
- MFA enforcement tests
- RBAC permission tests
- RLS policy tests
- tenant isolation negative tests
- cross-tenant leakage tests
- audit-log write-path tests
- stale permission tests
- billing/tenant mapping tests
- service-account scope tests

No tests are implemented in this pass.

## Current Non-Implementation Declaration

Option E 0.4 does not implement or instantiate:

- Section 1.2
- backend
- auth
- database
- persistence
- billing
- tenant infrastructure
- RLS
- audit ledger
- Palisade
- Weave
- public NEXUS runtime
- production deployment
- compliance certification

It also does not add routes, runtime UI behavior, JavaScript behavior, CSS behavior, public gallery behavior, Stripe integration, MFA/session code, RLS/database migrations, tenant infrastructure, API endpoints, server files, package dependencies, audit-log infrastructure, or customer workspace behavior.

## Relationship To Next Option E Pass

The natural next pass after Option E 0.4 may be:

- Option E 0.5 - Persistence / Audit Log Schema Planning
- Option E 0.5 - Database / RLS Policy Planning Baseline

This document does not start Option E 0.5.
