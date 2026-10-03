import { useState } from "react";
import { useAppKit, useAppKitAccount, useDisconnect } from "@reown/appkit/react";

export interface WalletState {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useWallet(): WalletState {
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();
  const { disconnect: appkitDisconnect } = useDisconnect();
  const [isManualConnecting, setIsManualConnecting] = useState(false);

  const connect = async () => {
    try {
      setIsManualConnecting(true);
      await open();
    } finally {
      setIsManualConnecting(false);
    }
  };

  const disconnect = async () => {
    await appkitDisconnect();
  };

  const isConnecting = isManualConnecting || status === "connecting";

  return {
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect
  };
}
