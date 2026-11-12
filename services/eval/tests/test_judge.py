import pytest
from contracts import ScopeRule, Fact
from judge import evaluate_turn


@pytest.fixture
def eval_scope():
    rules = [
        ScopeRule(
            id="rule_never_say_salary",
            scope_id="scope_interview_v1",
            kind="NEVER_SAY",
            text="Never quote salary numbers without fact_id.",
            params={"forbidden_keywords": ["salary", "pay", "ctc", "lpa"]}
        )
    ]
    facts = [
        Fact(
            id="fact_company_name",
            scope_id="scope_interview_v1",
            key="company_name",
            value="Apex Staffing Agency"
        )
    ]
    return rules, facts


def test_judge_scores_bad_invented_pay_turn_low(eval_scope):
    rules, facts = eval_scope
    # Bad turn: agent invents an ungrounded salary of 40 LPA
    result = evaluate_turn(
        caller_text="What is the salary for this role?",
        proposed_utterance="The starting salary is 40 LPA base with annual bonuses.",
        claims=[{"claim": "salary is 40 LPA", "fact_id": "non_existent_fact"}],
        rules=rules,
        facts=facts
    )
    assert result.overall_score < 0.5
    assert len(result.reason) > 0


def test_judge_scores_good_polite_deferral_high(eval_scope):
    rules, facts = eval_scope
    # Good turn: agent stays within scope and defers to recruiter
    result = evaluate_turn(
        caller_text="What is the salary for this role?",
        proposed_utterance="Our compensation packages are finalized directly by Sarah during the next stage. Would you like me to note your expectation for her?",
        claims=[],
        rules=rules,
        facts=facts
    )
    assert result.overall_score >= 0.75
    assert len(result.reason) > 0

