import type { LatitudeProjectEnsureRequest } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { RemoteEnvironmentAuthorization } from "../authorization/service.ts";
import type { PreparedConnection } from "../connection/model.ts";
import { environmentEndpointUrl } from "../environment/endpoint.ts";
import { ManagedRelayDpopSigner } from "../relay/managedRelay.ts";
import { executeAuthenticatedEnvironmentHttpRequest } from "../state/environmentHttpAuth.ts";

const PATH = "/api/integrations/latitude/projects/ensure";

export const ensureEnvironmentLatitudeProject = Effect.fn(
  "clientRuntime.operations.ensureEnvironmentLatitudeProject",
)(function* (input: {
  readonly prepared: PreparedConnection;
  readonly project: LatitudeProjectEnsureRequest;
}) {
  const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
  const remoteAuthorization = yield* Effect.serviceOption(RemoteEnvironmentAuthorization);
  return yield* executeAuthenticatedEnvironmentHttpRequest({
    prepared: input.prepared,
    signer,
    remoteAuthorization,
    method: "POST",
    url: (httpBaseUrl) => environmentEndpointUrl(httpBaseUrl, PATH),
    timeoutMs: 15_000,
    request: ({ client, headers }) =>
      client.orchestration.ensureLatitudeProject({ headers, payload: input.project }),
  });
});
