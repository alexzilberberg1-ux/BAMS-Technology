import {
  EmrAdapter,
  EmrError,
  type BookingConfirmation,
  type BookingRequest,
  type CreatedPatient,
  type PatientRecord,
  type Slot,
} from "./types.js";

interface OpenDentalOptions {
  baseUrl: string;
  developerKey: string;
  customerKey: string;
  defaultOperatoryNum?: number;
  defaultProvNum?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Adapter for the Open Dental REST API (api.opendental.com), the most widely
 * open practice-management API in dental. Auth is the documented ODFHIR
 * two-part key: "ODFHIR {developerKey}/{customerKey}".
 *
 * Endpoints used:
 *   GET  /appointments/SlotsForOps  — open slots for operatories
 *   POST /appointments              — create an appointment
 *   POST /patients                  — create a patient
 *   PUT  /allergies (per patient)   — record allergies
 */
export class OpenDentalAdapter implements EmrAdapter {
  readonly name = "Open Dental";
  private fetchImpl: typeof fetch;

  constructor(private opts: OpenDentalOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const res = await this.fetchImpl(`${this.opts.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `ODFHIR ${this.opts.developerKey}/${this.opts.customerKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) {
      throw new EmrError("Open Dental authorization failed — check API keys.");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new EmrError(
        `Open Dental ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`,
      );
    }
    return res.status === 204 ? null : res.json();
  }

  async getAvailability(params: {
    appointmentType: string;
    durationMinutes: number;
    from: string;
    to: string;
  }): Promise<Slot[]> {
    const q = new URLSearchParams({
      dateStart: params.from.slice(0, 10),
      dateEnd: params.to.slice(0, 10),
      lengthMinutes: String(params.durationMinutes),
    });
    if (this.opts.defaultOperatoryNum) q.set("OpNum", String(this.opts.defaultOperatoryNum));
    if (this.opts.defaultProvNum) q.set("ProvNum", String(this.opts.defaultProvNum));

    const slots: any[] = await this.request("GET", `/appointments/SlotsForOps?${q.toString()}`);
    return (slots ?? []).slice(0, 20).map((s) => ({
      // Slot identity is its start time + operatory; encoded so booking can decode it
      slotId: `od|${s.DateTimeStart}|${s.OpNum ?? this.opts.defaultOperatoryNum ?? ""}`,
      start: new Date(s.DateTimeStart).toISOString(),
      end: new Date(s.DateTimeEnd).toISOString(),
      providerName: s.provAbbr,
    }));
  }

  async bookAppointment(request: BookingRequest): Promise<BookingConfirmation> {
    const [tag, dateTimeStart, opNum] = request.slotId.split("|");
    if (tag !== "od" || !dateTimeStart) {
      throw new EmrError("Unknown slot id.", true);
    }

    const { patientId } = await this.createPatient({
      firstName: request.patient.firstName,
      lastName: request.patient.lastName,
      phone: request.patient.phone,
      email: request.patient.email,
      dateOfBirth: request.patient.dateOfBirth,
    });

    const apt = await this.request("POST", "/appointments", {
      PatNum: Number(patientId),
      AptDateTime: dateTimeStart,
      Op: opNum ? Number(opNum) : this.opts.defaultOperatoryNum,
      ProvNum: this.opts.defaultProvNum,
      Note: `${request.appointmentType}${request.notes ? ` — ${request.notes}` : ""} (booked via BAMS assistant)`,
    });

    return {
      appointmentId: String(apt.AptNum),
      start: new Date(dateTimeStart).toISOString(),
    };
  }

  async createPatient(record: PatientRecord): Promise<CreatedPatient> {
    const patient = await this.request("POST", "/patients", {
      LName: record.lastName,
      FName: record.firstName,
      Birthdate: record.dateOfBirth,
      WirelessPhone: record.phone,
      Email: record.email,
    });
    const patNum = patient.PatNum;

    for (const allergy of record.allergies ?? []) {
      await this.request("POST", "/allergies", {
        PatNum: patNum,
        defDescription: allergy,
        StatusIsActive: true,
      });
    }

    return { patientId: String(patNum) };
  }
}
