# Option E 0.2 Threat Model / Data Boundary Register

## Purpose

Option E 0.2 establishes a threat model and data boundary register before any future Section 1.2 Direct UI Membrane implementation work.

This pass defines future data classes, data that must not be stored by default, trust boundaries, tenant-boundary risks, authentication and authorization risk surfaces, persistence and audit-log boundaries, trace/evidence boundary risks, public-claim risks, Palisade and Weave dependency boundaries, and failure modes that must be resolved before implementation.

This is planning and specification only. It does not implement Section 1.2 and does not authorize runtime UI behavior, authentication, backend routes, database behavior, persistence, billing, public gallery behavior, public NEXUS execution, Palisade, Weave, customer data handling, tenant infrastructure, production deployment, operational release authority, runtime monitoring, audit-log infrastructure, or compliance certification.

## Current Object Status

Section 1.2 Direct UI Membrane remains not instantiated.

No authenticated or interactive Direct UI Membrane exists yet.

No backend, authentication system, database, persistence layer, billing integration, Palisade runtime, Weave runtime, or public NEXUS runtime exists.

AETHERUS_MONOLITH / Section 1.1 remains the instantiated static public artifact. It is the current static, browser-side, deterministic, scenario-driven, non-persistent, prototype-facing public Facade.

This document is planning only. It is not implementation, not a production threat model for a deployed system, not an audit ledger, not tenant infrastructure, and not evidence of an operational security boundary.

## Relationship To Option E 0.1

Option E 0.1 defined the architecture domains and unresolved design decisions required before any future Section 1.2 implementation work. Those domains included backend service tier, authentication, authorization, persistence, tenant isolation, audit logging, tenant-aware key management, billing, trace/evidence persistence, Palisade dependency, and Weave dependency.

Option E 0.2 defines the risk and data-boundary model those future decisions must respect. It does not choose the backend, database, auth provider, RLS model, audit system, billing integration, Palisade integration, Weave orchestration model, or public NEXUS runtime boundary.

## System Boundary Assumptions

| Boundary assumption | Planning statement |
|---------------------|--------------------|
| Current public artifact | AETHERUS_MONOLITH is a static public site and conceptual research interface. |
| Future object under planning | The Direct UI Membrane is the future object under architecture planning. It is not instantiated. |
| Future backend/persistence/auth layer | The backend, persistence, and auth layer is not selected and not implemented. |
| Current local Track 3 reports | Local Track 3 reports are local evidence only, not production audit infrastructure. |
| Pinned NEXUS source | The pinned NEXUS source is a local/pinned Vault evidence source, not public runtime. |

These assumptions bound all threat and data statements in this document.

## Future Data Classes

| Data class | Examples | Sensitivity | Storage boundary | Risk |
|------------|----------|-------------|------------------|------|
| Public concept metadata | public docs cards, static concept copy, visual-surface descriptions | low | static repo/site | claim escalation if wording implies live capability |
| User identity data | email, account ID, MFA state, auth provider ID | high | future auth system only | account compromise, improper retention, unauthorized access |
| Tenant / workspace metadata | tenant ID, workspace name, role membership, access scope | high | future database with RLS | cross-tenant leakage, missing tenant context, privilege confusion |
| Evidence / artifact records | uploaded artifact metadata, support classification, required proof status | medium to high depending on artifact | future tenant-scoped persistence only | storing customer material without clear retention/deletion model |
| Review notes | reviewer comments, boundary notes, concept notes | medium to high | future tenant-scoped persistence | subjective or sensitive assessments becoming durable without governance |
| Trace records | review-state transitions, mark-state events, flow history | medium to high | future trace store if authorized | confusing traces with immutable audit ledger or compliance evidence |
| Audit logs | who accessed what tenant data and when | high | separate future audit log system | insufficient separation from application logs, tampering, overclaiming compliance |
| Secrets and keys | auth secrets, API keys, encryption keys, tenant-aware key material | critical | future secrets/key-management system | accidental repo exposure, weak tenant separation, raw DB exposure |
| Billing records | Stripe customer IDs, checkout sessions, subscription state, webhook events | high | future billing integration | webhook spoofing, mismatched tenant/account state, overcollection |
| NEXUS / Vault outputs | future adapter outputs, verdicts, risk classifications | medium to high depending on input | future authorized integration only | confusing local prototype evidence with public runtime output |

