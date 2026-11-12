import * as fs from "node:fs";
import * as path from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  AgentTurnSchema,
  GateResultSchema,
  ScopeRuleSchema,
  FactSchema,
  TestCaseSchema,
  ReviewDecisionSchema
} from "./index.js";

const outDir = path.resolve(process.cwd(), "dist");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const schemas = [
  { name: "AgentTurn", schema: AgentTurnSchema },
  { name: "GateResult", schema: GateResultSchema },
  { name: "ScopeRule", schema: ScopeRuleSchema },
  { name: "Fact", schema: FactSchema },
  { name: "TestCase", schema: TestCaseSchema },
  { name: "ReviewDecision", schema: ReviewDecisionSchema }
];

for (const { name, schema } of schemas) {
  const jsonSchema = zodToJsonSchema(schema, name);
  const targetPath = path.join(outDir, `${name}.json`);
  fs.writeFileSync(targetPath, JSON.stringify(jsonSchema, null, 2), "utf-8");
  console.log(`Exported schema: ${name}.json`);
}

