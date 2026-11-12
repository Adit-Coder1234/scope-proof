import { z } from "zod";
import * as dotenv from "dotenv";
import * as path from "node:path";

// Load from root .env or local .env
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("4000").transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  GROQ_AGENT_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_JUDGE_MODEL: z.string().default("mixtral-8x7b-32768"),
  GROQ_GENERATOR_MODEL: z.string().default("mixtral-8x7b-32768"),
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  TELNYX_API_KEY: z.string().optional(),
  TELNYX_SIP_TRUNK_ID: z.string().optional(),
  TELNYX_PHONE_NUMBER: z.string().optional(),
  PLIVO_AUTH_ID: z.string().optional(),
  PLIVO_AUTH_TOKEN: z.string().optional(),
  PLIVO_PHONE_NUMBER: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().default("scopeproof_webhook_verify_token"),
  WHATSAPP_APP_SECRET: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  USER_PHONE_NUMBER: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

