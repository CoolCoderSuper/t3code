import type { LatitudeProjectEnsureRequest } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import type { PreparedConnection } from "../connection/model.ts";
import { environmentEndpointUrl } from "../environment/endpoint.ts";
import { ManagedRelayDpopSigner } from "../relay/managedRelay.ts";
import { executeEnvironmentHttpRequest, makeEnvironmentHttpApiClient } from "../rpc/http.ts";
import {
  buildEnvironmentAuthHeaders,
  withEnvironmentCredentials,
} from "../state/environmentHttpAuth.ts";

const PATH = "/api/integrations/latitude/projects/ensure";

export const ensureEnvironmentLatitudeProject = Effect.fn(
  "clientRuntime.operations.ensureEnvironmentLatitudeProject",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly project: LatitudeProjectEnsureRequest;
}) {
  const requestUrl = environmentEndpointUrl(input.prepared.httpBaseUrl, PATH);
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    15_000,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.orchestration.ensureLatitudeProject({ headers, payload: input.project }),
    ),
  );
});
