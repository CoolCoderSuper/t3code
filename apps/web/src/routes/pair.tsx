import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import {
  HostedPairingRouteSurface,
  PairingPendingSurface,
  PairingRouteSurface,
} from "../components/auth/PairingRouteSurface";
import { useNewThreadHandler } from "../hooks/useHandleNewThread";
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
      (authGateState.status === "authenticated" && readLaunchProjectId() === null)
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
  const launchProjectId = useRef(readLaunchProjectId()).current;
  const launchProject = projects.find((project) => project.id === launchProjectId);
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
    void handleNewThread(scopeProjectRef(launchProject.environmentId, launchProject.id));
  }, [authGateState?.status, handleNewThread, launchProject]);

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
        if (launchProjectId) {
          window.location.reload();
          return;
        }
        void navigate({ to: "/", replace: true });
      }}
      {...(authGateState.errorMessage ? { initialErrorMessage: authGateState.errorMessage } : {})}
    />
  );
}

function readLaunchProjectId(): string | null {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const projectId = new URLSearchParams(hash).get("project")?.trim() ?? "";
  return projectId.length > 0 ? projectId : null;
}

function PairRoutePendingView() {
  return <PairingPendingSurface />;
}
