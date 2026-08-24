import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadClients } from "../src/config/loader";
import { ClientConfigSchema } from "../src/config/schema";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("client config", () => {
  it("loads and validates the example Lakeside Dental config", () => {
    const clients = loadClients(path.resolve(here, "../clients"));
    const lakeside = clients.get("lakeside-dental");
    expect(lakeside).toBeDefined();
    expect(lakeside!.branding.practiceName).toBe("Lakeside Dental");
    expect(lakeside!.emr.kind).toBe("mock");
    expect(lakeside!.practice.appointmentTypes.length).toBeGreaterThan(0);
  });

  it("rejects a config with a bad clientId", () => {
    const result = ClientConfigSchema.safeParse({
      clientId: "Bad Id!",
      branding: { assistantName: "A", practiceName: "P" },
      practice: { hours: "9-5", address: "x", phone: "y" },
      emr: { kind: "mock" },
    });
    expect(result.success).toBe(false);
  });

  it("requires env-var names (not secrets) for FHIR auth", () => {
    const result = ClientConfigSchema.safeParse({
      clientId: "test-fhir",
      branding: { assistantName: "A", practiceName: "P" },
      practice: { hours: "9-5", address: "x", phone: "y" },
      emr: { kind: "fhir-r4", baseUrl: "https://fhir.example.com/r4" },
    });
    expect(result.success).toBe(false); // missing authTokenEnv
  });

  it("applies defaults for optional sections", () => {
    const result = ClientConfigSchema.parse({
      clientId: "minimal",
      branding: { assistantName: "A", practiceName: "P" },
      practice: { hours: "9-5", address: "x", phone: "y" },
      emr: { kind: "mock" },
    });
    expect(result.features.scheduling).toBe(true);
    expect(result.model).toBe("claude-opus-5");
    expect(result.knowledge).toEqual([]);
  });
});
