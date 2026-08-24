import crypto from "node:crypto";
import fs from "node:fs";

/**
 * HIPAA-oriented audit trail: WHO did WHAT and WHEN, without message content.
 * Chat text and extracted fields (PHI) never enter this log; session ids are
 * hashed so log readers can correlate events without holding a live session
 * key. The log itself still references patient/appointment ids, so store it
 * like PHI: encrypted at rest, access-controlled, retained per policy
 * (HIPAA expects 6 years for audit records).
 */

export interface AuditEvent {
  event:
    | "chat_turn"
    | "chat_error"
    | "document_intake"
    | "document_error"
    | "handoff_recorded"
    | "rate_limited";
  clientId: string;
  sessionHash?: string;
  /** Non-PHI metadata only: durations, status flags, record ids */
  meta?: Record<string, string | number | boolean>;
}

export function hashSession(sessionId: string): string {
  return crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
}

export class AuditLog {
  private stream: fs.WriteStream | null = null;

  constructor(filePath?: string) {
    const target = filePath ?? process.env.AUDIT_LOG_PATH;
    if (target) {
      this.stream = fs.createWriteStream(target, { flags: "a" });
    }
  }

  write(event: AuditEvent): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
    if (this.stream) {
      this.stream.write(line + "\n");
    } else {
      console.log(`[audit] ${line}`);
    }
  }
}
