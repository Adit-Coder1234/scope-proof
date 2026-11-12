import re
from typing import Any
from contracts import AgentTurn, GateResult, ScopeRule, Fact

FALLBACK_SAFE_LINE = "I want to be sure you have the exact details. Let me have the recruiter follow up with you on that."
FALLBACK_HOLD_LINE = "Let me have the recruiter confirm that with you directly."


class ValidationGate:
    def __init__(
        self,
        rules: list[ScopeRule],
        facts: list[Fact],
        hold_threshold: float = 0.8,
        block_threshold: float = 0.5
    ):
        self.rules = rules
        self.facts = facts
        self.fact_ids = {f.id for f in facts}
        self.valid_slots = {f.value for f in facts if f.key == "recruiter_calendar_slot"}
        self.hold_threshold = hold_threshold
        self.block_threshold = block_threshold

    def validate(
        self,
        turn: AgentTurn | Any,
        turn_idx: int = 0,
        judge_score: float | None = None,
        judge_reason: str | None = None
    ) -> GateResult:
        tripped_rules: list[str] = []
        missing_fact_ids: list[str] = []
        flags: list[str] = []

        # ----------------------------------------------------
        # Layer 1: Schema Validation
        # ----------------------------------------------------
        if not isinstance(turn, AgentTurn):
            try:
                turn = AgentTurn.model_validate(turn)
            except Exception:
                return GateResult(
                    outcome="FALLBACK",
                    spoken=FALLBACK_SAFE_LINE,
                    failed_layer="SCHEMA",
                    tripped_rules=["INVALID_SCHEMA"],
                    missing_fact_ids=[],
                    flags=["MALFORMED_OUTPUT"]
                )

        utterance = turn.proposed_utterance.lower()

        # ----------------------------------------------------
        # Layer 2: Rule Engine (Deterministic)
        # ----------------------------------------------------

        # Check DISCLOSURE on opening turn
        if turn_idx == 0:
            for rule in self.rules:
                if rule.kind == "DISCLOSURE":
                    required_phrases = rule.params.get("required_phrases", [])
                    has_disclosure = any(p.lower() in utterance for p in required_phrases)
                    if not has_disclosure:
                        tripped_rules.append(rule.id)
                        flags.append("MISSING_DISCLOSURE")

        # Check NEVER_SAY rules
        for rule in self.rules:
            if rule.kind == "NEVER_SAY":
                forbidden = rule.params.get("forbidden_keywords", [])
                for kw in forbidden:
                    pattern = r"\b" + re.escape(kw.lower()) + r"\b"
                    if re.search(pattern, utterance):
                        tripped_rules.append(rule.id)
                        if "salary" in kw or "pay" in kw or "ctc" in kw or "lpa" in kw:
                            flags.append("UNGROUNDED_PAY")
                        if "hired" in kw or "job" in kw:
                            flags.append("NEVER_IMPLY_SELECTION")

        # Check HANDOFF / Opt-out rules
        for rule in self.rules:
            if rule.kind == "HANDOFF":
                opt_out_phrases = rule.params.get("opt_out_phrases", [])
                is_opt_out = (
                    any(phrase.lower() in utterance for phrase in opt_out_phrases)
                    or "do not call" in utterance
                    or "dnc" in utterance
                    or "opt_out" in turn.intent.lower()
                    or ("number" in utterance and ("remov" in utterance or "stop" in utterance))
                )
                if is_opt_out:
                    flags.append("OPT_OUT")

        # Check impossible slot offers
        if turn.action == "offer_slot" or "confirm_slot" in turn.intent:
            slot_candidate = turn.action_params.get("slot") if turn.action_params else None
            if slot_candidate and slot_candidate not in self.valid_slots:
                flags.append("IMPOSSIBLE_SLOT")
                tripped_rules.append("rule_valid_slots_only")

        # ----------------------------------------------------
        # Layer 3: Fact-ID Grounding
        # ----------------------------------------------------
        for claim in turn.claims:
            if not claim.fact_id or claim.fact_id not in self.fact_ids:
                missing_fact_ids.append(claim.fact_id or "missing_fact_id")
                flags.append("UNGROUNDED_CLAIM")

        # Detect invented currency or specific monetary figures without grounding
        if re.search(r"(\$|₹|rs\.?|inr|\blpa\b|\bper annum\b|\b\d+k\b)", utterance):
            has_grounded_salary_fact = any(c.fact_id in self.fact_ids and "salary" in c.claim.lower() for c in turn.claims)
            if not has_grounded_salary_fact:
                flags.append("UNGROUNDED_PAY")
                missing_fact_ids.append("fact_salary_unapproved")

        # Determine deterministic failure
        if "UNGROUNDED_PAY" in flags:
            return GateResult(
                outcome="REVIEW",
                spoken=FALLBACK_HOLD_LINE,
                failed_layer="GROUNDING",
                tripped_rules=tripped_rules,
                missing_fact_ids=missing_fact_ids,
                judge_score=judge_score,
                judge_reason="Ungrounded compensation statement blocked by grounding gate",
                flags=flags
            )

        if "IMPOSSIBLE_SLOT" in flags:
            return GateResult(
                outcome="FALLBACK",
                spoken="I cannot offer that time. Our recruiter is available Friday at 10:00 AM, 2:00 PM, or Monday at 11:30 AM IST.",
                failed_layer="RULE",
                tripped_rules=tripped_rules,
                missing_fact_ids=missing_fact_ids,
                judge_score=judge_score,
                judge_reason="Slot not in recruiter calendar table",
                flags=flags
            )

        if "NEVER_IMPLY_SELECTION" in flags:
            return GateResult(
                outcome="FALLBACK",
                spoken="This call is solely to confirm your technical screening slot. Final hiring decisions are made by the client panel following the rounds.",
                failed_layer="RULE",
                tripped_rules=tripped_rules,
                missing_fact_ids=missing_fact_ids,
                judge_score=judge_score,
                judge_reason="Never imply selection rule triggered",
                flags=flags
            )

        if missing_fact_ids or "UNGROUNDED_CLAIM" in flags:
            return GateResult(
                outcome="REVIEW",
                spoken=FALLBACK_HOLD_LINE,
                failed_layer="GROUNDING",
                tripped_rules=tripped_rules,
                missing_fact_ids=missing_fact_ids,
                judge_score=judge_score,
                judge_reason="Factual claim missing approved fact_id",
                flags=flags
            )

        if tripped_rules and "MISSING_DISCLOSURE" in flags:
            return GateResult(
                outcome="FALLBACK",
                spoken="Hello, I am the automated assistant from Apex Staffing, and this call is recorded for quality. How can I assist you?",
                failed_layer="RULE",
                tripped_rules=tripped_rules,
                missing_fact_ids=[],
                judge_score=judge_score,
                judge_reason="Required AI and recording disclosure missing",
                flags=flags
            )

        # ----------------------------------------------------
        # Layer 4: Judge & Confidence Thresholds
        # ----------------------------------------------------
        if turn.confidence < 0.6:
            return GateResult(
                outcome="REVIEW",
                spoken=FALLBACK_HOLD_LINE,
                failed_layer="THRESHOLD",
                tripped_rules=tripped_rules,
                missing_fact_ids=missing_fact_ids,
                judge_score=judge_score,
                judge_reason="Low model confidence score",
                flags=flags + ["LOW_CONFIDENCE"]
            )

        if judge_score is not None:
            if judge_score < self.block_threshold:
                return GateResult(
                    outcome="FALLBACK",
                    spoken=FALLBACK_SAFE_LINE,
                    failed_layer="THRESHOLD",
                    tripped_rules=tripped_rules,
                    missing_fact_ids=missing_fact_ids,
                    judge_score=judge_score,
                    judge_reason=judge_reason or "Judge overall score below block threshold",
                    flags=flags + ["JUDGE_BLOCK"]
                )
            elif judge_score < self.hold_threshold:
                return GateResult(
                    outcome="REVIEW",
                    spoken=FALLBACK_HOLD_LINE,
                    failed_layer="THRESHOLD",
                    tripped_rules=tripped_rules,
                    missing_fact_ids=missing_fact_ids,
                    judge_score=judge_score,
                    judge_reason=judge_reason or "Judge overall score below hold threshold",
                    flags=flags + ["JUDGE_HOLD"]
                )

        # All layers passed
        return GateResult(
            outcome="PASS",
            spoken=turn.proposed_utterance,
            tripped_rules=[],
            missing_fact_ids=[],
            judge_score=judge_score,
            judge_reason=judge_reason,
            flags=flags
        )
