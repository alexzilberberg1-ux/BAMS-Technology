import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { loadClients } from "../config/loader.js";
import { createAdapter } from "../emr/registry.js";
import { PracticeAssistant } from "../ai/assistant.js";
import { InMemoryHandoffSink } from "../ai/tools.js";
import { processIntakeDocument } from "../ai/extraction.js";
import { SessionStore } from "./sessions.js";
import { AuditLog, hashSession } from "./audit.js";
import { RateLimiter } from "./rate-limit.js";
import type { EmrAdapter } from "../emr/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp(options?: { clientsDir?: string }) {
  const clientsDir =
    options?.clientsDir ?? process.env.CLIENTS_DIR ?? path.resolve(here, "../../clients");

  const clients = loadClients(clientsDir);
  const anthropic = new Anthropic();
  const sessions = new SessionStore();
  const handoff = new InMemoryHandoffSink();
  const audit = new AuditLog();
  const chatLimiter = new RateLimiter(20, 60_000); // 20 messages/min per caller
  const docLimiter = new RateLimiter(5, 60_000); // uploads are heavier

  // One adapter + assistant per client, built once at startup
  const adapters = new Map<string, EmrAdapter>();
  const assistants = new Map<string, PracticeAssistant>();
  for (const [clientId, config] of clients) {
    const emr = createAdapter(config.emr);
    adapters.set(clientId, emr);
    assistants.set(clientId, new PracticeAssistant(config, { client: anthropic, emr, handoff }));
  }

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "20mb" }));

  // Baseline security headers. PHI responses must never be cached by
  // intermediaries or the browser.
  app.use((req, res, next) => {
    res.header("X-Content-Type-Options", "nosniff");
    res.header("Referrer-Policy", "no-referrer");
    if (req.path.startsWith("/api/")) {
      res.header("Cache-Control", "no-store");
    }
    // Behind a TLS-terminating proxy in production; HIPAA transport security
    if (req.headers["x-forwarded-proto"] === "https" || process.env.FORCE_HSTS === "1") {
      res.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    }
    next();
  });

  // CORS per client config, so the widget can be embedded on the practice's site
  app.use("/api/:clientId", (req, res, next) => {
    const config = clients.get(req.params.clientId);
    if (!config) return res.status(404).json({ error: "Unknown client" });
    const origin = req.headers.origin;
    if (origin && (config.allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production")) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  /** Widget bootstrap: branding + features + compliance copy, no secrets */
  app.get("/api/:clientId/widget-config", (req, res) => {
    const config = clients.get(req.params.clientId)!;
    res.json({
      branding: config.branding,
      features: config.features,
      compliance: config.compliance,
      phone: config.practice.phone,
    });
  });

  /** One chat turn. Body: { sessionId?, message } */
  app.post("/api/:clientId/chat", async (req, res) => {
    const clientId = req.params.clientId;
    const assistant = assistants.get(clientId)!;
    const { sessionId: incomingSessionId, message } = req.body ?? {};

    const callerKey = `${req.ip}|${clientId}`;
    if (!chatLimiter.allow(callerKey)) {
      audit.write({ event: "rate_limited", clientId, meta: { route: "chat" } });
      return res.status(429).json({ error: "Too many messages — please slow down." });
    }

    if (typeof message !== "string" || !message.trim() || message.length > 4000) {
      return res.status(400).json({ error: "message must be a non-empty string (max 4000 chars)" });
    }

    let sessionId: string = incomingSessionId;
    let session = sessionId ? sessions.get(sessionId, clientId) : undefined;
    if (!session) {
      sessionId = sessions.create(clientId);
      session = sessions.get(sessionId, clientId)!;
    }
    const sessionHash = hashSession(sessionId);

    const started = Date.now();
    try {
      const { reply, history } = await assistant.chat(session.history, message.trim());
      sessions.update(sessionId, history);
      audit.write({
        event: "chat_turn",
        clientId,
        sessionHash,
        meta: { ms: Date.now() - started, turns: history.length },
      });
      res.json({ sessionId, reply });
    } catch (err) {
      // Log the error class/message only — API errors can echo request
      // content, and chat content is PHI that must stay out of app logs.
      const label = err instanceof Error ? `${err.name}: ${err.message.slice(0, 200)}` : "unknown";
      console.error(`[chat:${clientId}] ${label}`);
      audit.write({ event: "chat_error", clientId, sessionHash, meta: { error: label.slice(0, 120) } });
      res.status(502).json({
        sessionId,
        error: "assistant_unavailable",
        reply: `Sorry — I'm having trouble right now. Please call the office at ${assistant.config.practice.phone}.`,
      });
    }
  });

  /** Intake document upload. Body: { data: base64, mediaType } */
  app.post("/api/:clientId/documents", async (req, res) => {
    const clientId = req.params.clientId;
    const config = clients.get(clientId)!;
    if (!config.features.documentIntake) {
      return res.status(403).json({ error: "Document intake is not enabled for this client" });
    }
    if (!docLimiter.allow(`${req.ip}|${clientId}`)) {
      audit.write({ event: "rate_limited", clientId, meta: { route: "documents" } });
      return res.status(429).json({ error: "Too many uploads — please wait a minute." });
    }
    const { data, mediaType } = req.body ?? {};
    if (typeof data !== "string" || typeof mediaType !== "string") {
      return res.status(400).json({ error: "Body must include base64 `data` and `mediaType`" });
    }

    try {
      const result = await processIntakeDocument({
        client: anthropic,
        emr: adapters.get(clientId)!,
        model: config.model,
        data: Buffer.from(data, "base64"),
        mediaType,
      });
      audit.write({
        event: "document_intake",
        clientId,
        meta: {
          needsReview: result.needsReview,
          patientCreated: Boolean(result.patientId),
          ...(result.patientId ? { patientId: result.patientId } : {}),
        },
      });
      res.json(result);
    } catch (err) {
      const label = err instanceof Error ? `${err.name}: ${err.message.slice(0, 200)}` : "unknown";
      console.error(`[documents:${clientId}] ${label}`);
      audit.write({ event: "document_error", clientId, meta: { error: label.slice(0, 120) } });
      res.status(422).json({ error: err instanceof Error ? err.message : "Extraction failed" });
    }
  });

  /** Staff view of pending callback requests (put behind real auth in production) */
  app.get("/api/:clientId/handoffs", (req, res) => {
    res.json({
      handoffs: handoff.requests.filter((h) => h.clientId === req.params.clientId),
    });
  });

  // The embeddable widget script
  app.use("/widget", express.static(path.resolve(here, "../../widget")));

  return { app, clients, sessions, handoff, adapters, audit };
}

// Entrypoint when run directly (dev/prod), not when imported by tests
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  const { app, clients } = createApp();
  app.listen(port, () => {
    console.log(`BAMS Practice Assistant on :${port} — clients: ${[...clients.keys()].join(", ")}`);
  });
}
