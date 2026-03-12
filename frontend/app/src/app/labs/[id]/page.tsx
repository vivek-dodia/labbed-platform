"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import TopologyCanvas from "@/components/topology/TopologyCanvas";
import StatusBadge from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { useWSChannel, useShellInput } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";
import { parseContainerlabYAML } from "@/lib/yaml-parser";
import type { LabResponse, NodeResponse, TopologyResponse } from "@/types/api";

/* ── Quick-command definitions ── */
interface QuickCmd { label: string; cmd: string; description: string }

const FRR_COMMANDS: QuickCmd[] = [
  { label: "ROUTES", cmd: "vtysh -c 'show ip route'", description: "IP routing table" },
  { label: "BGP", cmd: "vtysh -c 'show bgp summary'", description: "BGP peer status" },
  { label: "OSPF", cmd: "vtysh -c 'show ip ospf neighbor'", description: "OSPF adjacencies" },
  { label: "INTF", cmd: "vtysh -c 'show interface brief'", description: "Interface status" },
  { label: "CONFIG", cmd: "vtysh -c 'show running-config'", description: "Active configuration" },
];

const LINUX_COMMANDS: QuickCmd[] = [
  { label: "IP ADDR", cmd: "ip addr show", description: "Interface addresses" },
  { label: "ROUTE", cmd: "ip route show", description: "Routing table" },
  { label: "PING", cmd: "ping -c 3 8.8.8.8", description: "Internet connectivity" },
  { label: "ARP", cmd: "ip neigh show", description: "ARP/neighbor cache" },
  { label: "PORTS", cmd: "netstat -tlnp 2>/dev/null || ss -tlnp", description: "Listening ports" },
];

const DNSMASQ_COMMANDS: QuickCmd[] = [
  { label: "LEASES", cmd: "cat /var/lib/misc/dnsmasq.leases 2>/dev/null || echo 'No leases'", description: "DHCP leases" },
  { label: "CONF", cmd: "cat /etc/dnsmasq.conf", description: "Dnsmasq config" },
  { label: "IP ADDR", cmd: "ip addr show", description: "Interface addresses" },
  { label: "ROUTE", cmd: "ip route show", description: "Routing table" },
];

function getCommandsForImage(image: string): { category: string; commands: QuickCmd[] } {
  const img = image.toLowerCase();
  if (img.includes("frr") || img.includes("frrouting")) return { category: "FRR", commands: FRR_COMMANDS };
  if (img.includes("dnsmasq") || img.includes("kea")) return { category: "DHCP/DNS", commands: DNSMASQ_COMMANDS };
  return { category: "LINUX", commands: LINUX_COMMANDS };
}

/** Strip the long clab prefix from node names for display */
function shortName(name: string): string {
  // containerlab names are like "clab-<lab>-<node>", show just the node part
  const parts = name.split("-");
  if (parts.length > 2 && parts[0] === "clab") return parts.slice(2).join("-");
  return name;
}

const BG = "#79f673";
const INK = "#000000";
const BORDER = "1px solid #000000";
const FONT = "'Manrope', -apple-system, sans-serif";
const MONO = "'Space Mono', monospace";
const LABEL: React.CSSProperties = { fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 };

