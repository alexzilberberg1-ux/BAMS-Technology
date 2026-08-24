import {
  EmrAdapter,
  EmrError,
  type BookingConfirmation,
  type BookingRequest,
  type CreatedPatient,
  type PatientRecord,
  type Slot,
} from "./types.js";

/**
 * In-memory EMR for demos, development, and sales calls. Generates a
 * deterministic-looking schedule (weekday mornings/afternoons, Saturday
 * mornings) and remembers bookings and patients for the process lifetime.
 */
export class MockEmrAdapter implements EmrAdapter {
  readonly name = "Mock EMR (demo)";

  private booked = new Set<string>();
  private appointments = new Map<string, BookingRequest>();
  private patients = new Map<string, PatientRecord>();
  private nextId = 1;

  async getAvailability(params: {
    appointmentType: string;
    durationMinutes: number;
    from: string;
    to: string;
  }): Promise<Slot[]> {
    const slots: Slot[] = [];
    const start = new Date(params.from);
    const end = new Date(params.to);
    for (let d = new Date(start); d <= end && slots.length < 8; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day === 0) continue; // closed Sunday
      const hours = day === 6 ? [9, 11] : [9, 11, 14, 16]; // Saturday mornings only
      for (const h of hours) {
        const slotStart = new Date(d);
        slotStart.setHours(h, h === 9 ? 15 : 30, 0, 0);
        if (slotStart < new Date()) continue;
        const slotId = `mock-${slotStart.toISOString()}`;
        if (this.booked.has(slotId)) continue;
        const slotEnd = new Date(slotStart.getTime() + params.durationMinutes * 60_000);
        slots.push({
          slotId,
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          providerName: "Dr. Patel",
        });
        if (slots.length >= 8) break;
      }
    }
    return slots;
  }

  async bookAppointment(request: BookingRequest): Promise<BookingConfirmation> {
    if (this.booked.has(request.slotId)) {
      throw new EmrError("That time was just taken — please pick another slot.", true);
    }
    if (!request.slotId.startsWith("mock-")) {
      throw new EmrError("Unknown slot id.", true);
    }
    this.booked.add(request.slotId);
    const appointmentId = `apt-${this.nextId++}`;
    this.appointments.set(appointmentId, request);
    return {
      appointmentId,
      start: request.slotId.slice("mock-".length),
      providerName: "Dr. Patel",
    };
  }

  async createPatient(record: PatientRecord): Promise<CreatedPatient> {
    const patientId = `pat-${this.nextId++}`;
    this.patients.set(patientId, record);
    return { patientId };
  }

  /** Test/demo helpers */
  getAppointment(id: string) {
    return this.appointments.get(id);
  }
  getPatient(id: string) {
    return this.patients.get(id);
  }
}
