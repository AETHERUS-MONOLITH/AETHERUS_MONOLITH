# Live governed evaluation v0

## Executable path

Authenticated user and active workspace membership
→ persisted run identity
→ one selected Intelligence
→ one server-side OpenAI Responses API invocation
→ pinned AETHERUS↔NEXUS Python host
→ bounded deterministic governance normalization
→ persisted run, events, evidence and result
→ Current Work Object → Evidence → Decision → Result.

The browser never receives the OpenAI key, Supabase service-role key or NEXUS
server token. The endpoint accepts only input explicitly classified by the user
as non-sensitive with per-run authorization for external OpenAI processing.

## Model boundary

- Provider: OpenAI.
- Model: gpt-5.6-luna.
- Calls per run: exactly one.
- Storage request: store false.
- Output: strict JSON schema selected by intelligence_id.
- Evidence: provider, model, response ID, request hash, output hash and returned
  usage.

## Five Intelligences

The authoritative runtime contracts are in
data/intelligence-runtime-contracts.v0.json. All five share the endpoint but
have different strict output schemas and authority boundaries. A run activates
exactly one Intelligence. Existence does not imply activation. No autonomous
multi-agent loop or generalized sequence is implemented.

## NEXUS boundary

The Edge Function requires a healthy server-to-server HTTPS boundary. The
Python host in services/nexus-execution-host verifies a clean checkout at
commit ab95cbbd24df5817c4e363d24b3b199ac8af6c6f, imports the existing
Alpha/Delta/Omega kernel and removes ANTHROPIC_API_KEY before import. OpenAI
therefore remains the only model invocation. NEXUS output is normalized through
the existing adapter meaning; the kernel is neither ported nor redesigned.

## Persisted objects

ScenarioInput, GateResult, Verdict, EvidenceRequirement, ArtifactReference,
ReleaseEligibility, TraceEvent, HandoffReceipt and IntelligenceInvocation are
persisted only with fields established by this runtime. Release eligibility is
always false and no commit, publication, certification or external action is
performed.

## Failure boundary

Failure to establish session identity, active workspace membership, run
identity, NEXUS health, model response, NEXUS result, governance normalization
or persistence produces a persisted fail-closed record when a run identity has
already been created. No successful result is rendered from an indeterminate
stage.
