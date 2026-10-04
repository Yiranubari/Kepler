import React, { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  type Node,
  type Edge
} from "reactflow";
import { type TaintGraph } from "@/lib/api";
import { layoutGraph } from "@/lib/graphLayout";
import { TaintNodeView, type TaintNodeData } from "./TaintNodeView";
import { TaintEdgeView, type TaintEdgeData } from "./TaintEdgeView";

export interface TaintGraphViewProps {
  graph: TaintGraph;
  onNodeSelect: (nodeId: string) => void;
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
}

const nodeTypes = {
  taintNode: TaintNodeView
};

const edgeTypes = {
  taintEdge: TaintEdgeView
};

export const TaintGraphView: React.FC<TaintGraphViewProps> = ({
  graph,
  onNodeSelect,
  selectedNodeId,
  highlightedNodeIds
}) => {
  const { nodes, edges } = useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return { nodes: [], edges: [] };
    }

    const positions = layoutGraph(graph.nodes, graph.edges || []);
    const positionMap = new Map(positions.map((p) => [p.id, p]));

    const flowNodes: Node<TaintNodeData>[] = graph.nodes.map((node) => {
      const pos = positionMap.get(node.id) ?? { x: 0, y: 0 };
      const isSelected = selectedNodeId === node.id;
      const isHighlighted = highlightedNodeIds.has(node.id);

      return {
        id: node.id,
        type: "taintNode",
        position: { x: pos.x, y: pos.y },
        data: {
          type: node.type,
          value: node.value,
          metadata: node.metadata,
          highlighted: isHighlighted
        },
        selected: isSelected
      };
    });

    const flowEdges: Edge<TaintEdgeData>[] = (graph.edges || []).map((edge) => {
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        type: "taintEdge",
        data: {
          relationship: edge.relationship,
          confidence: edge.confidence,
          evidence: edge.evidence
        }
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [graph, selectedNodeId, highlightedNodeIds]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<TaintNodeData>) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  return (
    <div className="w-full h-[560px] rounded-[12px] border border-white/[0.08] bg-card overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.4}
        maxZoom={1.6}
        panOnDrag={true}
        zoomOnScroll={true}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="hsl(var(--muted-foreground) / 0.15)"
        />
        <Controls
          position="bottom-right"
          showInteractive={false}
          className="border border-white/[0.08] rounded-[8px] overflow-hidden"
        />
      </ReactFlow>
    </div>
  );
};
