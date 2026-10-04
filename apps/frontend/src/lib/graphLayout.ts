import dagre from "dagre";
import { type TaintNode, type TaintEdge } from "@/lib/api";

export interface GraphNodePosition {
  id: string;
  x: number;
  y: number;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

export function layoutGraph(
  nodes: TaintNode[],
  edges: TaintEdge[]
): GraphNodePosition[] {
  if (nodes.length === 0) {
    return [];
  }

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: "LR",
    nodesep: 60,
    ranksep: 120
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const validNodeIds = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    if (validNodeIds.has(edge.from) && validNodeIds.has(edge.to)) {
      graph.setEdge(edge.from, edge.to);
    }
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const dagreNode = graph.node(node.id);
    return {
      id: node.id,
      x: dagreNode ? dagreNode.x - NODE_WIDTH / 2 : 0,
      y: dagreNode ? dagreNode.y - NODE_HEIGHT / 2 : 0
    };
  });
}
