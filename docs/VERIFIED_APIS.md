# Verified APIs

Every external library, SDK, API or service used in ScopeProof is recorded here before product code is written. No code may use a symbol not listed below.

| Package | Version | Symbol / API | Signature (as verified) | Doc URL | Date checked |
|---------|---------|-------------|------------------------|---------|--------------|
| `zod` | 3.25.76 | `z.object`, `z.string`, `z.number`, `z.boolean`, `z.array`, `z.enum`, `z.record`, `z.optional` | `(shape: ZodRawShape) => ZodObject` | https://zod.dev | 2026-10-28 |
| `zod-to-json-schema` | 3.25.2 | `zodToJsonSchema` | `(schema: ZodSchema, nameOrOptions?: string \| Options) => JsonSchema7Type` | https://www.npmjs.com/package/zod-to-json-schema | 2026-10-28 |
| `@prisma/client` | 6.19.3 | `PrismaClient` | `new PrismaClient(options?: PrismaClientOptions)` | https://www.prisma.io/docs/orm/prisma-client | 2026-10-28 |
| `express` | 4.21.2 | `express()`, `app.use`, `app.get`, `app.post`, `app.patch`, `app.listen` | `() => Express` | https://expressjs.com | 2026-10-28 |
| `pydantic` | 2.14.1 | `BaseModel`, `Field`, `model_validate`, `model_dump` | `class Model(BaseModel)` | https://docs.pydantic.dev | 2026-10-28 |
| `groq` | 1.7.0 | `Groq(api_key=...)`, `client.chat.completions.create` | `client.chat.completions.create(messages=..., model=..., response_format=...)` | https://console.groq.com/docs | 2026-10-28 |
| Groq Live Model | `qwen/qwen3.8-27b` | Cross-evaluator model (judge & generator) | JSON mode supported | https://console.groq.com/docs/models | 2026-10-28 |
| Groq Live Model | `openai/gpt-oss-120b` | Conversational brain model | JSON mode supported | https://console.groq.com/docs/models | 2026-10-28 |
| `fastapi` | 0.141.1 | `FastAPI()`, `@app.post`, `@app.get` | standard ASGI framework | https://fastapi.tiangolo.com | 2026-10-28 |
| `uvicorn` | 0.52.1 | `uvicorn.run(app, host=..., port=...)` | ASGI server | https://www.uvicorn.org | 2026-10-28 |
| `pytest` | 9.2.0 | `pytest.raises`, `@pytest.fixture` | standard test runner | https://docs.pytest.org | 2026-10-28 |
