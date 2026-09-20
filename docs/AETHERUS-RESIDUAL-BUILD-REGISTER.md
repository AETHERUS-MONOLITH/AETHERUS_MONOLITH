# AETHERUS residual build register

Status vocabulary:

- **A — implemented and usable**
- **B — implemented with a material limitation**
- **C — specified but not implemented**
- **D — not specified sufficiently**
- **E — product/business work still required**

Anything in B–D remains open engineering scope.

| Area | State | Current evidence | Open work |
| --- | --- | --- | --- |
| Five-Intelligence runtime | B | Communicator, Mediator, Drafter, Refiner and Origin have distinct validated input/output and authority contracts behind the active `live-governed-evaluation-v0` Edge Function. One selected Intelligence runs per request. | No authenticated persisted execution has completed yet. Knowledge inputs are limited to the submitted ScenarioInput and static contract semantics. |
| Orchestration | C | Human selection and one-Intelligence invocation are implemented. | No generalized sequence, retry graph, Temporal/Weave workflow or autonomous loop exists. Define explicit inter-Intelligence handoff and failure semantics before implementation. |
| Intelligence knowledge/resources | D | Each Intelligence declares minimum required resources in data/intelligence-runtime-contracts.v0.json. | Resource registry, retrieval policy, freshness, licensing, provenance, tenant boundaries and evaluation criteria are not specified sufficiently. |
| Workspace capabilities | B | Authenticated Current Work stages one input, invokes one Intelligence, renders Object → Evidence → Decision → Result and preserves a distinct deterministic fixture. The live Supabase project contains existing workspace and membership records. | Authenticated browser admission and rendering from a real persisted run remain unverified. No run list, comparison, cancellation, collaboration, workspace administration or second-user onboarding flow. |
| Model execution | B | The active Edge Function implements one bounded OpenAI Responses API call with explicit provider, model, request/output digests, usage evidence and `store: false`. Per-run non-sensitive classification and processing consent are required before invocation. | `OPENAI_API_KEY` presence cannot be verified with the available project-management boundary, and no authenticated live invocation has completed. |
| Evidence and persistence | B | The live Supabase project contains the dedicated run and append-only event tables. They bind user, workspace, input/model/NEXUS hashes and normalized result; RLS grants only the invoking workspace member read access and server-owned writes remain outside authenticated client privileges. | The tables currently contain zero live runs/events. This is not a production ledger: no hash chain, retention policy, export, evidence verification UI, disaster recovery or operational integrity monitoring. |
| AETHERUS↔NEXUS | B | A separate Python execution host imports the clean pinned Alpha/Delta/Omega kernel and returns the existing adapter semantics. Local tests executed the pinned kernel successfully, and AETHERUS rejects commit/source/model-boundary mismatches. | No durable HTTPS execution host exists. `AETHERUS_NEXUS_EXECUTION_URL` and `AETHERUS_NEXUS_EXECUTION_TOKEN` cannot be treated as configured until that host is provisioned; NEXUS itself remains independently owned. |
| External actions | C | Every result explicitly records no external release action and Origin cannot exercise commit authority. | No external-action executor, approval/consumption protocol for product runs or reversible action receipt exists. |
| Governance controls | B | Request schemas, identity binding, exact model output schemas, NEXUS preflight, deterministic verdict dominance and fail-closed persistence are executable. | Generalized Palisade/Conduit consumption, policy version selection, conflict resolution and control evaluation coverage remain open. |
| Operational observability | D | Per-run events and failure stage/code are persisted. | Metrics, alerting, traces, SLOs, cost controls, redaction review, abuse monitoring and incident response are not specified sufficiently. |
| User-facing product surfaces | B | Accepted AETHERUS v2 Public Facade, Access and bounded Current Work surfaces exist. | History, resource management, evidence inspection, admin and error-recovery surfaces are incomplete. |
| Deployment/production hardening | B | Both live-run migrations and the `live-governed-evaluation-v0` Edge Function are active on the healthy Supabase project. The corrected Pages authorization-request function accepted a standards-compliant GitHub OIDC token and bound an exact `efedb49` artifact. | Pages publication stopped at the existing action-specific fixed-Operator session decision and the public domain still serves the previous site. NEXUS hosting, model/NEXUS secret verification, secret rotation, environment separation, rollback rehearsal, load/security testing and independent second-user verification remain open. |
| Product completion | E | The bounded runtime supplies implementation evidence. | Define the complete product beyond this first run type. |
| Customer problem/use case | E | No implementation evidence establishes a final customer problem. | Select and validate one concrete problem and use case. |
| ICP/target market | E | Legacy research exists only as input evidence. | Reconcile current research and reevaluate directly addressable customers against current-generation model capabilities. |
| Commercial model | E | Not established by this runtime. | Define commercial model, pricing and packaging after customer validation. |
| Marketing/acquisition | E | Not established by this runtime. | Define positioning, acquisition channels and evidence-backed go-to-market structure. |

## Current boundary

live_governed_evaluation_v0 is the first bounded product execution path. It is
not completion of the AETHERUS product, a compliance system, a production audit
ledger, a generalized orchestrator or an external-action authority.

As of 2026-09-20, Supabase reactivation and backend deployment are complete.
The next runtime proof still requires an authenticated workspace session, a
verified OpenAI secret, and a durable authenticated NEXUS execution host. Pages
publication requires a fresh exact-artifact request authorized through the
existing fixed-Operator Supabase session protocol.
