import React from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { relationshipLabel } from "@kepler/shared";
import { useReducedMotion } from "@/lib/motion";
import { CopyButton } from "@/components/ui/copy-button";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { type TaintNode, type TaintEdge } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface TaintNodeDetailProps {
  node: TaintNode | null;
  onClose: () => void;
  connectedEdges?: TaintEdge[];
  edges?: TaintEdge[];
  className?: string;
}

function formatShortDate(date: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const month = months[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month} ${day}, ${year}, ${hours}:${minutes} UTC`;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (Math.abs(diffSec) < 60) {
    return diffSec >= 0 ? "just now" : "in a moment";
  }
  const diffMin = Math.floor(Math.abs(diffSec) / 60);
  if (diffMin < 60) {
    return diffSec >= 0 ? `${diffMin}m ago` : `in ${diffMin}m`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return diffSec >= 0 ? `${diffHours}h ago` : `in ${diffHours}h`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return diffSec >= 0 ? `${diffDays}d ago` : `in ${diffDays}d`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return diffSec >= 0 ? `${diffMonths}mo ago` : `in ${diffMonths}mo`;
  }
  const diffYears = Math.floor(diffDays / 365);
  return diffSec >= 0 ? `${diffYears}y ago` : `in ${diffYears}y`;
}

function renderMetadataValue(key: string, val: unknown): React.ReactNode {
  const isDateKey =
    key === "createdAt" ||
    key === "blockTime" ||
    key === "timestamp" ||
    key === "expiresAt";

  if (
    isDateKey &&
    (typeof val === "number" ||
      (typeof val === "string" && /^\d{9,12}$/.test(val)))
  ) {
    const sec = Number(val);
    const date = new Date(sec * 1000);
    return (
      <span className="font-sans text-body-sm text-muted-foreground block">
        {formatRelativeTime(date)} · {formatShortDate(date)}
      </span>
    );
  }

  if (
    key === "amountMsat" &&
    (typeof val === "number" ||
      typeof val === "bigint" ||
      (typeof val === "string" && /^-?\d+$/.test(val)))
  ) {
    const sats = Math.round(Number(val) / 1000);
    return (
      <span className="font-sans text-body-sm text-foreground block">
        <AnimatedNumber value={sats} /> sats
      </span>
    );
  }

  if (
    key.endsWith("Sats") &&
    (typeof val === "number" ||
      typeof val === "bigint" ||
      (typeof val === "string" && /^-?\d+$/.test(val)))
  ) {
    const sats = Math.round(Number(val));
    return (
      <span className="font-sans text-body-sm text-foreground block">
        <AnimatedNumber value={sats} /> sats
      </span>
    );
  }

  if (
    key.endsWith("Msat") &&
    (typeof val === "number" ||
      typeof val === "bigint" ||
      (typeof val === "string" && /^-?\d+$/.test(val)))
  ) {
    const msat = Math.round(Number(val));
    return (
      <span className="font-sans text-body-sm text-foreground block">
        <AnimatedNumber value={msat} /> msats
      </span>
    );
  }

  if (typeof val === "string" && /^[0-9a-fA-F]{40,}$/.test(val)) {
    const truncated = `${val.slice(0, 12)}...${val.slice(-8)}`;
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-body-sm text-foreground">
          {truncated}
        </span>
        <CopyButton value={val} ariaLabel="Copy value" />
      </div>
    );
  }

  if (typeof val === "object" && val !== null) {
    return (
      <pre className="font-mono text-xs text-muted-foreground p-2 rounded-[6px] bg-white/[0.02] border border-white/[0.06] overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(val, null, 2)}
      </pre>
    );
  }

  return (
    <span className="font-sans text-body-sm text-foreground block break-all">
      {String(val ?? "")}
    </span>
  );
}

export const TaintNodeDetail: React.FC<TaintNodeDetailProps> = ({
  node,
  onClose,
  connectedEdges,
  edges,
  className
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (!node) {
    return null;
  }

  const metadataEntries = Object.entries(node.metadata || {});

  const edgeList =
    connectedEdges ??
    (edges
      ? edges.filter((e) => e.from === node.id || e.to === node.id)
      : []);

  return (
    <motion.div
      key={node.id}
      initial={
        shouldReduceMotion
          ? { opacity: 1 }
          : { x: "100%", opacity: 0 }
      }
      animate={{
        x: 0,
        opacity: 1,
        transition: shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.2, ease: "easeOut" }
      }}
      exit={
        shouldReduceMotion
          ? { opacity: 0, transition: { duration: 0 } }
          : { x: "100%", opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }
      }
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto z-50 w-full max-h-[75vh] rounded-t-[16px] border-t border-white/[0.08] bg-card flex flex-col overflow-y-auto p-5 space-y-5 shadow-2xl md:absolute md:top-0 md:right-0 md:left-auto md:bottom-auto md:w-[360px] md:h-full md:max-h-full md:rounded-none md:border-l md:border-t-0",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-sans text-body-sm text-muted-foreground">
          {node.type}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="p-1 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      <div className="space-y-2">
        <div className="font-mono text-[12px] text-foreground break-all select-all leading-relaxed">
          {node.value}
        </div>
        <div>
          <CopyButton value={node.value} ariaLabel="Copy value" />
        </div>
      </div>

      <div className="border-t border-white/[0.08]" />

      {metadataEntries.length > 0 && (
        <div className="space-y-3">
          <div className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
            Metadata
          </div>
          <div className="space-y-3">
            {metadataEntries.map(([key, val]) => (
              <div key={key} className="space-y-1">
                <span className="font-sans text-body-sm text-muted-foreground block">
                  {key}
                </span>
                {renderMetadataValue(key, val)}
              </div>
            ))}
          </div>
        </div>
      )}

      {edgeList.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="border-t border-white/[0.08] pt-3">
            <span className="font-sans text-label-caps uppercase text-muted-foreground font-semibold">
              Connected edges
            </span>
          </div>
          <div className="space-y-1.5">
            {edgeList.map((edge) => {
              const label = relationshipLabel(edge.relationship);
              return (
                <div
                  key={edge.id}
                  className="flex items-center justify-between p-2 rounded-[6px] bg-white/[0.02] border border-white/[0.06] text-left select-none"
                >
                  <span
                    className="font-sans text-xs text-foreground truncate max-w-[200px]"
                    title={label}
                  >
                    {label}
                  </span>
                  <span className="font-display font-medium text-xs text-muted-foreground tabular-nums">
                    {edge.confidence.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};
