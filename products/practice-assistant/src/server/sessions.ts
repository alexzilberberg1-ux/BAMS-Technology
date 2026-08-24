import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";

interface Session {
  clientId: string;
  history: Anthropic.Beta.BetaMessageParam[];
  lastActivity: number;
}

/**
 * In-memory conversation store with idle expiry. Fine for a single-node
 * deployment; swap for Redis when running more than one instance.
 */
export class SessionStore {
  private sessions = new Map<string, Session>();

  constructor(private ttlMs: number = 30 * 60 * 1000) {}

  create(clientId: string): string {
    const id = randomUUID();
    this.sessions.set(id, { clientId, history: [], lastActivity: Date.now() });
    return id;
  }

  get(id: string, clientId: string): Session | undefined {
    this.evictExpired();
    const session = this.sessions.get(id);
    // Sessions are scoped to one client — no cross-practice bleed
    if (!session || session.clientId !== clientId) return undefined;
    session.lastActivity = Date.now();
    return session;
  }

  update(id: string, history: Anthropic.Beta.BetaMessageParam[]): void {
    const session = this.sessions.get(id);
    if (session) {
      session.history = history;
      session.lastActivity = Date.now();
    }
  }

  private evictExpired(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, session] of this.sessions) {
      if (session.lastActivity < cutoff) this.sessions.delete(id);
    }
  }
}
