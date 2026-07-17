import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const specification = JSON.parse(await fs.readFile("contracts/github-pages-publication-authorization-acceptance-tests-v0.json", "utf8"));
const expected = [
  ["AT-01", "Exact valid request creation"],
  ["AT-02", "Idempotent identical request retry"],
  ["AT-03", "Conflicting duplicate request"],
  ["AT-04", "Unsupported action"],
  ["AT-05", "Requester substitution"],
  ["AT-06", "Operator authorization"],
  ["AT-07", "Separate acts for self-authorization"],
  ["AT-08", "Operator rejection"],
  ["AT-09", "Non-Operator decision rejection"],
  ["AT-10", "Double decision concurrency"],
  ["AT-11", "Valid atomic consumption"],
  ["AT-12", "Double-consumption concurrency"],
  ["AT-13", "Replay after consumption"],
  ["AT-14", "Manifest substitution"],
  ["AT-15", "Artifact substitution"],
  ["AT-16", "Requester substitution at consumption"],
  ["AT-17", "Operator assignment invalidation"]
];

assert.equal(specification.test_count, 17);
assert.deepEqual(specification.tests.map(({ test_id, title }) => [test_id, title]), expected);

for (const [testId, title] of expected) {
  test(`${testId} — ${title}`, () => {
    const definition = specification.tests.find((entry) => entry.test_id === testId);
    assert.ok(definition);
    assert.equal(definition.title, title);
    assert.match(definition.environment, /disposable_postgresql/);
    assert.notEqual(definition.method, "source_inspection");
  });
}

test("corrective acceptance ledger requires every audit field", () => {
  assert.deepEqual(specification.required_ledger_fields, [
    "test_id", "title", "preconditions", "execution_environment", "execution_method", "expected_result",
    "observed_result", "authorization_state_before", "authorization_state_after", "event_rows_created",
    "sequence_or_identity_effects", "cleanup_result", "evidence_file_reference", "result"
  ]);
});
