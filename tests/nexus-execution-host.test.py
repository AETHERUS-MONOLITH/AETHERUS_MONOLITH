import hashlib
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "services" / "nexus-execution-host" / "server.py"
SPEC = importlib.util.spec_from_file_location("aetherus_nexus_execution_host", MODULE_PATH)
HOST = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HOST)


def stable_hash(value):
    source = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


class NexusExecutionHostTests(unittest.TestCase):
    def setUp(self):
        self.candidate = {
            "summary": "A bounded non-sensitive evaluation candidate.",
            "candidate_decision": "pass",
            "risk_level": "low",
            "rationale": "The input remains within the bounded evaluation surface.",
            "evidence_requirements": [],
            "intelligence_output": {
                "constraints": ["Remain within the bounded input."],
                "acceptance_tests": ["A result is persisted."],
                "forbidden_patterns": ["No external release action."],
            },
        }
        self.request = {
            "schema_version": "0.1",
            "run_id": "33333333-3333-4333-8333-333333333333",
            "intelligence_id": "mediator",
            "input_text": "Provide a general compliance overview for an internal review.",
            "input_sha256": hashlib.sha256(b"Provide a general compliance overview for an internal review.").hexdigest(),
            "model_candidate": self.candidate,
            "model_output_sha256": stable_hash(self.candidate),
        }

    def test_request_identity_is_enforced(self):
        self.assertEqual(HOST.validate_request(dict(self.request))["run_id"], self.request["run_id"])
        invalid = dict(self.request)
        invalid["input_sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "input_identity_mismatch"):
            HOST.validate_request(invalid)

    def test_adapter_semantics_are_conservative(self):
        normalized = HOST.normalize_nexus(
            {"cell_id": "cell"},
            {"status": "blocked", "risk_score": 0.9, "domain_payload": {"intent_type": "fair_lending_check"}},
            {"decision": "escalate", "reasoning": "Human review required."},
        )
        self.assertEqual(normalized["verdict"], "escalate")
        self.assertFalse(normalized["external_release_eligible"])

    def test_real_pinned_alpha_delta_omega_execution(self):
        source = Path(os.environ.get("AETHERUS_NEXUS_SOURCE_PATH", REPO_ROOT.parent / "nexus-mvp-pinned-ab95cbb"))
        if not source.exists():
            self.skipTest("pinned NEXUS checkout is not available")
        with tempfile.TemporaryDirectory() as directory:
            runtime = HOST.NexusRuntime(source, Path(directory))
            result = runtime.evaluate(HOST.validate_request(dict(self.request)))
        self.assertEqual(result["execution_status"], "completed")
        self.assertEqual(result["adapter_identity"]["nexus_commit"], HOST.EXPECTED_NEXUS_COMMIT)
        self.assertFalse(result["adapter_identity"]["anthropic_invocation"])
        self.assertFalse(result["normalized"]["external_release_eligible"])
        self.assertEqual([gate["gate_id"] for gate in result["normalized"]["gate_results"]], ["alpha_intake", "delta_risk_gate", "omega_decision"])


if __name__ == "__main__":
    unittest.main()
