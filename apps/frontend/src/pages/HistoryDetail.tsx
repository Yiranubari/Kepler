import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  getScenario,
  getTaintGraph,
  listEvidenceBundles,
  type ScenarioResponse,
  type TaintGraph,
  type EvidenceBundleWire,
  ClientError
} from "@/lib/api";
import { networkLabel } from "@/lib/networkLabel";
import { EmptyState } from "@/components/layout/EmptyState";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { DotClock } from "@/components/visual/icons/DotClock";
import { DotShield } from "@/components/visual/icons/DotShield";
import { fadeInUp, useReducedMotion } from "@/lib/motion";
import {
  TaintGraphView,
  TaintNodeDetail,
  TaintPathList,
  TaintGraphExplanation
} from "@/components/graph";
import {
  EvidenceClaimCard,
  EvidenceVerify,
  EvidenceRawData,
  EvidenceSteps
} from "@/components/proof";
import { claimTypeLabel } from "@/components/proof/EvidenceClaimCard";

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) {
    return "just now";
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }
  return date.toLocaleDateString();
};

interface EvidenceBundleGroupProps {
  bundle: EvidenceBundleWire;
}

const EvidenceBundleGroup: React.FC<EvidenceBundleGroupProps> = ({
  bundle
}) => {
  return (
    <div className="space-y-4">
      <EvidenceClaimCard bundle={bundle} />
      <EvidenceVerify bundle={bundle} />
      <EvidenceRawData refs={bundle.rawDataRefs} />
      <EvidenceSteps steps={bundle.verificationSteps} />
    </div>
  );
};

