# Option E 0.3 Backend Service Tier Decision Matrix

## Purpose

Option E 0.3 evaluates backend service-tier options before any future Section 1.2 Direct UI Membrane implementation work.

This pass identifies the likely planning direction for where server-side authority should live in a future Direct UI Membrane architecture. It does not select a final technology stack and does not implement any backend, authentication, persistence, routes, API endpoints, server files, package dependencies, or runtime behavior.

This is planning and specification only. It does not implement Section 1.2 and does not authorize runtime UI behavior, authentication, backend routes, database behavior, persistence, billing, public gallery behavior, public NEXUS execution, Palisade, Weave, customer data handling, tenant infrastructure, production deployment, operational release authority, runtime monitoring, or compliance certification.

## Current Object Status

Section 1.2 Direct UI Membrane remains not instantiated.

No authenticated or interactive Direct UI Membrane exists yet.

No backend, authentication system, database, persistence layer, billing integration, Palisade runtime, Weave runtime, or public NEXUS runtime exists.

AETHERUS_MONOLITH / Section 1.1 remains the instantiated static public artifact. It is the current static, browser-side, deterministic, scenario-driven, non-persistent, prototype-facing public Facade.

This document is planning only. It is not implementation, not a service architecture selection, not a backend, not tenant infrastructure, and not evidence of an operational security boundary.

## Relationship To Option E 0.1 And 0.2

Option E 0.1 defined the architecture domains and unresolved implementation questions required before any future Section 1.2 implementation work.

Option E 0.2 defined threat and data-boundary constraints that any future architecture must respect.

Option E 0.3 evaluates where server-side authority should live before authentication, tenant isolation, audit logging, billing, Palisade, Weave, or public NEXUS runtime integration are specified further.

This pass does not answer the auth provider, database schema, RLS policy, audit-log schema, billing model, Palisade integration, Weave orchestration, or public NEXUS runtime authorization decisions. It frames the backend service-tier planning direction that later decisions must refine.

## Backend Service-Tier Requirements

A future backend service tier must satisfy the following requirements before Section 1.2 can move toward implementation:

- server-side authorization enforcement
- strict tenant-context binding
- database-level RLS compatibility
- audit-log write path separation
- secure auth/session integration
- secrets/key-management compatibility
- Stripe webhook verification compatibility
- future Palisade decision/enforcement integration
- future Weave workflow/activity integration
- future Conduit / Vault runtime boundary support, if later authorized
- clear failure/recovery behavior
- observability without overclaiming runtime monitoring
- deployability without implying production deployment now

These are planning requirements only. No service tier currently exists.

## Decision Options

### A. Backend-As-A-Service First Architecture

Examples: Supabase-style architecture, managed Postgres, integrated auth, RLS-first model.

Strengths:

- Strong initial alignment with managed Postgres and RLS-first tenant isolation.
- Integrated auth can reduce early operational burden if the auth model fits.
- Managed data platform can accelerate schema, migration, and environment setup once implementation is authorized.
- Good fit for a future architecture that treats tenant isolation as database-enforced rather than UI-only.

Risks:

- Platform lock-in may increase if auth, storage, functions, and database policies become tightly coupled to one provider.
- Service boundaries can become under-specified if client libraries talk too directly to data primitives.
- Audit logging may need an explicit separate write path beyond application logs and provider logs.
- Complex authorization semantics may outgrow basic managed-auth conventions.

Fit with RLS / tenant isolation: strong if the schema and policies are designed carefully.

Fit with auth/MFA: medium to strong, depending on provider MFA, session, SSO, and account-recovery capabilities.

Fit with audit logging: medium unless a separate audit-log design is added.

Fit with Stripe: medium; webhook handling still needs secure server-side verification and reconciliation.

Fit with Palisade / Weave later: medium; integration is possible but policy/orchestration boundaries must not be hidden inside provider-specific glue.

Risk of platform lock-in: medium to high.

