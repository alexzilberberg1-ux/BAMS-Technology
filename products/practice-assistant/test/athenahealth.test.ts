import { describe, expect, it, vi } from "vitest";
import { AthenaHealthAdapter } from "../src/emr/athenahealth";
import { EmrError } from "../src/emr/types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const TOKEN_RESPONSE = { access_token: "atk-1", expires_in: 3600 };

function makeAdapter(fetchImpl: ReturnType<typeof vi.fn>, now?: () => number) {
  return new AthenaHealthAdapter({
    baseUrl: "https://api.athena.example",
    practiceId: "195900",
    departmentId: "1",
    getClientId: () => "cid",
    getClientSecret: () => "csecret",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now,
  });
}

describe("AthenaHealthAdapter", () => {
  it("fetches an OAuth token once and reuses it until expiry", async () => {
    let clock = 1_000_000;
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/v1/token")) {
        return Promise.resolve(jsonResponse(TOKEN_RESPONSE));
      }
      return Promise.resolve(jsonResponse({ appointments: [] }));
    });
    const emr = makeAdapter(fetchImpl, () => clock);

    const window = { appointmentType: "Follow-up", durationMinutes: 20, from: "2026-08-24", to: "2026-08-31" };
    await emr.getAvailability(window);
    await emr.getAvailability(window);
    const tokenCalls = fetchImpl.mock.calls.filter((c) => String(c[0]).includes("/oauth2/"));
    expect(tokenCalls).toHaveLength(1);

    // Token request shape: Basic auth + client_credentials form body
    const [, init] = tokenCalls[0];
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("cid:csecret").toString("base64")}`);
    expect(init.body).toContain("grant_type=client_credentials");

    // After expiry the adapter re-authenticates
    clock += 3600 * 1000;
    await emr.getAvailability(window);
    expect(fetchImpl.mock.calls.filter((c) => String(c[0]).includes("/oauth2/"))).toHaveLength(2);
  });

  it("maps open appointments to slots with athena date/time conversion", async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/")) return Promise.resolve(jsonResponse(TOKEN_RESPONSE));
      return Promise.resolve(
        jsonResponse({
          appointments: [
            {
              appointmentid: "9001",
              date: "08/29/2026",
              starttime: "09:15",
              duration: "20",
              providerid: "71",
              appointmenttypeid: "62",
            },
          ],
        }),
      );
    });
    const emr = makeAdapter(fetchImpl);

    const slots = await emr.getAvailability({
      appointmentType: "Follow-up",
      emrCode: "62",
      durationMinutes: 20,
      from: "2026-08-24",
      to: "2026-08-31",
    });

    expect(slots[0]).toMatchObject({
      slotId: "athena|9001|62",
      start: "2026-08-29T09:15:00",
      end: "2026-08-29T09:35:00",
    });
    const openCall = fetchImpl.mock.calls.find((c) => String(c[0]).includes("/appointments/open"))!;
    const url = String(openCall[0]);
    expect(url).toContain("/v1/195900/appointments/open");
    expect(url).toContain("startdate=08%2F24%2F2026");
    expect(url).toContain("appointmenttypeid=62");
    expect(openCall[1].headers.Authorization).toBe("Bearer atk-1");
  });

  it("books by creating a patient then PUTting the open appointment, form-encoded", async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      const u = String(url);
      if (u.includes("/oauth2/")) return Promise.resolve(jsonResponse(TOKEN_RESPONSE));
      if (u.endsWith("/patients") && init.method === "POST") {
        return Promise.resolve(jsonResponse([{ patientid: 5150 }]));
      }
      if (u.includes("/appointments/9001/notes")) return Promise.resolve(jsonResponse({ success: true }));
      if (u.includes("/appointments/9001")) {
        return Promise.resolve(jsonResponse([{ appointmentid: "9001", date: "08/29/2026", starttime: "09:15" }]));
      }
      return Promise.resolve(jsonResponse({}));
    });
    const emr = makeAdapter(fetchImpl);

    const confirmation = await emr.bookAppointment({
      slotId: "athena|9001|62",
      appointmentType: "Follow-up",
      patient: {
        firstName: "Sarah",
        lastName: "Mitchell",
        phone: "555-0101",
        dateOfBirth: "1992-03-14",
      },
      notes: "Prefers morning visits",
    });

    expect(confirmation).toMatchObject({ appointmentId: "9001", start: "2026-08-29T09:15:00" });

    const patientCall = fetchImpl.mock.calls.find(
      (c) => String(c[0]).endsWith("/patients") && c[1].method === "POST",
    )!;
    expect(patientCall[1].headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const patientBody = new URLSearchParams(patientCall[1].body);
    expect(patientBody.get("dob")).toBe("03/14/1992");
    expect(patientBody.get("departmentid")).toBe("1");

    const bookCall = fetchImpl.mock.calls.find(
      (c) => /\/appointments\/9001$/.test(String(c[0])) && c[1].method === "PUT",
    )!;
    const bookBody = new URLSearchParams(bookCall[1].body);
    expect(bookBody.get("patientid")).toBe("5150");
    expect(bookBody.get("appointmenttypeid")).toBe("62");

    // Booking note delivered
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/appointments/9001/notes"))).toBe(true);
  });

  it("records allergies/insurance as a chart alert on intake, tolerating restricted practices", async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      const u = String(url);
      if (u.includes("/oauth2/")) return Promise.resolve(jsonResponse(TOKEN_RESPONSE));
      if (u.endsWith("/patients") && init.method === "POST") {
        return Promise.resolve(jsonResponse([{ patientid: 7 }]));
      }
      if (u.includes("/chartalert")) return Promise.resolve(new Response("forbidden", { status: 403 }));
      return Promise.resolve(jsonResponse({}));
    });
    const emr = makeAdapter(fetchImpl);

    // 403 on chartalert must not fail the intake
    const { patientId } = await emr.createPatient({
      firstName: "Sarah",
      lastName: "Mitchell",
      allergies: ["Penicillin"],
      insuranceCarrier: "Aetna",
    });
    expect(patientId).toBe("7");
    const alertCall = fetchImpl.mock.calls.find((c) => String(c[0]).includes("/chartalert"))!;
    expect(new URLSearchParams(alertCall[1].body).get("notetext")).toContain("Penicillin");
  });

  it("clears the cached token on 401 and reports an auth error", async () => {
    let first = true;
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/oauth2/")) return Promise.resolve(jsonResponse(TOKEN_RESPONSE));
      if (first) {
        first = false;
        return Promise.resolve(new Response("", { status: 401 }));
      }
      return Promise.resolve(jsonResponse({ appointments: [] }));
    });
    const emr = makeAdapter(fetchImpl);
    const window = { appointmentType: "Follow-up", durationMinutes: 20, from: "2026-08-24", to: "2026-08-31" };

    await expect(emr.getAvailability(window)).rejects.toThrow(EmrError);
    // Next call re-authenticates (2 token calls total) and succeeds
    await emr.getAvailability(window);
    expect(fetchImpl.mock.calls.filter((c) => String(c[0]).includes("/oauth2/"))).toHaveLength(2);
  });
});
