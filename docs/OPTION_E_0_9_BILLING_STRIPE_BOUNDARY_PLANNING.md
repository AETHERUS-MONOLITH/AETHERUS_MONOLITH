# Option E 0.9 Billing / Stripe Boundary Planning

## Purpose

Option E 0.9 is planning-only billing boundary work for future Section 1.2 Direct UI Membrane architecture.

This pass defines future billing/Stripe assumptions, billing data classes, webhook boundaries, tenant/billing relationship requirements, failure modes, future controls, and rejected patterns. It does not implement billing, checkout, customer portal, webhook handling, subscriptions, tenant billing state, Stripe integration, backend services, authentication, database behavior, persistence, routes, or runtime behavior.

## Current Object Status

Section 1.2 Direct UI Membrane remains not instantiated.

No authenticated or interactive Direct UI Membrane exists yet.

No backend, authentication system, database, persistence layer, billing implementation, Stripe integration, tenant infrastructure, Palisade runtime, Weave runtime, or public NEXUS runtime exists.

This document is planning only. It is not implementation.

## Relationship To Option E 0.1-0.8

Previous Option E passes defined backend, threat/data, auth/tenant, persistence, database/RLS, audit event, and secrets/key boundaries.

Billing must be planned before subscription or customer-account implementation.

Option E 0.9 defines future billing/Stripe boundaries that must respect auth, tenant isolation, audit logging, secrets/key management, and claim-boundary requirements.

## Billing Boundary Assumptions

Future billing planning assumes:

- Stripe is the likely future billing layer
- Checkout sessions, customer portal, subscription status, and webhook handling are future-only
- billing state must map to tenant/account state server-side
- Billing Admin role does not imply evidence access
- billing records are not customer review data

These assumptions do not authorize billing implementation or public SaaS billing claims.

## Future Billing Data Classes

| Billing data class | Sensitivity | Tenant-bound? | Audit-required? | Current status |
|--------------------|-------------|---------------|-----------------|----------------|
| Stripe customer ID | high | yes, through tenant/account mapping | yes | not implemented / planning only |
| Subscription ID | high | yes | yes | not implemented / planning only |
| Checkout session ID | high | yes after server-side resolution | yes | not implemented / planning only |
| Customer portal session reference | high | yes after server-side authorization | yes | not implemented / planning only |
| Billing email | high | yes, through billing account | yes | not implemented / planning only |
| Billing admin role | high | yes | yes | not implemented / planning only |
| Invoice/payment status references | high | yes | yes | not implemented / planning only |
| Webhook event ID | high | conditional until mapped | yes | not implemented / planning only |
| Tenant billing mapping | high | yes | yes | not implemented / planning only |

Billing data must remain separate from evidence/review data unless a future explicitly authorized workflow requires a bounded reference.

## Stripe Webhook Boundary

Future Stripe webhook planning requires:

- webhook signature verification required
- idempotency required
- event replay handling required
- tenant mapping must be server-side verified
- no client-side subscription authority
- billing changes auditable
- no implementation exists

Webhook receipt does not equal trust. A future service tier must verify the event, map it to a tenant/account, apply idempotency, and emit audit events for billing-state changes.

## Tenant / Billing Relationship

Tenant billing state must not grant evidence access by itself.

Billing Admin role must be separate from Reviewer/Admin evidence roles unless explicitly assigned.

Account suspension or plan limits require a future policy boundary. The billing layer must not directly become an unreviewed authorization engine for evidence access, review-state authority, or release semantics.

No current tenant billing model exists.

## Billing Failure Modes

| Failure mode | Risk | Required future control | Current status |
|--------------|------|-------------------------|----------------|
| Webhook spoofing | Fake event mutates subscription or tenant state | Stripe signature verification | not implemented / planning only |
| Duplicate webhook event | Billing action applies twice | Idempotency store and replay handling | not implemented / planning only |
| Billing customer mapped to wrong tenant | Subscription state affects wrong workspace | Server-side billing-to-tenant mapping and reconciliation | not implemented / planning only |
| Subscription state trusted from client | User changes entitlement through browser state | Server-side subscription verification | not implemented / planning only |
| Billing admin gains evidence access accidentally | Billing role becomes review/evidence role | Role separation and explicit role assignment | not implemented / planning only |
| Failed payment triggers overbroad access change | Billing event removes or grants unrelated access | Plan/entitlement policy boundary | not implemented / planning only |
| Invoice data mixed with evidence data | Billing records become customer review data | Data-class separation and storage boundary | not implemented / planning only |
| Stripe keys exposed | Billing integration can be abused | Secrets manager and key rotation policy | not implemented / planning only |
| Billing events not audited | Billing changes lack accountability | Audit event coverage for billing changes | not implemented / planning only |
| Tenant deletion leaves billing state orphaned | Account closure becomes incomplete | Deletion/export/account closure process | not implemented / planning only |

## Required Future Controls

Future implementation work must define:

- webhook verification
- idempotency store
- billing-to-tenant mapping table
- audit event coverage
- role separation
- portal session authorization
- Stripe secret-management boundary
- plan/entitlement policy boundary
- deletion/export/account closure process

No control is implemented in this pass.

## Rejected Patterns

The following patterns are rejected:

- client-controlled subscription state
- webhook without signature verification
- billing role equals evidence role
- billing data mixed with review/evidence data
- Stripe secrets in repo
- billing implementation before auth/tenant model
- public pricing implying active SaaS billing before implementation

## Non-Implementation Declaration

Option E 0.9 does not implement:

- Section 1.2
- billing
- Stripe
- checkout
- customer portal
- webhook handling
- backend
- auth
- database
- persistence
- Palisade
- Weave
- public NEXUS runtime

It also does not create routes, runtime UI behavior, JavaScript behavior, CSS behavior, public gallery behavior, tenant infrastructure, Stripe integration, API endpoints, server files, package dependencies, or customer workspace behavior.

## Next Pass Relationship

After Option E 0.9, the next clean decision may be:

- Option E 0.10 - Implementation Readiness Gate / Remaining Architecture Decisions
- Option E 0.10 - Section 1.2 Birth-Condition Readiness Assessment

This document does not start Option E 0.10.
