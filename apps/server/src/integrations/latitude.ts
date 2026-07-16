import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";

const COMMAND_URL = "http://127.0.0.1:7600";

const LatitudeProject = Schema.Struct({
  name: Schema.String,
  enabled: Schema.Boolean,
  project_dir: Schema.String,
  deployments: Schema.Array(Schema.Unknown),
});
const LatitudeProjects = Schema.Array(LatitudeProject);
const LatitudeHealth = Schema.Struct({ public_bind: Schema.String });
const LatitudeEmbedSession = Schema.Struct({ href: Schema.String });

export class LatitudeRequestError extends Schema.TaggedErrorClass<LatitudeRequestError>()(
  "LatitudeRequestError",
  { message: Schema.String },
) {}

function projectName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
}

function publicOrigin(bind: string): string {
  const port = bind.match(/:(\d+)$/)?.[1] ?? "8080";
  return `http://127.0.0.1:${port}`;
}

interface LatitudeProjectLookup {
  readonly projectDir: string;
  readonly workspaceRoot?: string | undefined;
  readonly branch?: string | undefined;
}

export function comparableLatitudePath(value: string): string {
  let normalized = value.trim().replaceAll("\\", "/").replace(/\/+$/, "");
  if (/^\/\/\?\/unc\//i.test(normalized)) {
    normalized = `//${normalized.slice(8)}`;
  } else if (normalized.startsWith("//?/")) {
    normalized = normalized.slice(4);
  }
  return /^(?:[a-z]:\/|\/\/)/i.test(normalized) ? normalized.toLowerCase() : normalized;
}

export function findExistingLatitudeProject(
  projects: ReadonlyArray<typeof LatitudeProject.Type>,
  input: LatitudeProjectLookup,
): typeof LatitudeProject.Type | undefined {
  const requestedPath = comparableLatitudePath(input.projectDir);
  const exact = projects.find(
    (project) => comparableLatitudePath(project.project_dir) === requestedPath,
  );
  if (exact) return exact;

  const workspaceRoot = input.workspaceRoot;
  const branchLabel = input.branch?.split("/").at(-1);
  if (!workspaceRoot || !branchLabel) return undefined;
  const rootPath = comparableLatitudePath(workspaceRoot);
  const rootProject = projects.find(
    (project) => comparableLatitudePath(project.project_dir) === rootPath,
  );
  if (!rootProject) return undefined;
  const expectedName = `${rootProject.name}--${projectName(branchLabel)}`;
  return projects.find((project) => project.name.toLowerCase() === expectedName.toLowerCase());
}

export const ensureLatitudeProject = Effect.fn("Latitude.ensureProject")(function* (input: {
  readonly projectDir: string;
  readonly preferredName: string;
  readonly theme: "light" | "dark";
  readonly workspaceRoot?: string | undefined;
  readonly branch?: string | undefined;
  readonly createIfMissing?: boolean | undefined;
}) {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(COMMAND_URL)),
    HttpClient.filterStatusOk,
  );
  const requestedDir = input.projectDir.trim();
  const projects = yield* client.get("/api/projects").pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(LatitudeProjects)),
    Effect.mapError((cause) => new LatitudeRequestError({ message: String(cause) })),
  );
  let selected = findExistingLatitudeProject(projects, input);
  let created = false;

  if (!selected) {
    if (input.createIfMissing === false) {
      return yield* new LatitudeRequestError({
        message: `Latitude project was not found for ${requestedDir}`,
      });
    }
    const baseName = projectName(input.preferredName);
    const usedNames = new Set(projects.map((project) => project.name));
    let name = baseName;
    for (let suffix = 2; usedNames.has(name); suffix += 1) name = `${baseName}-${suffix}`;
    selected = yield* HttpClientRequest.post("/api/projects").pipe(
      HttpClientRequest.bodyJson({
        name,
        enabled: true,
        project_dir: requestedDir,
        deployments: [],
      }),
      Effect.flatMap(client.execute),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(LatitudeProject)),
      Effect.mapError((cause) => new LatitudeRequestError({ message: String(cause) })),
    );
    created = true;
  }

  const health = yield* client.get("/health").pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(LatitudeHealth)),
    Effect.mapError((cause) => new LatitudeRequestError({ message: String(cause) })),
  );
  if (!selected) {
    return yield* new LatitudeRequestError({ message: "Latitude project was not resolved" });
  }
  const embedSession = yield* HttpClientRequest.post("/api/t3code/embed-session").pipe(
    HttpClientRequest.bodyJson({ project: selected.name, theme: input.theme }),
    Effect.flatMap(client.execute),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(LatitudeEmbedSession)),
    Effect.mapError((cause) => new LatitudeRequestError({ message: String(cause) })),
  );
  return {
    name: selected.name,
    publicUrl: `${publicOrigin(health.public_bind)}${embedSession.href}`,
    created,
  };
}, Effect.provide(FetchHttpClient.layer));
