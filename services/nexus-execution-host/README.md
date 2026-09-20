# NEXUS execution host — live governed evaluation v0

This is the smallest server boundary that preserves the frozen Python NEXUS
kernel. It imports the clean source at commit
`ab95cbbd24df5817c4e363d24b3b199ac8af6c6f`; it does not port or modify the
kernel. The host removes `ANTHROPIC_API_KEY` before import so Alpha uses its
deterministic fallback. The Supabase Edge Function remains the only model
boundary.

Required environment:

- `AETHERUS_NEXUS_SOURCE_PATH`: clean checkout of the pinned NEXUS repository.
- `AETHERUS_NEXUS_EXECUTION_TOKEN`: random server-to-server bearer token of at
  least 32 characters.
- `AETHERUS_NEXUS_HOST`: bind address; defaults to `127.0.0.1`.
- `AETHERUS_NEXUS_PORT`: port; defaults to `8792`.
- `AETHERUS_NEXUS_AUDIT_DIR`: optional local JSONL directory.

Both endpoints require the bearer token. The JSONL output is execution-host
evidence only and is explicitly not a production ledger. The Edge Function
persists normalized NEXUS evidence and its hash in Supabase.

A hosted Edge Function can call this service only after the Operator deploys it
behind HTTPS and sets `AETHERUS_NEXUS_EXECUTION_URL` plus the matching token as
Supabase Edge secrets. This repository change does not infer or silently create
that infrastructure.
