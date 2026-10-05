import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { getBalance, type BalanceResponse, ClientError } from "@/lib/api";
import { networkLabel } from "@/lib/networkLabel";
import { useReducedMotion } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { DotCoin, DotSend, DotLock } from "@/components/visual/icons";

export interface BalanceStripProps {
  bitcoinAddress: string | null;
  cashuToken: string | null;
  network: string;
}

export const BalanceStrip: React.FC<BalanceStripProps> = ({
  bitcoinAddress,
  cashuToken,
  network
}) => {
  const shouldReduceMotion = useReducedMotion();

  const { data, isLoading } = useQuery<BalanceResponse, ClientError>({
    queryKey: ["balance", network, bitcoinAddress, cashuToken],
    queryFn: () =>
      getBalance({
        network,
        bitcoinAddress: bitcoinAddress ?? undefined,
        cashuToken: cashuToken ?? undefined
      }),
    staleTime: 20000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000
  });

  const isLightningConfigured =
    Boolean(data?.lightning?.connected) && data?.lightning?.error !== "NOT_CONFIGURED";
  const showConnectNotice =
    bitcoinAddress === null && cashuToken === null && !isLightningConfigured;

  const renderValue = (item?: {
    connected: boolean;
    balanceSats: string | null;
    error: string | null;
  }) => {
    if (!item) {
      return (
        <span className="font-sans text-body-sm text-muted-foreground">
          Not connected
        </span>
      );
    }

    if (item.error === null && typeof item.balanceSats === "string") {
      const numericValue = Number(item.balanceSats) || 0;
      return (
        <span className="font-sans text-body-sm text-muted-foreground flex items-center gap-1">
          <span className="font-numeric tabular-nums text-foreground font-medium">
            <AnimatedNumber value={numericValue} />
          </span>
          <span>sats</span>
        </span>
      );
    }

    if (item.error === "NOT_CONFIGURED") {
      return (
        <span className="font-sans text-body-sm text-muted-foreground">
          Not connected
        </span>
      );
    }

    if (item.error === "TIMEOUT") {
      return (
        <span className="font-sans text-body-sm text-muted-foreground">
          Did not respond
        </span>
      );
    }

    if (item.error === "NETWORK_ERROR") {
      return (
        <span className="font-sans text-body-sm text-muted-foreground">
          Could not reach
        </span>
      );
    }

    return (
      <span className="font-sans text-body-sm text-muted-foreground">
        Balance unavailable
      </span>
    );
  };

  const rows = [
    {
      key: "bitcoin",
      name: "Bitcoin",
      icon: <DotCoin size={24} className="text-foreground shrink-0" aria-hidden="true" />,
      item: data?.bitcoin
    },
    {
      key: "lightning",
      name: "Lightning",
      icon: <DotSend size={24} className="text-foreground shrink-0" aria-hidden="true" />,
      item: data?.lightning
    },
    {
      key: "cashu",
      name: "Cashu",
      icon: <DotLock size={24} className="text-foreground shrink-0" aria-hidden="true" />,
      item: data?.cashu
    }
  ];

  return (
    <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none w-full">
      <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground mb-6">
        Your balance
      </h2>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
            className="space-y-4 py-2"
            aria-busy="true"
            aria-label="Checking your balance..."
          >
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-28" />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
          >
            {showConnectNotice ? (
              <p className="font-sans text-body-sm text-muted-foreground mb-4">
                Connect your wallet and services to see balances.
              </p>
            ) : null}

            <div className="space-y-4 py-2">
              {rows.map((row, index) => (
                <motion.div
                  key={row.key}
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.2, ease: "easeOut", delay: index * 0.04 }
                  }
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-3">
                    {row.icon}
                    <span className="font-sans text-body font-medium text-foreground">
                      {row.name}
                    </span>
                  </div>
                  <div>{renderValue(row.item)}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-white/[0.08] my-4" />
      <p className="font-sans text-body-sm text-muted-foreground">
        Network: {networkLabel(network)}
      </p>
    </Card>
  );
};
