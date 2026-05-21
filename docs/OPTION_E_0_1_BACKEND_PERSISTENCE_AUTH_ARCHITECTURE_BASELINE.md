# Option E 0.1 Backend / Persistence / Auth Architecture Baseline

## Purpose

Option E 0.1 establishes the architecture-planning baseline required before any future Section 1.2 Direct UI Membrane implementation work can responsibly begin.

This pass defines the backend, persistence, authentication, authorization, tenant-isolation, and operational security questions that must be specified before Section 1.2 can move toward birth conditions.

This is planning and specification only. It does not implement Section 1.2 and does not authorize runtime UI behavior, authentication, backend routes, database behavior, persistence, billing, public NEXUS execution, Palisade, Weave, customer data handling, tenant infrastructure, production deployment, operational release authority, runtime monitoring, or compliance certification.

## Current Object Status

Section 1.2 Direct UI Membrane remains not instantiated.

No authenticated or interactive Direct UI Membrane exists yet.

AETHERUS_MONOLITH / Section 1.1 remains the instantiated static public artifact. It is the current static, browser-side, deterministic, scenario-driven, non-persistent, prototype-facing public Facade.

This document is architecture planning only. It is not implementation, not an implemented authenticated surface, not a backend, not a persistence layer, not a tenant platform, and not a production security boundary.

## Why Option E Is Required

Section 1.2 cannot responsibly move toward birth conditions until the project specifies the architecture that would govern authenticated interaction, stored evidence, reviewer authority, and tenant-scoped data.

Before any future implementation pass, the project must specify:

- backend service tier
- authentication
- authorization
- persistence
- database isolation
- audit logging
- tenant scoping
- key management
- privacy and security boundaries
- failure and recovery semantics

Without these decisions, any Direct UI Membrane implementation would risk implying authority, persistence, operational security, tenant readiness, or audit durability that the repository does not yet possess.

## Architecture Domains To Be Planned

### A. Backend Service Tier

The future Direct UI Membrane requires a defined API or service boundary before it can become an authenticated or interactive surface.

Required planning topics:

- future API/service boundary
- server-side enforcement for authorization, tenant scoping, and data access
- server-side validation of every sensitive action
- explicit rejection of client-side-only authority
- service ownership, deployment target, and operational monitoring boundary

Current status: no backend service tier is implemented.

### B. Authentication

The future Direct UI Membrane requires an authentication architecture before any account, workspace, tenant, or reviewer session is implemented.

Required planning topics:

- email/password baseline
- MFA requirement
- session handling, expiration, rotation, revocation, and device visibility
- password policy
- suspicious-activity monitoring
- account recovery and lockout semantics
- SAML SSO / directory sync as later B2B maturity, not an immediate assumption

Current status: no authentication implementation exists.

### C. Authorization

The future Direct UI Membrane requires server-side authorization before any reviewer, admin, or tenant action is treated as meaningful.

Required planning topics:

- server-side RBAC
- role model for reviewers, admins, and future tenants
- permission boundary for evidence viewing, release review, escalation review, and administrative actions
- no UI-only authorization
- no client-side-only permission checks

Current status: no authorization implementation exists.

### D. Persistence

The future Direct UI Membrane requires a persistence architecture before any reviewer note, evidence state, artifact state, tenant workspace, audit event, or release decision can be stored.

Required planning topics:

- database requirement
- storage model
- data ownership model
- retention model
- deletion and export semantics
- backup, restore, and migration expectations
- distinction between durable records and temporary operational state

Current status: no production persistence exists.

### E. Tenant Isolation

The future Direct UI Membrane requires tenant isolation to be treated as a first-order architecture boundary.

Required planning topics:

- one database, with tenant isolation treated as if each tenant had a separate database
- database-level Row-Level Security
- strict tenant context on every query
- tenant identifier model and propagation boundary
- no cross-tenant analytics on raw data
- test strategy for tenant-boundary failures
- administrative access controls that do not bypass tenant isolation casually

Current status: no tenant infrastructure exists.

### F. Audit Logging

The future Direct UI Membrane requires an audit-logging architecture before any access, review, release, escalation, administrative, or tenant-data event can be treated as audit-relevant.

Required planning topics:

- who accessed what tenant data and when
- who changed what state and why
- separation from application logs
- immutable or tamper-evident design options
- compliance-grade design target
- audit access controls and retention policy
- correlation with security events without mixing audit and debug logs

