import { z } from "zod";

/**
 * Per-client configuration. One JSON file per practice under clients/.
 * Everything the assistant knows about a practice — branding, hours,
 * insurance, FAQ knowledge, feature flags, and which EMR to talk to —
 * lives here, so onboarding a new client is a config file, not a code change.
 */

export const BrandingSchema = z.object({
  /** Display name shown in the chat header, e.g. "Lakeside Assistant" */
  assistantName: z.string().min(1),
  practiceName: z.string().min(1),
  /** CSS colors for the embedded widget */
  primaryColor: z.string().default("#1d4fd7"),
  accentColor: z.string().default("#12b3a2"),
  /** Emoji or image URL used as the widget avatar */
  avatar: z.string().default("💬"),
  greeting: z
    .string()
    .default("Hi! How can I help you today?"),
});

export const PracticeInfoSchema = z.object({
  /** Free-text practice facts the assistant answers from: hours, address, parking, policies */
  hours: z.string(),
  address: z.string(),
  phone: z.string(),
  providers: z
    .array(z.object({ name: z.string(), role: z.string(), practitionerId: z.string().optional() }))
    .default([]),
  /** Insurance carriers/plans the practice is in-network with */
  acceptedInsurance: z.array(z.string()).default([]),
  /** Appointment types bookable through the assistant, with EMR service codes */
  appointmentTypes: z
    .array(
      z.object({
        name: z.string(),
        durationMinutes: z.number().int().positive(),
        /** Code the EMR adapter uses (FHIR service-type, Open Dental AptType, etc.) */
        emrCode: z.string().optional(),
      }),
    )
    .default([]),
});

/** Extra Q&A knowledge: policies, pricing, prep instructions — inlined into the system prompt */
export const KnowledgeEntrySchema = z.object({
  topic: z.string(),
  content: z.string(),
});

export const FeaturesSchema = z.object({
  /** Answer questions + book appointments in chat */
  scheduling: z.boolean().default(true),
  /** Answer "do you take X insurance" from acceptedInsurance */
  insuranceQuestions: z.boolean().default(true),
  /** Accept intake form uploads and push structured data to the EMR */
  documentIntake: z.boolean().default(true),
  /** Offer human handoff (records a callback request) */
  humanHandoff: z.boolean().default(true),
});

/** Patient-facing compliance copy shown by the widget before any chat */
export const ComplianceSchema = z.object({
  privacyPolicyUrl: z.string().url().optional(),
  consentText: z
    .string()
    .default(
      "This assistant helps with scheduling and general practice questions. Please don't share detailed medical history here — only what's needed to book. The information you provide is used to assist you and manage your appointment.",
    ),
  emergencyNote: z.string().default("If this is a medical emergency, call 911."),
});

export const EmrConfigSchema = z.discriminatedUnion("kind", [
  z.object({
    /** In-memory EMR for demos and development */
    kind: z.literal("mock"),
  }),
  z.object({
    /** Any FHIR R4 server: Epic, Cerner/Oracle Health, athenahealth, Medplum, HAPI ... */
    kind: z.literal("fhir-r4"),
    baseUrl: z.string().url(),
    /** Name of the env var holding the bearer token (never the token itself) */
    authTokenEnv: z.string(),
    /** FHIR Schedule/Practitioner references used when querying slots */
    scheduleReference: z.string().optional(),
  }),
  z.object({
    /** athenahealth athenaOne API (api.platform.athenahealth.com) */
    kind: z.literal("athenahealth"),
    baseUrl: z.string().url().default("https://api.platform.athenahealth.com"),
    /** athenahealth practice ID (use "195900" against the sandbox) */
    practiceId: z.string().min(1),
    /** Department the assistant books into */
    departmentId: z.string().min(1),
    /** Env vars holding the OAuth client credentials (never the secrets themselves) */
    clientIdEnv: z.string(),
    clientSecretEnv: z.string(),
  }),
  z.object({
    /** Open Dental REST API (https://api.opendental.com) */
    kind: z.literal("opendental"),
    baseUrl: z.string().url().default("https://api.opendental.com/api/v1"),
    /** Env vars holding the developer + customer API keys */
    developerKeyEnv: z.string(),
    customerKeyEnv: z.string(),
    /** Default operatory and provider numbers for bookings */
    defaultOperatoryNum: z.number().int().optional(),
    defaultProvNum: z.number().int().optional(),
  }),
]);

export const ClientConfigSchema = z.object({
  /** URL-safe identifier, used in API routes: /api/:clientId/chat */
  clientId: z.string().regex(/^[a-z0-9-]+$/),
  branding: BrandingSchema,
  practice: PracticeInfoSchema,
  knowledge: z.array(KnowledgeEntrySchema).default([]),
  compliance: ComplianceSchema.default({
    consentText:
      "This assistant helps with scheduling and general practice questions. Please don't share detailed medical history here — only what's needed to book. The information you provide is used to assist you and manage your appointment.",
    emergencyNote: "If this is a medical emergency, call 911.",
  }),
  features: FeaturesSchema.default({
    scheduling: true,
    insuranceQuestions: true,
    documentIntake: true,
    humanHandoff: true,
  }),
  emr: EmrConfigSchema,
  /** Claude model for this client (cost/quality dial per contract tier) */
  model: z.string().default("claude-opus-5"),
  /** Origins allowed to embed the widget (CORS allowlist) */
  allowedOrigins: z.array(z.string()).default([]),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;
export type EmrConfig = z.infer<typeof EmrConfigSchema>;
export type Branding = z.infer<typeof BrandingSchema>;
