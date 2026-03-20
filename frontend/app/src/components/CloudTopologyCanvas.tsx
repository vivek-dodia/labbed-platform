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

/* ── VPC group node (background container) ── */
function VpcNode({ data }: { data: Record<string, unknown> }) {
  const w = (data.width as number) || 500;
  const h = (data.height as number) || 300;
  const label = data.label as string;
  const cidr = data.cidr as string;

  return (
    <div style={{
      width: w, height: h,
      border: `2px solid ${GREEN}`,
      borderRadius: 8,
      background: "rgba(121,246,115,0.04)",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "6px 12px",
        borderBottom: `1px solid rgba(121,246,115,0.15)`,
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(121,246,115,0.06)",
        borderRadius: "6px 6px 0 0",
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={2}>
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <path d="M2 8h20M8 2v20" />
        </svg>
        <span style={{
          fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em", color: GREEN, fontFamily: FONT,
        }}>VPC</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#fff", fontFamily: FONT }}>{label}</span>
        {cidr && (
          <span style={{ fontSize: "0.65rem", fontFamily: MONO, color: GREEN, opacity: 0.6 }}>{cidr}</span>
        )}
      </div>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

/* ── Resource node (subnet, igw, rt, sg, etc.) ── */
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
  const iconInfo = ICON_MAP[kind] || { icon: "?", color: "#94a3b8" };

  return (
    <div style={{
      minWidth: 170,
      background: selected ? "rgba(121,246,115,0.12)" : "rgba(0,0,0,0.6)",
      border: `1.5px solid ${selected ? GREEN : `${iconInfo.color}88`}`,
      borderRadius: 6,
      padding: "8px 12px",
      fontFamily: FONT,
      backdropFilter: "blur(8px)",
      transition: "border-color 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: "0.5rem", fontWeight: 800, color: "#000",
          background: iconInfo.color, borderRadius: 3,
          padding: "1px 5px", letterSpacing: "0.04em",
          fontFamily: MONO, lineHeight: 1.4,
        }}>{iconInfo.icon}</span>
        <span style={{
          fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.05em", color: iconInfo.color, opacity: 0.8,
          fontFamily: FONT,
        }}>
          {kind.replace("aws_", "").replace(/_/g, " ")}
        </span>
      </div>
      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>{label}</div>
      {detail && (
        <div style={{ fontSize: "0.65rem", fontFamily: MONO, color: GREEN, opacity: 0.5, marginTop: 2 }}>
          {detail}
        </div>
      )}
      {rid && (
        <div style={{ fontSize: "0.55rem", fontFamily: MONO, color: "#fff", opacity: 0.2, marginTop: 2 }}>
          {rid.length > 28 ? rid.slice(0, 28) + "..." : rid}
        </div>
      )}
      <Handle type="target" position={Position.Top} style={{ background: iconInfo.color, width: 5, height: 5, border: "none" }} />
      <Handle type="source" position={Position.Bottom} style={{ background: iconInfo.color, width: 5, height: 5, border: "none" }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  vpc: VpcNode,
  resource: ResourceNode,
};

/* ── Build the graph ── */
function buildGraph(resources: NodeResponse[], selectedNode: string | null) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

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
  const isSelected = (name: string) => selectedNode === name;

  // Layout: no parent-child nesting — all nodes absolute positioned
  const NODE_W = 190;
  const NODE_H = 90;
  const COL_GAP = 40;
  const ROW_GAP = 50;
  const VPC_PAD_TOP = 55;
  const VPC_PAD_LEFT = 30;
  const VPC_PAD_BOTTOM = 30;

  let vpcOffsetX = 0;

  vpcs.forEach((vpc) => {
    const vpcId = vpc.containerId;
    const vpcSubnets = subnets.filter((s) => getVpcId(s) === vpcId);
    const vpcIgws = igws.filter((g) => getVpcId(g) === vpcId);
    const vpcRts = rts.filter((rt) => getVpcId(rt) === vpcId);
    const vpcSgs = sgs.filter((sg) => getVpcId(sg) === vpcId);
    const vpcNats = natGws.filter((n) => getVpcId(n) === vpcId);

    // Row 1: subnets + IGW
    const row1Items = [...vpcSubnets, ...vpcIgws, ...vpcNats];
    const row1Cols = Math.max(row1Items.length, 1);

    // Row 2: route tables + SGs
    const row2Items = [...vpcRts, ...vpcSgs];
    const row2Cols = Math.max(row2Items.length, 1);

    const maxCols = Math.max(row1Cols, row2Cols, 2);
    const vpcW = maxCols * (NODE_W + COL_GAP) + VPC_PAD_LEFT * 2 - COL_GAP;
    const hasRow2 = row2Items.length > 0;
    const vpcH = VPC_PAD_TOP + NODE_H + (hasRow2 ? ROW_GAP + NODE_H : 0) + VPC_PAD_BOTTOM;

    const vpcX = vpcOffsetX;
    const vpcY = 60;

    // VPC background node (z-index -1 via style)
    nodes.push({
      id: `vpc-${vpc.name}`,
      type: "vpc",
      position: { x: vpcX, y: vpcY },
      data: {
        label: vpc.name,
        cidr: vpc.properties?.cidr_block || "",
        width: vpcW,
        height: vpcH,
      },
      style: { zIndex: -1 },
      selectable: false,
      draggable: false,
    });

    // Row 1: Subnets
    vpcSubnets.forEach((subnet, i) => {
      const x = vpcX + VPC_PAD_LEFT + i * (NODE_W + COL_GAP);
      const y = vpcY + VPC_PAD_TOP;
      const isPublic = subnet.name.toLowerCase().includes("public");
      const nodeId = `subnet-${subnet.containerId}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x, y },
        data: {
          kind: "aws_subnet",
          label: subnet.name + (isPublic ? " (pub)" : " (priv)"),
          detail: [subnet.properties?.cidr_block, subnet.properties?.availability_zone].filter(Boolean).join(" / "),
          resourceId: subnet.containerId,
          selected: isSelected(subnet.name),
        },
      });
    });

    // Row 1 continued: IGWs
    vpcIgws.forEach((igw, i) => {
      const x = vpcX + VPC_PAD_LEFT + (vpcSubnets.length + i) * (NODE_W + COL_GAP);
      const y = vpcY + VPC_PAD_TOP;
      const nodeId = `igw-${igw.containerId}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x, y },
        data: {
          kind: "aws_internet_gateway",
          label: igw.name,
          detail: "",
          resourceId: igw.containerId,
          selected: isSelected(igw.name),
        },
      });

      // Edge: IGW → VPC
      edges.push({
        id: `e-igw-vpc-${igw.containerId}`,
        source: nodeId,
        target: `vpc-${vpc.name}`,
        style: { stroke: "#eab308", strokeWidth: 1.5, strokeDasharray: "6 3" },
        animated: true,
      });
    });

    // Row 1 continued: NAT GWs
    vpcNats.forEach((nat, i) => {
      const x = vpcX + VPC_PAD_LEFT + (vpcSubnets.length + vpcIgws.length + i) * (NODE_W + COL_GAP);
      const y = vpcY + VPC_PAD_TOP;
      const nodeId = `nat-${nat.containerId}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x, y },
        data: {
          kind: "aws_nat_gateway",
          label: nat.name,
          detail: "",
          resourceId: nat.containerId,
          selected: isSelected(nat.name),
        },
      });
    });

    // Row 2: Route tables
    vpcRts.forEach((rt, i) => {
      const x = vpcX + VPC_PAD_LEFT + i * (NODE_W + COL_GAP);
      const y = vpcY + VPC_PAD_TOP + NODE_H + ROW_GAP;
      const nodeId = `rt-${rt.containerId}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x, y },
        data: {
          kind: "aws_route_table",
          label: rt.name,
          detail: "",
          resourceId: rt.containerId,
          selected: isSelected(rt.name),
        },
      });

      // Find RT association → subnet edge
      const assoc = rtAssocs.find((a) => a.properties?.route_table_id === rt.containerId);
      if (assoc?.properties?.subnet_id) {
        const subnetNode = nodes.find((n) => n.id === `subnet-${assoc.properties?.subnet_id}`);
        if (subnetNode) {
          edges.push({
            id: `e-rt-sub-${rt.containerId}`,
            source: nodeId,
            target: subnetNode.id,
            style: { stroke: "#a855f7", strokeWidth: 1.5 },
          });
        }
      }
    });

    // Row 2 continued: Security groups
    vpcSgs.forEach((sg, i) => {
      const x = vpcX + VPC_PAD_LEFT + (vpcRts.length + i) * (NODE_W + COL_GAP);
      const y = vpcY + VPC_PAD_TOP + NODE_H + ROW_GAP;
      const nodeId = `sg-${sg.containerId}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x, y },
        data: {
          kind: "aws_security_group",
          label: sg.name,
          detail: "",
          resourceId: sg.containerId,
          selected: isSelected(sg.name),
        },
      });
    });

    vpcOffsetX += vpcW + 100;
  });

  // VPC Peering
  peerings.forEach((peer) => {
    const nodeId = `peer-${peer.containerId}`;
    const vpcNodes = nodes.filter((n) => n.type === "vpc");
    const midX = vpcNodes.length >= 2
      ? (vpcNodes[0].position.x + (vpcNodes[0].data.width as number) + vpcNodes[1].position.x) / 2 - NODE_W / 2
      : vpcOffsetX;

    nodes.push({
      id: nodeId,
      type: "resource",
      position: { x: midX, y: 200 },
      data: {
        kind: "aws_vpc_peering_connection",
        label: peer.name,
        detail: "peering",
        resourceId: peer.containerId,
        selected: isSelected(peer.name),
      },
    });

    vpcNodes.forEach((vn) => {
      edges.push({
        id: `e-peer-${peer.containerId}-${vn.id}`,
        source: nodeId,
        target: vn.id,
        style: { stroke: "#38bdf8", strokeWidth: 2, strokeDasharray: "8 4" },
        animated: true,
      });
    });
  });

  // EIPs above VPCs
  eips.forEach((eip, i) => {
    nodes.push({
      id: `eip-${eip.containerId}`,
      type: "resource",
      position: { x: i * (NODE_W + COL_GAP), y: 0 },
      data: {
        kind: "aws_eip",
        label: eip.name,
        detail: eip.properties?.public_ip || "",
        resourceId: eip.containerId,
        selected: isSelected(eip.name),
      },
    });
  });

  // Others below
  others.forEach((r, i) => {
    nodes.push({
      id: `other-${r.containerId}-${i}`,
      type: "resource",
      position: { x: i * (NODE_W + COL_GAP), y: 500 },
      data: {
        kind: r.kind,
        label: r.name,
        detail: r.properties?.cidr_block || "",
        resourceId: r.containerId,
        selected: isSelected(r.name),
      },
    });
  });

  // Cross-resource reference edges (from _refs property)
  // _refs format: "aws_security_group.web:sg-xxx,aws_vpc.main:vpc-yyy"
  const nodeByContainerId = new Map<string, string>(); // containerId -> nodeId
  nodes.forEach((n) => {
    const rid = (n.data as Record<string, unknown>).resourceId as string;
    if (rid) nodeByContainerId.set(rid, n.id);
  });

  resources.forEach((r) => {
    const refs = r.properties?._refs;
    if (!refs) return;
    const sourceNodeId = nodeByContainerId.get(r.containerId);
    if (!sourceNodeId) return;

    refs.split(",").forEach((ref) => {
      const colonIdx = ref.lastIndexOf(":");
      if (colonIdx < 0) return;
      const refId = ref.slice(colonIdx + 1);
      const refAddr = ref.slice(0, colonIdx);
      const targetNodeId = nodeByContainerId.get(refId);
      if (!targetNodeId) return;
      // Skip VPC membership edges (vpc_id) — those are implicit from layout
      if (refAddr.startsWith("aws_vpc.")) return;

      const edgeId = `e-ref-${r.containerId}-${refId}`;
      // Avoid duplicate edges
      if (edges.some((e) => e.id === edgeId)) return;

      const iconInfo = ICON_MAP[r.kind];
      edges.push({
        id: edgeId,
        source: sourceNodeId,
        target: targetNodeId,
        style: { stroke: iconInfo?.color || "#94a3b8", strokeWidth: 1.5 },
        animated: true,
        label: r.kind === "aws_security_group" ? "ingress" : undefined,
        labelStyle: { fontSize: 9, fill: "#94a3b8", fontFamily: FONT },
        labelBgStyle: { fill: "rgba(0,0,0,0.7)", rx: 3 },
        labelBgPadding: [4, 2] as [number, number],
      });
    });
  });

  // No VPCs fallback: grid
  if (vpcs.length === 0 && resources.length > 0) {
    resources.forEach((r, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      nodes.push({
        id: `res-${i}`,
        type: "resource",
        position: { x: col * (NODE_W + COL_GAP), y: row * (NODE_H + ROW_GAP) },
        data: {
          kind: r.kind,
          label: r.name,
          detail: r.properties?.cidr_block || "",
          resourceId: r.containerId,
          selected: isSelected(r.name),
        },
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
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(resources, selectedNode || null),
    [resources, selectedNode]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "vpc") return;
      const name = ((node.data as Record<string, unknown>).label as string || "").replace(/ \(.*\)$/, "");
      onSelectNode?.(name || null);
    },
    [onSelectNode]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={() => onSelectNode?.(null)}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={2}
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
