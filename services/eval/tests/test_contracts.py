import pytest
from pydantic import ValidationError
from contracts import (
    AgentTurn,
    GateResult,
    ScopeRule,
    Fact,
    TestCase,
    ReviewDecision
)


def test_agent_turn_valid():
    payload = {
        "intent": "confirm_slot",
        "is_commitment": True,
        "claims": [{"claim": "Interview slot is at 2pm", "fact_id": "fact_slot_01"}],
        "proposed_utterance": "I have you down for 2pm on Friday. Does that still work?",
        "confidence": 0.95,
        "action": "offer_slot",
        "action_params": {"slot": "2026-10-30T14:00:00Z"},
    }
    turn = AgentTurn.model_validate(payload)
    assert turn.intent == "confirm_slot"
    assert turn.is_commitment is True
    assert len(turn.claims) == 1
    assert turn.confidence == 0.95


def test_agent_turn_invalid_confidence():
    payload = {
        "intent": "greeting",
        "is_commitment": False,
        "claims": [],
        "proposed_utterance": "Hello",
        "confidence": 1.5,  # Out of range (max 1.0)
    }
    with pytest.raises(ValidationError):
        AgentTurn.model_validate(payload)


def test_gate_result_valid():
    payload = {
        "outcome": "PASS",
        "spoken": "Confirmed for 2pm Friday.",
        "tripped_rules": [],
        "missing_fact_ids": [],
        "judge_score": 0.98,
        "flags": [],
    }
    gate = GateResult.model_validate(payload)
    assert gate.outcome == "PASS"
    assert gate.judge_score == 0.98


def test_gate_result_invalid_outcome():
    payload = {
        "outcome": "UNKNOWN_OUTCOME",
        "spoken": "Test",
    }
    with pytest.raises(ValidationError):
        GateResult.model_validate(payload)


def test_scope_rule_and_fact_valid():
    rule_payload = {
        "id": "rule_01",
        "scope_id": "scope_v1",
        "kind": "NEVER_SAY",
        "text": "Never quote pay without fact_id",
        "params": {"forbidden_keywords": ["salary", "pay", "compensation"]},
    }
    rule = ScopeRule.model_validate(rule_payload)
    assert rule.kind == "NEVER_SAY"

    fact_payload = {
        "id": "fact_01",
        "scope_id": "scope_v1",
        "key": "company_name",
        "value": "Acme Staffing",
    }
    fact = Fact.model_validate(fact_payload)
    assert fact.key == "company_name"


def test_review_decision_valid():
    payload = {
        "review_item_id": "rev_01",
        "decision": "APPROVED",
        "notes": "Verified against recruiter email",
        "promote_to_test": True,
    }
    decision = ReviewDecision.model_validate(payload)
    assert decision.decision == "APPROVED"
    assert decision.promote_to_test is True