export default function LabDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [lab, setLab] = useState<LabResponse | null>(null);
  const [topology, setTopology] = useState<TopologyResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState("");

  /* Terminal state */
  interface TermLine { type: "input" | "output"; text: string }
  const [termLines, setTermLines] = useState<TermLine[]>([]);
  const [termInput, setTermInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendInput = useShellInput();

  const shellChannel = lab && selectedNode ? `shell:${lab.uuid}:${selectedNode}` : null;

  const handleShellMessage = useCallback((data: unknown) => {
    const d = data as { output?: string };
    if (d.output) setTermLines((prev) => [...prev, { type: "output", text: d.output! }]);
  }, []);
  useWSChannel(shellChannel, handleShellMessage);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [termLines]);
  useEffect(() => { setTermLines([]); setTermInput(""); }, [selectedNode]);

  const runCommand = useCallback((cmd: string) => {
    if (!shellChannel) return;
    setTermLines((prev) => [...prev, { type: "input", text: cmd }]);
    sendInput(shellChannel, cmd + "\n");
    inputRef.current?.focus();
  }, [shellChannel, sendInput]);

  const handleTermKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && termInput.trim()) { runCommand(termInput); setTermInput(""); }
  };

  /* Load lab + topology */
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    api.get<LabResponse>(`/api/v1/labs/${id}`).then((l) => {
      setLab(l);
      // Don't auto-select a node — canvas starts full screen
      api.get<TopologyResponse>(`/api/v1/topologies/${l.topologyId}`).then(setTopology).catch(() => {});
    });
  }, [id, user, authLoading, router]);

  /* WebSocket channels */
  useWSChannel(lab ? `lab:${lab.uuid}` : null, useCallback((data: unknown) => { setLab(data as LabResponse); }, []));
  useWSChannel(lab ? `lab:${lab.uuid}:nodes` : null, useCallback((data: unknown) => {
    const nodes = data as NodeResponse[];
    setLab((prev) => (prev ? { ...prev, nodes } : prev));
  }, []));

  /* Polling */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const updated = await api.get<LabResponse>(`/api/v1/labs/${id}`);
        setLab(updated);
        // Don't auto-select — user clicks a node to open terminal
        if (updated.state !== "deploying" && updated.state !== "stopping") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [id, selectedNode]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  /* Actions */
  const handleAction = useCallback(async (action: "deploy" | "destroy") => {
    setActionLoading(action);
    try {
      await api.post(`/api/v1/labs/${id}/${action}`, {});
      const updated = await api.get<LabResponse>(`/api/v1/labs/${id}`);
      setLab(updated);
      startPolling();
    } finally { setActionLoading(""); }
  }, [id, startPolling]);

  const handleDelete = useCallback(async () => {
    await api.del(`/api/v1/labs/${id}`);
    router.push("/");
  }, [id, router]);

  /* Loading */
  if (!lab) {
    return (
      <div style={{ backgroundColor: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <span style={{ ...LABEL, opacity: 0.4 }}>LOADING LAB...</span>
      </div>
    );
  }

  const nodeStates: Record<string, string> = {};
  lab.nodes?.forEach((n) => { nodeStates[n.name] = n.state; });
  const isLive = lab.state === "running" || lab.state === "deploying";
  const canDeploy = lab.state === "stopped" || lab.state === "failed" || lab.state === "scheduled";
  const selectedNodeData = lab.nodes?.find((n) => n.name === selectedNode);
  const { category: cmdCategory, commands: quickCommands } = getCommandsForImage(selectedNodeData?.image || "");
  const nodeCount = lab.nodes?.length || 0;
  const showTerminal = selectedNode !== null && isLive;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: BG, color: INK, fontFamily: FONT, overflow: "hidden" }}>

      {/* Sidebar 48px */}
      <aside style={{ width: 48, minWidth: 48, borderRight: BORDER, display: "flex", flexDirection: "column", alignItems: "center", padding: "1rem 0" }}>
        <Link href="/" style={{ textDecoration: "none", color: INK }}>
          <div style={{ width: 24, height: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer" }}>
            <span style={{ display: "block", height: 1, backgroundColor: INK, width: "100%" }} />
            <span style={{ display: "block", height: 1, backgroundColor: INK, width: "100%" }} />
            <span style={{ display: "block", height: 1, backgroundColor: INK, width: "100%" }} />
          </div>
        </Link>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Top bar */}
        <header style={{ height: 48, minHeight: 48, borderBottom: BORDER, display: "flex", alignItems: "stretch" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", padding: "0 1.25rem", borderRight: BORDER, textDecoration: "none", color: INK, fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            LABBED
          </Link>
          <Link href="/" style={{ display: "flex", alignItems: "center", padding: "0 1.25rem", borderRight: BORDER, textDecoration: "none", color: INK, fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.6 }}>
            &larr; LABS
          </Link>
          <div style={{ display: "flex", alignItems: "center", padding: "0 1.25rem", borderRight: BORDER, gap: "0.75rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{lab.name}</span>
            <StatusBadge state={lab.state} />
          </div>
          <div style={{ display: "flex", alignItems: "center", padding: "0 1.25rem", gap: "1.5rem" }}>
            <span style={{ ...LABEL, opacity: 0.5 }}>{nodeCount} NODES</span>
            <span style={{ ...LABEL, opacity: 0.5, fontFamily: MONO, fontSize: "0.65rem" }}>{lab.uuid.slice(0, 8)}</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0 1.25rem" }}>
            {canDeploy && (
              <button onClick={() => handleAction("deploy")} disabled={!!actionLoading} style={{ ...pillStyle, backgroundColor: INK, color: BG }}>
                {actionLoading === "deploy" ? "DEPLOYING..." : "DEPLOY"}
              </button>
            )}
            {isLive && (
              <button onClick={() => handleAction("destroy")} disabled={!!actionLoading} style={{ ...pillStyle, borderStyle: "dashed" }}>
                {actionLoading === "destroy" ? "..." : "DESTROY"}
              </button>
            )}
            <button onClick={handleDelete} style={{ ...pillStyle, borderStyle: "dashed", opacity: 0.5 }}>
              DELETE
            </button>
          </div>
        </header>

        {/* Error bar */}
        {lab.errorMessage && (
          <div style={{ padding: "0.6rem 1.25rem", backgroundColor: INK, color: BG, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            ERROR: {lab.errorMessage}
          </div>
        )}

        {/* Main workspace */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* ── Canvas section: fills all space when no terminal, shrinks to 40% with terminal ── */}
          <div style={{ flex: showTerminal ? undefined : 1, height: showTerminal ? "40%" : undefined, minHeight: showTerminal ? 180 : undefined, display: "flex", borderBottom: showTerminal ? BORDER : "none", overflow: "hidden", transition: "height 0.2s" }}>

            {/* Topology canvas */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
              <div style={{ padding: "0.5rem 1rem", borderBottom: BORDER, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={LABEL}>TOPOLOGY</span>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  {showTerminal && (
                    <button
                      onClick={() => { setSelectedNode(null); }}
                      style={{ ...LABEL, opacity: 0.4, cursor: "pointer", background: "none", border: "none", color: INK, fontFamily: FONT, fontSize: "0.6rem" }}
                    >
                      ✕ CLOSE TERMINAL
                    </button>
                  )}
                  <span style={{ ...LABEL, opacity: 0.4 }}>{topology?.name || ""}</span>
                </div>
              </div>
              <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                {topology ? (
                  <TopologyCanvas
                    definition={topology.definition}
                    selectedNode={selectedNode}
                    onSelectNode={(name) => setSelectedNode(name || null)}
                    nodeStates={nodeStates}
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.2 }}>
                    <span style={LABEL}>LOADING TOPOLOGY...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Node list sidebar */}
            <div style={{ width: 220, minWidth: 220, borderLeft: BORDER, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "0.5rem 0.75rem", borderBottom: BORDER }}>
                <span style={LABEL}>NODES</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {(lab.nodes || []).map((node) => {
                  const isSelected = selectedNode === node.name;
                  return (
                    <div
                      key={node.name}
                      onClick={() => setSelectedNode(node.name)}
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderBottom: BORDER,
                        cursor: "pointer",
                        backgroundColor: isSelected ? INK : "transparent",
                        color: isSelected ? BG : INK,
                        transition: "all 0.1s",
                      }}
                    >
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase" }}>{shortName(node.name)}</div>
                      <div style={{ fontSize: "0.65rem", opacity: 0.5, fontFamily: MONO, marginTop: "0.1rem" }}>
                        {node.kind} · {node.state}
                      </div>
                    </div>
                  );
                })}
                {nodeCount === 0 && (
                  <div style={{ padding: "0.75rem", opacity: 0.3 }}>
                    <span style={LABEL}>NO NODES</span>
                  </div>
                )}
              </div>
              {/* Node detail */}
              {selectedNodeData && (() => {
                const sn = shortName(selectedNodeData.name);
                const links = topology ? parseContainerlabYAML(topology.definition).links.filter(
                  (l) => l.a.node === sn || l.b.node === sn
                ).map((l) => l.a.node === sn
                  ? { local: l.a.iface, remote: l.b.iface, peer: l.b.node }
                  : { local: l.b.iface, remote: l.a.iface, peer: l.a.node }
                ) : [];
                return (
                  <div style={{ borderTop: BORDER, padding: "0.6rem 0.75rem" }}>
                    <div style={{ ...LABEL, opacity: 0.5, marginBottom: "0.3rem", fontSize: "0.6rem" }}>SELECTED</div>
                    <div style={{ fontSize: "0.65rem", fontFamily: MONO, lineHeight: 1.7 }}>
                      <div>IMAGE: {selectedNodeData.image?.split("/").pop()}</div>
                      <div>IPv4: {selectedNodeData.ipv4 || "\u2014"}</div>
                      <div>ID: {(selectedNodeData.containerId || "\u2014").slice(0, 12)}</div>
                    </div>
                    {links.length > 0 && (
                      <div style={{ marginTop: "0.4rem" }}>
                        <div style={{ ...LABEL, opacity: 0.5, marginBottom: "0.2rem", fontSize: "0.55rem" }}>INTERFACES</div>
                        {links.map((l, i) => (
                          <div key={i} style={{ fontSize: "0.6rem", fontFamily: MONO, lineHeight: 1.6, opacity: 0.7 }}>
                            {l.local} → {l.peer}:{l.remote}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Terminal section: only shown when a node is selected ── */}
          {showTerminal && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: INK, color: BG, overflow: "hidden" }}>
              {/* Terminal header with node tabs */}
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", flexShrink: 0 }}>
                <span style={{ padding: "0.5rem 1rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", opacity: 0.3, textTransform: "uppercase" }}>
                  TERMINAL
                </span>
                <div style={{ display: "flex", flex: 1, overflow: "auto" }}>
                  {(lab.nodes || []).map((node) => {
                    const active = selectedNode === node.name;
                    return (
                      <button
                        key={node.name}
                        onClick={() => setSelectedNode(node.name)}
                        style={{
                          padding: "0.5rem 1rem",
                          background: active ? "rgba(255,255,255,0.1)" : "transparent",
                          border: "none",
                          borderLeft: "1px solid rgba(255,255,255,0.06)",
                          color: active ? BG : "rgba(121,246,115,0.4)",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          cursor: "pointer",
                          fontFamily: FONT,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shortName(node.name)}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 5, padding: "0 1rem", flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
                </div>
              </div>

              {selectedNode && isLive ? (
                <>
                  {/* Terminal output */}
                  <div
                    ref={scrollRef}
                    className="terminal-scroll"
                    style={{
                      flex: 1,
                      minHeight: 0,
                      padding: "1rem 1.25rem",
                      fontFamily: MONO,
                      fontSize: "0.85rem",
                      lineHeight: 1.7,
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {termLines.map((line, i) => (
                      <div key={i}>
                        {line.type === "input" ? (
                          <>
                            <span style={{ color: "rgba(121,246,115,0.5)" }}>{shortName(selectedNode)}#</span>{" "}
                            <span style={{ color: BG }}>{line.text}</span>
                          </>
                        ) : (
                          <span style={{ opacity: 0.6 }}>{line.text}</span>
                        )}
                      </div>
                    ))}
                    {/* Input */}
                    <div style={{ display: "flex" }}>
                      <span style={{ color: "rgba(121,246,115,0.5)" }}>{shortName(selectedNode)}#</span>&nbsp;
                      <input
                        ref={inputRef}
                        value={termInput}
                        onChange={(e) => setTermInput(e.target.value)}
                        onKeyDown={handleTermKeyDown}
                        style={{
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          color: BG,
                          fontFamily: MONO,
                          fontSize: "0.85rem",
                          flex: 1,
                          caretColor: BG,
                        }}
                        autoFocus
                        spellCheck={false}
                        placeholder="_"
                      />
                    </div>
                  </div>

                  {/* Quick commands */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "0.6rem 1.25rem", flexShrink: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, opacity: 0.3, marginRight: "0.25rem" }}>
                        {cmdCategory}:
                      </span>
                      {quickCommands.map((qc) => (
                        <button
                          key={qc.label}
                          onClick={() => runCommand(qc.cmd)}
                          title={qc.description}
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 99,
                            color: BG,
                            fontSize: "0.6rem",
                            padding: "0.25rem 0.6rem",
                            cursor: "pointer",
                            fontFamily: FONT,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {qc.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ ...LABEL, opacity: 0.2, textAlign: "center", fontSize: "0.8rem" }}>
                    {isLive ? "SELECT A NODE TO OPEN TERMINAL" : "DEPLOY LAB TO ACCESS TERMINAL"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  padding: "0.35rem 1rem",
  borderRadius: 99,
  border: "1px solid #000000",
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
  fontFamily: "'Manrope', -apple-system, sans-serif",
  background: "transparent",
  color: "#000000",
};
