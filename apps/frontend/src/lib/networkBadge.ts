export interface NetworkBadgeConfig {
  label: string;
  tone: "warning" | "neutral";
}

export function networkBadge(network: string | undefined): NetworkBadgeConfig {
  const normalized = (network ?? "").toLowerCase();
  if (normalized === "mainnet") {
    return { label: "Mainnet", tone: "neutral" };
  }
  if (normalized === "testnet" || normalized === "testnet4") {
    return { label: "Testnet", tone: "warning" };
  }
  if (normalized === "signet") {
    return { label: "Signet", tone: "warning" };
  }
  if (normalized === "regtest") {
    return { label: "Regtest", tone: "warning" };
  }
  return { label: "", tone: "neutral" };
}
