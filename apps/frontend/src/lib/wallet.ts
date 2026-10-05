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
  type AppKitNetwork
} from "@reown/appkit/networks";
import { type SupportedNetwork } from "@/lib/api";

export class WalletError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "WalletError";
    this.code = code;
  }
}

export const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error("VITE_REOWN_PROJECT_ID is not set");
}

export const reownProjectId = projectId;

export const getBitcoinNetwork = (networkName?: string): AppKitNetwork => {
  const normalized = (networkName || "").toLowerCase();
  if (normalized === "mainnet" || normalized === "bitcoin") {
    return bitcoin;
  }
  return bitcoinTestnet;
};

export const selectedBitcoinNetwork: AppKitNetwork = bitcoinTestnet;

export const bitcoinAdapter = new BitcoinAdapter({ projectId });

export const appKit = createAppKit({
  adapters: [bitcoinAdapter],
  networks: [bitcoin, bitcoinTestnet],
  defaultNetwork: bitcoinTestnet,
  projectId,
  featuredWalletIds: [
    "2a87d74ae02e10bdd1f51f7ce6c4e1cc53cd5f2c0b6b5ad0d7b3007d2b13de7b",
    "483afe1df1df63daf313109971ff3ef8356ddf1cc4e45877d205eee0b7893a13",
    "971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709"
  ],
  metadata: {
    name: "Kepler",
    description: "Private payments for Bitcoin",
    url: typeof window !== "undefined" ? window.location.origin : "",
    icons: []
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
    swaps: false,
    onramp: false
  },
  themeMode: "dark"
});

export interface WalletState {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: (network: SupportedNetwork) => Promise<void>;
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

  const reconnect = async (network: SupportedNetwork): Promise<void> => {
    const target = network === "mainnet" ? bitcoin : bitcoinTestnet;
    try {
      await disconnect();
    } catch (_err: unknown) {
      throw new WalletError(
        "WALLET_DISCONNECT_FAILED",
        "We could not disconnect your wallet. Try again."
      );
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 300));

    try {
      await appKit.switchNetwork(target);
    } catch (_err: unknown) {
      throw new WalletError(
        "WALLET_SWITCH_FAILED",
        "Your wallet could not switch to the new network. Please switch it manually and try again."
      );
    }

    try {
      await connect();
    } catch (_err: unknown) {
      throw new WalletError(
        "WALLET_CONNECT_FAILED",
        "We could not reconnect your wallet. Please connect it again."
      );
    }
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
    reconnect,
    signPsbt
  };
}
