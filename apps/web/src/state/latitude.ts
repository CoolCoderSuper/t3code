import { ensureEnvironmentLatitudeProject } from "@t3tools/client-runtime/operations";
import { createRuntimeCommand } from "@t3tools/client-runtime/state/runtime";

import { connectionAtomRuntime } from "../connection/runtime";

export const ensureLatitudeProjectCommand = createRuntimeCommand(connectionAtomRuntime, {
  label: "Open Latitude project",
  execute: ensureEnvironmentLatitudeProject,
});
