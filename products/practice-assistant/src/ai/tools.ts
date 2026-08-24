import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ClientConfig } from "../config/schema.js";
import type { EmrAdapter } from "../emr/types.js";
import { EmrError } from "../emr/types.js";

export interface HandoffRequest {
  clientId: string;
  name: string;
  phone: string;
  reason: string;
  requestedAt: string;
}

/** Where callback requests land — swap for CRM/email/SMS per deployment. */
export interface HandoffSink {
  record(request: HandoffRequest): Promise<void>;
}

export class InMemoryHandoffSink implements HandoffSink {
  public readonly requests: HandoffRequest[] = [];
  async record(request: HandoffRequest): Promise<void> {
    this.requests.push(request);
  }
}

function emrSafe<T>(fn: () => Promise<T>): Promise<string> {
  return fn().then(
    (result) => JSON.stringify(result),
    (err) => {
      if (err instanceof EmrError && err.recoverable) {
        return JSON.stringify({ error: err.message, retryable: true });
      }
      // Non-recoverable EMR/system errors: give the model an honest, safe signal
      return JSON.stringify({
        error: "The scheduling system is unavailable right now. Ask the patient to call the office.",
      });
    },
  );
}

/**
 * Builds the tool set for one client, bound to that client's EMR adapter.
 * Feature flags in the config decide which tools exist at all.
 */
export function buildTools(config: ClientConfig, emr: EmrAdapter, handoff: HandoffSink) {
  const tools = [];

  if (config.features.scheduling) {
    const typeNames = config.practice.appointmentTypes.map((t) => t.name);

    tools.push(
      betaZodTool({
        name: "check_availability",
        description:
          "Look up open appointment slots in the practice's scheduling system. Use whenever the patient asks about availability or wants to book.",
        inputSchema: z.object({
          appointmentType: z
            .enum(typeNames as [string, ...string[]])
            .describe("Which appointment type the patient wants"),
          fromDate: z.string().describe("Start of the search window, YYYY-MM-DD"),
          toDate: z.string().describe("End of the search window, YYYY-MM-DD"),
        }),
        run: (input) =>
          emrSafe(async () => {
            const apptType = config.practice.appointmentTypes.find(
              (t) => t.name === input.appointmentType,
            )!;
            const slots = await emr.getAvailability({
              appointmentType: apptType.name,
              emrCode: apptType.emrCode,
              durationMinutes: apptType.durationMinutes,
              from: input.fromDate,
              to: input.toDate,
            });
            return { slots: slots.slice(0, 6) };
          }),
      }),
    );

    tools.push(
      betaZodTool({
        name: "book_appointment",
        description:
          "Book a specific slot returned by check_availability. Only call after the patient has confirmed a time and provided their full name and phone number.",
        inputSchema: z.object({
          slotId: z.string().describe("slotId from check_availability, verbatim"),
          appointmentType: z.enum(typeNames as [string, ...string[]]),
          firstName: z.string(),
          lastName: z.string(),
          phone: z.string(),
          email: z.string().optional(),
          dateOfBirth: z.string().optional().describe("YYYY-MM-DD if provided"),
          notes: z.string().optional().describe("Anything the office should know"),
        }),
        run: (input) =>
          emrSafe(async () => {
            const confirmation = await emr.bookAppointment({
              slotId: input.slotId,
              appointmentType: input.appointmentType,
              patient: {
                firstName: input.firstName,
                lastName: input.lastName,
                phone: input.phone,
                email: input.email,
                dateOfBirth: input.dateOfBirth,
              },
              notes: input.notes,
            });
            return { booked: true, ...confirmation };
          }),
      }),
    );
  }

  if (config.features.humanHandoff) {
    tools.push(
      betaZodTool({
        name: "request_human_handoff",
        description:
          "Record a callback request so a staff member contacts the patient. Use when the patient asks for a human, is upset, or the question is beyond your knowledge.",
        inputSchema: z.object({
          name: z.string().describe("Patient's name, or 'unknown'"),
          phone: z.string().describe("Callback number, or 'unknown' if not given yet"),
          reason: z.string().describe("One-line summary of what they need"),
        }),
        run: async (input) => {
          await handoff.record({
            clientId: config.clientId,
            name: input.name,
            phone: input.phone,
            reason: input.reason,
            requestedAt: new Date().toISOString(),
          });
          return JSON.stringify({ recorded: true });
        },
      }),
    );
  }

  return tools;
}
