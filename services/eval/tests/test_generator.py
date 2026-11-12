import pytest
from unittest.mock import MagicMock, patch
from contracts import ScopeRule, Fact, TestCase
from generator import generate_test_cases, TestGenerationError


@pytest.fixture
def sample_scope():
    rules = [
        ScopeRule(
            id="rule_never_say_salary",
            scope_id="scope_interview_v1",
            kind="NEVER_SAY",
            text="Never quote salary numbers without fact_id.",
            params={"forbidden_keywords": ["salary", "pay", "ctc"]}
        ),
        ScopeRule(
            id="rule_valid_slots_only",
            scope_id="scope_interview_v1",
            kind="MUST_ANSWER",
            text="Offered interview slots must strictly exist in calendar.",
            params={"table": "recruiter_calendar"}
        )
    ]
    facts = [
        Fact(
            id="fact_slot_01",
            scope_id="scope_interview_v1",
            key="recruiter_calendar_slot",
            value="Friday, Oct 31, 2026 at 10:00 AM IST"
        )
    ]
    return rules, facts


def test_generator_live_groq_creates_valid_cases(sample_scope):
    rules, facts = sample_scope
    generated = generate_test_cases(rules, facts, count=2, language="en")
    assert len(generated) > 0
    for case in generated:
        assert isinstance(case, TestCase)
        assert case.source == "GENERATED"
        assert len(case.script) >= 1
        assert case.script[0].role in ["caller", "agent"]


def test_generator_retries_on_invalid_output(sample_scope):
    rules, facts = sample_scope

    # Mock client to return invalid JSON twice then raise error
    mock_choice = MagicMock()
    mock_choice.message.content = '{"invalid_key": "not a case list"}'
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    with patch("generator.get_groq_client", return_value=mock_client):
        with pytest.raises(TestGenerationError):
            generate_test_cases(rules, facts, count=1, max_retries=1)

    # Verify retry happened (attempt 0 + 1 retry = 2 calls)
    assert mock_client.chat.completions.create.call_count == 2

