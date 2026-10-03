import { useState } from "react";
import {
  createAppKit,
  useAppKit,
  useAppKitAccount,
  useDisconnect,
  useAppKitProvider
} from "@reown/appkit/react";
import { BitcoinAdapter } from "@reown/appkit-adapter-bitcoin";
import {
  bitcoin,
  bitcoinTestnet,
  bitcoinSignet,
  type AppKitNetwork
} from "@reown/appkit/networks";

export const reownProjectId: string = import.meta.env.VITE_REOWN_PROJECT_ID || "";

if (!reownProjectId) {
  throw new Error("VITE_REOWN_PROJECT_ID is required to initialize the wallet.");
}

const networkConfig = (
  import.meta.env.VITE_BITCOIN_NETWORK || "testnet4"
).toLowerCase();

export const selectedBitcoinNetwork: AppKitNetwork =
  networkConfig === "mainnet" || networkConfig === "bitcoin"
    ? bitcoin
    : networkConfig === "signet"
    ? bitcoinSignet
    : bitcoinTestnet;

export const bitcoinAdapter = new BitcoinAdapter({
  projectId: reownProjectId
});

export const appKit = createAppKit({
  adapters: [bitcoinAdapter],
  networks: [selectedBitcoinNetwork],
  projectId: reownProjectId,
  metadata: {
    name: "Kepler",
    description: "Kepler agent wallet",
    url:
      typeof window !== "undefined"
        ? window.location.origin
        : import.meta.env.VITE_API_BASE_URL || "",
    icons: []
  },
  themeMode: "dark"
});

export interface WalletState {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signPsbt: (psbtBase64: string) => Promise<string>;
}

export function useWallet(): WalletState {
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();
  const { disconnect: appkitDisconnect } = useDisconnect();
  const { walletProvider } = useAppKitProvider("bip122");
  const [isManualConnecting, setIsManualConnecting] = useState(false);

  const connect = async (): Promise<void> => {
    try {
      setIsManualConnecting(true);
      await open();
    } finally {
      setIsManualConnecting(false);
    }
  };

  const disconnect = async (): Promise<void> => {
    await appkitDisconnect();
  };

  const signPsbt = async (psbtBase64: string): Promise<string> => {
    if (!isConnected || !walletProvider) {
      throw new Error(
        "Your wallet is not connected. Connect your wallet and try again."
      );
    }

    const providerCandidate = walletProvider as Record<string, unknown>;
    if (typeof providerCandidate.signPsbt === "function") {
      const result: unknown = await (
        providerCandidate.signPsbt as (arg: string) => Promise<unknown>
      )(psbtBase64);
      if (typeof result === "string") {
        return result;
      }
      if (
        result &&
        typeof result === "object" &&
        "psbt" in result &&
        typeof (result as { psbt: unknown }).psbt === "string"
      ) {
        return (result as { psbt: string }).psbt;
      }
    }

    throw new Error("Your connected wallet does not support PSBT signing.");
  };

  const isConnecting = isManualConnecting || status === "connecting";

  return {
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    signPsbt
  };
}
