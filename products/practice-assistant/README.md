# BAMS Practice Assistant

The product from the demo video, for real: an AI front-desk assistant for
medical/dental practices. A website chat widget that answers questions from the
practice's own facts, books appointments in the practice's scheduling system,
and reads intake documents straight into the patient record.

Built on the Claude API (`claude-opus-5` by default, configurable per client).

## Architecture

```
clients/*.json          Per-client config: branding, hours, insurance,
                        knowledge, feature flags, EMR selection
        │
        ▼
src/config/             Zod-validated config schema + loader
src/ai/                 The AI layer
  prompt.ts               system prompt built from client config (cached prefix)
  tools.ts                Claude tools bound to the client's EMR adapter
  assistant.ts            chat orchestration via the SDK tool runner
  extraction.ts           intake form → structured fields → EMR (structured outputs)
src/emr/                The EMR integration layer
  types.ts                EmrAdapter interface (getAvailability / bookAppointment / createPatient)
  mock.ts                 in-memory EMR for demos and dev
  fhir.ts                 any FHIR R4 server (Epic, Oracle Health, athenahealth, Medplum…)
  opendental.ts           Open Dental REST API
  registry.ts             config → adapter
src/server/             Express API + session store
widget/widget.js        Embeddable chat widget (one script tag, zero deps)
```

The AI layer never talks to an EMR directly — only to the `EmrAdapter`
interface. **Adding an EMR integration = one adapter file + a registry case +
a config variant.** Onboarding a new practice = one JSON file.

## Running

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev            # starts on :3000 with the demo Lakeside Dental client
```

Embed on a practice's site:

```html
<script src="https://YOUR-DEPLOYMENT/widget/widget.js"
        data-client="lakeside-dental" defer></script>
```

API surface:

| Route | Purpose |
|---|---|
| `POST /api/:clientId/chat` | One chat turn. `{ sessionId?, message }` → `{ sessionId, reply }` |
| `POST /api/:clientId/documents` | Intake upload. `{ data: base64, mediaType }` → extraction + EMR patient id |
| `GET /api/:clientId/widget-config` | Branding/features for the widget (no secrets) |
| `GET /api/:clientId/handoffs` | Pending human-callback requests (put behind auth before production) |

## Onboarding a client

Copy `clients/lakeside-dental.json`, change the facts, pick the EMR:

```jsonc
"emr": { "kind": "mock" }                                  // demos
"emr": { "kind": "fhir-r4", "baseUrl": "https://fhir.../r4",
         "authTokenEnv": "ACME_FHIR_TOKEN" }               // FHIR R4 vendors
"emr": { "kind": "opendental", "baseUrl": "https://api.opendental.com/api/v1",
         "developerKeyEnv": "OD_DEV_KEY", "customerKeyEnv": "ACME_OD_KEY",
         "defaultOperatoryNum": 3, "defaultProvNum": 1 }   // Open Dental
"emr": { "kind": "athenahealth",
         "baseUrl": "https://api.preview.platform.athenahealth.com",   // preview/sandbox
         "practiceId": "195900", "departmentId": "1",
         "clientIdEnv": "ACME_ATHENA_CLIENT_ID",
         "clientSecretEnv": "ACME_ATHENA_CLIENT_SECRET" }              // athenahealth
```

Configs hold **env-var names, never secrets** — the schema enforces it.
Feature flags (`scheduling`, `insuranceQuestions`, `documentIntake`,
`humanHandoff`) add/remove tools and prompt sections per contract tier.
See `clients/sunrise-family-medicine.json` for a complete athenahealth
example, including the `compliance` consent/emergency copy the widget shows.

## What "EMR integration" really involves (read before selling it)

- **athenahealth** — implemented against the athenaOne API: OAuth2
  client-credentials, `GET /appointments/open` for slots, `POST /patients` +
  `PUT /appointments/{id}` to book (form-encoded, MM/DD/YYYY dates — the
  adapter converts). `emrCode` on each appointment type carries the athena
  `appointmenttypeid`. Get a developer account at docs.athenahealth.com, test
  against the preview sandbox (practice `195900`), then Marketplace/partner
  approval before touching production PHI. Discrete allergy/insurance
  write-back needs per-practice reference IDs (allergen ids, insurance
  package ids) — until those are mapped for a client, the adapter surfaces
  them as a chart alert/appointment note so staff see them.
- **Open Dental** — genuinely open REST API; you need a developer key from
  Open Dental and a per-practice customer key. Fastest real integration in
  dental.
- **FHIR R4 vendors (Epic, Oracle Health, athenahealth…)** — the adapter here
  speaks standard FHIR, but each vendor gates access: app registration (e.g.
  Epic's Vendor Services/App Market), SMART backend-services OAuth, per-site
  approval, and often certification fees and months of lead time. The token
  acquisition is deliberately left outside the adapter (`authTokenEnv`) so the
  per-vendor OAuth dance can live in a small sidecar without touching
  scheduling logic.
- **Dentrix / Eaglesoft and other closed dental PMS** — no public API; go
  through their partner programs or an aggregator (e.g. NexHealth, Kolla)
  — an aggregator adapter would slot into `src/emr/` like any other.

## HIPAA posture

What the code already does:

- **Consent + notice in the widget**: a per-practice consent screen (text and
  privacy-policy link set in `compliance` config) is shown before any chat,
  with a pinned emergency disclaimer. PHI-minimization language asks patients
  not to share detailed history.
- **No client-side persistence**: the widget writes nothing to localStorage,
  sessionStorage, or cookies; the session id lives in page memory only. It
  refuses to run against a non-HTTPS endpoint.
- **Audit trail** (`src/server/audit.ts`): who/what/when JSON lines — chat
  turns, document intakes, errors, rate-limit hits — with hashed session ids
  and **no message content**. Set `AUDIT_LOG_PATH` to write to a file; store
  audit logs encrypted and retain ~6 years.
- **PHI kept out of app logs**: error paths log exception class/message only,
  never chat text or extracted fields.
- **Transport/caching**: `Cache-Control: no-store` on all API responses,
  `nosniff`, `no-referrer`, HSTS when behind TLS. Per-client CORS allowlist.
- **Abuse controls**: per-caller rate limits on chat (20/min) and uploads
  (5/min).
- **Secrets**: configs hold env-var names only; the schema makes it
  impossible to commit an API key in a client file.

What you must still do before real patients (the business half of HIPAA):

- Sign Anthropic's **BAA** before sending PHI through the Claude API
  (available on eligible plans — confirm with Anthropic sales), and BAAs with
  your hosting provider and athenahealth as applicable. Anthropic's zero-
  retention/no-training options should match your BAA terms.
- Replace the in-memory session/handoff stores with encrypted, audited
  persistence (Redis/Postgres with encryption at rest); add authentication to
  `/handoffs`.
- Terminate TLS 1.2+ in front of the service; set `AUDIT_LOG_PATH` to
  protected storage.
- Run a risk assessment and keep policies/training current — HIPAA compliance
  is an organizational program, not a code feature. This section is
  engineering guidance, not legal advice.
- The assistant's prompt already forbids clinical advice and routes
  emergencies to the phone/911 — keep that language when customizing.

## Tests

```bash
npm test          # 31 tests: config validation, all four adapters, tools, extraction
npm run typecheck
```

Anthropic calls are mocked in tests; adapters are tested against fake `fetch`
implementations, so the suite runs with no keys and no network.
