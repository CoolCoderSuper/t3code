import { describe, expect, it } from "vite-plus/test";

import { comparableLatitudePath, findExistingLatitudeProject } from "./latitude.ts";

describe("Latitude path matching", () => {
  it("matches Windows verbatim worktree paths with regular paths", () => {
    expect(comparableLatitudePath(String.raw`\\?\C:\Users\Joseph\worktree`)).toBe(
      comparableLatitudePath("C:/Users/Joseph/worktree"),
    );
  });

  it("matches Windows verbatim UNC paths with regular UNC paths", () => {
    expect(comparableLatitudePath(String.raw`\\?\UNC\server\share\worktree`)).toBe(
      comparableLatitudePath(String.raw`\\server\share\worktree`),
    );
  });

  it("selects Latitude's discovered worktree project by repository and branch", () => {
    const projects = [
      {
        name: "fabricore",
        enabled: true,
        project_dir: String.raw`C:\Code\Fabricore`,
        deployments: [],
      },
      {
        name: "fabricore--invoice-early-pay-discount",
        enabled: true,
        project_dir: String.raw`C:\Users\remote\.codex\worktrees\abc1\Fabricore`,
        deployments: [],
      },
    ];

    expect(
      findExistingLatitudeProject(projects, {
        projectDir: String.raw`C:\different-client-path\Fabricore`,
        workspaceRoot: String.raw`C:\Code\Fabricore`,
        branch: "t3code/invoice-early-pay-discount",
      })?.name,
    ).toBe("fabricore--invoice-early-pay-discount");
  });
});
