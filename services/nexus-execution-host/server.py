#!/usr/bin/env python3
"""Bounded Python execution host for live_governed_evaluation_v0."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

EXPECTED_NEXUS_COMMIT = "ab95cbbd24df5817c4e363d24b3b199ac8af6c6f"
ADAPTER_NAME = "track_3_17_3_20_nexus_import_adapter_semantics"
UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I)
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
MAX_REQUEST_BYTES = 64 * 1024


def stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_value(value: Any) -> str:
    source = value if isinstance(value, str) else stable_json(value)
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def run_git(source: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=source, check=True, capture_output=True, text=True)
    return result.stdout.strip()


def source_preflight(source: Path) -> dict[str, Any]:
    required = [
        ".git",
        "data/risk_manifest.json",
        "src/operators/alpha.py",
        "src/operators/delta.py",
        "src/operators/omega.py",
    ]
    missing = [item for item in required if not (source / item).exists()]
    commit = run_git(source, "rev-parse", "HEAD") if (source / ".git").exists() else ""
    status = run_git(source, "status", "--porcelain") if (source / ".git").exists() else "missing_git"
    return {
        "ready": not missing and commit == EXPECTED_NEXUS_COMMIT and status == "",
        "nexus_commit": commit,
        "source_clean": status == "",
        "missing": missing,
        "anthropic_enabled": False,
    }


def validate_model_candidate(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("model_candidate_invalid")
    required = {"summary", "candidate_decision", "risk_level", "rationale", "evidence_requirements", "intelligence_output"}
    if set(value) != required:
        raise ValueError("model_candidate_fields_mismatch")
    if value.get("candidate_decision") not in {"pass", "fail", "escalate"}:
        raise ValueError("model_candidate_decision_invalid")
    if value.get("risk_level") not in {"low", "moderate", "high", "critical"}:
        raise ValueError("model_candidate_risk_invalid")
    if not isinstance(value.get("summary"), str) or not value["summary"].strip():
        raise ValueError("model_candidate_summary_invalid")
    if not isinstance(value.get("rationale"), str) or not value["rationale"].strip():
        raise ValueError("model_candidate_rationale_invalid")
    if not isinstance(value.get("evidence_requirements"), list):
        raise ValueError("model_candidate_evidence_requirements_invalid")
    if not isinstance(value.get("intelligence_output"), dict):
        raise ValueError("model_candidate_intelligence_output_invalid")
    return value


def validate_request(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("request_body_invalid")
    required = {"schema_version", "run_id", "intelligence_id", "input_text", "input_sha256", "model_candidate", "model_output_sha256"}
    if set(value) != required or value.get("schema_version") != "0.1":
        raise ValueError("request_fields_invalid")
    if not UUID_PATTERN.match(str(value.get("run_id", ""))):
        raise ValueError("run_id_invalid")
    if value.get("intelligence_id") not in {"communicator", "mediator", "drafter", "refiner", "origin"}:
        raise ValueError("intelligence_id_invalid")
    input_text = value.get("input_text")
    if not isinstance(input_text, str) or not 20 <= len(input_text.strip()) <= 4000:
        raise ValueError("input_text_invalid")
    if not SHA256_PATTERN.match(str(value.get("input_sha256", ""))) or sha256_value(input_text.strip()) != value["input_sha256"]:
        raise ValueError("input_identity_mismatch")
    candidate = validate_model_candidate(value.get("model_candidate"))
    if not SHA256_PATTERN.match(str(value.get("model_output_sha256", ""))) or sha256_value(candidate) != value["model_output_sha256"]:
        raise ValueError("model_output_identity_mismatch")
    value["input_text"] = input_text.strip()
    return value


def normalize_nexus(alpha: dict[str, Any], delta: dict[str, Any], omega: dict[str, Any]) -> dict[str, Any]:
    delta_status = delta.get("status")
    omega_decision = omega.get("decision")
    verdict = "pass" if omega_decision == "release" else "fail" if omega_decision == "block" else "escalate"
    gate_results = [
        {
            "gate_id": "alpha_intake",
            "status": "pass" if alpha else "escalate",
            "source": "pinned_nexus_alpha_operator_deterministic_fallback",
            "reason": "Alpha produced a cell without a second model invocation." if alpha else "Alpha output missing.",
        },
        {
            "gate_id": "delta_risk_gate",
            "status": "pass" if delta_status == "safe" else "escalate",
            "source": "pinned_nexus_delta_operator",
            "reason": "Delta status: %s; intent: %s; risk: %s"
            % (delta_status or "missing", delta.get("domain_payload", {}).get("intent_type", "missing"), delta.get("risk_score", "missing")),
        },
        {
            "gate_id": "omega_decision",
            "status": "pass" if omega_decision == "release" else "escalate",
            "source": "pinned_nexus_omega_operator",
            "reason": omega.get("reasoning") or "Omega reasoning unavailable.",
        },
    ]
    return {
        "verdict": verdict,
        "gate_results": gate_results,
        "decision_explanation": {
            "source_decision": omega_decision or "missing",
            "source_delta_status": delta_status or "missing",
            "source_intent_class": delta.get("domain_payload", {}).get("intent_type", "missing"),
            "reason": omega.get("reasoning") or "NEXUS output normalized by the existing adapter semantics.",
        },
        "kernel_candidate_eligible": verdict == "pass" and all(gate["status"] == "pass" for gate in gate_results),
        "external_release_eligible": False,
    }


class NexusRuntime:
    def __init__(self, source: Path, audit_dir: Path):
        self.source = source.resolve()
        self.audit_dir = audit_dir.resolve()
        self.audit_dir.mkdir(parents=True, exist_ok=True)
        self.preflight = source_preflight(self.source)
        if not self.preflight["ready"]:
            raise RuntimeError("nexus_source_preflight_failed")
        os.environ.pop("ANTHROPIC_API_KEY", None)
        sys.path.insert(0, str(self.source))
        os.chdir(self.source)
        from src.operators.alpha import alpha_operator
        from src.operators.delta import delta_operator
        from src.operators.omega import OmegaOperator

        self.alpha_operator = alpha_operator
        self.delta_operator = delta_operator
        self.omega_type = OmegaOperator

    def evaluate(self, request: dict[str, Any]) -> dict[str, Any]:
        run_id = request["run_id"]
        ledger_path = self.audit_dir / f"{run_id}.jsonl"
        context = {
            "session_id": run_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "regulatory_framework": "AETHERUS_LIVE_GOVERNED_EVALUATION_V0",
            "jurisdiction": "US",
        }
        cell_after_alpha = self.alpha_operator(request["input_text"], context)
        alpha = {
            "cell_id": cell_after_alpha.get("cell_id"),
            "status": cell_after_alpha.get("status"),
            "uncertainty": cell_after_alpha.get("uncertainty"),
            "proposal": cell_after_alpha.get("proposal"),
        }
        cell_after_delta = self.delta_operator(cell_after_alpha)
        delta = {
            "status": cell_after_delta.get("status"),
            "risk_score": cell_after_delta.get("risk_score"),
            "intent_type": cell_after_delta.get("domain_payload", {}).get("intent_type"),
            "domain_payload": cell_after_delta.get("domain_payload"),
        }
        omega = self.omega_type(
            ledger_path=str(ledger_path),
            manifest_path=str(self.source / "data/risk_manifest.json"),
        ).process(
            cell_after_delta,
            request["input_text"],
            {"framework": context["regulatory_framework"], "intent_class": delta["intent_type"]},
        )
        if not ledger_path.exists():
            raise RuntimeError("nexus_audit_log_missing")
        audit_bytes = ledger_path.read_bytes()
        response = {
            "schema_version": "0.1",
            "execution_status": "completed",
            "run_id": run_id,
            "adapter_identity": {
                "name": ADAPTER_NAME,
                "nexus_commit": EXPECTED_NEXUS_COMMIT,
                "source_modified": False,
                "anthropic_invocation": False,
                "openai_invocation": False,
                "kernel_execution": ["alpha", "delta", "omega"],
            },
            "input_binding": {"intelligence_id": request["intelligence_id"], "input_sha256": request["input_sha256"], "model_output_sha256": request["model_output_sha256"]},
            "normalized": normalize_nexus(alpha, delta, omega),
            "audit_log_reference": {
                "status": "execution_host_jsonl_not_production_ledger",
                "sha256": hashlib.sha256(audit_bytes).hexdigest(),
                "size_bytes": len(audit_bytes),
            },
        }
        response["execution_sha256"] = sha256_value(response)
        return response


class Handler(BaseHTTPRequestHandler):
    server_version = "AETHERUSNexusHost/0"

    def _authorized(self) -> bool:
        supplied = self.headers.get("authorization", "")
        expected = f"Bearer {self.server.token}"
        return hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8"))

    def _json(self, status: int, value: dict[str, Any]) -> None:
        body = json.dumps(value, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/health" or not self._authorized():
            self._json(404, {"error": "not_found"})
            return
        self._json(200, self.server.runtime.preflight)

    def do_POST(self) -> None:
        if self.path != "/v1/evaluate" or not self._authorized():
            self._json(404, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("request_size_invalid")
            request = validate_request(json.loads(self.rfile.read(length)))
            self._json(200, self.server.runtime.evaluate(request))
        except (ValueError, json.JSONDecodeError) as error:
            self._json(400, {"error": str(error)})
        except Exception:
            self._json(503, {"error": "nexus_execution_failed"})

    def log_message(self, format: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), format % args))


class NexusServer(HTTPServer):
    def __init__(self, address: tuple[str, int], runtime: NexusRuntime, token: str):
        super().__init__(address, Handler)
        self.runtime = runtime
        self.token = token


def main() -> None:
    source_value = os.environ.get("AETHERUS_NEXUS_SOURCE_PATH", "").strip()
    token = os.environ.get("AETHERUS_NEXUS_EXECUTION_TOKEN", "").strip()
    if not source_value:
        raise SystemExit("AETHERUS_NEXUS_SOURCE_PATH is required")
    if len(token) < 32:
        raise SystemExit("AETHERUS_NEXUS_EXECUTION_TOKEN must contain at least 32 characters")
    host = os.environ.get("AETHERUS_NEXUS_HOST", "127.0.0.1")
    port = int(os.environ.get("AETHERUS_NEXUS_PORT", "8792"))
    audit_dir = Path(os.environ.get("AETHERUS_NEXUS_AUDIT_DIR", str(Path(tempfile.gettempdir()) / "aetherus-nexus-v0")))
    runtime = NexusRuntime(Path(source_value), audit_dir)
    server = NexusServer((host, port), runtime, token)
    print(json.dumps({"status": "ready", "host": host, "port": port, **runtime.preflight}), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
