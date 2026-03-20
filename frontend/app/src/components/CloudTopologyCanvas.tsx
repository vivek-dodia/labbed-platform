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

/* ── Design tokens ── */
const FONT = "'Manrope', sans-serif";
const MONO = "'Space Mono', monospace";

/* ── Resource colors ── */
const COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  aws_vpc:                       { bg: "#f0f9ff", border: "#0369a1", text: "#0c4a6e", badge: "#0ea5e9" },
  aws_subnet:                    { bg: "#f0fdf4", border: "#16a34a", text: "#14532d", badge: "#22c55e" },
  aws_internet_gateway:          { bg: "#fefce8", border: "#ca8a04", text: "#713f12", badge: "#eab308" },
  aws_nat_gateway:               { bg: "#fff7ed", border: "#ea580c", text: "#7c2d12", badge: "#f97316" },
  aws_route_table:               { bg: "#faf5ff", border: "#9333ea", text: "#581c87", badge: "#a855f7" },
  aws_route_table_association:   { bg: "#faf5ff", border: "#7c3aed", text: "#4c1d95", badge: "#8b5cf6" },
  aws_security_group:            { bg: "#fdf2f8", border: "#db2777", text: "#831843", badge: "#ec4899" },
  aws_eip:                       { bg: "#fff7ed", border: "#ea580c", text: "#7c2d12", badge: "#f97316" },
  aws_vpc_peering_connection:    { bg: "#f0f9ff", border: "#0284c7", text: "#0c4a6e", badge: "#38bdf8" },
  default:                       { bg: "#f8fafc", border: "#64748b", text: "#1e293b", badge: "#94a3b8" },
};

function getColor(kind: string) {
  return COLORS[kind] || COLORS.default;
}

/* ── Icons (simple SVG) ── */
function ResourceIcon({ kind }: { kind: string }) {
  const size = 20;
  const color = getColor(kind).badge;

  switch (kind) {
    case "aws_vpc":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <path d="M2 8h20M8 2v20" />
        </svg>
      );
    case "aws_subnet":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
          <circle cx="12" cy="12" r="3" fill={color} />
        </svg>
      );
    case "aws_internet_gateway":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18" />
        </svg>
      );
    case "aws_nat_gateway":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 12h6M12 9l3 3-3 3" />
        </svg>
      );
    case "aws_route_table":
    case "aws_route_table_association":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
          <path d="M3 6h18M3 12h18M3 18h12" />
          <circle cx="18" cy="18" r="2" fill={color} />
        </svg>
      );
    case "aws_security_group":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
          <path d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z" />
        </svg>
      );
    case "aws_vpc_peering_connection":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
          <circle cx="7" cy="12" r="4" />
          <circle cx="17" cy="12" r="4" />
          <path d="M11 12h2" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
      );
  }
}

