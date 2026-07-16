import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import {
  HostedPairingRouteSurface,
  PairingPendingSurface,
  PairingRouteSurface,
} from "../components/auth/PairingRouteSurface";
import { useNewThreadHandler } from "../hooks/useHandleNewThread";
import { readPairLaunchContext } from "../pairLaunchContext";
import { useProjects } from "../state/entities";

export const Route = createFileRoute("/pair")({
  beforeLoad: async ({ context }) => {
    const { authGateState } = context;
    if (authGateState.status === "hosted-pairing") {
      return {
        authGateState,
      };
    }

    if (
      authGateState.status === "hosted-static" ||
      (authGateState.status === "authenticated" &&
        readPairLaunchContext(window.location.hash) === null)
    ) {
      throw redirect({ to: "/", replace: true });
    }
    return {
      authGateState,
    };
  },
  component: PairRouteView,
  pendingComponent: PairRoutePendingView,
});

function PairRouteView() {
  const { authGateState } = Route.useRouteContext();
  const navigate = useNavigate();
  const handleNewThread = useNewThreadHandler();
  const projects = useProjects();
  const launchContext = useRef(readPairLaunchContext(window.location.hash)).current;
  const launchProject = projects.find((project) => project.id === launchContext?.projectId);
  const didLaunchAuthenticatedProject = useRef(false);

  useEffect(() => {
    if (
      authGateState?.status !== "authenticated" ||
      !launchProject ||
      didLaunchAuthenticatedProject.current
    ) {
      return;
    }
    didLaunchAuthenticatedProject.current = true;
    void handleNewThread(scopeProjectRef(launchProject.environmentId, launchProject.id), {
      ...(launchContext?.branch ? { branch: launchContext.branch } : {}),
      ...(launchContext?.worktreePath
        ? { worktreePath: launchContext.worktreePath, envMode: "worktree" }
        : {}),
    });
  }, [authGateState?.status, handleNewThread, launchContext, launchProject]);

  if (!authGateState) {
    return null;
  }

  if (authGateState.status === "hosted-pairing") {
    return <HostedPairingRouteSurface />;
  }

  if (authGateState.status === "authenticated") {
    return <PairRoutePendingView />;
  }

  return (
    <PairingRouteSurface
      auth={authGateState.auth}
      onAuthenticated={() => {
        if (launchContext?.projectId) {
          window.location.reload();
          return;
        }
        void navigate({ to: "/", replace: true });
      }}
      {...(authGateState.errorMessage ? { initialErrorMessage: authGateState.errorMessage } : {})}
    />
  );
}

function PairRoutePendingView() {
  return <PairingPendingSurface />;
}
