export interface PairLaunchContext {
  readonly projectId: string;
  readonly worktreePath: string | null;
  readonly branch: string | null;
}

export function readPairLaunchContext(hash: string): PairLaunchContext | null {
  const parameters = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const projectId = parameters.get("project")?.trim() ?? "";
  if (projectId.length === 0) {
    return null;
  }

  const worktreePath = parameters.get("worktree")?.trim() ?? "";
  const branch = parameters.get("branch")?.trim() ?? "";
  return {
    projectId,
    worktreePath: worktreePath.length > 0 ? worktreePath : null,
    branch: branch.length > 0 ? branch : null,
  };
}
