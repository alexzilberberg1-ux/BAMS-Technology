import { describe, expect, it } from "vitest";
import { MockEmrAdapter } from "../src/emr/mock";
import { EmrError } from "../src/emr/types";

function nextWeekWindow() {
  const from = new Date();
  from.setDate(from.getDate() + 1);
  const to = new Date();
  to.setDate(to.getDate() + 8);
  return { from: from.toISOString(), to: to.toISOString() };
}

describe("MockEmrAdapter", () => {
  it("returns future slots, never on Sundays", async () => {
    const emr = new MockEmrAdapter();
    const { from, to } = nextWeekWindow();
    const slots = await emr.getAvailability({
      appointmentType: "Cleaning",
      durationMinutes: 45,
      from,
      to,
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(new Date(slot.start).getDay()).not.toBe(0);
      expect(new Date(slot.start).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("books a slot and refuses to double-book it", async () => {
    const emr = new MockEmrAdapter();
    const { from, to } = nextWeekWindow();
    const [slot] = await emr.getAvailability({
      appointmentType: "Cleaning",
      durationMinutes: 45,
      from,
      to,
    });
    const request = {
      slotId: slot.slotId,
      appointmentType: "Cleaning",
      patient: { firstName: "Sarah", lastName: "Mitchell", phone: "555-0101" },
    };
    const confirmation = await emr.bookAppointment(request);
    expect(confirmation.appointmentId).toMatch(/^apt-/);
    expect(emr.getAppointment(confirmation.appointmentId)?.patient.lastName).toBe("Mitchell");

    await expect(emr.bookAppointment(request)).rejects.toThrow(EmrError);
    await expect(emr.bookAppointment(request)).rejects.toMatchObject({ recoverable: true });

    const after = await emr.getAvailability({
      appointmentType: "Cleaning",
      durationMinutes: 45,
      from,
      to,
    });
    expect(after.map((s) => s.slotId)).not.toContain(slot.slotId);
  });

  it("creates patients with intake fields", async () => {
    const emr = new MockEmrAdapter();
    const { patientId } = await emr.createPatient({
      firstName: "Sarah",
      lastName: "Mitchell",
      allergies: ["Penicillin"],
      insuranceCarrier: "Delta Dental PPO",
    });
    expect(emr.getPatient(patientId)?.allergies).toEqual(["Penicillin"]);
  });
});
