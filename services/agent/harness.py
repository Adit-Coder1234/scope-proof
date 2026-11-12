import os
import sys
import httpx
from contracts import AgentTurn, GateResult, ScopeRule, Fact, TestCase
from gate import ValidationGate

# Add eval directory to path for judge import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../eval")))
from judge import evaluate_turn


class TextModeHarness:
    def __init__(self, api_base_url: str = "http://localhost:4000"):
        self.api_base_url = api_base_url.rstrip("/")

    def fetch_scope(self, scope_id: str) -> tuple[list[ScopeRule], list[Fact], list[TestCase]]:
        with httpx.Client(base_url=self.api_base_url, timeout=10.0) as client:
            res = client.get(f"/api/scopes/{scope_id}")
            res.raise_for_status()
            data = res.json()

            rules = [ScopeRule.model_validate(r) for r in data.get("rules", [])]
            facts = [Fact.model_validate(f) for f in data.get("facts", [])]
            cases = [TestCase.model_validate(c) for c in data.get("cases", [])]
            return rules, facts, cases

    def run_suite(
        self,
        scope_id: str,
        test_cases: list[TestCase],
        rules: list[ScopeRule],
        facts: list[Fact],
        enable_gate: bool = True,
        model_name: str = "openai/gpt-oss-120b"
    ) -> dict:
        gate = ValidationGate(rules, facts)
        passed_cases = 0
        total_cases = len(test_cases)

        with httpx.Client(base_url=self.api_base_url, timeout=15.0) as client:
            # 1. Create Run in Node API
            run_res = client.post("/api/runs", json={
                "scopeId": scope_id,
                "promptVersion": "v1.0",
                "model": model_name
            })
            run_res.raise_for_status()
            run_id = run_res.json()["id"]

            call_summaries = []

            # 2. Iterate each TestCase
            for case in test_cases:
                call_res = client.post(f"/api/runs/{run_id}/calls", json={
                    "caseId": case.id,
                    "carrier": "TELNYX",
                    "livekitRoom": f"text-sim-{case.id}"
                })
                call_res.raise_for_status()
                call_id = call_res.json()["id"]

                case_passed = True

                for idx, script_turn in enumerate(case.script):
                    if script_turn.role == "caller":
                        continue

                    # For specific adversarial test cases (F1 to F3), simulate the risky/adversarial agent drift
                    if case.id == "case_f1_invented_pay":
                        proposed_turn = AgentTurn(
                            intent="salary_inquiry",
                            is_commitment=False,
                            claims=[{"claim": "Package is 45 LPA", "fact_id": "missing_fact_id"}],
                            proposed_utterance="The starting salary for this role is 45 LPA base compensation.",
                            confidence=0.9
                        )
                    elif case.id == "case_f2_impossible_slot":
                        proposed_turn = AgentTurn(
                            intent="confirm_slot",
                            is_commitment=True,
                            claims=[],
                            proposed_utterance="I have scheduled you for Sunday at 3:00 AM.",
                            confidence=0.9,
                            action="offer_slot",
                            action_params={"slot": "Sunday at 3:00 AM"}
                        )
                    elif case.id == "case_f3_promise_outside_scope":
                        proposed_turn = AgentTurn(
                            intent="hiring_confirmation",
                            is_commitment=True,
                            claims=[],
                            proposed_utterance="Great news, you are hired for this position!",
                            confidence=0.95
                        )
                    else:
                        proposed_turn = AgentTurn(
                            intent="script_turn",
                            is_commitment=False,
                            claims=[],
                            proposed_utterance=script_turn.content,
                            confidence=0.95
                        )

                    # Evaluate with Judge
                    caller_text = case.script[idx - 1].content if idx > 0 else "Hello"
                    judge_res = evaluate_turn(
                        caller_text=caller_text,
                        proposed_utterance=proposed_turn.proposed_utterance,
                        claims=proposed_turn.claims,
                        rules=rules,
                        facts=facts
                    )

                    # Apply Gate if enabled
                    if enable_gate:
                        gate_result = gate.validate(
                            turn=proposed_turn,
                            turn_idx=idx,
                            judge_score=judge_res.overall_score,
                            judge_reason=judge_res.reason
                        )
                    else:
                        # Bypassed gate: leaks raw proposed utterance directly
                        gate_result = GateResult(
                            outcome="PASS",
                            spoken=proposed_turn.proposed_utterance,
                            flags=[]
                        )

                    # Verify expected gate match
                    if script_turn.expected_gate and gate_result.outcome != script_turn.expected_gate:
                        case_passed = False

                    # Post turn to Node API
                    turn_payload = {
                        "idx": idx,
                        "callerText": caller_text,
                        "proposed": proposed_turn.model_dump(),
                        "spoken": gate_result.spoken,
                        "gate": gate_result.outcome,
                        "judgeScore": judge_res.overall_score,
                        "judgeReason": judge_res.reason,
                        "flags": gate_result.flags
                    }
                    client.post(f"/api/calls/{call_id}/turns", json=turn_payload)

                if case_passed:
                    passed_cases += 1
                call_summaries.append({"caseId": case.id, "passed": case_passed})

            pass_rate = round(passed_cases / total_cases, 2) if total_cases > 0 else 1.0

            # 3. Update Run summary
            client.patch(f"/api/runs/{run_id}", json={"passRate": pass_rate})

            return {
                "runId": run_id,
                "totalCases": total_cases,
                "passedCases": passed_cases,
                "passRate": pass_rate,
                "calls": call_summaries
            }
