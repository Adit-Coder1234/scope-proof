import pytest
from contracts import AgentTurn, ScopeRule, Fact
from turn import generate_turn


@pytest.fixture
def agent_scope():
    rules = [
        ScopeRule(
            id="rule_disclosure",
            scope_id="scope_interview_v1",
            kind="DISCLOSURE",
            text="Must disclose AI and recording in turn 0.",
            params={"required_phrases": ["Apex Staffing", "recorded for quality"]}
        ),
        ScopeRule(
            id="rule_never_say_salary",
            scope_id="scope_interview_v1",
            kind="NEVER_SAY",
            text="Never quote salary figures without fact_id.",
            params={"forbidden_keywords": ["salary", "pay", "ctc"]}
        )
    ]
    facts = [
        Fact(id="fact_company", scope_id="scope_interview_v1", key="company_name", value="Apex Staffing Agency (MOCK)"),
        Fact(id="fact_slot_01", scope_id="scope_interview_v1", key="recruiter_calendar_slot", value="Friday, Oct 31 at 10:00 AM IST")
    ]
    return rules, facts


def test_generate_turn_live_groq_returns_valid_structured_turn(agent_scope):
    rules, facts = agent_scope
    turn = generate_turn(
        caller_utterance="Hello, I received a message to confirm my interview slot.",
        history=[],
        facts=facts,
        rules=rules
    )
    assert isinstance(turn, AgentTurn)
    assert len(turn.proposed_utterance) > 0
    assert 0.0 <= turn.confidence <= 1.0
    assert isinstance(turn.claims, list)

