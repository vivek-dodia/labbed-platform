"use client";

import { useState, useCallback, useRef, useMemo, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  Handle,
  Position,
  type NodeTypes,
  type EdgeTypes,
  type OnConnect,
  type OnNodesDelete,
  type OnEdgesDelete,
  type OnNodeDrag,
  type NodeChange,
  getStraightPath,
  type EdgeProps,
  useReactFlow,
  applyNodeChanges,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NosImageResponse, CollectionResponse } from "@/types/api";
import { useBuilderState } from "@/hooks/useBuilderState";
import { generateContainerlabYAML, parseToBuilderState } from "@/lib/yaml-generator";
import { NODE_W, NODE_H, getLayoutedPositions } from "@/lib/layout";

// ── Styles ──

const labelStyle: React.CSSProperties = {
  fontSize: "0.65rem",
  textTransform: "uppercase",
  fontWeight: 700,
  letterSpacing: "0.05em",
  fontFamily: "'Manrope', sans-serif",
};

const pillBtn = (active?: boolean): React.CSSProperties => ({
  padding: "0.5rem 1.2rem",
  borderRadius: "99px",
  border: "1px solid #000000",
  background: active ? "#000000" : "transparent",
  color: active ? "#79f673" : "#000000",
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
  fontFamily: "'Manrope', sans-serif",
  transition: "all 0.15s",
});

// ── Builder Node ──

function BuilderNode({ data }: { data: { label: string; kind: string; image: string; selected?: boolean } }) {
  const sel = data.selected;
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
          border: "1.5px solid #000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
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
          {data.kind} &middot; {data.image}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="bs" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
      <Handle type="target" position={Position.Bottom} id="bt" style={{ background: "#000", width: 6, height: 6, border: "none" }} />
    </>
  );
}

// ── Hover Edge (reused from TopologyCanvas) ──

function HoverEdge({ sourceX, sourceY, targetX, targetY, data, style }: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const sourceLabel = (data as { sourceIface?: string })?.sourceIface || "";
  const targetLabel = (data as { targetIface?: string })?.targetIface || "";

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} />
      <path
        d={edgePath}
        fill="none"
        stroke={hovered ? "rgba(0,0,0,0.6)" : ((style?.stroke as string) || "rgba(0,0,0,0.25)")}
        strokeWidth={hovered ? 3 : ((style?.strokeWidth as number) || 1.5)}
      />
      {hovered && sourceLabel && targetLabel && (
        <foreignObject x={labelX - 80} y={labelY - 14} width={160} height={28} style={{ overflow: "visible", pointerEvents: "none" }}>
          <div style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            background: "#000", color: "#79f673", fontSize: "9px",
            fontFamily: "'Space Mono', monospace", padding: "3px 8px",
            whiteSpace: "nowrap", width: "fit-content", margin: "0 auto",
            boxShadow: "2px 2px 0 rgba(0,0,0,0.15)",
          }}>
            {sourceLabel} ↔ {targetLabel}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

const nodeTypes: NodeTypes = { builder: BuilderNode };
const edgeTypes: EdgeTypes = { hover: HoverEdge };

// ── NOS Image grouping ──

interface ImageGroup {
  label: string;
  images: NosImageResponse[];
}

function groupNosImages(images: NosImageResponse[]): ImageGroup[] {
  const routers: NosImageResponse[] = [];
  const hosts: NosImageResponse[] = [];
  const services: NosImageResponse[] = [];

  const routerKinds = new Set(["mikrotik_ros", "openwrt", "freebsd"]);
  const routerImages = ["frr", "frrouting", "gobgp", "bird", "vyos"];
  const hostImages = ["labbed-host"];
  const serviceImages = ["kea", "coredns", "nginx"];

  for (const img of images) {
    const imgLower = img.dockerImage.toLowerCase();
    if (routerKinds.has(img.clabKind) || routerImages.some((r) => imgLower.includes(r))) {
      routers.push(img);
    } else if (hostImages.some((h) => imgLower.includes(h))) {
      hosts.push(img);
    } else if (serviceImages.some((s) => imgLower.includes(s))) {
      services.push(img);
    } else {
      // Default to services
      services.push(img);
    }
  }

  const groups: ImageGroup[] = [];
  if (routers.length) groups.push({ label: "Routers", images: routers });
  if (hosts.length) groups.push({ label: "Hosts", images: hosts });
  if (services.length) groups.push({ label: "Services", images: services });
  return groups;
}

