import * as NodeDgram from "node:dgram";
import * as NodeOS from "node:os";

import { HostProcessPlatform } from "@t3tools/shared/hostProcess";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export interface DesktopNetworkInterfaceInfo {
  readonly address: string;
  readonly family: string | number;
  readonly internal: boolean;
  readonly netmask?: string;
  readonly mac?: string;
  readonly cidr?: string | null;
  readonly scopeid?: number;
}

export type NetworkInterfaces = Readonly<
  Record<string, readonly DesktopNetworkInterfaceInfo[] | undefined>
>;

export class DesktopNetworkInterfacesReadError extends Schema.TaggedError<DesktopNetworkInterfacesReadError>()(
  "DesktopNetworkInterfacesReadError",
  {
    platform: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to read desktop network interfaces on ${this.platform}.`;
  }
}

export class DesktopNetworkInterfaces extends Context.Service<
  DesktopNetworkInterfaces,
  {
    readonly read: Effect.Effect<NetworkInterfaces>;
    readonly readRoutedIpv4Address: Effect.Effect<string | null>;
  }
>()("@t3tools/desktop/backend/DesktopNetworkInterfaces") {}

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.gen(function* () {
  const platform = yield* HostProcessPlatform;
  const readRoutedIpv4Address = Effect.tryPromise({
    try: (signal) =>
      new Promise<string | null>((resolve) => {
        const socket = NodeDgram.createSocket("udp4");
        let settled = false;

        const finish = (address: string | null) => {
          if (settled) return;
          settled = true;
          try {
            socket.close();
          } catch {
            // The socket can still be unbound when route selection fails.
          }
          resolve(address);
        };

        signal.addEventListener("abort", () => finish(null), { once: true });
        socket.once("error", () => finish(null));
        // Connecting a UDP socket selects an outbound route without sending a
        // packet. TEST-NET-1 keeps the probe destination non-routable on the
        // public internet while still exercising the host's default route.
        socket.connect(9, "192.0.2.1", () => {
          const address = socket.address();
          finish(typeof address === "string" ? null : address.address);
        });
      }),
    catch: () => null,
  }).pipe(Effect.orElseSucceed(() => null));

  return DesktopNetworkInterfaces.of({
    read: Effect.try({
      try: () => NodeOS.networkInterfaces(),
      catch: (cause) => new DesktopNetworkInterfacesReadError({ platform, cause }),
    }).pipe(Effect.orDie),
    readRoutedIpv4Address,
  });
});

export const layer = Layer.effect(DesktopNetworkInterfaces, make);
