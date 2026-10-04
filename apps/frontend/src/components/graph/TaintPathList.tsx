import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/EmptyState";
import { DotArrow } from "@/components/visual/icons";
import { listContainer, listItem, useReducedMotion } from "@/lib/motion";
import { type EvidencePath, type TaintGraph } from "@/lib/api";

export interface TaintPathListProps {
  paths: EvidencePath[];
  graph: TaintGraph;
  onPathHover: (pathIndex: number | null) => void;
}

function getShortTypeName(type: string): string {
  const normalized = (type || "").toLowerCase().replace(/[^a-z]/g, "");
  if (normalized === "paymenthash") return "PaymentHash";
  if (normalized === "eventid" || normalized === "event") return "Event";
  if (normalized === "cashutoken") return "Token";
  if (normalized === "address") return "Address";
  if (normalized === "invoice") return "Invoice";
  if (normalized === "txid") return "Txid";
  if (normalized === "preimage") return "Preimage";
  if (normalized === "npub") return "Npub";
  if (normalized === "mint") return "Mint";
  if (normalized === "relay") return "Relay";
  return type || "Node";
}

export const TaintPathList: React.FC<TaintPathListProps> = ({
  paths,
  graph,
  onPathHover
}) => {
  const shouldReduceMotion = useReducedMotion();

  const nodeTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    if (graph && graph.nodes) {
      for (const node of graph.nodes) {
        map.set(node.id, node.type);
      }
    }
    return map;
  }, [graph]);

  return (
    <Card className="rounded-[12px] border border-white/[0.08] bg-card p-5 md:p-8 shadow-none space-y-4">
      <h2 className="font-display text-heading-2 font-semibold tracking-[-0.01em] text-foreground">
        Paths
      </h2>

      {!paths || paths.length === 0 ? (
        <EmptyState
          icon={DotArrow}
          description="No paths connect the nodes in this payment."
          className="border-none bg-transparent p-4 my-0 max-w-full"
        />
      ) : (
        <motion.div
          variants={shouldReduceMotion ? undefined : listContainer(0.04)}
          initial={shouldReduceMotion ? false : "initial"}
          animate="animate"
          className="space-y-2"
        >
          {paths.map((path, index) => {
            const hopCount = path.nodes.length;
            const hopText = `${hopCount} ${hopCount === 1 ? "hop" : "hops"}`;
            const pathString = path.nodes
              .map((id) => getShortTypeName(nodeTypeMap.get(id) || ""))
              .join(" \u2192 ");
            const confidencePercent = Math.round(path.overallConfidence * 100);

            return (
              <motion.div
                key={index}
                variants={listItem}
                onMouseEnter={() => onPathHover(index)}
                onMouseLeave={() => onPathHover(null)}
                onFocus={() => onPathHover(index)}
                onBlur={() => onPathHover(null)}
                tabIndex={0}
                className="flex items-center justify-between gap-4 p-3 rounded-[8px] border border-white/[0.06] bg-card hover:bg-white/[0.04] hover:border-white/[0.12] transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span className="font-sans text-body-sm text-muted-foreground whitespace-nowrap min-w-[50px] shrink-0">
                  {hopText}
                </span>
                <span
                  className="font-sans text-body-sm text-foreground truncate min-w-0 flex-1 text-center"
                  title={pathString}
                >
                  {pathString}
                </span>
                <span className="font-sans font-medium text-body text-foreground whitespace-nowrap text-right shrink-0">
                  {confidencePercent}%
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </Card>
  );
};
