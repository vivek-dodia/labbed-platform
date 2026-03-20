"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NodeResponse } from "@/types/api";

const FONT = "'Manrope', sans-serif";
const MONO = "'Space Mono', monospace";
const GREEN = "#79f673";

/* ── VPC group node ── */
function VpcNode({ data }: { data: Record<string, unknown> }) {
  const label = data.label as string;
  const cidr = data.cidr as string;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{
        position: "absolute", top: 8, left: 12,
        display: "flex", alignItems: "center", gap: 6,
        pointerEvents: "none",
      }}>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={2.5}>
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <path d="M2 8h20M8 2v20" />
        </svg>
        <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: GREEN, fontFamily: FONT }}>VPC</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#fff", fontFamily: FONT }}>{label}</span>
        {cidr && <span style={{ fontSize: "0.6rem", fontFamily: MONO, color: GREEN, opacity: 0.5 }}>{cidr}</span>}
      </div>
      <Handle id="top" type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle id="top" type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle id="bottom" type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle id="left" type="source" position={Position.Left} style={{ opacity: 0 }} />
      <Handle id="left" type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle id="right" type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle id="right" type="target" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

/* ── Resource node ── */
const ICON_MAP: Record<string, { icon: string; color: string }> = {
  aws_subnet:                  { icon: "SN",  color: "#22c55e" },
  aws_internet_gateway:        { icon: "IGW", color: "#eab308" },
  aws_nat_gateway:             { icon: "NAT", color: "#f97316" },
  aws_route_table:             { icon: "RT",  color: "#a855f7" },
  aws_route_table_association: { icon: "RTA", color: "#8b5cf6" },
  aws_security_group:          { icon: "SG",  color: "#ec4899" },
  aws_eip:                     { icon: "EIP", color: "#f97316" },
  aws_vpc_peering_connection:  { icon: "PCX", color: "#38bdf8" },
};

