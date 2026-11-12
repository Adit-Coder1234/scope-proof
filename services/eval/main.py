from fastapi import FastAPI
from pydantic import BaseModel
from contracts import ScopeRule, Fact
from judge import evaluate_turn, JudgeResult

app = FastAPI(title="ScopeProof Evaluation Service", version="0.1.0")


class JudgeRequest(BaseModel):
    caller_text: str
    proposed_utterance: str
    claims: list[dict] = []
    rules: list[ScopeRule] = []
    facts: list[Fact] = []


@app.get("/health")
def health():
    return {"status": "ok", "service": "eval"}


@app.post("/eval/judge", response_model=JudgeResult)
def judge_turn(req: JudgeRequest):
    return evaluate_turn(
        caller_text=req.caller_text,
        proposed_utterance=req.proposed_utterance,
        claims=req.claims,
        rules=req.rules,
        facts=req.facts
    )

