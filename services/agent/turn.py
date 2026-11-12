import json
import os
from typing import Any
import dotenv
import groq
from contracts import AgentTurn, Fact, ScopeRule

dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
dotenv.load_dotenv()


def get_groq_client() -> groq.Groq:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is missing.")
    return groq.Groq(api_key=api_key)


def build_agent_system_prompt(facts: list[Fact], rules: list[ScopeRule]) -> str:
    facts_block = "\n".join([f"- [ID: {f.id}] ({f.key}): {f.value}" for f in facts])
    rules_block = "\n".join([f"- [{r.kind}] (ID: {r.id}): {r.text} | Params: {json.dumps(r.params)}" for r in rules])

    return f"""You are the conversational brain of an AI voice agent for Apex Staffing Agency confirming interview slots.
You must speak naturally, concisely, and strictly adhere to the approved scope rules and facts.

Approved Facts (You may ONLY cite claims backed by these fact_ids):
{facts_block}

Strict Scope Rules:
{rules_block}

CRITICAL INSTRUCTIONS:
1. Every factual statement or claim MUST be cited in the "claims" list with its exact "fact_id". If there is no fact_id, you CANNOT state it as fact.
2. If the user asks for salary or compensation, do NOT quote any figure. Defer to recruiter Sarah Jenkins.
3. If the user asks for unavailable times, offer only the approved recruiter_calendar_slot facts.
4. If the user asks if they are hired, clarify that this call is solely to confirm the screening round.
5. If the turn involves scheduling a slot, committing to a callback, or discussing terms, set "is_commitment": true.

Output MUST be valid JSON with the following exact schema:
{{
  "intent": "string",
  "is_commitment": boolean,
  "claims": [
    {{ "claim": "string", "fact_id": "string" }}
  ],
  "proposed_utterance": "string",
  "confidence": float between 0.0 and 1.0,
  "action": "string or null",
  "action_params": {{}} or null
}}
"""


def generate_turn(
    caller_utterance: str,
    history: list[dict[str, str]],
    facts: list[Fact],
    rules: list[ScopeRule],
    model: str | None = None
) -> AgentTurn:
    client = get_groq_client()
    selected_model = model or os.environ.get("GROQ_AGENT_MODEL", "openai/gpt-oss-120b")
    system_prompt = build_agent_system_prompt(facts, rules)

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for h in history:
        messages.append(h)
    messages.append({"role": "user", "content": caller_utterance})

    try:
        response = client.chat.completions.create(
            model=selected_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.2
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        return AgentTurn.model_validate(data)
    except Exception as e:
        # Safe fallback turn if model generation fails
        return AgentTurn(
            intent="error_fallback",
            is_commitment=False,
            claims=[],
            proposed_utterance="I apologize, could you please repeat that? I want to make sure I get your schedule right.",
            confidence=0.5,
            action="fallback",
            action_params={"error": str(e)}
        )

