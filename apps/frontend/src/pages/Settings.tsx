import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type PolicyResponse } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
        <LoadingState statusText="Checking your payment..." cardsCount={2} />
      )}

      {error && (
        <ErrorState error={error} onRetry={() => void refetch()} />
      )}

      {!isLoading && !error && policy && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-sm text-muted-foreground">Daily limit</span>
                <span className="text-sm font-semibold font-mono text-foreground">
                  {Number(policy.dailyBudgetSats).toLocaleString()} sats
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Per payment limit</span>
                <span className="text-sm font-semibold font-mono text-foreground">
                  {Number(policy.perTxBudgetSats).toLocaleString()} sats
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allowed scopes</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
