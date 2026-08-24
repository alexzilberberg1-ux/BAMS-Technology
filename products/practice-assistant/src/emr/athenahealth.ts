import {
  EmrAdapter,
  EmrError,
  type BookingConfirmation,
  type BookingRequest,
  type CreatedPatient,
  type PatientRecord,
  type Slot,
} from "./types.js";

interface AthenaOptions {
  baseUrl: string;
  practiceId: string;
  departmentId: string;
  /** Resolved lazily so the server can boot without credentials present */
  getClientId: () => string;
  getClientSecret: () => string;
  fetchImpl?: typeof fetch;
  /** Injectable clock for token-expiry tests */
  now?: () => number;
}

/**
 * Adapter for the athenahealth athenaOne (athenaNet) API.
 *
 * Auth: OAuth2 client-credentials against /oauth2/v1/token (Basic auth with
 * the app's client id/secret), bearer token on every call. Tokens are cached
 * until shortly before expiry.
 *
 * Endpoints used:
 *   GET  /v1/{practiceId}/appointments/open        — open slots
 *   POST /v1/{practiceId}/patients                 — create patient
 *   PUT  /v1/{practiceId}/appointments/{apptId}    — book an open slot
 *   POST /v1/{practiceId}/appointments/{id}/notes  — booking note (allergies etc.)
 *
 * athenahealth quirks handled here: dates are MM/DD/YYYY, times are HH:MM
 * practice-local, and request bodies are form-encoded, not JSON.
 *
 * NOTE on clinical write-back: discrete allergies and insurance require
 * practice-specific reference IDs (allergen ids, insurance package ids) that
 * must be mapped per client against their sandbox. Until that mapping exists,
 * this adapter records them as an appointment note so staff see them —
 * flagged, not silently dropped.
 *
 * Access prereqs (business, not code): an athenahealth developer account,
 * an app with the Scheduling/Patient scopes, sandbox practice access
 * (practice 195900), and Marketplace/partner approval before production PHI.
 */