/* ── VPC Group Node ── */
function VpcNode({ data }: { data: Record<string, unknown> }) {
  const c = getColor("aws_vpc");
  const name = data.label as string;
  const cidr = data.cidr as string;
  const width = (data.width as number) || 600;
  const height = (data.height as number) || 400;

  return (
    <div
      style={{
        width,
        height,
        border: `2px solid ${c.border}`,
        borderRadius: 12,
        background: `${c.bg}cc`,
        padding: 0,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -1,
          left: 16,
          background: c.border,
          color: "#fff",
          padding: "4px 12px",
          borderRadius: "0 0 8px 8px",
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          fontFamily: FONT,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <ResourceIcon kind="aws_vpc" />
        VPC: {name}
        {cidr && <span style={{ opacity: 0.7, fontFamily: MONO, fontSize: "0.6rem" }}>{cidr}</span>}
      </div>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

/* ── Generic Resource Node ── */
function ResourceNode({ data }: { data: Record<string, unknown> }) {
  const kind = data.kind as string;
  const c = getColor(kind);
  const name = data.label as string;
  const detail = data.detail as string;
  const resourceId = data.resourceId as string;
  const selected = data.selected as boolean;

  return (
    <div
      style={{
        minWidth: 180,
        background: c.bg,
        border: `2px solid ${selected ? "#000" : c.border}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontFamily: FONT,
        boxShadow: selected ? "0 0 0 2px #000" : `0 1px 3px ${c.border}33`,
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <ResourceIcon kind={kind} />
        <span
          style={{
            fontSize: "0.55rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: c.badge,
            fontFamily: FONT,
          }}
        >
          {kind.replace("aws_", "").replace(/_/g, " ")}
        </span>
      </div>
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: c.text, marginBottom: 2 }}>
        {name}
      </div>
      {detail && (
        <div style={{ fontSize: "0.7rem", fontFamily: MONO, color: c.text, opacity: 0.6 }}>
          {detail}
        </div>
      )}
      {resourceId && (
        <div style={{ fontSize: "0.6rem", fontFamily: MONO, color: c.text, opacity: 0.35, marginTop: 2 }}>
          {resourceId.length > 24 ? resourceId.slice(0, 24) + "..." : resourceId}
        </div>
      )}
      <Handle type="target" position={Position.Top} style={{ background: c.border, width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: c.border, width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  vpc: VpcNode,
  resource: ResourceNode,
};

/* ── Layout logic ── */

interface ResourceWithProps extends NodeResponse {
  tfAddress?: string; // e.g. "aws_vpc.main"
}

function buildGraph(resources: NodeResponse[], selectedNode: string | null) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Classify resources
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

  // Helper to find VPC ID for a resource
  const getVpcId = (r: NodeResponse): string => r.properties?.vpc_id || "";

  // Layout constants
  const VPC_PADDING_TOP = 50;
  const VPC_PADDING_LEFT = 30;
  const SUBNET_W = 200;
  const SUBNET_H = 80;
  const SUBNET_GAP = 30;
  const VPC_MIN_W = 550;
  const VPC_MIN_H = 350;

  // For each VPC, compute its children and layout
  const vpcLayouts: Record<string, { x: number; y: number; w: number; h: number }> = {};
  let vpcX = 50;

  vpcs.forEach((vpc, vi) => {
    const vpcId = vpc.containerId;
    const vpcSubnets = subnets.filter((s) => getVpcId(s) === vpcId);
    const vpcIgws = igws.filter((g) => getVpcId(g) === vpcId);
    const vpcNats = natGws.filter((n) => getVpcId(n) === vpcId);
    const vpcRts = rts.filter((rt) => getVpcId(rt) === vpcId);
    const vpcSgs = sgs.filter((sg) => getVpcId(sg) === vpcId);

    // Subnet columns
    const subnetCols = Math.max(vpcSubnets.length, 1);
    const vpcW = Math.max(VPC_MIN_W, subnetCols * (SUBNET_W + SUBNET_GAP) + VPC_PADDING_LEFT * 2);

    // Row 1: IGW + subnets
    // Row 2: route tables
    // Row 3: security groups
    let innerY = VPC_PADDING_TOP + 10;
    const row1Y = innerY;
    innerY += SUBNET_H + 40;
    const row2Y = innerY;
    innerY += 90;
    const row3Y = innerY;
    innerY += (vpcSgs.length > 0 ? 90 : 0);

    const vpcH = Math.max(VPC_MIN_H, innerY + 30);

    const vpcNodeId = `vpc-${vpc.name}`;
    nodes.push({
      id: vpcNodeId,
      type: "vpc",
      position: { x: vpcX, y: 50 },
      data: {
        label: vpc.name,
        cidr: vpc.properties?.cidr_block || "",
        width: vpcW,
        height: vpcH,
      },
      style: { zIndex: 0 },
    });

    vpcLayouts[vpcId] = { x: vpcX, y: 50, w: vpcW, h: vpcH };

    // IGWs on the top-left of VPC
    vpcIgws.forEach((igw, i) => {
      const nodeId = `igw-${igw.name}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x: vpcX + vpcW - 220, y: 10 },
        data: {
          kind: igw.kind,
          label: igw.name,
          detail: "",
          resourceId: igw.containerId,
          selected: selectedNode === igw.name,
        },
        parentId: undefined,
      });
      edges.push({
        id: `e-${vpcNodeId}-${nodeId}`,
        source: nodeId,
        target: vpcNodeId,
        style: { stroke: getColor("aws_internet_gateway").border, strokeWidth: 2, strokeDasharray: "6 3" },
        animated: true,
      });
    });

    // Subnets inside VPC
    vpcSubnets.forEach((subnet, si) => {
      const subX = VPC_PADDING_LEFT + si * (SUBNET_W + SUBNET_GAP);
      const nodeId = `subnet-${subnet.name}-${si}`;
      const isPublic = subnet.name.toLowerCase().includes("public");
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x: subX, y: row1Y },
        parentId: vpcNodeId,
        extent: "parent" as const,
        data: {
          kind: subnet.kind,
          label: `${subnet.name}${isPublic ? " (public)" : " (private)"}`,
          detail: `${subnet.properties?.cidr_block || ""} · ${subnet.properties?.availability_zone || ""}`,
          resourceId: subnet.containerId,
          selected: selectedNode === subnet.name,
        },
      });
    });

    // Route tables inside VPC
    vpcRts.forEach((rt, ri) => {
      const rtX = VPC_PADDING_LEFT + ri * (SUBNET_W + SUBNET_GAP);
      const nodeId = `rt-${rt.name}-${ri}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x: rtX, y: row2Y },
        parentId: vpcNodeId,
        extent: "parent" as const,
        data: {
          kind: rt.kind,
          label: rt.name,
          detail: "",
          resourceId: rt.containerId,
          selected: selectedNode === rt.name,
        },
      });

      // Connect RT to subnet (find association)
      const assoc = rtAssocs.find((a) => {
        const rtId = a.properties?.route_table_id;
        return rtId === rt.containerId;
      });
      if (assoc) {
        const subnetId = assoc.properties?.subnet_id;
        const subnetNode = nodes.find((n) => {
          const r = vpcSubnets.find((s) => s.containerId === subnetId);
          return r && n.id.startsWith("subnet-") && n.id.includes(r.name);
        });
        if (subnetNode) {
          edges.push({
            id: `e-${nodeId}-${subnetNode.id}`,
            source: nodeId,
            target: subnetNode.id,
            style: { stroke: getColor("aws_route_table").border, strokeWidth: 1.5 },
            label: "routes",
          });
        }
      }
    });

    // Security groups inside VPC
    vpcSgs.forEach((sg, si) => {
      const sgX = VPC_PADDING_LEFT + si * (SUBNET_W + SUBNET_GAP);
      const nodeId = `sg-${sg.name}-${si}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x: sgX, y: row3Y },
        parentId: vpcNodeId,
        extent: "parent" as const,
        data: {
          kind: sg.kind,
          label: sg.name,
          detail: "",
          resourceId: sg.containerId,
          selected: selectedNode === sg.name,
        },
      });
    });

    // NAT Gateways
    vpcNats.forEach((nat, ni) => {
      const natX = VPC_PADDING_LEFT + (vpcSubnets.length + ni) * (SUBNET_W + SUBNET_GAP);
      const nodeId = `nat-${nat.name}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x: Math.min(natX, vpcW - SUBNET_W - VPC_PADDING_LEFT), y: row1Y },
        parentId: vpcNodeId,
        extent: "parent" as const,
        data: {
          kind: nat.kind,
          label: nat.name,
          detail: nat.properties?.subnet_id?.slice(0, 16) || "",
          resourceId: nat.containerId,
          selected: selectedNode === nat.name,
        },
      });
    });

    vpcX += vpcW + 80;
  });

  // VPC Peering connections
  peerings.forEach((peer) => {
    const nodeId = `peering-${peer.name}`;
    // Place between VPCs
    const allVpcXs = Object.values(vpcLayouts);
    const midX = allVpcXs.length >= 2
      ? (allVpcXs[0].x + allVpcXs[0].w + allVpcXs[1].x) / 2 - 100
      : vpcX + 50;

    nodes.push({
      id: nodeId,
      type: "resource",
      position: { x: midX, y: 200 },
      data: {
        kind: peer.kind,
        label: peer.name,
        detail: "peering",
        resourceId: peer.containerId,
        selected: selectedNode === peer.name,
      },
    });

    // Connect to both VPCs
    const vpcNodeIds = nodes.filter((n) => n.type === "vpc").map((n) => n.id);
    vpcNodeIds.forEach((vid) => {
      edges.push({
        id: `e-${nodeId}-${vid}`,
        source: nodeId,
        target: vid,
        style: { stroke: getColor("aws_vpc_peering_connection").border, strokeWidth: 2, strokeDasharray: "8 4" },
        animated: true,
      });
    });
  });

  // EIPs (outside VPC)
  eips.forEach((eip, i) => {
    const nodeId = `eip-${eip.name}`;
    nodes.push({
      id: nodeId,
      type: "resource",
      position: { x: 50 + i * 230, y: 0 },
      data: {
        kind: eip.kind,
        label: eip.name,
        detail: eip.properties?.public_ip || "",
        resourceId: eip.containerId,
        selected: selectedNode === eip.name,
      },
    });
  });

  // Other resources (placed below VPCs)
  const otherY = Math.max(...Object.values(vpcLayouts).map((v) => v.y + v.h), 300) + 60;
  others.forEach((r, i) => {
    const nodeId = `other-${r.kind}-${r.name}-${i}`;
    nodes.push({
      id: nodeId,
      type: "resource",
      position: { x: 50 + i * 230, y: otherY },
      data: {
        kind: r.kind,
        label: r.name,
        detail: "",
        resourceId: r.containerId,
        selected: selectedNode === r.name,
      },
    });
  });

  // If no VPCs, lay out everything in a grid
  if (vpcs.length === 0) {
    const allResources = resources;
    allResources.forEach((r, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const nodeId = `res-${r.kind}-${r.name}-${i}`;
      nodes.push({
        id: nodeId,
        type: "resource",
        position: { x: 50 + col * 230, y: 50 + row * 120 },
        data: {
          kind: r.kind,
          label: r.name,
          detail: r.properties?.cidr_block || r.properties?.id || "",
          resourceId: r.containerId,
          selected: selectedNode === r.name,
        },
      });
    });
  }

  return { nodes, edges };
}

/* ── Main component ── */

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
      const name = (node.data as Record<string, unknown>).label as string;
      if (name && onSelectNode) {
        // Strip suffix like " (public)" for matching
        const cleanName = name.replace(/ \(.*\)$/, "");
        onSelectNode(cleanName);
      }
    },
    [onSelectNode]
  );

  const onPaneClick = useCallback(() => {
    onSelectNode?.(null);
  }, [onSelectNode]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.3}
      maxZoom={1.5}
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
