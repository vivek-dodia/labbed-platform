"use client";

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
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

export interface LinkEndpoint {
  node: string;
  iface: string;
}

interface Props {
  definition: string;
  selectedNode?: string | null;
  onSelectNode?: (name: string) => void;
  onLinkClick?: (a: LinkEndpoint, b: LinkEndpoint) => void;
  nodeStates?: Record<string, string>;
}

const NODE_W = 140;
const NODE_H = 48;

/* ── Node tier classification ── */
type Tier = "router" | "server" | "client";

const ROUTER_PATTERNS = [/^r\d/i, /router/i, /spine/i, /core/i, /border/i, /gateway/i, /gw/i];
const ROUTER_IMAGES = ["frr", "frrouting", "srl", "ceos", "xrd", "vyos", "bird", "quagga", "gobgp"];
const SERVER_PATTERNS = [/^s\d/i, /^srv/i, /server/i, /dns/i, /dhcp/i, /web/i, /http/i, /ntp/i, /radius/i, /syslog/i, /monitor/i];
const SERVER_IMAGES = ["dnsmasq", "nginx", "apache", "bind9", "kea", "freeradius", "syslog", "grafana", "prometheus"];
const CLIENT_PATTERNS = [/^pc/i, /^h\d/i, /^host/i, /client/i, /endpoint/i, /user/i, /workstation/i];

function classifyNode(name: string, kind: string, image: string): Tier {
  if (ROUTER_PATTERNS.some((p) => p.test(name))) return "router";
  if (kind === "router" || kind === "srl" || kind === "ceos" || kind === "vr-sros") return "router";
  const imgLower = image.toLowerCase();
  if (ROUTER_IMAGES.some((r) => imgLower.includes(r))) return "router";

  if (SERVER_PATTERNS.some((p) => p.test(name))) return "server";
  if (SERVER_IMAGES.some((r) => imgLower.includes(r))) return "server";

  if (CLIENT_PATTERNS.some((p) => p.test(name))) return "client";

  // Default: if not router, treat as client (bottom)
  return "client";
}

/* ── Tiered auto-layout ── */
const H_GAP = 60;
const V_GAP = 120;

function getLayoutedPositions(
  nodes: { id: string; kind: string; image: string }[],
): Record<string, { x: number; y: number }> {
  const tiers: Record<Tier, typeof nodes> = { router: [], server: [], client: [] };

  nodes.forEach((n) => {
    tiers[classifyNode(n.id, n.kind, n.image)].push(n);
  });

  const positions: Record<string, { x: number; y: number }> = {};

  function layoutRow(row: typeof nodes, y: number) {
    const totalW = row.length * NODE_W + (row.length - 1) * H_GAP;
    const startX = -totalW / 2;
    row.forEach((n, i) => {
      positions[n.id] = { x: startX + i * (NODE_W + H_GAP), y };
    });
  }

  let y = 0;
  const order: Tier[] = ["router", "server", "client"];
  order.forEach((tier) => {
    if (tiers[tier].length > 0) {
      layoutRow(tiers[tier], y);
      y += NODE_H + V_GAP;
    }
  });

  return positions;
}

/* ── Custom edge with hover labels + click-to-capture ── */
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
  const onClickCapture = (data as { onClickCapture?: () => void })?.onClickCapture;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onClickCapture?.(); }}
      style={{ cursor: onClickCapture ? "crosshair" : "default" }}
    >
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: onClickCapture ? "crosshair" : "default" }}
      />
      <path
        d={edgePath}
        fill="none"
        stroke={hovered ? "rgba(0,0,0,0.6)" : ((style?.stroke as string) || "rgba(0,0,0,0.25)")}
        strokeWidth={hovered ? 3 : ((style?.strokeWidth as number) || 1.5)}
      />
      {hovered && sourceLabel && targetLabel && (
        <foreignObject
          x={labelX - 80}
          y={labelY - 14}
          width={160}
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
            {sourceLabel} \u2194 {targetLabel} {onClickCapture ? "\u00b7 SNIFF" : ""}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

/* ── Custom node ── */
function getStatusColor(state: string): string {
  switch (state) {
    case "running": return "#27c93f";
    case "failed": return "#ff5f56";
    case "deploying": case "starting": return "#ffbd2e";
    case "stopped": case "exited": return "#888";
    default: return "transparent";
  }
}

function TopoNode({ data }: { data: { label: string; kind: string; image: string; selected: boolean; state: string } }) {
  const sel = data.selected;
  const faded = data.state === "exited" || data.state === "failed";
  const statusColor = getStatusColor(data.state);

  return (
    <>
      <Handle type="target" position={Position.Top} id="tt" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="source" position={Position.Top} id="ts" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="target" position={Position.Left} id="lt" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="source" position={Position.Left} id="ls" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="target" position={Position.Right} id="rt" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="source" position={Position.Right} id="rs" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <div style={{ position: "relative" }}>
        {statusColor !== "transparent" && (
          <div style={{
            position: "absolute",
            top: -3,
            right: -3,
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: statusColor,
            border: "1.5px solid #000",
            zIndex: 10,
          }} />
        )}
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
            {data.kind} \u00b7 {data.image}
          </div>
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
function TopologyCanvasInner({ definition, selectedNode, onSelectNode, onLinkClick, nodeStates }: Props) {
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

    const rfEdges: Edge[] = edgeData.map((e) => {
      const sPos = positions[e.source] || { x: 0, y: 0 };
      const tPos = positions[e.target] || { x: 0, y: 0 };
      const dx = tPos.x - sPos.x;
      const dy = tPos.y - sPos.y;

      let sourceHandle: string;
      let targetHandle: string;

      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0) {
          sourceHandle = "bs"; targetHandle = "tt";
        } else {
          sourceHandle = "ts"; targetHandle = "bt";
        }
      } else {
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

    return { nodes: rfNodes, edges: rfEdges, edgeData };
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

  // Inject onClickCapture into edge data when onLinkClick is provided
  const styledEdges = useMemo(
    () => edges.map((e) => {
      const edgeInfo = initial.edgeData.find((ed) => ed.id === e.id);
      return {
        ...e,
        data: {
          ...e.data,
          onClickCapture: onLinkClick && edgeInfo ? () => {
            onLinkClick(
              { node: edgeInfo.source, iface: edgeInfo.sourceIface },
              { node: edgeInfo.target, iface: edgeInfo.targetIface },
            );
          } : undefined,
        },
      };
    }),
    [edges, onLinkClick, initial.edgeData],
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
      edges={styledEdges}
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
      <MiniMap
        nodeColor={(n) => {
          const state = (n.data as { state?: string })?.state || "";
          if (state === "running") return "#27c93f";
          if (state === "failed") return "#ff5f56";
          if (state === "deploying" || state === "starting") return "#ffbd2e";
          return "#000";
        }}
        maskColor="rgba(121,246,115,0.15)"
        style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.15)" }}
        pannable
        zoomable
      />
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