export class AthenaHealthAdapter implements EmrAdapter {
  readonly name = "athenahealth";
  private fetchImpl: typeof fetch;
  private now: () => number;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private opts: AthenaOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now() + 60_000) {
      return this.token.value;
    }
    const basic = Buffer.from(
      `${this.opts.getClientId()}:${this.opts.getClientSecret()}`,
    ).toString("base64");
    const res = await this.fetchImpl(`${this.opts.baseUrl}/oauth2/v1/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "athena/service/Athenanet.MDP.*",
      }).toString(),
    });
    if (!res.ok) {
      throw new EmrError(`athenahealth token request failed (${res.status}).`);
    }
    const data: any = await res.json();
    this.token = {
      value: data.access_token,
      expiresAt: this.now() + (Number(data.expires_in) || 3600) * 1000,
    };
    return this.token.value;
  }

  private async request(method: string, path: string, form?: Record<string, string>): Promise<any> {
    const token = await this.getToken();
    const url = `${this.opts.baseUrl}/v1/${this.opts.practiceId}${path}`;
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    if (res.status === 401 || res.status === 403) {
      this.token = null; // force re-auth on next call
      throw new EmrError("athenahealth authorization failed — check app credentials/scopes.");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new EmrError(
        `athenahealth ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`,
      );
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
      departmentid: this.opts.departmentId,
      startdate: toAthenaDate(params.from),
      enddate: toAthenaDate(params.to),
      limit: "20",
    });
    // emrCode carries the athenahealth appointmenttypeid for this visit type
    if (params.emrCode) q.set("appointmenttypeid", params.emrCode);

    const data = await this.request("GET", `/appointments/open?${q.toString()}`);
    const appointments: any[] = data.appointments ?? [];
    return appointments.map((a) => {
      const startIso = toIsoLocal(a.date, a.starttime);
      const durationMin = Number(a.duration) || params.durationMinutes;
      return {
        slotId: `athena|${a.appointmentid}|${a.appointmenttypeid ?? params.emrCode ?? ""}`,
        start: startIso,
        end: addMinutes(startIso, durationMin),
        providerName: a.providerid ? `Provider #${a.providerid}` : undefined,
      };
    });
  }

  async bookAppointment(request: BookingRequest): Promise<BookingConfirmation> {
    const [tag, appointmentId, appointmentTypeId] = request.slotId.split("|");
    if (tag !== "athena" || !appointmentId) {
      throw new EmrError("Unknown slot id.", true);
    }

    const { patientId } = await this.createPatient({
      firstName: request.patient.firstName,
      lastName: request.patient.lastName,
      phone: request.patient.phone,
      email: request.patient.email,
      dateOfBirth: request.patient.dateOfBirth,
    });

    const form: Record<string, string> = { patientid: patientId };
    if (appointmentTypeId) form.appointmenttypeid = appointmentTypeId;

    let booked: any;
    try {
      booked = await this.request("PUT", `/appointments/${appointmentId}`, form);
    } catch (err) {
      if (err instanceof EmrError && /409|conflict|not.*open/i.test(err.message)) {
        throw new EmrError("That time was just taken — please pick another slot.", true);
      }
      throw err;
    }

    if (request.notes) {
      // Notes are visible to front-desk staff; non-fatal if the practice
      // restricts the notes endpoint.
      await this.request("POST", `/appointments/${appointmentId}/notes`, {
        notetext: request.notes.slice(0, 500),
      }).catch(() => undefined);
    }

    const confirmed = Array.isArray(booked) ? booked[0] : booked;
    return {
      appointmentId: String(confirmed?.appointmentid ?? appointmentId),
      start: confirmed?.date && confirmed?.starttime ? toIsoLocal(confirmed.date, confirmed.starttime) : "",
    };
  }

  async createPatient(record: PatientRecord): Promise<CreatedPatient> {
    const form: Record<string, string> = {
      firstname: record.firstName,
      lastname: record.lastName,
      departmentid: this.opts.departmentId,
    };
    if (record.dateOfBirth) form.dob = toAthenaDate(record.dateOfBirth);
    if (record.phone) form.mobilephone = record.phone;
    if (record.email) form.email = record.email;

    const created = await this.request("POST", "/patients", form);
    const patientId = String((Array.isArray(created) ? created[0] : created)?.patientid ?? "");
    if (!patientId) throw new EmrError("athenahealth did not return a patient id.");

    // Discrete allergy/insurance write-back needs per-practice reference IDs
    // (see class doc). Surface them as a chart alert so staff act on them;
    // tolerate practices that restrict the endpoint.
    const flags: string[] = [];
    if (record.allergies?.length) flags.push(`Allergies reported: ${record.allergies.join(", ")}`);
    if (record.insuranceCarrier) {
      flags.push(
        `Insurance reported: ${record.insuranceCarrier}${record.insuranceMemberId ? ` (member ${record.insuranceMemberId})` : ""} — verify & attach package`,
      );
    }
    if (record.reasonForVisit) flags.push(`Reason for visit: ${record.reasonForVisit}`);
    if (flags.length) {
      await this.request("PUT", `/patients/${patientId}/chartalert`, {
        notetext: `[Intake via BAMS assistant] ${flags.join(" | ")}`.slice(0, 500),
      }).catch(() => undefined);
    }

    return { patientId };
  }
}

/** ISO date (YYYY-MM-DD…) → athenahealth MM/DD/YYYY */
function toAthenaDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${m}/${d}/${y}`;
}

/** athena "08/29/2026" + "09:15" → "2026-08-29T09:15:00" (practice-local) */
function toIsoLocal(date: string, time: string): string {
  const [m, d, y] = date.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${time}:00`;
}

function addMinutes(isoLocal: string, minutes: number): string {
  const dt = new Date(isoLocal);
  dt.setMinutes(dt.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
}
