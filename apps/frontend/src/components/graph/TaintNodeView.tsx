import React from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import {
  DotArrow,
  DotClock,
  DotCoin,
  DotEye,
  DotGear,
  DotLink,
  DotLock,
  DotSend
} from "@/components/visual/icons";
import { cn } from "@/lib/utils";

export interface TaintNodeData {
  type: string;
  value: string;
  metadata?: Record<string, unknown>;
  highlighted?: boolean;
}

function getNodeIcon(type: string): React.FC<{ size?: number; className?: string }> {
  const normalized = (type || "").toLowerCase().replace(/[^a-z]/g, "");
  switch (normalized) {
    case "address":
      return DotCoin;
    case "txid":
      return DotArrow;
    case "invoice":
      return DotSend;
    case "paymenthash":
      return DotLock;
    case "preimage":
      return DotLock;
    case "npub":
      return DotEye;
    case "eventid":
      return DotClock;
    case "mint":
      return DotGear;
    case "relay":
      return DotLink;
    case "cashutoken":
      return DotCoin;
    default:
      return DotArrow;
  }
}

function formatNodeValue(type: string, value: string): string {
  if (!value) {
    return "";
  }
  const normalized = (type || "").toLowerCase().replace(/[^a-z]/g, "");
  if (
    normalized === "paymenthash" ||
    normalized === "txid" ||
    normalized === "eventid" ||
    normalized === "preimage" ||
    normalized === "npub"
  ) {
    if (value.length <= 16) {
      return value;
    }
    return `${value.slice(0, 8)}...${value.slice(-8)}`;
  }

  if (
    normalized === "address" ||
    normalized === "invoice" ||
    normalized === "mint" ||
    normalized === "relay"
  ) {
    if (value.length <= 18) {
      return value;
    }
    return `${value.slice(0, 12)}...${value.slice(-6)}`;
  }

  if (value.length <= 16) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

export const TaintNodeView: React.FC<NodeProps<TaintNodeData>> = ({
  data,
  selected
}) => {
  const isSelectedOrHighlighted = Boolean(selected || data?.highlighted);
  const IconComponent = getNodeIcon(data?.type ?? "");
  const formattedValue = formatNodeValue(data?.type ?? "", data?.value ?? "");

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between w-[180px] h-[56px] rounded-[8px] bg-card px-3 py-2 transition-[border-color,box-shadow] duration-150 select-none box-border",
        isSelectedOrHighlighted
          ? "border border-[hsl(var(--accent)/0.6)] [box-shadow:0_0_0_1px_hsl(var(--accent)/0.3)]"
          : "border border-white/[0.1] hover:border-white/[0.2]"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
      />
      <div className="flex items-center gap-1.5 min-w-0">
        <IconComponent size={16} className="text-muted-foreground shrink-0" />
        <span className="font-sans text-body-sm text-muted-foreground truncate leading-none">
          {data?.type ?? ""}
        </span>
      </div>
      <div className="min-w-0">
        <span
          className="font-mono text-[11px] text-foreground truncate block leading-none"
          title={data?.value}
        >
          {formattedValue}
        </span>
      </div>
    </div>
  );
};
