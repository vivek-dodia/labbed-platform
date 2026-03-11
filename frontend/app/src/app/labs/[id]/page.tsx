"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import TopologyCanvas from "@/components/topology/TopologyCanvas";
import TerminalPanel from "@/components/lab/TerminalPanel";
import ArrowButton from "@/components/ui/ArrowButton";
import StatusDot from "@/components/ui/StatusDot";
import { useAuth } from "@/hooks/useAuth";
import { useWSChannel } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";
import type { LabResponse, NodeResponse, TopologyResponse } from "@/types/api";

export default function LabDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [lab, setLab] = useState<LabResponse | null>(null);
  const [topology, setTopology] = useState<TopologyResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState("");

  // Load lab + topology
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    api.get<LabResponse>(`/api/v1/labs/${id}`).then((l) => {
      setLab(l);
      if (l.nodes?.length > 0) setSelectedNode(l.nodes[0].name);
      // fetch topology for canvas
      api.get<TopologyResponse>(`/api/v1/topologies/${l.topologyId}`)
        .then(setTopology)
        .catch(() => {});
    });
  }, [id, user, authLoading, router]);

  // WebSocket: lab state updates
  const handleLabState = useCallback((data: unknown) => {
    setLab(data as LabResponse);
  }, []);
  useWSChannel(lab ? `lab:${lab.uuid}` : null, handleLabState);

  // WebSocket: node updates
  const handleNodeUpdate = useCallback((data: unknown) => {
    const nodes = data as NodeResponse[];
    setLab((prev) => (prev ? { ...prev, nodes } : prev));
  }, []);
  useWSChannel(lab ? `lab:${lab.uuid}:nodes` : null, handleNodeUpdate);

  // Poll lab state until it settles (not deploying/stopping)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const updated = await api.get<LabResponse>(`/api/v1/labs/${id}`);
        setLab(updated);
        if (updated.nodes?.length > 0 && !selectedNode) {
          setSelectedNode(updated.nodes[0].name);
        }
        // Stop polling once state settles
        if (updated.state !== "deploying" && updated.state !== "stopping") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [id, selectedNode]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleAction = useCallback(
    async (action: "deploy" | "destroy") => {
      setActionLoading(action);
      try {
        await api.post(`/api/v1/labs/${id}/${action}`, {});
        // Re-fetch lab state immediately
        const updated = await api.get<LabResponse>(`/api/v1/labs/${id}`);
        setLab(updated);
        // Start polling for async state transitions
        startPolling();
      } finally {
        setActionLoading("");
      }
    },
    [id, startPolling]
  );

  const handleDelete = useCallback(async () => {
    await api.del(`/api/v1/labs/${id}`);
    router.push("/");
  }, [id, router]);

  if (!lab) {
    return (
      <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="label" style={{ opacity: 0.4, color: "#F2F2F2" }}>LOADING LAB...</span>
      </div>
    );
  }

  const nodeStates: Record<string, string> = {};
  lab.nodes?.forEach((n) => {
    nodeStates[n.name] = n.state;
  });

  const isLive = lab.state === "running" || lab.state === "deploying";

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return "—";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", padding: 1 }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 8px 400px", gap: "1px", backgroundColor: "#0A0A0A" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px" }}>
          <Link
            href="/"
            style={{ backgroundColor: "#F2F2F2", padding: "1.2rem 2rem", display: "flex", alignItems: "center", textDecoration: "none", color: "#0A0A0A" }}
          >
            <span className="label" style={{ fontWeight: 700 }}>LABBED</span>
          </Link>
          <Link
            href="/"
            style={{ backgroundColor: "#F2F2F2", padding: "1.2rem 2rem", display: "flex", alignItems: "center", textDecoration: "none", color: "#0A0A0A" }}
          >
            <span className="label">(Dashboard)</span>
          </Link>
          <div style={{ backgroundColor: "#F2F2F2", padding: "1.2rem 2rem", display: "flex", alignItems: "center" }}>
            <span className="label">(Lab)</span>
          </div>
        </div>
        <div style={{ background: "#2b9d88" }} />
        <div style={{ backgroundColor: "#0A0A0A" }} />
      </div>

      {/* Body: left content | gradient divider | right terminal */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 8px 400px",
          gap: "1px",
          backgroundColor: "#0A0A0A",
          minHeight: "calc(100vh - 52px)",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", backgroundColor: "#0A0A0A" }}>

          {/* Lab hero */}
            <div style={{ backgroundColor: "#F2F2F2", padding: "3rem 3.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
                <StatusDot state={lab.state} />
                <span className="label" style={{ fontSize: "0.85rem" }}>{lab.state.toUpperCase()}</span>
                {lab.errorMessage && (
                  <span className="footnote" style={{ color: "var(--status-fail)" }}>
                    {lab.errorMessage}
                  </span>
                )}
              </div>
              <h1
                style={{
                  fontSize: "2.8vw",
                  fontWeight: 400,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  lineHeight: 1.1,
                }}
              >
                {lab.name}
              </h1>
              <div style={{ display: "flex", gap: "4rem", marginTop: "2.5rem" }}>
                <div>
                  <span className="label" style={{ fontSize: "0.7rem", opacity: 0.5 }}>NODES</span>
                  <p className="footnote" style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>{lab.nodes?.length || 0} instances</p>
                </div>
                <div>
                  <span className="label" style={{ fontSize: "0.7rem", opacity: 0.5 }}>DEPLOYED</span>
                  <p className="footnote" style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>{timeAgo(lab.deployedAt)}</p>
                </div>
                <div>
                  <span className="label" style={{ fontSize: "0.7rem", opacity: 0.5 }}>TOPOLOGY</span>
                  <p className="footnote" style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>{topology?.name || lab.topologyId.slice(0, 8)}</p>
                </div>
              </div>
            </div>

          {/* Canvas */}
          <div style={{ backgroundColor: "#F2F2F2", position: "relative", overflow: "hidden", minHeight: 320, maxHeight: 420 }}>
            {topology ? (
              <TopologyCanvas
                definition={topology.definition}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                nodeStates={nodeStates}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.3 }}>
                <span className="label">TOPOLOGY CANVAS</span>
              </div>
            )}
          </div>

          {/* Node table */}
          {lab.nodes && lab.nodes.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2.5fr 0.8fr 1.5fr 1.2fr 0.7fr",
                gap: "1px",
                backgroundColor: "#0A0A0A",
              }}
            >
              {["NODE", "KIND", "IMAGE", "IPV4", "STATE"].map((h) => (
                <div
                  key={h}
                  style={{
                    backgroundColor: "#EBEBEB",
                    padding: "1rem 1.8rem",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                    fontWeight: 700,
                  }}
                >
                  {h}
                </div>
              ))}
              {lab.nodes.map((n, ri) => {
                const isSelected = n.name === selectedNode;
                const cellStyle = {
                  backgroundColor: isSelected ? "#E2E2E2" : "#F2F2F2",
                  padding: "1rem 1.8rem",
                  borderBottom: "1px solid #0A0A0A",
                  display: "flex" as const,
                  alignItems: "center" as const,
                  cursor: "pointer" as const,
                };
                return [
                  <div key={`${ri}-n`} onClick={() => setSelectedNode(n.name)} style={{ ...cellStyle, gap: "0.6rem" }}>
                    <StatusDot state={n.state} />
                    <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: "0.85rem" }}>{n.name}</span>
                  </div>,
                  <div key={`${ri}-k`} onClick={() => setSelectedNode(n.name)} style={cellStyle}>
                    <span className="mono" style={{ fontSize: "0.8rem" }}>{n.kind}</span>
                  </div>,
                  <div key={`${ri}-i`} onClick={() => setSelectedNode(n.name)} style={cellStyle}>
                    <span className="mono" style={{ fontSize: "0.75rem" }}>{n.image.split("/").pop()}</span>
                  </div>,
                  <div key={`${ri}-ip`} onClick={() => setSelectedNode(n.name)} style={cellStyle}>
                    <span className="mono" style={{ fontSize: "0.8rem" }}>{n.ipv4 || "—"}</span>
                  </div>,
                  <div key={`${ri}-s`} onClick={() => setSelectedNode(n.name)} style={cellStyle}>
                    <span className="label" style={{ fontSize: "0.7rem" }}>{n.state.toUpperCase()}</span>
                  </div>,
                ];
              })}
            </div>
          )}

          {/* Color strip below node table */}
          <div style={{ flexGrow: 1, background: "linear-gradient(90deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)" }} />
        </div>

        {/* Gradient divider — full height */}
        <div style={{ background: "linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)" }} />

        {/* Right column: controls + terminal */}
        <div style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Lab controls */}
          <div
            style={{
              backgroundColor: "#F2F2F2",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span className="label" style={{ fontSize: "0.65rem", opacity: 0.5 }}>LAB ID</span>
              <span className="mono" style={{ fontSize: "0.7rem" }}>{lab.uuid.slice(0, 8)}</span>
            </div>
            {lab.state === "stopped" || lab.state === "failed" || lab.state === "scheduled" ? (
              <ArrowButton
                label={actionLoading === "deploy" ? "Deploying..." : "Deploy"}
                onClick={() => handleAction("deploy")}
                disabled={!!actionLoading}
              />
            ) : (
              <ArrowButton
                label={actionLoading === "destroy" ? "Destroying..." : "Stop & Destroy"}
                onClick={() => handleAction("destroy")}
                disabled={!!actionLoading}
                inverted
              />
            )}
            <ArrowButton label="Delete Lab" inverted onClick={handleDelete} />
          </div>

          {/* Terminal */}
          {selectedNode && isLive ? (
            <TerminalPanel
              labUuid={lab.uuid}
              nodeName={selectedNode}
              nodeImage={lab.nodes?.find((n) => n.name === selectedNode)?.image}
            />
          ) : (
            <div
              style={{
                backgroundColor: "#0A0A0A",
                color: "#F2F2F2",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
              }}
            >
              <span className="label" style={{ opacity: 0.3, textAlign: "center" }}>
                {isLive
                  ? "SELECT A NODE TO OPEN TERMINAL"
                  : "DEPLOY LAB TO ACCESS TERMINAL"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
