import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { processIntakeDocument, type IntakeExtraction } from "../src/ai/extraction";
import { MockEmrAdapter } from "../src/emr/mock";

function fakeClient(parsed: IntakeExtraction | null) {
  const parse = vi.fn().mockResolvedValue({ parsed_output: parsed });
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

const fullExtraction: IntakeExtraction = {
  firstName: "Sarah",
  lastName: "Mitchell",
  dateOfBirth: "1992-03-14",
  phone: "555-0101",
  email: null,
  insuranceCarrier: "Delta Dental PPO",
  insuranceMemberId: "DD-4821-9937",
  allergies: ["Penicillin"],
  reasonForVisit: "Cleaning + checkup",
  uncertainFields: [],
};

describe("processIntakeDocument", () => {
  it("extracts fields and writes the patient to the EMR", async () => {
    const { client, parse } = fakeClient(fullExtraction);
    const emr = new MockEmrAdapter();

    const result = await processIntakeDocument({
      client,
      emr,
      model: "claude-opus-5",
      data: Buffer.from("fake-pdf"),
      mediaType: "application/pdf",
    });

    expect(result.patientId).toBeDefined();
    expect(result.needsReview).toBe(false);
    expect(emr.getPatient(result.patientId!)?.insuranceCarrier).toBe("Delta Dental PPO");

    // PDF goes up as a document block
    const request = parse.mock.calls[0][0];
    expect(request.messages[0].content[0].type).toBe("document");
    expect(request.output_format).toBeDefined();
  });

  it("flags for review when fields are uncertain", async () => {
    const { client } = fakeClient({ ...fullExtraction, uncertainFields: ["insuranceMemberId"] });
    const result = await processIntakeDocument({
      client,
      emr: new MockEmrAdapter(),
      model: "claude-opus-5",
      data: Buffer.from("x"),
      mediaType: "image/png",
    });
    expect(result.needsReview).toBe(true);
    expect(result.patientId).toBeDefined();
  });

  it("does not create a patient without a name, and flags for review", async () => {
    const { client } = fakeClient({ ...fullExtraction, firstName: null });
    const emrSpy = new MockEmrAdapter();
    const createSpy = vi.spyOn(emrSpy, "createPatient");
    const result = await processIntakeDocument({
      client,
      emr: emrSpy,
      model: "claude-opus-5",
      data: Buffer.from("x"),
      mediaType: "image/jpeg",
    });
    expect(createSpy).not.toHaveBeenCalled();
    expect(result.patientId).toBeUndefined();
    expect(result.needsReview).toBe(true);
  });

  it("rejects unsupported media types", async () => {
    const { client } = fakeClient(fullExtraction);
    await expect(
      processIntakeDocument({
        client,
        emr: new MockEmrAdapter(),
        model: "claude-opus-5",
        data: Buffer.from("x"),
        mediaType: "text/csv",
      }),
    ).rejects.toThrow(/Unsupported document type/);
  });
});
