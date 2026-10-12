import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  DeviceModelId,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import {
  SignerEthBuilder,
  type SignerEth,
} from "@ledgerhq/device-signer-kit-ethereum";
import {
  speculosIdentifier,
  speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import { firstValueFrom, timeout, type Observable } from "rxjs";
import { getAddress, type Address, type Hex } from "viem";
import { config } from "./config.js";

const dmk = new DeviceManagementKitBuilder()
  .addTransport(
    speculosTransportFactory(config.speculosUrl, false, DeviceModelId.NANO_SP),
  )
  .build();

let session: Promise<{ sessionId: DeviceSessionId; signer: SignerEth }> | undefined;

function connect() {
  session ??= (async () => {
    const device = await firstValueFrom(
      dmk.startDiscovering({ transport: speculosIdentifier }).pipe(timeout(5000)),
    );
    const sessionId = await dmk.connect({ device });
    return { sessionId, signer: new SignerEthBuilder({ dmk, sessionId }).build() };
  })().catch((error) => {
    session = undefined;
    throw new Error(`Ledger device not reachable at ${config.speculosUrl}`, {
      cause: error,
    });
  });
  return session;
}

export class DeviceError extends Error {
  // True when the treasurer pressed Reject, as opposed to the device being unreachable.
  rejected = false;
}

// Resolves with the device action's output, rejects if the device refuses.
function run<Output>(action: { observable: Observable<any> }): Promise<Output> {
  return new Promise((resolve, reject) => {
    action.observable.subscribe({
      next: (state) => {
        if (state.status === DeviceActionStatus.Completed) resolve(state.output);
        if (state.status === DeviceActionStatus.Error) {
          const { errorCode, message, _tag } = state.error ?? {};
          // 6985: the user pressed Reject on the device
          const error = new DeviceError(
            errorCode === "6985"
              ? "Rejected on the Ledger device"
              : `${_tag ?? "DeviceError"}: ${message ?? "unknown"} (${errorCode ?? "-"})`,
          );
          error.rejected = errorCode === "6985";
          reject(error);
        }
      },
      error: (error) => {
        session = undefined;
        reject(new DeviceError(String(error?.message ?? error)));
      },
    });
  });
}

// Runs a device action; if the session has gone stale (e.g. the emulator was restarted),
// reconnects and tries once more. A rejection on the device is final and never retried.
async function withSigner<Output>(
  action: (signer: SignerEth) => { observable: Observable<any> },
): Promise<Output> {
  for (let attempt = 0; ; attempt++) {
    const current = session;
    try {
      return await run<Output>(action((await connect()).signer));
    } catch (error) {
      if ((error instanceof DeviceError && error.rejected) || attempt > 0) throw error;
      if (session === current) session = undefined;
      const stale = await current?.catch(() => undefined);
      if (stale) await dmk.disconnect({ sessionId: stale.sessionId }).catch(() => undefined);
    }
  }
}

export async function getTreasuryAddress(): Promise<Address> {
  const { address } = await withSigner<{ address: string }>((signer) =>
    signer.getAddress(config.derivationPath, { checkOnDevice: false }),
  );
  return getAddress(address);
}

// Blocks until the treasurer approves or rejects on the device.
export function signOnDevice(unsignedTx: Uint8Array) {
  return withSigner<{ r: Hex; s: Hex; v: number }>((signer) =>
    signer.signTransaction(config.derivationPath, unsignedTx),
  );
}