// ── Props ──

interface TopologyBuilderProps {
  nosImages: NosImageResponse[];
  collections: CollectionResponse[];
  onSave: (name: string, yaml: string, collectionId: string) => Promise<void>;
}

// ── Inner Component (needs useReactFlow) ──

function BuilderInner({ nosImages, collections, onSave }: TopologyBuilderProps) {
  const {
    state, rfNodes, rfEdges,
    addNode, removeNode, updateNode,
    addLink, removeLink,
    setName, setCollection,
    updatePosition, loadState,
  } = useBuilderState();

  const { screenToFlowPosition } = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [editingExec, setEditingExec] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageGroups = useMemo(() => groupNosImages(nosImages), [nosImages]);

  const selectedNode = useMemo(
    () => state.nodes.find((n) => n.id === selectedNodeId) || null,
    [state.nodes, selectedNodeId],
  );

  const selectedLink = useMemo(
    () => state.links.find((l) => l.id === selectedEdgeId) || null,
    [state.links, selectedEdgeId],
  );

  // Styled nodes with selection
  const styledNodes = useMemo(
    () => rfNodes.map((n) => ({
      ...n,
      data: { ...n.data, selected: n.id === selectedNodeId },
    })),
    [rfNodes, selectedNodeId],
  );

  // ── Canvas Handlers ──

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const imageId = e.dataTransfer.getData("application/labbed-nos-image");
      if (!imageId) return;
      const nosImage = nosImages.find((img) => img.uuid === imageId);
      if (!nosImage) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(nosImage, position);
    },
    [nosImages, screenToFlowPosition, addNode],
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (params.source && params.target) {
        addLink(params.source, params.target);
      }
    },
    [addLink],
  );

  const onNodesDelete: OnNodesDelete = useCallback(
    (deleted) => {
      for (const n of deleted) removeNode(n.id);
    },
    [removeNode],
  );

  const onEdgesDelete: OnEdgesDelete = useCallback(
    (deleted) => {
      for (const e of deleted) removeLink(e.id);
    },
    [removeLink],
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_, node) => {
      updatePosition(node.id, node.position);
    },
    [updatePosition],
  );

  const [localNodes, setLocalNodes] = useState<Node[]>([]);
  const nodesForFlow = styledNodes.length > 0 || localNodes.length === 0 ? styledNodes : localNodes;

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply position changes locally for smooth dragging
      setLocalNodes(applyNodeChanges(changes, styledNodes));
    },
    [styledNodes],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      const builderNode = state.nodes.find((n) => n.id === node.id);
      if (builderNode) {
        setEditingName(builderNode.name);
        setEditingExec(builderNode.exec.join("\n"));
      }
    },
    [state.nodes],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // ── Auto layout ──

  const handleAutoLayout = useCallback(() => {
    const layoutNodes = state.nodes.map((n) => ({
      id: n.id,
      kind: n.clabKind,
      image: n.dockerImage,
    }));
    const positions = getLayoutedPositions(layoutNodes);
    for (const node of state.nodes) {
      if (positions[node.id]) {
        updatePosition(node.id, positions[node.id]);
      }
    }
  }, [state.nodes, updatePosition]);

  // ── Import YAML ──

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const yaml = ev.target?.result as string;
        if (!yaml) return;
        const imported = parseToBuilderState(yaml, nosImages);
        // Auto-layout imported nodes
        const layoutNodes = imported.nodes.map((n) => ({
          id: n.id,
          kind: n.clabKind,
          image: n.dockerImage,
        }));
        const positions = getLayoutedPositions(layoutNodes);
        imported.nodes = imported.nodes.map((n) => ({
          ...n,
          position: positions[n.id] || n.position,
        }));
        imported.collectionId = state.collectionId;
        loadState(imported);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [nosImages, state.collectionId, loadState],
  );

  // ── Save ──

  const handleSave = useCallback(async () => {
    if (!state.name.trim() || !state.collectionId || state.nodes.length === 0) return;
    setSaving(true);
    try {
      const yaml = generateContainerlabYAML(state);
      await onSave(state.name, yaml, state.collectionId);
    } finally {
      setSaving(false);
    }
  }, [state, onSave]);

  // ── Properties Panel: node update handlers ──

  const handleNameBlur = useCallback(() => {
    if (selectedNodeId && editingName) {
      updateNode(selectedNodeId, { name: editingName });
    }
  }, [selectedNodeId, editingName, updateNode]);

  const handleExecBlur = useCallback(() => {
    if (selectedNodeId) {
      const cmds = editingExec.split("\n").filter((l) => l.trim());
      updateNode(selectedNodeId, { exec: cmds });
    }
  }, [selectedNodeId, editingExec, updateNode]);

  const handleImageChange = useCallback(
    (imageId: string) => {
      if (!selectedNodeId) return;
      const img = nosImages.find((i) => i.uuid === imageId);
      if (!img) return;
      updateNode(selectedNodeId, {
        nosImageId: img.uuid,
        clabKind: img.clabKind,
        dockerImage: img.dockerImage,
      });
    },
    [selectedNodeId, nosImages, updateNode],
  );

  // ── Palette drag start ──

  const onDragStart = useCallback((e: DragEvent, imageId: string) => {
    e.dataTransfer.setData("application/labbed-nos-image", imageId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      {/* Left — Node Palette */}
      <div style={{
        width: 220,
        borderRight: "1px solid #000",
        overflow: "auto",
        padding: "1rem",
        flexShrink: 0,
      }}>
        <span style={{ ...labelStyle, opacity: 0.5, display: "block", marginBottom: "1rem" }}>NODE PALETTE</span>

        {imageGroups.map((group) => (
          <div key={group.label} style={{ marginBottom: "1.5rem" }}>
            <span style={{ ...labelStyle, fontSize: "0.6rem", opacity: 0.4, display: "block", marginBottom: "0.5rem" }}>
              {group.label.toUpperCase()}
            </span>
            {group.images.map((img) => (
              <div
                key={img.uuid}
                draggable
                onDragStart={(e) => onDragStart(e, img.uuid)}
                style={{
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #000",
                  marginBottom: "0.4rem",
                  cursor: "grab",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "0.75rem",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontWeight: 700, fontFamily: "'Manrope', sans-serif", fontSize: "0.7rem", textTransform: "uppercase" }}>
                  {img.name}
                </div>
                <div style={{ fontSize: "0.6rem", opacity: 0.5, marginTop: 2 }}>
                  {img.clabKind}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ borderTop: "1px solid rgba(0,0,0,0.15)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button onClick={handleAutoLayout} style={pillBtn()}>Auto Layout</button>
          <button onClick={handleImport} style={pillBtn()}>Import YAML</button>
          <input ref={fileInputRef} type="file" accept=".yaml,.yml" onChange={onFileImport} style={{ display: "none" }} />
        </div>
      </div>

      {/* Center — Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodesForFlow}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          nodesConnectable
          deleteKeyCode="Delete"
          panOnDrag
          zoomOnScroll
          minZoom={0.3}
          maxZoom={2}
          style={{ background: "#79f673" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={0.8} color="rgba(0,0,0,0.06)" />
        </ReactFlow>
        {state.nodes.length === 0 && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ ...labelStyle, opacity: 0.3, fontSize: "0.8rem" }}>
              DRAG NODES FROM THE PALETTE TO GET STARTED
            </span>
          </div>
        )}
      </div>

      {/* Right — Properties Panel */}
      <div style={{
        width: 280,
        borderLeft: "1px solid #000",
        overflow: "auto",
        padding: "1rem",
        flexShrink: 0,
      }}>
        {selectedNode ? (
          <>
            <span style={{ ...labelStyle, opacity: 0.5, display: "block", marginBottom: "1rem" }}>NODE PROPERTIES</span>

            {/* Name */}
            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>NAME</label>
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={(e) => { if (e.key === "Enter") handleNameBlur(); }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #000",
                  padding: "0.4rem 0",
                  fontSize: "0.9rem",
                  fontFamily: "'Space Mono', monospace",
                  outline: "none",
                }}
              />
            </div>

            {/* Image */}
            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>IMAGE</label>
              <select
                value={selectedNode.nosImageId}
                onChange={(e) => handleImageChange(e.target.value)}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #000",
                  padding: "0.4rem 0",
                  fontSize: "0.8rem",
                  fontFamily: "'Manrope', sans-serif",
                  outline: "none",
                }}
              >
                {nosImages.map((img) => (
                  <option key={img.uuid} value={img.uuid}>{img.name} ({img.clabKind})</option>
                ))}
              </select>
            </div>

            {/* Kind (read-only) */}
            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>KIND</label>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.8rem" }}>
                {selectedNode.clabKind}
              </span>
            </div>

            {/* Interfaces */}
            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>INTERFACES</label>
              {selectedNode.interfaces.length === 0 ? (
                <span style={{ fontSize: "0.75rem", opacity: 0.4, fontFamily: "'Space Mono', monospace" }}>none</span>
              ) : (
                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                  {selectedNode.interfaces.map((iface) => (
                    <span key={iface} style={{
                      padding: "0.2rem 0.5rem",
                      border: "1px solid rgba(0,0,0,0.3)",
                      fontSize: "0.7rem",
                      fontFamily: "'Space Mono', monospace",
                    }}>
                      {iface}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Exec */}
            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>EXEC COMMANDS</label>
              <textarea
                value={editingExec}
                onChange={(e) => setEditingExec(e.target.value)}
                onBlur={handleExecBlur}
                rows={4}
                placeholder="one command per line"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "1px solid rgba(0,0,0,0.3)",
                  padding: "0.5rem",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "0.7rem",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>

            {/* Delete node */}
            <button
              onClick={() => { removeNode(selectedNode.id); setSelectedNodeId(null); }}
              style={{ ...pillBtn(), borderColor: "#ff5f56", color: "#ff5f56" }}
            >
              Delete Node
            </button>
          </>
        ) : selectedLink ? (
          <>
            <span style={{ ...labelStyle, opacity: 0.5, display: "block", marginBottom: "1rem" }}>LINK PROPERTIES</span>

            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>ENDPOINTS</label>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.8rem" }}>
                {state.nodes.find((n) => n.id === selectedLink.sourceNodeId)?.name}:{selectedLink.sourceIface}
                <span style={{ opacity: 0.4, margin: "0 0.5rem" }}>→</span>
                {state.nodes.find((n) => n.id === selectedLink.targetNodeId)?.name}:{selectedLink.targetIface}
              </div>
            </div>

            <button
              onClick={() => { removeLink(selectedLink.id); setSelectedEdgeId(null); }}
              style={{ ...pillBtn(), borderColor: "#ff5f56", color: "#ff5f56" }}
            >
              Delete Link
            </button>
          </>
        ) : (
          <>
            <span style={{ ...labelStyle, opacity: 0.5, display: "block", marginBottom: "1rem" }}>TOPOLOGY</span>

            {/* Topology Name */}
            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>NAME</label>
              <input
                value={state.name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-topology"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #000",
                  padding: "0.4rem 0",
                  fontSize: "0.9rem",
                  fontFamily: "'Space Mono', monospace",
                  outline: "none",
                }}
              />
            </div>

            {/* Collection */}
            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>COLLECTION</label>
              <select
                value={state.collectionId}
                onChange={(e) => setCollection(e.target.value)}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #000",
                  padding: "0.4rem 0",
                  fontSize: "0.8rem",
                  fontFamily: "'Manrope', sans-serif",
                  outline: "none",
                }}
              >
                <option value="">Select collection...</option>
                {collections.map((c) => (
                  <option key={c.uuid} value={c.uuid}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Stats */}
            <div style={{ marginBottom: "1.5rem", fontFamily: "'Space Mono', monospace", fontSize: "0.75rem" }}>
              <div>{state.nodes.length} nodes &middot; {state.links.length} links</div>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || !state.name.trim() || !state.collectionId || state.nodes.length === 0}
              style={{
                ...pillBtn(),
                backgroundColor: "#000",
                color: "#79f673",
                opacity: (saving || !state.name.trim() || !state.collectionId || state.nodes.length === 0) ? 0.4 : 1,
                width: "100%",
              }}
            >
              {saving ? "Saving..." : "Save Topology"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Exported wrapper with ReactFlowProvider ──

export default function TopologyBuilder(props: TopologyBuilderProps) {
  return (
    <ReactFlowProvider>
      <BuilderInner {...props} />
    </ReactFlowProvider>
  );
}
