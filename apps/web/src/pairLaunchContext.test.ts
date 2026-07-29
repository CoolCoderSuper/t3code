import { describe, expect, it } from "vite-plus/test";

import { readPairLaunchContext } from "./pairLaunchContext";

describe("pair launch context", () => {
  it("reads a root project with linked worktree context", () => {
    expect(
      readPairLaunchContext(
        "#token=pairing-token&project=project-1&worktree=C%3A%5Cworktrees%5Cfeature&branch=feature%2Ffix",
      ),
    ).toEqual({
      projectId: "project-1",
      worktreePath: "C:\\worktrees\\feature",
      branch: "feature/fix",
    });
  });

  it("accepts project-only launch fragments", () => {
    expect(readPairLaunchContext("project=project-1")).toEqual({
      projectId: "project-1",
      worktreePath: null,
      branch: null,
    });
  });

  it("rejects launch fragments without a project", () => {
    expect(readPairLaunchContext("#token=pairing-token&worktree=%2Ftmp%2Ffeature")).toBeNull();
  });
});
