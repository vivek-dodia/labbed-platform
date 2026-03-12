"use client";

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  Handle,
  Position,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { parseContainerlabYAML } from "@/lib/yaml-parser";

interface Props {
  definition: string;
  selectedNode?: string | null;
  onSelectNode?: (name: string) => void;
  nodeStates?: Record<string, string>;
}

const NODE_W = 140;
const NODE_H = 48;

/* ── Node tier classification ── */
const ROUTER_PATTERNS = [/^r\d/i, /router/i, /spine/i, /core/i, /border/i, /gateway/i, /gw/i];
const ROUTER_IMAGES = ["frr", "frrouting", "srl", "ceos", "xrd", "vyos", "bird", "quagga", "gobgp"];

function isRouterNode(name: string, kind: string, image: string): boolean {
  if (ROUTER_PATTERNS.some((p) => p.test(name))) return true;
  if (kind === "router" || kind === "srl" || kind === "ceos" || kind === "vr-sros") return true;
  const imgLower = image.toLowerCase();
  if (ROUTER_IMAGES.some((r) => imgLower.includes(r))) return true;
  return false;
}

/* ── Tiered auto-layout ──
 * Routers on top row, other nodes on bottom row.
 * Each row is centered horizontally.
 */
const H_GAP = 60;
const V_GAP = 120;

function getLayoutedPositions(
  nodes: { id: string; kind: string; image: string }[],
): Record<string, { x: number; y: number }> {
  const routers: typeof nodes = [];
  const others: typeof nodes = [];

  nodes.forEach((n) => {
    if (isRouterNode(n.id, n.kind, n.image)) routers.push(n);
    else others.push(n);
  });

  const positions: Record<string, { x: number; y: number }> = {};

  // Layout a row centered at y, returns total width
  function layoutRow(row: typeof nodes, y: number) {
    const totalW = row.length * NODE_W + (row.length - 1) * H_GAP;
    const startX = -totalW / 2;
    row.forEach((n, i) => {
      positions[n.id] = { x: startX + i * (NODE_W + H_GAP), y };
    });
  }

  layoutRow(routers, 0);
  layoutRow(others, NODE_H + V_GAP);

  return positions;
}

/* ── Custom edge with hover labels ── */
function HoverEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const sourceLabel = (data as { sourceIface?: string })?.sourceIface || "";
  const targetLabel = (data as { targetIface?: string })?.targetIface || "";

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: "default" }}
      />
      <path
        d={edgePath}
        fill="none"
        stroke={(style?.stroke as string) || "rgba(0,0,0,0.25)"}
        strokeWidth={(style?.strokeWidth as number) || 1.5}
      />
      {hovered && sourceLabel && targetLabel && (
        <foreignObject
          x={labelX - 70}
          y={labelY - 14}
          width={140}
          height={28}
          style={{ overflow: "visible", pointerEvents: "none" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#000",
              color: "#79f673",
              fontSize: "9px",
              fontFamily: "'Space Mono', monospace",
              padding: "3px 8px",
              whiteSpace: "nowrap",
              width: "fit-content",
              margin: "0 auto",
              boxShadow: "2px 2px 0 rgba(0,0,0,0.15)",
            }}
          >
            {sourceLabel} ↔ {targetLabel}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

/* ── Custom node ── */
function TopoNode({ data }: { data: { label: string; kind: string; image: string; selected: boolean; state: string } }) {
  const sel = data.selected;
  const faded = data.state === "exited" || data.state === "failed";

  return (
    <>
      <Handle type="target" position={Position.Top} id="tt" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="source" position={Position.Top} id="ts" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="target" position={Position.Left} id="lt" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="source" position={Position.Left} id="ls" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="target" position={Position.Right} id="rt" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="source" position={Position.Right} id="rs" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <div
        style={{
          width: NODE_W,
          height: NODE_H,
          background: sel ? "#000" : "#79f673",
          border: sel ? "2px solid #000" : faded ? "1px dashed rgba(0,0,0,0.3)" : "1.5px solid #000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          opacity: faded ? 0.5 : 1,
          boxShadow: sel ? "3px 3px 0 rgba(0,0,0,0.15)" : "2px 2px 0 rgba(0,0,0,0.08)",
        }}
      >
        <div style={{
          fontSize: "12px",
          fontWeight: 700,
          textTransform: "uppercase",
          fontFamily: "'Manrope', sans-serif",
          color: sel ? "#79f673" : "#000",
          letterSpacing: "0.04em",
        }}>
          {data.label}
        </div>
        <div style={{
          fontSize: "9px",
          fontFamily: "'Space Mono', monospace",
          color: sel ? "rgba(121,246,115,0.5)" : "rgba(0,0,0,0.4)",
          marginTop: 2,
        }}>
          {data.kind} · {data.image}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="bs" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="target" position={Position.Bottom} id="bt" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
    </>
  );
}

const nodeTypes: NodeTypes = { topo: TopoNode };
const edgeTypes: EdgeTypes = { hover: HoverEdge };

/* ── Inner component ── */
function TopologyCanvasInner({ definition, selectedNode, onSelectNode, nodeStates }: Props) {
  const initial = useMemo(() => {
    const topo = parseContainerlabYAML(definition);

    const edgeData = topo.links.map((l, i) => ({
      id: `e-${i}`,
      source: l.a.node,
      target: l.b.node,
      sourceIface: l.a.iface,
      targetIface: l.b.iface,
    }));

    const positions = getLayoutedPositions(
      topo.nodes.map((n) => ({ id: n.name, kind: n.kind, image: n.image })),
    );

    const rfNodes: Node[] = topo.nodes.map((n) => ({
      id: n.name,
      type: "topo",
      position: positions[n.name] || { x: 0, y: 0 },
      data: {
        label: n.name,
        kind: n.kind,
        image: n.image.split(":")[0].split("/").pop() || "",
        selected: n.name === selectedNode,
        state: nodeStates?.[n.name] || "",
      },
    }));

    // Assign handles based on relative node positions
    const rfEdges: Edge[] = edgeData.map((e) => {
      const sPos = positions[e.source] || { x: 0, y: 0 };
      const tPos = positions[e.target] || { x: 0, y: 0 };
      const dx = tPos.x - sPos.x;
      const dy = tPos.y - sPos.y;

      let sourceHandle: string;
      let targetHandle: string;

      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical: source below target or above
        if (dy > 0) {
          sourceHandle = "bs"; targetHandle = "tt";
        } else {
          sourceHandle = "ts"; targetHandle = "bt";
        }
      } else {
        // Horizontal
        if (dx > 0) {
          sourceHandle = "rs"; targetHandle = "lt";
        } else {
          sourceHandle = "ls"; targetHandle = "rt";
        }
      }

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle,
        targetHandle,
        type: "hover",
        data: {
          sourceIface: e.sourceIface,
          targetIface: e.targetIface,
        },
        style: { stroke: "rgba(0,0,0,0.25)", strokeWidth: 1.5 },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition]);

  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges] = useEdgesState(initial.edges);

  const styledNodes = useMemo(
    () => nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        selected: n.id === selectedNode,
        state: nodeStates?.[n.id] || "",
      },
    })),
    [nodes, selectedNode, nodeStates],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onSelectNode?.(node.id),
    [onSelectNode],
  );

  const onPaneClick = useCallback(
    () => onSelectNode?.(""),
    [onSelectNode],
  );

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      panOnDrag
      zoomOnScroll
      minZoom={0.3}
      maxZoom={2}
      style={{ background: "#79f673" }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={0.8} color="rgba(0,0,0,0.06)" />
    </ReactFlow>
  );
}

export default function TopologyCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <TopologyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
