import type { EmrConfig } from "../config/schema.js";
import type { EmrAdapter } from "./types.js";
import { MockEmrAdapter } from "./mock.js";
import { FhirR4Adapter } from "./fhir.js";
import { OpenDentalAdapter } from "./opendental.js";
import { AthenaHealthAdapter } from "./athenahealth.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/** Instantiate the adapter a client's config asks for. */
export function createAdapter(config: EmrConfig): EmrAdapter {
  switch (config.kind) {
    case "mock":
      return new MockEmrAdapter();
    case "athenahealth":
      return new AthenaHealthAdapter({
        baseUrl: config.baseUrl,
        practiceId: config.practiceId,
        departmentId: config.departmentId,
        // Lazy: the server can boot (and serve the widget) before credentials
        // are provisioned; the first EMR call fails loudly instead.
        getClientId: () => requireEnv(config.clientIdEnv),
        getClientSecret: () => requireEnv(config.clientSecretEnv),
      });
    case "fhir-r4":
      return new FhirR4Adapter({
        baseUrl: config.baseUrl,
        getToken: () => requireEnv(config.authTokenEnv),
        scheduleReference: config.scheduleReference,
      });
    case "opendental":
      return new OpenDentalAdapter({
        baseUrl: config.baseUrl,
        developerKey: requireEnv(config.developerKeyEnv),
        customerKey: requireEnv(config.customerKeyEnv),
        defaultOperatoryNum: config.defaultOperatoryNum,
        defaultProvNum: config.defaultProvNum,
      });
  }
}
