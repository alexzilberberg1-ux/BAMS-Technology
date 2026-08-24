/**
 * The EMR abstraction. Every practice-management/EMR system BAMS integrates
 * gets one adapter implementing this interface; the AI layer only ever talks
 * to the interface. Adding an EMR = one new file + a registry entry.
 */

export interface Slot {
  /** Adapter-specific opaque id, passed back verbatim when booking */
  slotId: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  providerName?: string;
}

export interface BookingRequest {
  slotId: string;
  appointmentType: string;
  patient: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    dateOfBirth?: string; // YYYY-MM-DD
  };
  notes?: string;
}

export interface BookingConfirmation {
  appointmentId: string;
  start: string;
  providerName?: string;
}

export interface PatientRecord {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  insuranceCarrier?: string;
  insuranceMemberId?: string;
  allergies?: string[];
  reasonForVisit?: string;
}

export interface CreatedPatient {
  patientId: string;
}

export interface EmrAdapter {
  /** Human-readable name for logs and the admin UI */
  readonly name: string;

  /** Open slots for an appointment type in a date window */
  getAvailability(params: {
    appointmentType: string;
    emrCode?: string;
    durationMinutes: number;
    from: string; // ISO date
    to: string; // ISO date
  }): Promise<Slot[]>;

  /** Book a previously returned slot */
  bookAppointment(request: BookingRequest): Promise<BookingConfirmation>;

  /** Create (or upsert) a patient record from extracted intake data */
  createPatient(record: PatientRecord): Promise<CreatedPatient>;
}

/** Thrown by adapters for actionable failures (slot taken, auth expired). */
export class EmrError extends Error {
  constructor(
    message: string,
    /** true when the user can fix it by picking again (e.g. slot no longer free) */
    public readonly recoverable: boolean = false,
  ) {
    super(message);
    this.name = "EmrError";
  }
}
