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
| Five-Intelligence runtime | B | Communicator, Mediator, Drafter, Refiner and Origin have distinct validated input/output and authority contracts behind one authenticated server endpoint. One selected Intelligence runs per request. | Independent use needs deployed backend verification. Knowledge inputs are limited to the submitted ScenarioInput and static contract semantics. |
| Orchestration | C | Human selection and one-Intelligence invocation are implemented. | No generalized sequence, retry graph, Temporal/Weave workflow or autonomous loop exists. Define explicit inter-Intelligence handoff and failure semantics before implementation. |
| Intelligence knowledge/resources | D | Each Intelligence declares minimum required resources in data/intelligence-runtime-contracts.v0.json. | Resource registry, retrieval policy, freshness, licensing, provenance, tenant boundaries and evaluation criteria are not specified sufficiently. |
| Workspace capabilities | B | Authenticated Current Work stages one input, invokes one Intelligence, renders Object → Evidence → Decision → Result and preserves a distinct deterministic fixture. | No run list, comparison, cancellation, collaboration, workspace administration or second-user onboarding flow. |
| Evidence and persistence | B | Dedicated run and append-only event tables bind user, workspace, input/model/NEXUS hashes and normalized result. RLS grants the invoking member read access. | This is not a production ledger: no hash chain, retention policy, export, evidence verification UI, disaster recovery or operational integrity monitoring. |
| AETHERUS↔NEXUS | B | A separate Python execution host imports the clean pinned Alpha/Delta/Omega kernel and returns the existing adapter semantics. AETHERUS rejects commit/source/model-boundary mismatches. | A durable HTTPS host and production operations for that boundary are required; NEXUS itself remains independently owned. |
| External actions | C | Every result explicitly records no external release action and Origin cannot exercise commit authority. | No external-action executor, approval/consumption protocol for product runs or reversible action receipt exists. |
| Governance controls | B | Request schemas, identity binding, exact model output schemas, NEXUS preflight, deterministic verdict dominance and fail-closed persistence are executable. | Generalized Palisade/Conduit consumption, policy version selection, conflict resolution and control evaluation coverage remain open. |
| Operational observability | D | Per-run events and failure stage/code are persisted. | Metrics, alerting, traces, SLOs, cost controls, redaction review, abuse monitoring and incident response are not specified sufficiently. |
| User-facing product surfaces | B | Accepted AETHERUS v2 Public Facade, Access and bounded Current Work surfaces exist. | History, resource management, evidence inspection, admin and error-recovery surfaces are incomplete. |
| Deployment/production hardening | B | Static Pages deployment and Supabase Edge deployment paths exist with bounded governance controls. | NEXUS hosting, secret rotation, environment separation, rollback rehearsal, load/security testing and independent second-user verification remain open. |
| Product completion | E | The bounded runtime supplies implementation evidence. | Define the complete product beyond this first run type. |
| Customer problem/use case | E | No implementation evidence establishes a final customer problem. | Select and validate one concrete problem and use case. |
| ICP/target market | E | Legacy research exists only as input evidence. | Reconcile current research and reevaluate directly addressable customers against current-generation model capabilities. |
| Commercial model | E | Not established by this runtime. | Define commercial model, pricing and packaging after customer validation. |
| Marketing/acquisition | E | Not established by this runtime. | Define positioning, acquisition channels and evidence-backed go-to-market structure. |

## Current boundary

live_governed_evaluation_v0 is the first bounded product execution path. It is
not completion of the AETHERUS product, a compliance system, a production audit
ledger, a generalized orchestrator or an external-action authority.
