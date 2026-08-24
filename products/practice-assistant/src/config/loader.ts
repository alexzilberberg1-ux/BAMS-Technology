import fs from "node:fs";
import path from "node:path";
import { ClientConfigSchema, type ClientConfig } from "./schema.js";

/** Loads and validates every client config in a directory, keyed by clientId. */
export function loadClients(dir: string): Map<string, ClientConfig> {
  const clients = new Map<string, ClientConfig>();
  if (!fs.existsSync(dir)) return clients;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const parsed = ClientConfigSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Invalid client config ${file}: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
    }
    if (clients.has(parsed.data.clientId)) {
      throw new Error(`Duplicate clientId "${parsed.data.clientId}" in ${file}`);
    }
    clients.set(parsed.data.clientId, parsed.data);
  }
  return clients;
}
