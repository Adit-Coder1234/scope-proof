import pytest
from contracts import TestCase, ScopeRule, Fact
from harness import TextModeHarness


@pytest.fixture
def test_setup():
    harness = TextModeHarness(api_base_url="http://localhost:4000")
    rules, facts, cases = harness.fetch_scope("scope_interview_v1")
    return harness, rules, facts, cases


def test_harness_runs_and_stores_records_in_postgres(test_setup):
    harness, rules, facts, cases = test_setup

    # Run a subset (first 4 cases covering F1 to F4)
    f_cases = cases[:4]
    summary = harness.run_suite(
        scope_id="scope_interview_v1",
        test_cases=f_cases,
        rules=rules,
        facts=facts,
        enable_gate=True
    )

    assert summary["totalCases"] == 4
    assert summary["runId"] is not None
    assert "passRate" in summary
    assert len(summary["calls"]) == 4

    # Verify run details are stored in Node API / Postgres
    import httpx
    with httpx.Client(base_url="http://localhost:4000") as client:
        res = client.get(f"/api/runs/{summary['runId']}")
        assert res.status_code == 200
        run_data = res.json()
        assert run_data["id"] == summary["runId"]
        assert len(run_data["calls"]) == 4

        # Check that F1 opened a REVIEW gate outcome
        f1_call = next((c for c in run_data["calls"] if c["caseId"] == "case_f1_invented_pay"), None)
        assert f1_call is not None
        assert f1_call["turns"][0]["gate"] == "REVIEW"
        assert f1_call["turns"][0]["reviewItem"] is not None
        assert f1_call["turns"][0]["reviewItem"]["status"] == "PENDING"

