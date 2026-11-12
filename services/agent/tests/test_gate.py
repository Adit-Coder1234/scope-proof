import pytest
from contracts import AgentTurn, ScopeRule, Fact, GateResult
from gate import ValidationGate, FALLBACK_HOLD_LINE


@pytest.fixture
def gate_fixture():
    rules = [
        ScopeRule(
            id="rule_disclosure",
            scope_id="scope_interview_v1",
            kind="DISCLOSURE",
            text="Must disclose AI and recording in turn 0.",
            params={"required_phrases": ["automated assistant", "recorded for quality"]}
        ),
        ScopeRule(
            id="rule_valid_slots_only",
            scope_id="scope_interview_v1",
            kind="MUST_ANSWER",
            text="Offered slots must exist in recruiter calendar.",
            params={"check_table": "recruiter_calendar"}
        ),
        ScopeRule(
            id="rule_never_say_salary",
            scope_id="scope_interview_v1",
            kind="NEVER_SAY",
            text="Never quote salary figures without fact_id.",
            params={"forbidden_keywords": ["salary", "compensation", "ctc", "lpa"]}
        ),
        ScopeRule(
            id="rule_never_imply_selection",
            scope_id="scope_interview_v1",
            kind="NEVER_SAY",
            text="Never promise employment or say hired.",
            params={"forbidden_keywords": ["you're hired", "you are hired", "offer confirmed"]}
        ),
        ScopeRule(
            id="rule_opt_out_dnc",
            scope_id="scope_interview_v1",
            kind="HANDOFF",
            text="Handle opt-out politely and set DNC.",
            params={"opt_out_phrases": ["stop calling", "remove my number", "opt out"]}
        )
    ]
    facts = [
        Fact(id="fact_company", scope_id="scope_interview_v1", key="company_name", value="Apex Staffing"),
        Fact(id="fact_slot_01", scope_id="scope_interview_v1", key="recruiter_calendar_slot", value="Friday, Oct 31 at 10:00 AM IST"),
        Fact(id="fact_slot_02", scope_id="scope_interview_v1", key="recruiter_calendar_slot", value="Friday, Oct 31 at 2:00 PM IST")
    ]
    return ValidationGate(rules, facts)


# ---------------------------------------------------------------------------
# F1: Invented Pay Test (Fails without gate, passes with gate)
# ---------------------------------------------------------------------------
def test_f1_invented_pay_fails_without_gate_passes_with_gate(gate_fixture):
    # Risky turn proposing 45 LPA without grounded fact_id
    proposed = AgentTurn(
        intent="salary_inquiry",
        is_commitment=False,
        claims=[{"claim": "Package is 45 LPA", "fact_id": "missing_fact_id"}],
        proposed_utterance="The starting salary for this role is 45 LPA base compensation.",
        confidence=0.9
    )

    # 1. Without gate: raw utterance is spoken, ungrounded pay leaks
    raw_spoken_without_gate = proposed.proposed_utterance
    assert "45 LPA" in raw_spoken_without_gate  # Failure state without gate

    # 2. With gate: grounding catches missing fact_id & salary keywords, holds for review
    gate_res = gate_fixture.validate(proposed, turn_idx=1)
    assert gate_res.outcome == "REVIEW"
    assert "UNGROUNDED_PAY" in gate_res.flags or "UNGROUNDED_CLAIM" in gate_res.flags
    assert "45 LPA" not in gate_res.spoken
    assert gate_res.spoken == FALLBACK_HOLD_LINE


# ---------------------------------------------------------------------------
# F2: Impossible Slot Test (Fails without gate, passes with gate)
# ---------------------------------------------------------------------------
def test_f2_impossible_slot_fails_without_gate_passes_with_gate(gate_fixture):
    # Agent offers an unscheduled slot (Sunday 3:00 AM)
    proposed = AgentTurn(
        intent="confirm_slot",
        is_commitment=True,
        claims=[],
        proposed_utterance="I have scheduled you for Sunday at 3:00 AM.",
        confidence=0.9,
        action="offer_slot",
        action_params={"slot": "Sunday at 3:00 AM"}
    )

    # 1. Without gate: invalid slot is spoken to the candidate
    assert "Sunday at 3:00 AM" in proposed.proposed_utterance

    # 2. With gate: rule engine detects slot not in recruiter calendar, replaces with real slots
    gate_res = gate_fixture.validate(proposed, turn_idx=1)
    assert gate_res.outcome == "FALLBACK"
    assert "IMPOSSIBLE_SLOT" in gate_res.flags
    assert "Sunday at 3:00 AM" not in gate_res.spoken
    assert "Friday at 10:00 AM" in gate_res.spoken


# ---------------------------------------------------------------------------
# F3: Promise Outside Scope Test (Fails without gate, passes with gate)
# ---------------------------------------------------------------------------
def test_f3_promise_outside_scope_fails_without_gate_passes_with_gate(gate_fixture):
    # Agent drifts into guaranteeing employment
    proposed = AgentTurn(
        intent="hiring_confirmation",
        is_commitment=True,
        claims=[],
        proposed_utterance="Great news, you are hired for this position!",
        confidence=0.95
    )

    # 1. Without gate: hiring promise leaks
    assert "you are hired" in proposed.proposed_utterance

    # 2. With gate: NEVER_SAY rule trips, replaces with scope boundary clarification
    gate_res = gate_fixture.validate(proposed, turn_idx=1)
    assert gate_res.outcome == "FALLBACK"
    assert "NEVER_IMPLY_SELECTION" in gate_res.flags
    assert "you are hired" not in gate_res.spoken
    assert "solely to confirm your technical screening" in gate_res.spoken


# ---------------------------------------------------------------------------
# F4: Opt-Out / Do Not Call Test
# ---------------------------------------------------------------------------
def test_f4_opt_out_handled_politely(gate_fixture):
    proposed = AgentTurn(
        intent="opt_out_acknowledgment",
        is_commitment=False,
        claims=[],
        proposed_utterance="I have removed your number and marked do not call.",
        confidence=0.98
    )

    gate_res = gate_fixture.validate(proposed, turn_idx=1)
    assert gate_res.outcome == "PASS"
    assert "OPT_OUT" in gate_res.flags

