from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict, AliasChoices

RuleKind = Literal["MUST_ANSWER", "NEVER_SAY", "HANDOFF", "DISCLOSURE"]
GateOutcome = Literal["PASS", "FALLBACK", "REVIEW"]
ScopeStatus = Literal["DRAFT", "ACTIVE", "ARCHIVED"]
CaseSource = Literal["GENERATED", "REVIEW_PROMOTED", "MANUAL"]
ReviewStatus = Literal["PENDING", "APPROVED", "EDITED", "REJECTED"]
Carrier = Literal["TELNYX", "PLIVO", "TWILIO"]
FailedLayer = Literal["SCHEMA", "RULE", "GROUNDING", "JUDGE", "THRESHOLD"]


class AgentClaim(BaseModel):
    claim: str
    fact_id: str = Field(validation_alias=AliasChoices("fact_id", "factId"))


class AgentTurn(BaseModel):
    intent: str
    is_commitment: bool = Field(default=False, validation_alias=AliasChoices("is_commitment", "isCommitment"))
    claims: list[AgentClaim] = []
    proposed_utterance: str = Field(validation_alias=AliasChoices("proposed_utterance", "proposedUtterance"))
    confidence: float = Field(ge=0.0, le=1.0)
    action: str | None = None
    action_params: dict[str, Any] | None = Field(default=None, validation_alias=AliasChoices("action_params", "actionParams"))


class GateResult(BaseModel):
    outcome: GateOutcome
    spoken: str
    failed_layer: FailedLayer | None = Field(default=None, validation_alias=AliasChoices("failed_layer", "failedLayer"))
    tripped_rules: list[str] = Field(default=[], validation_alias=AliasChoices("tripped_rules", "trippedRules"))
    missing_fact_ids: list[str] = Field(default=[], validation_alias=AliasChoices("missing_fact_ids", "missingFactIds"))
    judge_score: float | None = Field(default=None, ge=0.0, le=1.0, validation_alias=AliasChoices("judge_score", "judgeScore"))
    judge_reason: str | None = None
    flags: list[str] = []


class ScopeRule(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    scope_id: str = Field(default="", validation_alias=AliasChoices("scope_id", "scopeId"))
    kind: RuleKind
    text: str
    params: dict[str, Any] = {}


class Fact(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    scope_id: str = Field(default="", validation_alias=AliasChoices("scope_id", "scopeId"))
    key: str
    value: str


class ScriptTurn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    role: Literal["caller", "agent"]
    content: str
    expected_gate: GateOutcome | None = Field(default=None, validation_alias=AliasChoices("expected_gate", "expectedGate"))


class TestCase(BaseModel):
    __test__ = False
    model_config = ConfigDict(populate_by_name=True)
    id: str
    scope_id: str = Field(default="", validation_alias=AliasChoices("scope_id", "scopeId"))
    rule_id: str | None = Field(default=None, validation_alias=AliasChoices("rule_id", "ruleId"))
    persona: dict[str, Any] = {}
    script: list[ScriptTurn]
    language: str = "en"
    source: CaseSource = "MANUAL"


class ReviewDecision(BaseModel):
    review_item_id: str = Field(validation_alias=AliasChoices("review_item_id", "reviewItemId"))
    decision: Literal["APPROVED", "EDITED", "REJECTED"]
    edited_utterance: str | None = Field(default=None, validation_alias=AliasChoices("edited_utterance", "editedUtterance"))
    notes: str | None = None
    promote_to_test: bool = Field(default=False, validation_alias=AliasChoices("promote_to_test", "promoteToTest"))
