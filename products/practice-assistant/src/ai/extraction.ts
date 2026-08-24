import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { EmrAdapter } from "../emr/types.js";

/** What we pull off an intake form. Mirrors PatientRecord, but everything is
 *  optional/nullable — forms arrive incomplete and extraction must not guess. */
export const IntakeExtractionSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  dateOfBirth: z.string().nullable().describe("YYYY-MM-DD, null if absent or illegible"),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  insuranceCarrier: z.string().nullable(),
  insuranceMemberId: z.string().nullable(),
  allergies: z.array(z.string()).describe("Empty array if none listed"),
  reasonForVisit: z.string().nullable(),
  /** Fields the model could not read confidently — surfaced for staff review */
  uncertainFields: z.array(z.string()),
});

export type IntakeExtraction = z.infer<typeof IntakeExtractionSchema>;

export interface ExtractionResult {
  extraction: IntakeExtraction;
  /** Set when the record was pushed to the EMR (requires at least a name) */
  patientId?: string;
  needsReview: boolean;
}

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/**
 * Reads an intake form (PDF or photo), extracts structured fields with
 * Claude's structured outputs, and creates the patient in the EMR.
 * This is the "paperwork enters itself" workflow.
 */
export async function processIntakeDocument(params: {
  client: Anthropic;
  emr: EmrAdapter;
  model: string;
  /** Raw document bytes */
  data: Buffer;
  mediaType: string;
}): Promise<ExtractionResult> {
  const base64 = params.data.toString("base64");

  const documentBlock: Anthropic.Beta.BetaContentBlockParam =
    params.mediaType === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: assertImageType(params.mediaType),
            data: base64,
          },
        };

  const response = await params.client.beta.messages.parse({
    model: params.model,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          documentBlock,
          {
            type: "text",
            text: "Extract the patient intake fields from this form. Use null for anything absent or illegible — never guess. List any field you are unsure about in uncertainFields.",
          },
        ],
      },
    ],
    output_format: betaZodOutputFormat(IntakeExtractionSchema),
  });

  const extraction = response.parsed_output;
  if (!extraction) {
    throw new Error("Could not extract structured data from the document.");
  }

  let patientId: string | undefined;
  if (extraction.firstName && extraction.lastName) {
    const created = await params.emr.createPatient({
      firstName: extraction.firstName,
      lastName: extraction.lastName,
      dateOfBirth: extraction.dateOfBirth ?? undefined,
      phone: extraction.phone ?? undefined,
      email: extraction.email ?? undefined,
      insuranceCarrier: extraction.insuranceCarrier ?? undefined,
      insuranceMemberId: extraction.insuranceMemberId ?? undefined,
      allergies: extraction.allergies,
      reasonForVisit: extraction.reasonForVisit ?? undefined,
    });
    patientId = created.patientId;
  }

  return {
    extraction,
    patientId,
    needsReview: extraction.uncertainFields.length > 0 || !patientId,
  };
}

function assertImageType(mediaType: string): ImageMediaType {
  if ((SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mediaType)) {
    return mediaType as ImageMediaType;
  }
  throw new Error(
    `Unsupported document type ${mediaType}. Upload a PDF or an image (JPEG/PNG/WebP/GIF).`,
  );
}
