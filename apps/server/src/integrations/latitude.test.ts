import { describe, expect, it } from "vite-plus/test";

import { comparableLatitudePath } from "./latitude.ts";

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
});
