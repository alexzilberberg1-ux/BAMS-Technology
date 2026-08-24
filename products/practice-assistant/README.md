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
```

Configs hold **env-var names, never secrets** — the schema enforces it.
Feature flags (`scheduling`, `insuranceQuestions`, `documentIntake`,
`humanHandoff`) add/remove tools and prompt sections per contract tier.

## What "EMR integration" really involves (read before selling it)

- **Open Dental** — genuinely open REST API; you need a developer key from
  Open Dental and a per-practice customer key. Fastest real integration; this
  is the one to pilot with.
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

## Compliance (not optional for real patients)

This codebase handles PHI the moment a real patient types into it:

- Sign Anthropic's **BAA** before sending PHI through the API (available on
  eligible plans — confirm with Anthropic sales; also disable any data-sharing
  options inconsistent with it).
- BAAs with your hosting provider; encrypt at rest; TLS everywhere.
- Replace the in-memory session/handoff stores with encrypted, audited
  persistence before production; add authentication to `/handoffs`.
- The assistant's prompt already forbids clinical advice and routes
  emergencies to the phone/911 — keep that language when customizing.

## Tests

```bash
npm test          # 24 tests: config validation, all three adapters, tools, extraction
npm run typecheck
```

Anthropic calls are mocked in tests; adapters are tested against fake `fetch`
implementations, so the suite runs with no keys and no network.
