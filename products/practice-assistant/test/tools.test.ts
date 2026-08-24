import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadClients } from "../src/config/loader";
import { MockEmrAdapter } from "../src/emr/mock";
import { buildTools, InMemoryHandoffSink } from "../src/ai/tools";
import { buildSystemPrompt } from "../src/ai/prompt";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = loadClients(path.resolve(here, "../clients")).get("lakeside-dental")!;

function toolByName(tools: ReturnType<typeof buildTools>, name: string) {
  const tool = tools.find((t) => t.name === name);
  expect(tool, `tool ${name} should exist`).toBeDefined();
  return tool!;
}

describe("buildTools", () => {
  it("exposes scheduling and handoff tools when features are on", () => {
    const tools = buildTools(config, new MockEmrAdapter(), new InMemoryHandoffSink());
    expect(tools.map((t) => t.name).sort()).toEqual([
      "book_appointment",
      "check_availability",
      "request_human_handoff",
    ]);
  });

  it("omits tools for disabled features", () => {
    const noScheduling = {
      ...config,
      features: { ...config.features, scheduling: false, humanHandoff: false },
    };
    const tools = buildTools(noScheduling, new MockEmrAdapter(), new InMemoryHandoffSink());
    expect(tools.map((t) => t.name)).toEqual([]);
  });

  it("check_availability returns real slots from the EMR adapter", async () => {
    const tools = buildTools(config, new MockEmrAdapter(), new InMemoryHandoffSink());
    const from = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const raw = await toolByName(tools, "check_availability").run({
      appointmentType: "Cleaning",
      fromDate: from,
      toDate: to,
    } as never);
    const result = JSON.parse(raw as string);
    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.slots[0].slotId).toMatch(/^mock-/);
  });

  it("book_appointment surfaces recoverable EMR errors as retryable JSON, not throws", async () => {
    const emr = new MockEmrAdapter();
    const tools = buildTools(config, emr, new InMemoryHandoffSink());
    const raw = await toolByName(tools, "book_appointment").run({
      slotId: "mock-2099-01-04T09:15:00.000Z",
      appointmentType: "Cleaning",
      firstName: "Sarah",
      lastName: "Mitchell",
      phone: "555-0101",
    } as never);
    expect(JSON.parse(raw as string).booked).toBe(true);

    // Same slot again → retryable error the model can act on
    const again = await toolByName(tools, "book_appointment").run({
      slotId: "mock-2099-01-04T09:15:00.000Z",
      appointmentType: "Cleaning",
      firstName: "Alex",
      lastName: "Kim",
      phone: "555-0202",
    } as never);
    expect(JSON.parse(again as string)).toMatchObject({ retryable: true });
  });

  it("request_human_handoff records a callback for the right client", async () => {
    const sink = new InMemoryHandoffSink();
    const tools = buildTools(config, new MockEmrAdapter(), sink);
    await toolByName(tools, "request_human_handoff").run({
      name: "Sarah",
      phone: "555-0101",
      reason: "Billing question",
    } as never);
    expect(sink.requests).toHaveLength(1);
    expect(sink.requests[0].clientId).toBe("lakeside-dental");
  });
});

describe("buildSystemPrompt", () => {
  it("includes practice facts, insurance, and knowledge entries", () => {
    const prompt = buildSystemPrompt(config);
    expect(prompt).toContain("Lakeside Dental");
    expect(prompt).toContain("Delta Dental PPO");
    expect(prompt).toContain("Cancellation policy");
    expect(prompt).toContain("never invent");
  });

  it("drops the scheduling section when the feature is off", () => {
    const prompt = buildSystemPrompt({
      ...config,
      features: { ...config.features, scheduling: false },
    });
    expect(prompt).not.toContain("check_availability");
  });
});