Current status: no production audit infrastructure exists.

### G. Tenant-Aware Key Management

The future Direct UI Membrane requires encryption and key-management planning before storing tenant-scoped data.

Required planning topics:

- encryption at rest
- tenant-aware key strategy
- key rotation, revocation, backup, and incident response
- secret-management boundary
- raw database access should not trivially expose other tenant data
- operational break-glass controls and auditability

Current status: no key-management implementation exists.

### H. Billing / Subscription

The future Direct UI Membrane may require a billing architecture before any customer workspace or subscription state is implemented.

Required planning topics:

- Stripe as likely billing layer
- checkout sessions
- customer portal
- webhook handling
- subscription state synchronization
- billing event model
- tenant/account relationship to billing entities

Current status: no billing implementation exists.

### I. Trace / Evidence Persistence Boundary

The future Direct UI Membrane must distinguish local Track 3 evidence and prototype trace material from production persistence.

Required planning topics:

- distinguish local Track 3 evidence reports from production persistence
- distinguish JSONL/local reports from a persistent audit ledger
- preserve `.track3-runs/` as ignored local evidence output, not production data infrastructure
- do not convert current `.track3-runs/` outputs into production audit infrastructure
- do not treat browser-side illustrative traces as durable operational evidence

Current status: Track 3 evidence remains local-only and is not production persistence.

### J. Palisade Dependency

Palisade remains not instantiated.

Required planning topics:

- future policy-enforcement boundary must be separately authorized
- enforcement semantics must be specified before any Palisade-backed claim exists
- operational control, policy authorship, and audit obligations must be defined
- do not reclassify current Conduit fail-closed behavior as Palisade

Current status: Palisade is not implemented, not instantiated, and not backing Section 1.2.

### K. Weave Dependency

Weave remains specification-only.

Required planning topics:

- Temporal runtime planning is not implemented here
- workflow/activity separation is future orchestration planning, not current runtime
- workflow identity, retry semantics, signal handling, and activity auditability must be separately specified
- no Weave runtime claim may be made from current static or local evidence behavior

Current status: Weave is not implemented, not runnable, and not backing Section 1.2.

## Required Unresolved Design Decisions

The following decisions must be answered before implementation:

- backend framework / service architecture
- database choice
- RLS strategy
- tenant identifier model
- auth provider or custom auth decision
- MFA mechanism
- RBAC role taxonomy
- audit-log schema
- retention/deletion model
- encryption/key-management approach
- secret-management approach
- billing event model
- operational monitoring boundary
- incident/failure recovery model
- whether public gallery work remains separate from authenticated membrane work

These decisions should be made in future planning passes before any runtime implementation begins.

## Non-Goals

This pass does not implement:

- backend
- auth
- database
- persistence
- tenant isolation
- billing
- Palisade
- Weave
- public NEXUS runtime
- Section 1.2 Direct UI Membrane runtime
- production audit ledger
- customer workspace

It also does not create routes, runtime UI behavior, JavaScript behavior, CSS behavior, Stripe integration, MFA/session code, RLS/database migrations, tenant infrastructure, or public gallery behavior.

## Relationship To Facade Reflection 0.4-0.10

The Facade Reflection arc established the Section 1.2 concept boundary before any implementation work:

- 0.4 documented the Direct UI Membrane visual specification.
- 0.5 established static documentation linkage and discoverability.
- 0.6 indexed visual assets and acceptance criteria.
- 0.7 defined IA and surface taxonomy.
- 0.8 defined interaction-flow specification.
- 0.9 audited copy and boundary language.
- 0.10 defined static concept-gallery decision criteria and public-display boundaries.

Option E begins the architecture-planning gate for eventual implementation feasibility. It does not replace the Facade Reflection boundary discipline and does not move Section 1.2 into implemented status.

## Relationship To Section 1.2 Birth Condition

Section 1.2 is born only when the first authenticated or interactive surface exists.

Option E 0.1 does not satisfy that birth condition.

Option E 0.1 defines prerequisite architecture questions that must be answered before such a surface can be implemented.

Until a separate authorized implementation pass creates an authenticated or interactive surface, Section 1.2 remains planned, specified, and not instantiated.

## Recommended Next Option E Pass

The natural next pass after Option E 0.1 may be:

- Option E 0.2 - Threat Model / Data Boundary Register
- Option E 0.2 - Backend Service Tier Decision Matrix

This document does not start either pass.
