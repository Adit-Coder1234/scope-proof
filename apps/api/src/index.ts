import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { scopesRouter } from "./routes/scopes.js";
import { testCasesRouter } from "./routes/test-cases.js";
import { runsRouter } from "./routes/runs.js";
import { reviewsRouter } from "./routes/reviews.js";
import { whatsappRouter } from "./routes/whatsapp.js";
import { twilioVoiceRouter } from "./routes/twilio-voice.js";

export const app = express();

app.use(cors());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", scopesRouter);
app.use("/api", testCasesRouter);
app.use("/api", runsRouter);
app.use("/api", reviewsRouter);
app.use("/api", whatsappRouter);
app.use("/api", twilioVoiceRouter);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

export function startServer(port = config.PORT) {
  return app.listen(port, () => {
    console.log(`ScopeProof API listening on port ${port}`);
  });
}

// Start automatically only if run directly
if (process.argv[1] && process.argv[1].endsWith("index.js") && process.env.NODE_ENV !== "test") {
  startServer();
}
