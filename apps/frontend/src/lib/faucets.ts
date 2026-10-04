export interface Faucet {
  name: string;
  url: string;
}

export function parseFaucets(raw: string | undefined): Faucet[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [name, url] = entry.split("|").map((part) => part.trim());
      if (!name || !url) return null;
      if (!url.startsWith("https://")) return null;
      return { name, url };
    })
    .filter((faucet): faucet is Faucet => faucet !== null);
}

export const bitcoinFaucets = (): Faucet[] =>
  parseFaucets(import.meta.env.VITE_TESTNET_FAUCETS_BITCOIN);

export const lightningFaucets = (): Faucet[] =>
  parseFaucets(import.meta.env.VITE_TESTNET_FAUCETS_LIGHTNING);

export const cashuFaucets = (): Faucet[] =>
  parseFaucets(import.meta.env.VITE_TESTNET_FAUCETS_CASHU);
