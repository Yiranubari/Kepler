export function networkLabel(network: string): string {
  const normalized = network.trim().toLowerCase();
  switch (normalized) {
    case "mainnet":
      return "Mainnet";
    case "testnet":
      return "Testnet";
    case "testnet4":
      return "Testnet 4";
    case "signet":
      return "Signet";
    case "regtest":
      return "Regtest";
    default:
      return normalized.length > 0 ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
  }
}