## Data That Must Not Be Stored By Default

The following categories must not be stored without explicit future authorization:

- raw customer documents
- sensitive personal data beyond minimum auth/account requirements
- secrets in repository files
- unredacted model prompts/outputs containing customer data
- cross-tenant analytics on raw data
- production audit claims derived from local `.track3-runs/`
- immutable-ledger claims without actual ledger design
- public NEXUS runtime outputs before runtime authorization
- Palisade execution records before Palisade exists
- Weave execution records before Weave exists

Any future decision to store one of these categories requires a separately authorized architecture pass with retention, deletion, export, access-control, audit, and tenant-isolation semantics.

## Trust Boundaries

### A. Browser / Client Boundary

The browser/client is not trusted for authorization.

A future UI may display state, reviewer context, tenant context, and review flow position, but it must not enforce authority alone. Any sensitive action, data access, role check, release state, tenant membership, or audit-relevant event must be enforced server-side in a future backend.

Current status: no future client implementation exists.

### B. Backend Service Boundary

The backend service boundary is the future server-side enforcement point for authentication-derived identity, authorization, tenant scoping, input validation, write authorization, and audit-event emission.

Current status: not implemented.

### C. Auth Provider Boundary

The auth provider boundary owns identity proofing, credential handling, MFA state, session lifecycle, account recovery, suspicious-activity handling, and session revocation semantics.

Current status: not selected.

### D. Database Boundary

The database boundary requires RLS and strict tenant scoping before any tenant data is stored.

Future database access must assume tenant context is mandatory for every tenant-scoped query. Missing tenant context is a security failure, not a recoverable display issue.

Current status: not implemented.

### E. Audit-Log Boundary

Audit logs must be separate from application logs.

Future audit events must have a defined schema, write path, retention policy, tamper-resistance model, access-control model, and relationship to incident response. Application debug logs must not be presented as compliance-grade audit evidence.

Current status: not implemented.

### F. Secrets / Key Boundary

Secrets must not be stored in the repository.

Future tenant-aware key management is required before tenant data is stored. Key access, rotation, revocation, break-glass use, and raw database exposure must be separately specified.

Current status: not implemented.

### G. Conduit / Vault Boundary

Current local Conduit evidence is not production runtime.

The pinned Vault remains a read-only evidence source unless explicitly authorized otherwise. Local adapter outputs, compatibility reports, and `.track3-runs/` artifacts must not be treated as production persistence, customer evidence stores, immutable ledgers, or public NEXUS runtime output.

Current status: local evidence only.

### H. Palisade Boundary

Palisade remains not instantiated.

There is no current OPA/Rego enforcement boundary, policy runtime, policy authoring workflow, policy audit path, or Palisade-backed production decision point.

Current status: not implemented.

### I. Weave Boundary

Weave remains specification-only.

There is no Temporal runtime, workflow execution, activity execution, signal handling, workflow retry behavior, or durable orchestration state.

Current status: not implemented.

## Threat Actors / Misuse Sources

The future threat model must account for:

- unauthenticated external user
- authenticated user from same tenant
- authenticated user from different tenant
- compromised reviewer account
- malicious or mistaken admin
- developer/operator error
- CI/deployment misconfiguration
- webhook spoofing source
- prompt/model integration misuse, future only
- public reader misinterpreting concept surfaces as live product

These actors and misuse sources are planning categories only. They do not imply the current repository has authenticated users, tenants, billing webhooks, model integrations, deployed infrastructure, or public runtime behavior.

## Primary Failure Modes

