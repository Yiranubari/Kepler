import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type PolicyResponse } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

export const SettingsPage: React.FC = () => {
  const {
    data: policy,
    isLoading,
    error,
    refetch
  } = useQuery<PolicyResponse>({
    queryKey: ["policy"],
    queryFn: () => api.getPolicy()
  });

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Policy rules, spending limits, and service allowlists."
      />

      {isLoading && (
        <LoadingState statusText="Loading settings..." cardsCount={2} />
      )}

      {Boolean(error) && (
        <ErrorState error={error} onRetry={() => void refetch()} />
      )}

      {!isLoading && !Boolean(error) && policy && (
        <div className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-medium">Spending limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Daily limit</span>
                <span className="text-sm font-semibold font-mono text-foreground">
                  <AnimatedNumber value={Number(policy.dailyBudgetSats)} /> sats
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Per payment limit</span>
                <span className="text-sm font-semibold font-mono text-foreground">
                  <AnimatedNumber value={Number(policy.perTxBudgetSats)} /> sats
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-medium">Allowed scopes</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {policy.scopes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {policy.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-foreground border border-border/60"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No scopes configured.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-medium">Allowed services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Mints
                </span>
                {policy.allowedMints.length > 0 ? (
                  <div className="space-y-1">
                    {policy.allowedMints.map((mint) => (
                      <div
                        key={mint}
                        className="text-xs font-mono text-foreground bg-secondary/50 p-2 rounded border border-border/40 break-all"
                      >
                        {mint}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No mints configured.</p>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Relays
                </span>
                {policy.allowedRelays.length > 0 ? (
                  <div className="space-y-1">
                    {policy.allowedRelays.map((relay) => (
                      <div
                        key={relay}
                        className="text-xs font-mono text-foreground bg-secondary/50 p-2 rounded border border-border/40 break-all"
                      >
                        {relay}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No relays configured.</p>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Esplora Servers
                </span>
                {policy.allowedEsplora.length > 0 ? (
                  <div className="space-y-1">
                    {policy.allowedEsplora.map((server) => (
                      <div
                        key={server}
                        className="text-xs font-mono text-foreground bg-secondary/50 p-2 rounded border border-border/40 break-all"
                      >
                        {server}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No Esplora servers configured.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