function ResourceNode({ data }: { data: Record<string, unknown> }) {
  const kind = data.kind as string;
  const label = data.label as string;
  const detail = data.detail as string;
  const rid = data.resourceId as string;
  const selected = data.selected as boolean;
  const info = ICON_MAP[kind] || { icon: "?", color: "#94a3b8" };

  return (
    <div style={{
      minWidth: 170, background: selected ? "rgba(121,246,115,0.15)" : "rgba(0,0,0,0.75)",
      border: `1.5px solid ${selected ? GREEN : info.color + "88"}`,
      borderRadius: 6, padding: "8px 12px", fontFamily: FONT,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: "0.5rem", fontWeight: 800, color: "#000", background: info.color, borderRadius: 3, padding: "1px 5px", fontFamily: MONO, lineHeight: 1.4 }}>{info.icon}</span>
        <span style={{ fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: info.color, opacity: 0.8 }}>
          {kind.replace("aws_", "").replace(/_/g, " ")}
        </span>
      </div>
      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>{label}</div>
      {detail && <div style={{ fontSize: "0.6rem", fontFamily: MONO, color: GREEN, opacity: 0.5, marginTop: 2 }}>{detail}</div>}
      {rid && <div style={{ fontSize: "0.5rem", fontFamily: MONO, color: "#fff", opacity: 0.2, marginTop: 1 }}>{rid.length > 26 ? rid.slice(0, 26) + "..." : rid}</div>}
      <Handle id="top" type="source" position={Position.Top} style={{ background: info.color, width: 5, height: 5, border: "none" }} />
      <Handle id="top" type="target" position={Position.Top} style={{ background: info.color, width: 5, height: 5, border: "none" }} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={{ background: info.color, width: 5, height: 5, border: "none" }} />
      <Handle id="bottom" type="target" position={Position.Bottom} style={{ background: info.color, width: 5, height: 5, border: "none" }} />
      <Handle id="left" type="source" position={Position.Left} style={{ background: info.color, width: 5, height: 5, border: "none" }} />
      <Handle id="left" type="target" position={Position.Left} style={{ background: info.color, width: 5, height: 5, border: "none" }} />
      <Handle id="right" type="source" position={Position.Right} style={{ background: info.color, width: 5, height: 5, border: "none" }} />
      <Handle id="right" type="target" position={Position.Right} style={{ background: info.color, width: 5, height: 5, border: "none" }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { vpc: VpcNode, resource: ResourceNode };

/* ── Layout constants ── */
const NODE_W = 190;
const NODE_H = 85;
const GAP_X = 35;
const GAP_Y = 40;
const VPC_PAD = 40;
const VPC_TOP = 45;

/* ── Pick closest handles between two nodes ── */
function bestHandles(
  srcX: number, srcY: number, srcW: number, srcH: number,
  tgtX: number, tgtY: number, tgtW: number, tgtH: number,
): { sourceHandle: string; targetHandle: string } {
  // Center points
  const sx = srcX + srcW / 2, sy = srcY + srcH / 2;
  const tx = tgtX + tgtW / 2, ty = tgtY + tgtH / 2;
  const dx = tx - sx, dy = ty - sy;

  let sourceHandle: string, targetHandle: string;
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal dominant
    sourceHandle = dx > 0 ? "right" : "left";
    targetHandle = dx > 0 ? "left" : "right";
  } else {
    // Vertical dominant
    sourceHandle = dy > 0 ? "bottom" : "top";
    targetHandle = dy > 0 ? "top" : "bottom";
  }
  return { sourceHandle, targetHandle };
}

/* ── Build graph ── */
function buildGraph(resources: NodeResponse[], selectedNode: string | null) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Track absolute positions for smart edge routing
  const absPos = new Map<string, { x: number; y: number; w: number; h: number }>();

  function addEdge(srcId: string, tgtId: string, style: React.CSSProperties, extra?: Partial<Edge>) {
    const s = absPos.get(srcId);
    const t = absPos.get(tgtId);
    const handles = s && t
      ? bestHandles(s.x, s.y, s.w, s.h, t.x, t.y, t.w, t.h)
      : { sourceHandle: "bottom", targetHandle: "top" };
    const eid = `e-${srcId}-${tgtId}`;
    if (edges.some((e) => e.id === eid)) return;
    edges.push({
      id: eid,
      source: srcId,
      target: tgtId,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      style,
      ...extra,
    } as Edge);
  }

  const vpcs = resources.filter((r) => r.kind === "aws_vpc");
  const subnets = resources.filter((r) => r.kind === "aws_subnet");
  const igws = resources.filter((r) => r.kind === "aws_internet_gateway");
  const natGws = resources.filter((r) => r.kind === "aws_nat_gateway");
  const rts = resources.filter((r) => r.kind === "aws_route_table");
  const rtAssocs = resources.filter((r) => r.kind === "aws_route_table_association");
  const sgs = resources.filter((r) => r.kind === "aws_security_group");
  const peerings = resources.filter((r) => r.kind === "aws_vpc_peering_connection");
  const eips = resources.filter((r) => r.kind === "aws_eip");
  const others = resources.filter((r) =>
    !["aws_vpc", "aws_subnet", "aws_internet_gateway", "aws_nat_gateway",
      "aws_route_table", "aws_route_table_association", "aws_security_group",
      "aws_vpc_peering_connection", "aws_eip"].includes(r.kind)
  );

  const getVpcId = (r: NodeResponse): string => r.properties?.vpc_id || "";
  const isSel = (n: string) => selectedNode === n;

  // Track VPC layouts for peering/IGW placement
  const vpcMeta: { id: string; nodeId: string; x: number; y: number; w: number; h: number }[] = [];
  let vpcX = 0;
  const vpcY = 120; // leave room for IGWs above

  vpcs.forEach((vpc) => {
    const vpcId = vpc.containerId;
    const vpcNodeId = `vpc-${vpcId}`;

    // Collect children
    const mySubnets = subnets.filter((s) => getVpcId(s) === vpcId);
    const myRts = rts.filter((r) => getVpcId(r) === vpcId);
    const mySgs = sgs.filter((s) => getVpcId(s) === vpcId);
    const myNats = natGws.filter((n) => getVpcId(n) === vpcId);

    // Layout children in rows inside VPC
    // Row 1: subnets + NATs
    const row1 = [...mySubnets, ...myNats];
    // Row 2: route tables + security groups
    const row2 = [...myRts, ...mySgs];

    const cols = Math.max(row1.length, row2.length, 1);
    const vpcW = cols * (NODE_W + GAP_X) - GAP_X + VPC_PAD * 2;
    const numRows = (row1.length > 0 ? 1 : 0) + (row2.length > 0 ? 1 : 0);
    const vpcH = VPC_TOP + numRows * (NODE_H + GAP_Y) - (numRows > 0 ? GAP_Y : 0) + VPC_PAD;

    // VPC node — dimensions via style so React Flow handles parent sizing
    nodes.push({
      id: vpcNodeId,
      type: "vpc",
      position: { x: vpcX, y: vpcY },
      data: { label: vpc.name, cidr: vpc.properties?.cidr_block || "" },
      style: {
        width: vpcW, height: vpcH,
        border: `2px solid ${GREEN}`,
        borderRadius: 10,
        background: "rgba(0,0,0,0.85)",
      },
      selectable: false,
    });
    absPos.set(vpcNodeId, { x: vpcX, y: vpcY, w: vpcW, h: vpcH });

    // Row 1 children (positions relative to parent)
    let childY = VPC_TOP;
    row1.forEach((r, i) => {
      const childX = VPC_PAD + i * (NODE_W + GAP_X);
      const isSubnet = r.kind === "aws_subnet";
      const isPub = r.name.toLowerCase().includes("public");
      const nodeId = `${r.kind}-${r.containerId}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x: childX, y: childY },
        parentId: vpcNodeId,
        extent: "parent" as const,
        data: {
          kind: r.kind,
          label: isSubnet ? `${r.name}${isPub ? " (pub)" : " (priv)"}` : r.name,
          detail: isSubnet
            ? [r.properties?.cidr_block, r.properties?.availability_zone].filter(Boolean).join(" / ")
            : "",
          resourceId: r.containerId,
          selected: isSel(r.name),
        },
      });
      absPos.set(nodeId, { x: vpcX + childX, y: vpcY + childY, w: NODE_W, h: NODE_H });
    });

    if (row1.length > 0 && row2.length > 0) childY += NODE_H + GAP_Y;

    // Row 2 children
    row2.forEach((r, i) => {
      const childX = VPC_PAD + i * (NODE_W + GAP_X);
      const nodeId = `${r.kind}-${r.containerId}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x: childX, y: childY },
        parentId: vpcNodeId,
        extent: "parent" as const,
        data: {
          kind: r.kind,
          label: r.name,
          detail: "",
          resourceId: r.containerId,
          selected: isSel(r.name),
        },
      });
      absPos.set(nodeId, { x: vpcX + childX, y: vpcY + childY, w: NODE_W, h: NODE_H });

      // RT → subnet edge via association (deferred — added after all nodes placed)
    });

    vpcMeta.push({ id: vpcId, nodeId: vpcNodeId, x: vpcX, y: vpcY, w: vpcW, h: vpcH });
    vpcX += vpcW + 120;
  });

  // IGWs — outside VPC, centered above it
  igws.forEach((igw) => {
    const vpcId = getVpcId(igw);
    const vpc = vpcMeta.find((v) => v.id === vpcId);
    const x = vpc ? vpc.x + vpc.w / 2 - NODE_W / 2 : 0;
    const y = vpc ? vpc.y - NODE_H - 30 : 0;
    const nodeId = `aws_internet_gateway-${igw.containerId}`;
    nodes.push({
      id: nodeId, type: "resource",
      position: { x, y },
      data: { kind: "aws_internet_gateway", label: igw.name, detail: "internet", resourceId: igw.containerId, selected: isSel(igw.name) },
    });
    absPos.set(nodeId, { x, y, w: NODE_W, h: NODE_H });
    if (vpc) {
      addEdge(nodeId, vpc.nodeId, { stroke: "#eab308", strokeWidth: 2, strokeDasharray: "6 3" }, { animated: true });
    }
  });

  // VPC Peering — between VPCs
  peerings.forEach((peer) => {
    const nodeId = `aws_vpc_peering_connection-${peer.containerId}`;
    const midX = vpcMeta.length >= 2
      ? (vpcMeta[0].x + vpcMeta[0].w + vpcMeta[1].x) / 2 - NODE_W / 2
      : vpcX;
    const midY = vpcMeta.length > 0
      ? vpcMeta[0].y + vpcMeta[0].h / 2 - NODE_H / 2
      : 200;

    nodes.push({
      id: nodeId, type: "resource",
      position: { x: midX, y: midY },
      data: { kind: "aws_vpc_peering_connection", label: peer.name, detail: "peering", resourceId: peer.containerId, selected: isSel(peer.name) },
    });
    absPos.set(nodeId, { x: midX, y: midY, w: NODE_W, h: NODE_H });
    vpcMeta.forEach((v) => {
      addEdge(nodeId, v.nodeId, { stroke: "#38bdf8", strokeWidth: 2, strokeDasharray: "8 4" }, { animated: true });
    });
  });

  // EIPs
  eips.forEach((eip, i) => {
    const x = i * (NODE_W + GAP_X);
    const nid = `aws_eip-${eip.containerId}`;
    nodes.push({
      id: nid, type: "resource",
      position: { x, y: 0 },
      data: { kind: "aws_eip", label: eip.name, detail: eip.properties?.public_ip || "", resourceId: eip.containerId, selected: isSel(eip.name) },
    });
    absPos.set(nid, { x, y: 0, w: NODE_W, h: NODE_H });
  });

  // Others
  const bottomY = vpcMeta.length > 0 ? Math.max(...vpcMeta.map((v) => v.y + v.h)) + 60 : 300;
  others.forEach((r, i) => {
    const x = i * (NODE_W + GAP_X);
    const nid = `other-${r.containerId}`;
    nodes.push({
      id: nid, type: "resource",
      position: { x, y: bottomY },
      data: { kind: r.kind, label: r.name, detail: r.properties?.cidr_block || "", resourceId: r.containerId, selected: isSel(r.name) },
    });
    absPos.set(nid, { x, y: bottomY, w: NODE_W, h: NODE_H });
  });

  // RT → subnet edges (deferred until all positions known)
  rts.forEach((rt) => {
    const rtNodeId = `aws_route_table-${rt.containerId}`;
    const assoc = rtAssocs.find((a) => a.properties?.route_table_id === rt.containerId);
    if (assoc?.properties?.subnet_id) {
      const tgt = `aws_subnet-${assoc.properties.subnet_id}`;
      if (absPos.has(tgt)) {
        addEdge(rtNodeId, tgt, { stroke: "#a855f7", strokeWidth: 1.5 });
      }
    }
  });

  // Cross-reference edges from _refs
  const nodeById = new Map<string, string>();
  nodes.forEach((n) => {
    const rid = (n.data as Record<string, unknown>).resourceId as string;
    if (rid) nodeById.set(rid, n.id);
  });
  resources.forEach((r) => {
    const refs = r.properties?._refs;
    if (!refs) return;
    const src = nodeById.get(r.containerId);
    if (!src) return;
    refs.split(",").forEach((ref) => {
      const ci = ref.lastIndexOf(":");
      if (ci < 0) return;
      const refId = ref.slice(ci + 1);
      const refAddr = ref.slice(0, ci);
      const tgt = nodeById.get(refId);
      if (!tgt) return;
      if (refAddr.startsWith("aws_vpc.")) return;
      const info = ICON_MAP[r.kind];
      addEdge(src, tgt, { stroke: info?.color || "#94a3b8", strokeWidth: 1.5 }, {
        animated: true,
        label: r.kind === "aws_security_group" ? "ingress" : undefined,
        labelStyle: { fontSize: 9, fill: "#94a3b8", fontFamily: FONT },
        labelBgStyle: { fill: "rgba(0,0,0,0.8)", rx: 3 },
        labelBgPadding: [4, 2] as [number, number],
      });
    });
  });

  // Fallback: no VPCs
  if (vpcs.length === 0 && resources.length > 0) {
    resources.forEach((r, i) => {
      nodes.push({
        id: `res-${i}`, type: "resource",
        position: { x: (i % 3) * (NODE_W + GAP_X), y: Math.floor(i / 3) * (NODE_H + GAP_Y) },
        data: { kind: r.kind, label: r.name, detail: r.properties?.cidr_block || "", resourceId: r.containerId, selected: isSel(r.name) },
      });
    });
  }

  return { nodes, edges };
}

/* ── Main ── */
interface Props {
  resources: NodeResponse[];
  selectedNode?: string | null;
  onSelectNode?: (name: string | null) => void;
}

function CloudCanvas({ resources, selectedNode, onSelectNode }: Props) {
  const { nodes: init, edges: initE } = useMemo(
    () => buildGraph(resources, selectedNode || null),
    [resources, selectedNode]
  );
  const [nodes, , onNodesChange] = useNodesState(init);
  const [edges, , onEdgesChange] = useEdgesState(initE);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "vpc") return;
    const name = ((node.data as Record<string, unknown>).label as string || "").replace(/ \(.*\)$/, "");
    onSelectNode?.(name || null);
  }, [onSelectNode]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick} onPaneClick={() => onSelectNode?.(null)}
      fitView fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2} maxZoom={2}
      proOptions={{ hideAttribution: true }}
      style={{ background: "#79f673" }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(0,0,0,0.08)" />
    </ReactFlow>
  );
}

export default function CloudTopologyCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CloudCanvas {...props} />
    </ReactFlowProvider>
  );
}