export const HistoryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const scenarioId = id ?? "";
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredPathIndex, setHoveredPathIndex] = useState<number | null>(null);

  const {
    data: scenario,
    isLoading,
    error,
    refetch
  } = useQuery<ScenarioResponse, ClientError>({
    queryKey: ["scenario", id],
    queryFn: () => {
      if (!id) {
        throw new Error("Missing payment identifier");
      }
      return getScenario(id);
    },
    enabled: Boolean(id)
  });

  const {
    data: graph,
    isLoading: isGraphLoading,
    error: graphError,
    refetch: refetchGraph
  } = useQuery<TaintGraph | null, ClientError>({
    queryKey: ["taintGraph", scenarioId],
    queryFn: () => getTaintGraph(scenarioId),
    enabled: Boolean(scenarioId)
  });

  const {
    data: bundles,
    isLoading: isBundlesLoading,
    error: bundlesError,
    refetch: refetchBundles
  } = useQuery<EvidenceBundleWire[], ClientError>({
    queryKey: ["evidenceBundles", scenarioId],
    queryFn: () => listEvidenceBundles(scenarioId),
    enabled: Boolean(scenarioId)
  });

  const highlightedNodeIds = useMemo<Set<string>>(() => {
    if (
      hoveredPathIndex === null ||
      !graph ||
      !graph.paths ||
      !graph.paths[hoveredPathIndex]
    ) {
      return new Set<string>();
    }
    return new Set<string>(graph.paths[hoveredPathIndex].nodes);
  }, [hoveredPathIndex, graph]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !graph || !graph.nodes) {
      return null;
    }
    return graph.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, graph]);

  const connectedEdges = useMemo(() => {
    if (!selectedNodeId || !graph || !graph.edges) {
      return [];
    }
    return graph.edges.filter(
      (e) => e.from === selectedNodeId || e.to === selectedNodeId
    );
  }, [selectedNodeId, graph]);

  const truncatedId = id
    ? id.length > 20
      ? `${id.slice(0, 10)}...${id.slice(-8)}`
      : id
    : "";

  const isNotFoundError = error && (error.code === "NOT_FOUND" || error.code === "SCENARIO_NOT_FOUND");

  const targetString = scenario
    ? typeof scenario.target.payload.invoice === "string"
      ? scenario.target.payload.invoice
      : typeof scenario.target.payload.address === "string"
      ? scenario.target.payload.address
      : typeof scenario.target.payload.mint === "string"
      ? scenario.target.payload.mint
      : typeof scenario.target.payload.request === "string"
      ? scenario.target.payload.request
      : typeof scenario.target.payload.destination === "string"
      ? scenario.target.payload.destination
      : ""
    : "";

  const getAmountSats = (): number | null => {
    if (!scenario) return null;
    if (
      typeof scenario.target.payload.amountSats === "number" ||
      typeof scenario.target.payload.amountSats === "string"
    ) {
      const parsed = Number(scenario.target.payload.amountSats);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (
      typeof scenario.target.payload.amountMsat === "number" ||
      typeof scenario.target.payload.amountMsat === "string"
    ) {
      const parsed = Math.floor(Number(scenario.target.payload.amountMsat) / 1000);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return null;
  };

  const amountSats = getAmountSats();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
      className="w-full space-y-8 md:space-y-12 max-w-3xl lg:max-w-4xl"
    >
      {isLoading ? (
        <div className="space-y-8">
          <div className="space-y-2 mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="w-full py-6 border-y border-white/[0.08] flex items-center justify-between">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </Card>
        </div>
      ) : isNotFoundError || (!scenario && !error) ? (
        <EmptyState
          icon={DotClock}
          title="Payment not found"
          description="We could not find this payment. Check your history."
          actionLabel="Back to history"
          onAction={() => navigate("/app/history")}
        />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : scenario ? (
        <>
          <div className="space-y-2">
            <h1 className="font-display text-heading-1 font-bold tracking-[-0.02em] text-foreground">
              Payment details
            </h1>
            <p className="font-mono text-sm text-muted-foreground">
              {truncatedId}
            </p>
          </div>

          <motion.div
            variants={fadeInUp}
            initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
            animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
            className="w-full py-6 border-y border-white/[0.08] flex items-center justify-between"
          >
            <StatusBadge status={scenario.status} />
            <span className="font-sans text-xs text-muted-foreground">
              {formatRelativeTime(scenario.createdAt)}
            </span>
          </motion.div>

          <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4 divide-y divide-white/[0.06]">
            <div className="flex flex-col gap-1 text-left first:pt-0">
              <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
                Target
              </span>
              <div className="flex items-center gap-2">
                <span className="font-sans font-medium text-sm text-foreground capitalize">
                  {scenario.target.kind}
                </span>
                {targetString && (
                  <>
                    <span className="font-mono text-xs text-foreground break-all">
                      {targetString}
                    </span>
                    <CopyButton value={targetString} ariaLabel="Copy target" />
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center py-3 text-left">
              <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
                Amount
              </span>
              {amountSats !== null ? (
                <span className="font-display font-medium text-base text-foreground tabular-nums">
                  <AnimatedNumber value={amountSats} /> sats
                </span>
              ) : (
                <span className="font-sans text-sm text-muted-foreground">
                  Not specified
                </span>
              )}
            </div>

            <div className="flex justify-between items-center py-3 text-left">
              <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
                Status
              </span>
              <StatusBadge status={scenario.status} />
            </div>

            <div className="flex justify-between items-center py-3 text-left">
              <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
                Network
              </span>
              <span className="font-sans text-sm text-foreground">
                {networkLabel(scenario.network || "testnet")}
              </span>
            </div>
          </Card>

          {isGraphLoading ? (
            <Card className="rounded-[12px] border border-white/[0.08] bg-card p-8 shadow-none flex flex-col items-center justify-center space-y-3 min-h-[240px]">
              <Spinner size="md" className="text-muted-foreground" />
              <span className="font-sans text-body-sm text-muted-foreground">
                Loading the privacy analysis...
              </span>
            </Card>
          ) : graphError ? (
            <ErrorState error={graphError} onRetry={() => void refetchGraph()} />
          ) : !graph ? (
            <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none">
              <EmptyState
                icon={DotShield}
                description="No privacy analysis yet. Analysis runs when a payment is prepared."
                className="border-none bg-transparent p-0 my-0 max-w-full"
              />
            </Card>
          ) : (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
              className="space-y-6"
            >
              <div className="relative w-full rounded-[12px] overflow-hidden">
                <TaintGraphView
                  graph={graph}
                  onNodeSelect={(nodeId) => setSelectedNodeId(nodeId)}
                  selectedNodeId={selectedNodeId}
                  highlightedNodeIds={highlightedNodeIds}
                />
                {graph.nodes.length === 0 && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-sm">
                    <EmptyState
                      icon={DotShield}
                      description="No privacy analysis yet. Analysis runs when a payment is prepared."
                      className="border-none bg-transparent p-0 my-0 max-w-full"
                    />
                  </div>
                )}
                <AnimatePresence>
                  {selectedNode && (
                    <>
                      <div
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                        onClick={() => setSelectedNodeId(null)}
                      />
                      <TaintNodeDetail
                        node={selectedNode}
                        connectedEdges={connectedEdges}
                        onClose={() => setSelectedNodeId(null)}
                      />
                    </>
                  )}
                </AnimatePresence>
              </div>

              <TaintPathList
                paths={graph.paths || []}
                graph={graph}
                onPathHover={setHoveredPathIndex}
              />

              <TaintGraphExplanation scenarioId={scenarioId} />

              <p className="font-sans text-body-sm text-muted-foreground text-center">
                Click any node to see its details. Hover a path to highlight the nodes on it.
              </p>
            </motion.div>
          )}

          {isBundlesLoading ? (
            <Card className="rounded-[12px] border border-white/[0.08] bg-card p-8 shadow-none flex flex-col items-center justify-center space-y-3 min-h-[240px]">
              <Spinner size="md" className="text-muted-foreground" />
              <span className="font-sans text-body-sm text-muted-foreground">
                Loading the evidence bundle...
              </span>
            </Card>
          ) : bundlesError ? (
            <ErrorState
              error={bundlesError}
              onRetry={() => void refetchBundles()}
            />
          ) : !bundles || bundles.length === 0 ? (
            <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none">
              <EmptyState
                icon={DotShield}
                title="No evidence bundle yet"
                description="The evidence bundle is created when a payment decision is made."
                className="border-none bg-transparent p-0 my-0 max-w-full"
              />
            </Card>
          ) : bundles.length === 1 ? (
            <EvidenceBundleGroup bundle={bundles[0]} />
          ) : (
            <div className="space-y-24">
              {bundles.map((bundle) => (
                <div key={bundle.id} className="space-y-4">
                  <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
                    {claimTypeLabel(bundle.claim["type"])}
                  </h2>
                  <EvidenceBundleGroup bundle={bundle} />
                </div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="ghost"
              size="md"
              onClick={() => navigate("/app/history")}
              className="w-fit"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span>Back to history</span>
            </Button>
          </div>
        </>
      ) : null}
    </motion.div>
  );
};
