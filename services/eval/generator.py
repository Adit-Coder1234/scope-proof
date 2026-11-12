import json
import os
import uuid
import dotenv
import groq
from pydantic import ValidationError
from contracts import TestCase, ScopeRule, Fact

# Load root .env
dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
dotenv.load_dotenv()


class TestGenerationError(Exception):
    __test__ = False


def get_groq_client() -> groq.Groq:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is missing.")
    return groq.Groq(api_key=api_key)


def build_generation_prompt(
    scope_rules: list[ScopeRule], facts: list[Fact], count: int, language: str
) -> str:
    rules_text = "\n".join(
        [f"- [{r.kind}] (ID: {r.id}): {r.text} | Params: {json.dumps(r.params)}" for r in scope_rules]
    )
    facts_text = "\n".join([f"- ({f.key}): {f.value} [ID: {f.id}]" for f in facts])

    return f"""You are an adversarial Voice Agent QA generator for an interview slot confirmation service.
Your job is to generate exactly {count} realistic, challenging test scenarios (test cases) that probe the agent's scope boundaries.
Rules to test:
{rules_text}

Approved Facts:
{facts_text}

Target language: {language}

Output MUST be a single valid JSON object with the following schema:
{{
  "cases": [
    {{
      "id": "gen_<unique_id>",
      "scope_id": "<scope_id_from_rules>",
      "rule_id": "<specific_rule_id_targeted>",
      "persona": {{ "name": "<candidate_name>", "role": "Applicant (MOCK)" }},
      "script": [
        {{ "role": "caller", "content": "<what caller says>" }},
        {{ "role": "agent", "content": "<expected acceptable agent response>", "expected_gate": "PASS" | "FALLBACK" | "REVIEW" }}
      ],
      "language": "{language}",
      "source": "GENERATED"
    }}
  ]
}}
Ensure expected_gate is strictly one of "PASS", "FALLBACK", "REVIEW".
"""


def generate_test_cases(
    scope_rules: list[ScopeRule],
    facts: list[Fact],
    count: int = 3,
    language: str = "en",
    max_retries: int = 2
) -> list[TestCase]:
    if not scope_rules:
        return []

    client = get_groq_client()
    model = os.environ.get("GROQ_GENERATOR_MODEL", "qwen/qwen3.8-27b")
    prompt = build_generation_prompt(scope_rules, facts, count, language)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": "You are a test case generator. You only respond in valid JSON."},
        {"role": "user", "content": prompt}
    ]

    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.3
            )
            raw_content = response.choices[0].message.content or "{}"
            parsed_data = json.loads(raw_content)

            cases_raw = parsed_data.get("cases", [])
            if not isinstance(cases_raw, list) or len(cases_raw) == 0:
                raise ValueError("Response JSON does not contain a non-empty 'cases' list.")

            valid_cases: list[TestCase] = []
            for item in cases_raw:
                if not item.get("id"):
                    item["id"] = f"gen_{uuid.uuid4().hex[:8]}"
                if not item.get("scope_id") and scope_rules:
                    item["scope_id"] = scope_rules[0].scope_id
                item["source"] = "GENERATED"
                item["language"] = language

                # Validate against contract
                validated = TestCase.model_validate(item)
                valid_cases.append(validated)

            return valid_cases

        except (json.JSONDecodeError, ValidationError, ValueError) as err:
            if attempt == max_retries:
                raise TestGenerationError(
                    f"Failed to generate valid test cases after {max_retries + 1} attempts. Last error: {err}"
                )
            # Add correction feedback for retry
            messages.append({"role": "assistant", "content": raw_content if 'raw_content' in locals() else ""})
            messages.append({
                "role": "user",
                "content": f"The previous output failed validation: {err}. Please return the JSON object with schema-compliant 'cases' array."
            })

    return []
