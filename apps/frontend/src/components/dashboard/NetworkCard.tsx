import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAppConfig,
  setNetwork,
  type AppConfigResponse,
  type SupportedNetwork,
  ClientError
} from "@/lib/api";
import { getFriendlyMessage, FALLBACK_ERROR_MESSAGE } from "@/lib/errorMessages";
import { useWallet, WalletError } from "@/lib/wallet";
import { useReducedMotion } from "@/lib/motion";
import { networkLabel } from "@/lib/networkLabel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface NetworkCardProps {
  network?: string;
  isLoading?: boolean;
  error?: ClientError | null;
  onRetry?: () => void;
}

export const NetworkCard: React.FC<NetworkCardProps> = ({
  network: propNetwork,
  isLoading: propLoading,
  error: propError,
  onRetry
}) => {
  const queryClient = useQueryClient();
  const { reconnect } = useWallet();
  const shouldReduceMotion = useReducedMotion();

  const [pendingNetwork, setPendingNetwork] = useState<SupportedNetwork | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const {
    data: config,
    isLoading: isConfigLoading,
    error: configError,
    refetch: refetchConfig
  } = useQuery<AppConfigResponse, ClientError>({
    queryKey: ["appConfig"],
    queryFn: getAppConfig
  });

  const isLoading = (propLoading ?? false) || (isConfigLoading && !config);
  const cardError = (configError as ClientError | null) ?? propError;

  const currentNetwork = (config?.network ?? propNetwork ?? "testnet4") as SupportedNetwork;
  const isTestnet = currentNetwork === "testnet" || currentNetwork === "testnet4";
  const isMainnet = currentNetwork === "mainnet";
  const isSignetOrRegtest = currentNetwork === "signet" || currentNetwork === "regtest";
  const isPending = Boolean(pendingNetwork);

  const handleSwitch = async (next: SupportedNetwork): Promise<void> => {
    if (isPending) {
      return;
    }
    setInlineError(null);
    setPendingNetwork(next);
    try {
      await setNetwork(next);
      await reconnect(next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appConfig"] }),
        queryClient.invalidateQueries({ queryKey: ["scenarios"] }),
        queryClient.invalidateQueries({ queryKey: ["policy"] })
      ]);
    } catch (err: unknown) {
      if (err instanceof ClientError) {
        setInlineError(err.friendlyMessage);
      } else if (err instanceof WalletError) {
        setInlineError(err.message);
      } else {
        setInlineError(getFriendlyMessage(undefined));
      }
    } finally {
      setPendingNetwork(null);
    }
  };

  return (
    <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none h-full flex flex-col justify-between">
      <div>
        <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground mb-4">
          Network
        </h2>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="space-y-2 py-1"
              aria-busy="true"
              aria-label="Checking network connection..."
            >
              <Skeleton className="h-4 w-28" />
            </motion.div>
          ) : cardError && !config ? (
            <motion.div
              key="error"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
              className="space-y-2 pt-2"
            >
              <p className="text-xs font-sans text-muted-foreground">
                {cardError.friendlyMessage ?? FALLBACK_ERROR_MESSAGE}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void refetchConfig();
                  onRetry?.();
                }}
              >
                Try again
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
            >
              <p className="font-sans text-body text-muted-foreground mb-4">
                {networkLabel(currentNetwork)}
              </p>

              {isSignetOrRegtest ? (
                <p className="font-sans text-xs text-muted-foreground">
                  Switching is available between Testnet and Mainnet.
                </p>
              ) : (
                <div>
                  <div
                    role="group"
                    aria-label="Network switch"
                    className="grid grid-cols-2 p-1 rounded-xl bg-muted/40 border border-white/[0.08] gap-1"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => {
                        if (isTestnet || isPending) {
                          return;
                        }
                        void handleSwitch("testnet4");
                      }}
                      className={cn(
                        "min-h-[44px] h-[44px] rounded-lg text-sm font-medium transition-colors",
                        isTestnet
                          ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                          : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                      )}
                    >
                      <motion.span
                        key={isPending && (pendingNetwork === "testnet4" || pendingNetwork === "testnet") ? "switching" : "idle"}
                        initial={shouldReduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.12 }}
                      >
                        {isPending && (pendingNetwork === "testnet4" || pendingNetwork === "testnet")
                          ? "Switching..."
                          : "Testnet"}
                      </motion.span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => {
                        if (isMainnet || isPending) {
                          return;
                        }
                        void handleSwitch("mainnet");
                      }}
                      className={cn(
                        "min-h-[44px] h-[44px] rounded-lg text-sm font-medium transition-colors",
                        isMainnet
                          ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                          : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                      )}
                    >
                      <motion.span
                        key={isPending && pendingNetwork === "mainnet" ? "switching" : "idle"}
                        initial={shouldReduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.12 }}
                      >
                        {isPending && pendingNetwork === "mainnet"
                          ? "Switching..."
                          : "Mainnet"}
                      </motion.span>
                    </Button>
                  </div>

                  <AnimatePresence mode="wait">
                    {inlineError && (
                      <motion.div
                        key="inline-error"
                        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
                        className="mt-3 text-xs font-sans text-muted-foreground"
                      >
                        {inlineError}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
};