| Failure mode | Risk | Affected boundary | Required future control | Current status |
|--------------|------|-------------------|-------------------------|----------------|
| Cross-tenant data exposure | Tenant data becomes visible to the wrong tenant | Database, backend, authorization | RLS, tenant identifier model, tenant-context tests, server-side authorization | not implemented / planning only |
| UI-only authorization | Client state is mistaken for authority | Browser/client, backend | Server-side RBAC and action authorization | not implemented / planning only |
| Missing tenant context in query | Query returns unscoped or wrong-tenant data | Database, backend | Mandatory tenant context, RLS deny-by-default policy, query review | not implemented / planning only |
| Audit log tampering or overclaim | Logs are altered or presented as compliance proof without design | Audit-log boundary | Separate audit store, tamper-resistance model, audit schema, claim boundary | not implemented / planning only |
| Secrets committed to repo | Secrets or keys become public or long-lived in source history | Secrets/key boundary, CI/deployment | Secret scanning, external secret store, rotation procedure | not implemented / planning only |
| Customer data stored before retention model | Data becomes durable without deletion/export governance | Persistence, database | Retention/deletion/export model, data classification, storage approval | not implemented / planning only |
| Local evidence treated as production audit infrastructure | Prototype/local reports are misused as compliance evidence | Conduit/Vault, audit-log boundary | Explicit evidence boundary, production audit design, claim review | not implemented / planning only |
| `.track3-runs/` treated as persistent ledger | Ignored local output is misread as durable audit ledger | Conduit/Vault, persistence | Keep ignored/local status, separate ledger design if authorized | not implemented / planning only |
| Palisade claimed before instantiated | Policy enforcement is implied without runtime | Palisade boundary, public claim boundary | Separate Palisade authorization, enforcement design, claim controls | not implemented / planning only |
| Weave claimed before instantiated | Orchestration/runtime durability is implied without Temporal runtime | Weave boundary, public claim boundary | Separate Weave authorization, workflow/activity design, claim controls | not implemented / planning only |
| Public NEXUS runtime implied before authorized | Local/pinned Vault evidence is mistaken for public execution | Conduit/Vault, NEXUS integration, public claim boundary | Runtime integration decision, public-claim review, execution boundary | not implemented / planning only |
| "Review state" interpreted as operational release authority | Conceptual state copy is mistaken for production approval | Browser/client, public claim boundary | Copy boundary review, server-side release authority design if authorized | not implemented / planning only |
| "Escalation" interpreted as live incident management | Conceptual escalation copy is mistaken for active operations | Browser/client, public claim boundary | Copy boundary review, incident-management boundary if authorized | not implemented / planning only |
| Billing account mismatch | Billing customer/subscription maps to the wrong tenant/account | Billing, tenant metadata | Stripe customer mapping model, webhook verification, reconciliation checks | not implemented / planning only |
| Webhook event spoofing | Fake billing event mutates subscription or tenant state | Billing, backend | Stripe signature verification, idempotency, event allowlist, replay handling | not implemented / planning only |
| Unauthorized reviewer access | Reviewer sees or modifies evidence outside scope | Auth, authorization, tenant metadata | RBAC taxonomy, tenant membership checks, audit event write path | not implemented / planning only |
| Stale role/permission state | Removed or changed access remains effective | Auth, authorization, database | Session invalidation, permission refresh, role-change audit | not implemented / planning only |

## Boundary Control Requirements Before Implementation

The following controls must be specified before implementation:

- backend framework/service boundary
- auth provider or custom auth decision
- MFA/session lifecycle design
- RBAC role taxonomy
- tenant identifier model
- RLS policy model
- database schema ownership model
- audit-log schema and write path
- retention/deletion/export model
- encryption/key-management approach
- secret-management approach
- Stripe webhook verification model
- monitoring and incident response boundary
- Palisade decision/enforcement integration point
- Weave workflow/activity boundary, if orchestration is later authorized
- NEXUS runtime integration boundary, if public runtime is later authorized

These controls must be designed before they are implemented. This document records the requirement to specify them; it does not create them.

## Current Non-Implementation Declaration

Option E 0.2 does not implement or instantiate:

- Section 1.2
- auth
- backend
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

It also does not add routes, runtime UI behavior, JavaScript behavior, CSS behavior, public gallery behavior, Stripe integration, MFA/session code, RLS/database migrations, tenant infrastructure, audit-log infrastructure, or customer workspace behavior.

## Relationship To Next Option E Pass

The natural next pass after Option E 0.2 may be:

- Option E 0.3 - Backend Service Tier Decision Matrix
- Option E 0.3 - Auth / Tenant Isolation Requirements Matrix

This document does not start either pass.