Risk of under-specifying service boundaries: high if managed client access replaces explicit server-side authority.

### B. Custom Application Backend

Examples: Node/TypeScript service, Python service, Go service, separate API layer.

Strengths:

- Clear place for server-side authorization, tenant-context binding, and sensitive action validation.
- Strong fit for explicit audit-log emission and separation from application logs.
- Strong fit for future Palisade policy checks and Weave orchestration handoffs because service boundaries are first-class.
- Easier to define domain-specific failure/recovery behavior and incident boundaries.

Risks:

- Higher implementation burden.
- Higher operational complexity, including deployment, scaling, monitoring, secret management, and patching.
- Database/RLS design still needs separate rigor.
- Auth/MFA integrations must be selected, integrated, and maintained carefully.

Fit with strict server-side authorization: strong.

Fit with tenant isolation: strong if every request binds tenant context and the database also enforces RLS.

Fit with audit logging: strong if an explicit audit write path is designed.

Fit with future Palisade / Weave: strong.

Operational complexity: high.

Implementation burden: high.

### C. Serverless / Edge-Function Backend

Examples: managed functions, API routes, edge runtime.

Strengths:

- Useful for bounded handlers such as Stripe webhooks, auth callbacks, signed uploads, and small authorization-protected actions.
- Can reduce infrastructure ownership when workloads are request-oriented and stateless.
- May fit static-site adjacency without converting the entire repository into a server application.

Risks:

- Enforcement can become fragmented across many functions.
- Durable orchestration, audit-log ordering, retry semantics, and cross-step state can become harder to reason about.
- Edge runtimes may constrain libraries, secrets access, database connections, and long-running tasks.
- Observability and incident response can be scattered across provider surfaces.

Fit with auth: medium; depends on provider integration and session propagation.

Fit with RLS: medium to strong if every function binds tenant context and uses database policies correctly.

Fit with audit logging: medium; needs a shared audit writer and idempotency strategy.

Fit with webhook handling: strong for focused handlers if signature verification and replay handling are explicit.

Limitations for durable orchestration: medium to high.

Boundary risks around fragmented enforcement: high.

### D. Hybrid Managed Data + Custom Service Tier

Examples: managed Postgres/Auth plus dedicated application service for authorization/audit orchestration.

Strengths:

- Preserves managed Postgres and RLS discipline while keeping server-side authorization explicit.
- Gives the future Direct UI Membrane a clear service boundary for tenant context, role checks, audit events, billing reconciliation, and sensitive actions.
- Provides a mature path toward Palisade policy checks and Weave workflow/activity handoffs without embedding those concerns directly in the browser.
- Allows serverless handlers to be used selectively for webhooks or narrow integration events while keeping core authority centralized.
- Keeps public claim boundaries clearer because backend capability can be described as planned architecture until separately implemented.

Risks:

- More moving parts than a pure Backend-as-a-Service path.
- Requires careful division of responsibility between managed auth, database/RLS, custom service code, audit writer, and integration handlers.
- Can still produce lock-in if managed data/auth capabilities are used without portability boundaries.
- Requires clear deployment, observability, incident, and secret-management planning.

Fit with Section 1.2 requirements: strong.

Fit with future Palisade / Weave integration: strong, because policy and orchestration calls can live behind an explicit service boundary.

Complexity level: medium to high.

Maturity path: strong if implemented in phases after auth, tenant, audit, and persistence decisions are specified.

### E. Static-Only Continuation

The current repository is static-only, browser-side, deterministic, non-persistent, and claim-bounded. Continuing this mode preserves current safety because it avoids customer data handling, authenticated sessions, tenant state, database writes, billing events, public NEXUS runtime behavior, Palisade enforcement claims, and Weave orchestration claims.

However, static-only continuation does not satisfy Section 1.2 birth conditions. Section 1.2 is born only when the first authenticated or interactive surface exists.

Static-only continuation cannot support:

