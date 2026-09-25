FROM python:3.11-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir pydantic==2.12.5

RUN git clone https://github.com/AETHERUS-MONOLITH/nexus-mvp.git /opt/nexus \
    && git -C /opt/nexus checkout --detach ab95cbbd24df5817c4e363d24b3b199ac8af6c6f \
    && test "$(git -C /opt/nexus rev-parse HEAD)" = ab95cbbd24df5817c4e363d24b3b199ac8af6c6f \
    && test -z "$(git -C /opt/nexus status --porcelain)"

WORKDIR /app
COPY server.py /app/server.py

ENV AETHERUS_NEXUS_SOURCE_PATH=/opt/nexus \
    AETHERUS_NEXUS_HOST=0.0.0.0 \
    AETHERUS_NEXUS_PORT=8080 \
    PYTHONDONTWRITEBYTECODE=1

RUN python -c "import server; from pathlib import Path; assert server.source_preflight(Path('/opt/nexus'))['ready']"

EXPOSE 8080
CMD ["python", "/app/server.py"]
