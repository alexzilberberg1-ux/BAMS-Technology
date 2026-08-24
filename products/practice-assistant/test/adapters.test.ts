import { describe, expect, it, vi } from "vitest";
import { FhirR4Adapter } from "../src/emr/fhir";
import { OpenDentalAdapter } from "../src/emr/opendental";
import { EmrError } from "../src/emr/types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("FhirR4Adapter", () => {
  it("maps a Slot bundle to slots and sends auth", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        resourceType: "Bundle",
        entry: [
          {
            resource: {
              resourceType: "Slot",
              id: "s1",
              start: "2026-08-29T09:15:00Z",
              end: "2026-08-29T10:00:00Z",
            },
          },
        ],
      }),
    );
    const emr = new FhirR4Adapter({
      baseUrl: "https://fhir.example.com/r4",
      getToken: () => "tok-123",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const slots = await emr.getAvailability({
      appointmentType: "Cleaning",
      emrCode: "cleaning",
      durationMinutes: 45,
      from: "2026-08-24",
      to: "2026-08-31",
    });

    expect(slots).toEqual([
      { slotId: "Slot/s1", start: "2026-08-29T09:15:00Z", end: "2026-08-29T10:00:00Z" },
    ]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/Slot?");
    expect(String(url)).toContain("service-type=cleaning");
    expect(init.headers.Authorization).toBe("Bearer tok-123");
  });

  it("creates Patient, AllergyIntolerance, and Coverage resources on intake", async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/Patient")) return Promise.resolve(jsonResponse({ id: "p1" }));
      return Promise.resolve(jsonResponse({ id: "x" }));
    });
    const emr = new FhirR4Adapter({
      baseUrl: "https://fhir.example.com/r4",
      getToken: () => "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const { patientId } = await emr.createPatient({
      firstName: "Sarah",
      lastName: "Mitchell",
      allergies: ["Penicillin"],
      insuranceCarrier: "Delta Dental PPO",
      insuranceMemberId: "DD-4821",
    });

    expect(patientId).toBe("p1");
    const paths = fetchImpl.mock.calls.map((c) => new URL(String(c[0])).pathname);
    expect(paths.filter((p) => p.endsWith("/Patient"))).toHaveLength(1);
    expect(paths.filter((p) => p.endsWith("/AllergyIntolerance"))).toHaveLength(1);
    expect(paths.filter((p) => p.endsWith("/Coverage"))).toHaveLength(1);
    const coverageBody = JSON.parse(
      fetchImpl.mock.calls.find((c) => String(c[0]).endsWith("/Coverage"))![1].body,
    );
    expect(coverageBody.beneficiary.reference).toBe("Patient/p1");
  });

  it("raises a clear error on auth failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    const emr = new FhirR4Adapter({
      baseUrl: "https://fhir.example.com/r4",
      getToken: () => "expired",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(
      emr.getAvailability({
        appointmentType: "Cleaning",
        durationMinutes: 45,
        from: "2026-08-24",
        to: "2026-08-31",
      }),
    ).rejects.toThrow(EmrError);
  });
});

describe("OpenDentalAdapter", () => {
  const opts = {
    baseUrl: "https://api.opendental.example/api/v1",
    developerKey: "dev",
    customerKey: "cust",
    defaultOperatoryNum: 3,
    defaultProvNum: 1,
  };

  it("maps SlotsForOps to slots with decodable ids", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          DateTimeStart: "2026-08-29 09:15:00",
          DateTimeEnd: "2026-08-29 10:00:00",
          OpNum: 3,
          provAbbr: "DrP",
        },
      ]),
    );
    const emr = new OpenDentalAdapter({ ...opts, fetchImpl: fetchImpl as unknown as typeof fetch });

    const slots = await emr.getAvailability({
      appointmentType: "Cleaning",
      durationMinutes: 45,
      from: "2026-08-24",
      to: "2026-08-31",
    });

    expect(slots[0].slotId).toBe("od|2026-08-29 09:15:00|3");
    expect(slots[0].providerName).toBe("DrP");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe("ODFHIR dev/cust");
    expect(String(url)).toContain("lengthMinutes=45");
  });

  it("books by creating a patient then an appointment at the slot time", async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/patients")) return Promise.resolve(jsonResponse({ PatNum: 42 }));
      if (path.endsWith("/appointments")) return Promise.resolve(jsonResponse({ AptNum: 77 }));
      return Promise.resolve(jsonResponse({}));
    });
    const emr = new OpenDentalAdapter({ ...opts, fetchImpl: fetchImpl as unknown as typeof fetch });

    const confirmation = await emr.bookAppointment({
      slotId: "od|2026-08-29 09:15:00|3",
      appointmentType: "Cleaning",
      patient: { firstName: "Sarah", lastName: "Mitchell", phone: "555-0101" },
    });

    expect(confirmation.appointmentId).toBe("77");
    const aptBody = JSON.parse(
      fetchImpl.mock.calls.find((c) => String(c[0]).endsWith("/appointments"))![1].body,
    );
    expect(aptBody.PatNum).toBe(42);
    expect(aptBody.AptDateTime).toBe("2026-08-29 09:15:00");
    expect(aptBody.Op).toBe(3);
  });

  it("rejects malformed slot ids as recoverable", async () => {
    const emr = new OpenDentalAdapter({ ...opts, fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(
      emr.bookAppointment({
        slotId: "garbage",
        appointmentType: "Cleaning",
        patient: { firstName: "A", lastName: "B", phone: "1" },
      }),
    ).rejects.toMatchObject({ recoverable: true });
  });
});
