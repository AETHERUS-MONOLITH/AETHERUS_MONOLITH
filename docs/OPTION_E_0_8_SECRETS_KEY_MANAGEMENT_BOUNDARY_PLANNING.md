# Option E 0.8 Secrets / Key Management Boundary Planning

## Purpose

Option E 0.8 is planning-only boundary work for secrets and tenant-aware key management in future Section 1.2 Direct UI Membrane architecture.

This pass defines future secret classes, non-secret configuration boundaries, tenant-aware key-management planning, secret lifecycle requirements, failure modes, and future controls. It does not implement secrets, encryption, key rotation, provider integration, backend services, authentication, database behavior, persistence, routes, or runtime behavior.

## Current Object Status

Section 1.2 Direct UI Membrane remains not instantiated.

No authenticated or interactive Direct UI Membrane exists yet.

No backend, authentication system, database, persistence layer, billing integration, secrets manager, key-management implementation, Palisade runtime, Weave runtime, or public NEXUS runtime exists.

This document is planning only. It is not implementation.

## Relationship To Option E 0.1-0.7

Option E 0.1-0.7 established architecture, threat/data, backend service-tier, auth/tenant, persistence, database/RLS, and audit-event planning.

Option E 0.8 defines the future secrets/key boundary required before any implementation work can be authorized.

This pass does not select a secrets manager, create environment variables, add provider credentials, implement encryption, create rotation jobs, or authorize Section 1.2 implementation.

## Secret Classes

| Secret class | Sensitivity | Storage boundary | Rotation requirement | Current status |
|--------------|-------------|------------------|----------------------|----------------|
| Auth provider secrets | critical | future secrets manager/provider config only | required on compromise and scheduled policy | not implemented / planning only |
| Session signing keys | critical | future secrets/key-management system | required with rotation and revocation model | not implemented / planning only |
| MFA/recovery secrets | critical | future auth/secrets boundary | required with recovery-flow governance | not implemented / planning only |
| Database credentials | critical | future secrets manager, never repo/client | required with environment separation | not implemented / planning only |
| Service account credentials | critical | future secrets manager with scoped access | required, auditable, revocable | not implemented / planning only |
| Stripe API keys | critical | future secrets manager/provider config only | required on compromise and scheduled policy | not implemented / planning only |
| Webhook signing secrets | critical | future secrets manager/webhook boundary | required when rotated by provider or incident response | not implemented / planning only |
| Encryption keys | critical | future key-management system | required with key lifecycle model | not implemented / planning only |
| Tenant-aware key material | critical | future tenant-aware key-management system | required with tenant-aware rotation strategy | not implemented / planning only |
| Future Palisade policy bundle credentials | high to critical | future policy/secrets boundary if Palisade is authorized | required if system exists | not implemented / planning only |
| Future Weave/Temporal credentials | high to critical | future orchestration/secrets boundary if Weave is authorized | required if system exists | not implemented / planning only |
| Future NEXUS/Vault runtime integration credentials | high to critical | future integration/secrets boundary if runtime is authorized | required if system exists | not implemented / planning only |

## Non-Secret Configuration

Non-secret configuration may include:

- public static configuration
- docs metadata
- non-sensitive environment identifiers
- feature flags
- concept-stage labels

Non-secret configuration must not be mixed with secrets. Public/static metadata must not contain credentials, signing material, customer data, provider tokens, private endpoints, or tenant keys.

## Key-Management Principles

Future key-management planning must follow these principles:

- no secrets in repository
- no secrets in client-side code
- least privilege
- rotation and revocation required
- environment separation
- tenant-aware encryption strategy required before tenant data persistence
- raw DB access should not trivially expose another tenant's data
- service-account keys tightly scoped and audited

Key boundaries must be designed before tenant-owned data is stored.

## Tenant-Aware Key Planning

Future tenant-aware key planning requires:

- tenant-aware key references
- key hierarchy options as a future decision
- key rotation implications
- deletion/export relationship
- encrypted-at-rest requirements
- no current implementation

The future design must decide whether tenant-aware protection is implemented through per-tenant keys, envelope encryption, provider-managed key hierarchies, application-managed key references, or another explicit model. This pass does not choose that model.

## Secret Lifecycle Requirements

Future secret lifecycle planning must cover:

- creation
- storage
- use
- rotation
- revocation
- incident response
- access logging
- decommissioning

Every secret class must have an owner, storage boundary, access policy, rotation trigger, revocation path, and incident response procedure before implementation.

## Failure Modes

| Failure mode | Risk | Required future control | Current status |
|--------------|------|-------------------------|----------------|
| Secret committed to repo | Secret leaks through source history | Secret scanning, external secret store, rotation path | not implemented / planning only |
| Secret exposed in client bundle | Public users can extract credentials | No secrets in static/client code; build-time checks | not implemented / planning only |
| Long-lived unrotated key | Compromise persists indefinitely | Rotation schedule and revocation model | not implemented / planning only |
| Shared key across tenants without design | Tenant data separation is weakened | Tenant-aware key model and threat review | not implemented / planning only |
| Webhook secret missing | Spoofed billing events may be accepted | Webhook signing secret and verification model | not implemented / planning only |
| Service account overbroad | Internal identity can access too much data | Least-privilege service scopes and audit events | not implemented / planning only |
| Production and development secrets mixed | Non-production access affects production data | Environment separation and access policy | not implemented / planning only |
| Secrets logged in audit/application logs | Logs become secret exposure channel | Redaction policy and log scanning | not implemented / planning only |
| Future NEXUS runtime credential exposed | Runtime integration could be abused | Runtime authorization boundary and scoped credentials | not implemented / planning only |
| Palisade/Weave credentials implied before systems exist | Enforcement/orchestration capability is overclaimed | Future-only credential classes and claim boundary | not implemented / planning only |

## Required Future Controls

Future implementation work must define:

- secrets manager selection
- environment-variable policy
- key rotation schedule
- webhook signature verification model
- service-account scope model
- incident response path
- audit event coverage
- tenant-aware key model
- developer access rules

No control is implemented in this pass.

## Rejected Patterns

The following patterns are rejected:

- secrets in repo
- secrets in static site
- secrets in `.track3-runs/`
- client-side authority over keys
- hardcoded Stripe keys
- public NEXUS runtime credentials before authorization

## Non-Implementation Declaration

Option E 0.8 does not implement:

- Section 1.2
- secrets
- key management
- encryption
- backend
- auth
- database
- persistence
- billing
- Palisade
- Weave
- public NEXUS runtime

It also does not create routes, runtime UI behavior, JavaScript behavior, CSS behavior, public gallery behavior, Stripe integration, secrets manager configuration, key rotation, API endpoints, server files, package dependencies, or customer workspace behavior.

## Next Pass Relationship

Option E 0.9 follows with billing / Stripe boundary planning.
