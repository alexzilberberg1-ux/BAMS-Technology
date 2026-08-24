import {
  EmrAdapter,
  EmrError,
  type BookingConfirmation,
  type BookingRequest,
  type CreatedPatient,
  type PatientRecord,
  type Slot,
} from "./types.js";

interface FhirOptions {
  baseUrl: string;
  /** Called per request so short-lived SMART tokens can be refreshed upstream */
  getToken: () => string;
  scheduleReference?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Adapter for any FHIR R4 server — Epic, Oracle Health (Cerner), athenahealth,
 * Medplum, HAPI, etc. Uses the standard Slot/Appointment/Patient resources.
 *
 * Auth note: vendors differ in how you OBTAIN the token (SMART backend
 * services / client-credentials), but all accept a Bearer token per request,
 * which is what this adapter takes. Token acquisition lives outside the
 * adapter so per-vendor OAuth flows don't leak into scheduling logic.
 */
export class FhirR4Adapter implements EmrAdapter {
  readonly name = "FHIR R4";
  private fetchImpl: typeof fetch;

  constructor(private opts: FhirOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const res = await this.fetchImpl(`${this.opts.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.getToken()}`,
        "Content-Type": "application/fhir+json",
        Accept: "application/fhir+json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) {
      throw new EmrError("EMR authorization failed — token expired or insufficient scope.");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new EmrError(`FHIR ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    }
    return res.json();
  }

  async getAvailability(params: {
    appointmentType: string;
    emrCode?: string;
    durationMinutes: number;
    from: string;
    to: string;
  }): Promise<Slot[]> {
    const q = new URLSearchParams({
      status: "free",
      start: `ge${params.from}`,
      _count: "20",
    });
    q.append("start", `le${params.to}`);
    if (params.emrCode) q.set("service-type", params.emrCode);
    if (this.opts.scheduleReference) q.set("schedule", this.opts.scheduleReference);

    const bundle = await this.request("GET", `/Slot?${q.toString()}`);
    const entries: any[] = bundle.entry ?? [];
    return entries
      .filter((e) => e.resource?.resourceType === "Slot")
      .map((e) => ({
        slotId: `Slot/${e.resource.id}`,
        start: e.resource.start,
        end: e.resource.end,
      }));
  }

  async bookAppointment(request: BookingRequest): Promise<BookingConfirmation> {
    // Ensure a Patient resource exists for the participant
    const { patientId } = await this.createPatient({
      firstName: request.patient.firstName,
      lastName: request.patient.lastName,
      phone: request.patient.phone,
      email: request.patient.email,
      dateOfBirth: request.patient.dateOfBirth,
    });

    const appointment = {
      resourceType: "Appointment",
      status: "booked",
      description: request.appointmentType,
      comment: request.notes,
      slot: [{ reference: request.slotId }],
      participant: [
        {
          actor: { reference: `Patient/${patientId}` },
          status: "accepted",
        },
      ],
    };
    const created = await this.request("POST", "/Appointment", appointment);
    return {
      appointmentId: `Appointment/${created.id}`,
      start: created.start ?? "",
    };
  }

  async createPatient(record: PatientRecord): Promise<CreatedPatient> {
    const telecom: any[] = [];
    if (record.phone) telecom.push({ system: "phone", value: record.phone });
    if (record.email) telecom.push({ system: "email", value: record.email });

    const patient = {
      resourceType: "Patient",
      name: [{ family: record.lastName, given: [record.firstName] }],
      birthDate: record.dateOfBirth,
      telecom,
    };
    const created = await this.request("POST", "/Patient", patient);

    // Allergies become AllergyIntolerance resources linked to the patient
    for (const allergy of record.allergies ?? []) {
      await this.request("POST", "/AllergyIntolerance", {
        resourceType: "AllergyIntolerance",
        patient: { reference: `Patient/${created.id}` },
        code: { text: allergy },
        clinicalStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
              code: "active",
            },
          ],
        },
      });
    }

    // Insurance becomes a Coverage resource
    if (record.insuranceCarrier) {
      await this.request("POST", "/Coverage", {
        resourceType: "Coverage",
        status: "active",
        beneficiary: { reference: `Patient/${created.id}` },
        subscriberId: record.insuranceMemberId,
        payor: [{ display: record.insuranceCarrier }],
      });
    }

    return { patientId: created.id };
  }
}
