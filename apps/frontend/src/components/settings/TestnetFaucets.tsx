import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import {
  getAppConfig,
  createLightningInvoice,
  ClientError,
  type AppConfigResponse
} from "@/lib/api";
import { getFriendlyMessage } from "@/lib/errorMessages";
import { useWallet } from "@/lib/wallet";
import { useReducedMotion } from "@/lib/motion";
import {
  bitcoinFaucets,
  lightningFaucets,
  cashuFaucets,
  type Faucet
} from "@/lib/faucets";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

export const TestnetFaucets: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const { address, isConnected } = useWallet();

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const { data: appConfig } = useQuery<AppConfigResponse, ClientError>({
    queryKey: ["appConfig"],
    queryFn: getAppConfig
  });

  const network = appConfig?.network;
  const isTestNetwork =
    network === "testnet" ||
    network === "testnet4" ||
    network === "signet" ||
    network === "regtest";

  if (!isTestNetwork) {
    return null;
  }

  const btcFaucets: Faucet[] = bitcoinFaucets();
  const lnFaucets: Faucet[] = lightningFaucets();
  const ecashFaucets: Faucet[] = cashuFaucets();

  const truncatedAddress =
    address && address.length > 20
      ? `${address.slice(0, 12)}...${address.slice(-8)}`
      : address;

  const handleCreateInvoice = async (): Promise<void> => {
    setIsCreating(true);
    setInvoiceError(null);
    try {
      const result = await createLightningInvoice(5000);
      setInvoice(result.invoice);
    } catch (err: unknown) {
      if (err instanceof ClientError) {
        setInvoiceError(err.friendlyMessage);
      } else {
        setInvoiceError(getFriendlyMessage(undefined));
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <motion.section
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
      className="space-y-4"
    >
      <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
        Get testnet funds
      </h2>
      <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-6">
        <p className="font-sans text-body text-muted-foreground">
          Testnet coins are free. Copy your receiving information into one of these faucets.
        </p>

        <div className="flex flex-col gap-6">
          <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-semibold tracking-[-0.01em] text-foreground">
                Bitcoin testnet
              </h3>
              <p className="font-sans text-body text-muted-foreground">
                Use this address in a Bitcoin faucet to receive testnet coins.
              </p>
            </div>

            {isConnected && address ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">
                  {truncatedAddress}
                </span>
                <CopyButton value={address} ariaLabel="Copy address" />
              </div>
            ) : (
              <p className="font-sans text-body-sm text-muted-foreground">
                Connect your wallet first to see your address.
              </p>
            )}

            {btcFaucets.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {btcFaucets.map((faucet) => (
                  <a
                    key={faucet.url}
                    href={faucet.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "inline-flex items-center gap-1.5"
                    )}
                  >
                    <span>{faucet.name}</span>
                    <ExternalLink size={14} className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="font-sans text-body-sm text-muted-foreground">
                No faucets configured. Add VITE_TESTNET_FAUCETS_BITCOIN to the environment.
              </p>
            )}
          </div>

          <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-semibold tracking-[-0.01em] text-foreground">
                Lightning testnet
              </h3>
              <p className="font-sans text-body text-muted-foreground">
                Create a small invoice, then paste it into a Lightning faucet.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                variant="primary"
                size="md"
                className="rounded-full"
                onClick={() => void handleCreateInvoice()}
                disabled={isCreating}
              >
                Create invoice for 5000 sats
              </Button>

              {invoiceError ? (
                <p role="alert" className="font-sans text-body-sm text-destructive">
                  {invoiceError}
                </p>
              ) : null}

              {invoice ? (
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg bg-black/40 border border-white/[0.08]"
                >
                  <p className="font-mono text-xs text-foreground break-all leading-relaxed select-all">
                    {invoice}
                  </p>
                  <CopyButton value={invoice} ariaLabel="Copy invoice" />
                </motion.div>
              ) : null}
            </div>

            {lnFaucets.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {lnFaucets.map((faucet) => (
                  <a
                    key={faucet.url}
                    href={faucet.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "inline-flex items-center gap-1.5"
                    )}
                  >
                    <span>{faucet.name}</span>
                    <ExternalLink size={14} className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="font-sans text-body-sm text-muted-foreground">
                No faucets configured. Add VITE_TESTNET_FAUCETS_LIGHTNING to the environment.
              </p>
            )}
          </div>

          <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-semibold tracking-[-0.01em] text-foreground">
                Cashu test tokens
              </h3>
              <p className="font-sans text-body text-muted-foreground">
                Mint test tokens from a public test mint to try ecash.
              </p>
            </div>

            {ecashFaucets.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {ecashFaucets.map((faucet) => (
                  <a
                    key={faucet.url}
                    href={faucet.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "inline-flex items-center gap-1.5"
                    )}
                  >
                    <span>{faucet.name}</span>
                    <ExternalLink size={14} className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="font-sans text-body-sm text-muted-foreground">
                No faucets configured. Add VITE_TESTNET_FAUCETS_CASHU to the environment.
              </p>
            )}
          </div>
        </div>
      </Card>
    </motion.section>
  );
};
