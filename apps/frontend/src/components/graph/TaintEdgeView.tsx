import React, { useState } from "react";
import {
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps
} from "reactflow";
import { relationshipLabel } from "@kepler/shared";

export interface TaintEdgeData {
  relationship?: string;
  confidence?: number;
  evidence?: unknown[];
  highlighted?: boolean;
}

export const TaintEdgeView: React.FC<EdgeProps<TaintEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  interactionWidth = 20,
  data
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const confidence = typeof data?.confidence === "number" ? data.confidence : 1;
  const relationship = data?.relationship ?? "";

  let stroke = "hsl(var(--muted-foreground))";
  let strokeOpacity = 0.4;
  let strokeWidth = 1;

  if (confidence >= 0.9) {
    stroke = "hsl(var(--foreground))";
    strokeOpacity = 0.85;
    strokeWidth = 2;
  } else if (confidence >= 0.6) {
    stroke = "hsl(var(--foreground))";
    strokeOpacity = 0.5;
    strokeWidth = 1.5;
  }

  const label = relationshipLabel(relationship);

  const isCryptographic =
    label === "Same payment code" ||
    label === "Same secret value" ||
    label === "Published by this user";

  const edgeStyle: React.CSSProperties = {
    ...style,
    stroke,
    strokeOpacity,
    strokeWidth,
    ...(isCryptographic ? { strokeDasharray: "6 4" } : {})
  };

  const showLabel = isHovered || Boolean(selected);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={interactionWidth}
        className="react-flow__edge-interaction cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <EdgeLabelRenderer>
        {showLabel && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "none"
            }}
            className="z-50 px-2.5 py-1 rounded-[6px] bg-card border border-white/[0.1] shadow-lg font-mono text-[11px] text-foreground whitespace-nowrap"
          >
            {label} · {confidence.toFixed(2)}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
};