- authentication
- tenant isolation
- server-side authorization
- durable persistence
- production audit logging
- billing
- real reviewer workspaces
- tenant-scoped evidence handling
- Palisade policy enforcement
- Weave orchestration
- public NEXUS runtime integration

Static-only continuation remains safe for Section 1.1, but insufficient for a future authenticated Direct UI Membrane.

## Evaluation Criteria

| Criteria | Backend-as-a-Service first | Custom application backend | Serverless / edge functions | Hybrid managed data + custom service tier | Static-only continuation |
|----------|----------------------------|----------------------------|-----------------------------|-------------------------------------------|--------------------------|
| Tenant isolation strength | strong | strong | medium | strong | not applicable |
| RLS compatibility | strong | strong | medium | strong | not applicable |
| Server-side authorization clarity | medium | strong | medium | strong | blocked |
| Audit-log separation | medium | strong | medium | strong | blocked |
| Auth/MFA fit | medium to strong | medium | medium | strong | blocked |
| Stripe/webhook fit | medium | strong | strong | strong | blocked |
| Secrets/key-management fit | medium | strong | medium | strong | blocked |
| Palisade integration path | medium | strong | medium | strong | blocked |
| Weave integration path | medium | strong | weak to medium | strong | blocked |
| Future NEXUS runtime boundary path | medium | strong | medium | strong | blocked |
| Operational complexity | medium | high | medium | medium to high | low |
| Implementation risk | medium | high | medium | medium | low for current static scope, blocked for Section 1.2 |
| Portability | medium | strong | medium | medium | strong for static docs only |
| Compliance-readiness potential | medium | medium to strong | medium | strong | blocked |
| Claim-boundary clarity | medium | strong | medium | strong | strong for Section 1.1, blocked for Section 1.2 |

## Recommended Planning Direction

Recommended planning direction: hybrid managed data plus explicit service-tier architecture.

This is likely the strongest planning direction because it can preserve RLS and tenant-isolation discipline while keeping authorization, audit logging, policy enforcement, billing, and future orchestration boundaries explicit.

The recommended direction is not a final technology selection. It does not decide Supabase, Postgres provider, auth provider, runtime language, deployment host, audit-log implementation, billing model, Palisade integration, Weave orchestration, or public NEXUS runtime authorization.

This recommendation does not authorize implementation and does not instantiate Section 1.2.

## Rejected Or Deferred Paths

Static-only continuation is safe for the current public artifact, but it is insufficient for Section 1.2 birth because it cannot support authentication, tenant isolation, persistence, billing, or real review workspaces.

UI-only auth or client-enforced authorization is rejected. The browser may display future state, but it must not be the authority boundary for tenant access, evidence access, release state, or audit-relevant actions.

Direct browser-to-Vault execution is rejected. Current Conduit / Vault evidence is local and not production runtime; any future Vault or NEXUS integration needs a separately authorized server-side boundary.

Direct public NEXUS runtime is rejected unless separately authorized. Local pinned evidence and adapter outputs must not be reclassified as public runtime behavior.

Backend implementation before an auth/tenant matrix is deferred. The service tier should not be implemented before auth, MFA, session lifecycle, RBAC, tenant identifier, RLS, audit, and retention requirements are specified.

Palisade or Weave implementation inside Option E 0.3 is deferred. Palisade remains not instantiated, and Weave remains specification-only.

## Required Follow-Up Decisions

The following decisions are still needed before implementation:

- auth provider / auth model
- MFA model
- session lifecycle
- RBAC role taxonomy
- tenant identifier model
- database/RLS schema strategy
- audit-log schema and write path
- Stripe billing model
- secrets/key-management model
- deployment target
- Palisade integration point
- Weave integration point
- public NEXUS runtime authorization boundary
- operational monitoring / incident boundary

## Current Non-Implementation Declaration

Option E 0.3 does not implement or instantiate:

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

The natural next pass after Option E 0.3 may be:

- Option E 0.4 - Auth / Tenant Isolation Requirements Matrix

This document does not start Option E 0.4.
