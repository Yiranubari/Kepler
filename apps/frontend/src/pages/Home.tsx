import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Scenario, Policy } from "@kepler/shared";
import {
  listScenarios,
  getPolicy,
  getAppConfig,
  toScenario,
  toPolicy,
  type AppConfigResponse,
  ClientError
} from "@/lib/api";
import { useWallet } from "@/lib/wallet";
import { useReducedMotion } from "@/lib/motion";
import {
  GreetingRow,
  ActivityCard,
  LimitsCard,
  NetworkCard,
  ServiceBanner
} from "@/components/dashboard";

export const HomePage: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const { address, isConnected } = useWallet();

  const configQuery = useQuery<AppConfigResponse, ClientError>({
    queryKey: ["appConfig"],
    queryFn: getAppConfig
  });

  const currentNetwork = configQuery.data?.network;

  const scenariosQuery = useQuery<Scenario[], ClientError>({
    queryKey: ["scenarios", 5, 0, currentNetwork],
    queryFn: async () => {
      const raw = await listScenarios(5, 0, currentNetwork);
      return raw.map(toScenario);
    }
  });

  const policyQuery = useQuery<Policy, ClientError>({
    queryKey: ["policy"],
    queryFn: async () => {
      const raw = await getPolicy();
      return toPolicy(raw);
    }
  });

  const scenariosServiceDown =
    scenariosQuery.isError &&
    scenariosQuery.error?.code === "SERVICE_UNAVAILABLE";
  const policyServiceDown =
    policyQuery.isError &&
    policyQuery.error?.code === "SERVICE_UNAVAILABLE";
  const configServiceDown =
    configQuery.isError &&
    configQuery.error?.code === "SERVICE_UNAVAILABLE";
  const allFailed = scenariosServiceDown && policyServiceDown && configServiceDown;

  const refetchAll = (): void => {
    void scenariosQuery.refetch();
    void policyQuery.refetch();
    void configQuery.refetch();
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
      className="w-full space-y-16 md:space-y-24"
    >
      <ServiceBanner visible={allFailed} onRetry={refetchAll} />
      <GreetingRow
        address={address ?? null}
        isConnected={isConnected}
      />
      <ActivityCard
        scenarios={scenariosQuery.data}
        isLoading={scenariosQuery.isLoading}
        error={allFailed ? null : scenariosQuery.error}
        onRetry={() => void scenariosQuery.refetch()}
      />
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 items-stretch">
        <LimitsCard
          policy={policyQuery.data}
          isLoading={policyQuery.isLoading}
          error={allFailed ? null : policyQuery.error}
          onRetry={() => void policyQuery.refetch()}
        />
        <NetworkCard
          network={currentNetwork}
          isLoading={configQuery.isLoading}
          error={allFailed ? null : configQuery.error}
          onRetry={() => void configQuery.refetch()}
        />
      </div>
    </motion.div>
  );
};
