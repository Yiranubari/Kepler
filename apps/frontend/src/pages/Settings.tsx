import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  getPolicy,
  getAppConfig,
  type PolicyResponse,
  type AppConfigResponse,
  ClientError
} from "@/lib/api";
import { networkLabel } from "@/lib/networkLabel";
import { useWallet } from "@/lib/wallet";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { PolicyEditor, TestnetFaucets } from "@/components/settings";
import { useAdvancedMode } from "@/store/advancedMode";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/motion";

export const SettingsPage: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const { address, isConnected, connect, disconnect } = useWallet();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const advancedEnabled = useAdvancedMode((state) => state.enabled);
  const setAdvancedEnabled = useAdvancedMode((state) => state.setEnabled);

  const handlePolicySaved = (): void => {
    setIsEditing(false);
    void queryClient.invalidateQueries({ queryKey: ["policy"] });
  };

  const {
    data: policy,
    isLoading: isPolicyLoading,
    error: policyError,
    refetch: refetchPolicy
  } = useQuery<PolicyResponse, ClientError>({
    queryKey: ["policy"],
    queryFn: getPolicy
  });

  const {
    data: appConfig,
    isLoading: isConfigLoading,
    error: configError,
    refetch: refetchConfig
  } = useQuery<AppConfigResponse, ClientError>({
    queryKey: ["appConfig"],
    queryFn: getAppConfig
  });

  const appVersion = import.meta.env.VITE_APP_VERSION || "0.1.0";
  const githubUrl = import.meta.env.VITE_GITHUB_URL || "";

  const formattedWalletAddress =
    isConnected && address
      ? `Connected as ${address.slice(0, 8)}...${address.slice(-6)}`
      : "No wallet connected";

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
      className="w-full space-y-16 md:space-y-24 max-w-3xl"
    >
      <PageHeader
        title="Settings"
        subtitle="Your spending limits, wallet connections, and privacy preferences."
      />

      <TestnetFaucets />

      <section className="space-y-4">
        <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
          Wallet
        </h2>
        <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4 divide-y divide-white/[0.06]">
          <div className="flex justify-between items-center text-left first:pt-0">
            <span className="font-sans text-body text-muted-foreground">Status</span>
            <span className="font-sans text-body text-foreground">
              {formattedWalletAddress}
            </span>
          </div>
          <div className="pt-4 flex justify-start">
            {isConnected ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => void disconnect()}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                className="rounded-full"
                onClick={() => void connect()}
              >
                Connect wallet
              </Button>
            )}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
          Limits
        </h2>
        {isPolicyLoading ? (
          <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
            <div className="flex justify-between items-center py-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex justify-between items-center py-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
          </Card>
        ) : policyError ? (
          <ErrorState error={policyError} onRetry={() => void refetchPolicy()} />
        ) : policy ? (
          <div className="space-y-4">
          <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-6">
            <div className="space-y-4 divide-y divide-white/[0.06]">
              <div className="flex justify-between items-center py-2 first:pt-0">
                <span className="font-sans text-body text-muted-foreground">Daily limit</span>
                <span className="font-display font-medium text-base text-foreground tabular-nums">
                  <AnimatedNumber value={Number(policy.dailyBudgetSats)} /> sats
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-sans text-body text-muted-foreground">Per transaction limit</span>
                <span className="font-display font-medium text-base text-foreground tabular-nums">
                  <AnimatedNumber value={Number(policy.perTxBudgetSats)} /> sats
                </span>
              </div>
            </div>
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                className="rounded-full"
                onClick={() => setIsEditing(true)}
              >
                Edit limits
              </Button>
            </div>
            </Card>
            {isEditing ? (
              <PolicyEditor policy={policy} onSaved={handlePolicySaved} />
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
          Advanced
        </h2>
        <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none">
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-left">
              <span className="font-sans text-body text-foreground font-medium block">
                Show advanced details
              </span>
              {advancedEnabled && (
                <p className="font-sans text-body-sm text-muted-foreground">
                  Raw JSON is now visible on each payment.
                </p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={advancedEnabled}
              aria-label="Show advanced details"
              onClick={() => setAdvancedEnabled(!advancedEnabled)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                advancedEnabled
                  ? "bg-accent border-accent"
                  : "bg-white/[0.1] border-transparent"
              )}
            >
              <motion.span
                animate={{ x: advancedEnabled ? 24 : 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.15, ease: "easeOut" }
                }
                className="block h-4 w-4 rounded-full bg-foreground"
              />
            </button>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
          About
        </h2>
        {isConfigLoading ? (
          <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
            <div className="flex justify-between items-center py-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex justify-between items-center py-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          </Card>
        ) : configError ? (
          <ErrorState error={configError} onRetry={() => void refetchConfig()} />
        ) : (
          <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4 divide-y divide-white/[0.06]">
            <div className="flex justify-between items-center py-2 first:pt-0">
              <span className="font-sans text-body text-muted-foreground">Version</span>
              <span className="font-mono text-sm text-foreground">
                {appVersion}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-sans text-body text-muted-foreground">Network</span>
              <span className="font-sans text-sm text-foreground">
                {appConfig?.network ? networkLabel(appConfig.network) : "Testnet"}
              </span>
            </div>
            {githubUrl ? (
              <div className="flex justify-between items-center py-2">
                <span className="font-sans text-body text-muted-foreground">Open source</span>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-sans text-sm text-foreground hover:underline"
                >
                  GitHub
                </a>
              </div>
            ) : null}
          </Card>
        )}
      </section>
    </motion.div>
  );
};
