"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import TopologyCanvas from "@/components/topology/TopologyCanvas";
import { useAuth } from "@/hooks/useAuth";
import { useWSChannel, useShellInput } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";
import type { LabResponse, NodeResponse, TopologyResponse } from "@/types/api";

/* ── Quick‑command definitions ── */
interface QuickCmd { label: string; cmd: string; description: string }

const FRR_COMMANDS: QuickCmd[] = [
  { label: "SHOW ROUTES", cmd: "vtysh -c 'show ip route'", description: "IP routing table" },
  { label: "BGP SUMMARY", cmd: "vtysh -c 'show bgp summary'", description: "BGP peer status" },
  { label: "BGP ROUTES", cmd: "vtysh -c 'show bgp ipv4 unicast'", description: "BGP learned routes" },
  { label: "OSPF NEIGHBORS", cmd: "vtysh -c 'show ip ospf neighbor'", description: "OSPF adjacencies" },
  { label: "INTERFACES", cmd: "vtysh -c 'show interface brief'", description: "Interface status" },
  { label: "RUNNING CONFIG", cmd: "vtysh -c 'show running-config'", description: "Active configuration" },
];

const LINUX_COMMANDS: QuickCmd[] = [
  { label: "IP ADDR", cmd: "ip addr show", description: "Interface addresses" },
  { label: "IP ROUTE", cmd: "ip route show", description: "Routing table" },
  { label: "PING TEST", cmd: "ping -c 3 8.8.8.8", description: "Internet connectivity" },
  { label: "ARP TABLE", cmd: "ip neigh show", description: "ARP/neighbor cache" },
  { label: "NETSTAT", cmd: "netstat -tlnp 2>/dev/null || ss -tlnp", description: "Listening ports" },
  { label: "PROCESSES", cmd: "ps aux", description: "Running processes" },
];

const DNSMASQ_COMMANDS: QuickCmd[] = [
  { label: "DHCP LEASES", cmd: "cat /var/lib/misc/dnsmasq.leases 2>/dev/null || echo 'No leases file'", description: "Active DHCP leases" },
  { label: "DNSMASQ CONF", cmd: "cat /etc/dnsmasq.conf", description: "Dnsmasq configuration" },
  { label: "IP ADDR", cmd: "ip addr show", description: "Interface addresses" },
  { label: "LISTENING", cmd: "netstat -ulnp 2>/dev/null || ss -ulnp", description: "UDP listeners" },
  { label: "IP ROUTE", cmd: "ip route show", description: "Routing table" },
  { label: "PROCESSES", cmd: "ps aux", description: "Running processes" },
];

function getCommandsForImage(image: string): { category: string; commands: QuickCmd[] } {
  const img = image.toLowerCase();
  if (img.includes("frr") || img.includes("frrouting")) return { category: "FRR", commands: FRR_COMMANDS };
  if (img.includes("dnsmasq") || img.includes("kea")) return { category: "DHCP/DNS", commands: DNSMASQ_COMMANDS };
  return { category: "LINUX", commands: LINUX_COMMANDS };
}

/* ── Inline Pill button ── */
function Pill({
  children,
  onClick,
  variant,
  disabled,
  style: extraStyle,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const bg =
    variant === "primary"
      ? "#ED6A4A"
      : variant === "secondary"
        ? "#A2C2ED"
        : "#F3EFE7";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.5rem 1.2rem",
        borderRadius: "99px",
        border: "1px solid #121212",
        fontSize: "0.75rem",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        gap: "0.5rem",
        backgroundColor: bg,
        textTransform: "uppercase",
        transition: "all 0.2s",
        fontFamily: "'Manrope', -apple-system, sans-serif",
        transform: hovered && !disabled ? "translateY(-2px)" : "none",
        boxShadow: hovered && !disabled ? "4px 4px 0 #121212" : "none",
        opacity: disabled ? 0.5 : 1,
        letterSpacing: "0.05em",
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

/* ── Page ── */
export default function LabDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [lab, setLab] = useState<LabResponse | null>(null);
  const [topology, setTopology] = useState<TopologyResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState("");

  /* ── Terminal state (inlined from TerminalPanel) ── */
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

  const runCommand = useCallback(
    (cmd: string) => {
      if (!shellChannel) return;
      setTermLines((prev) => [...prev, { type: "input", text: cmd }]);
      sendInput(shellChannel, cmd + "\n");
      inputRef.current?.focus();
    },
    [shellChannel, sendInput],
  );

  const handleTermKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && termInput.trim()) {
      runCommand(termInput);
      setTermInput("");
    }
  };

  /* ── Load lab + topology ── */
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    api.get<LabResponse>(`/api/v1/labs/${id}`).then((l) => {
      setLab(l);
      if (l.nodes?.length > 0) setSelectedNode(l.nodes[0].name);
      api.get<TopologyResponse>(`/api/v1/topologies/${l.topologyId}`)
        .then(setTopology)
        .catch(() => {});
    });
  }, [id, user, authLoading, router]);

  /* ── WebSocket: lab state ── */
  const handleLabState = useCallback((data: unknown) => { setLab(data as LabResponse); }, []);
  useWSChannel(lab ? `lab:${lab.uuid}` : null, handleLabState);

  /* ── WebSocket: node updates ── */
  const handleNodeUpdate = useCallback((data: unknown) => {
    const nodes = data as NodeResponse[];
    setLab((prev) => (prev ? { ...prev, nodes } : prev));
  }, []);
  useWSChannel(lab ? `lab:${lab.uuid}:nodes` : null, handleNodeUpdate);

  /* ── Polling for state transitions ── */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const updated = await api.get<LabResponse>(`/api/v1/labs/${id}`);
        setLab(updated);
        if (updated.nodes?.length > 0 && !selectedNode) setSelectedNode(updated.nodes[0].name);
        if (updated.state !== "deploying" && updated.state !== "stopping") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [id, selectedNode]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  /* ── Actions ── */
  const handleAction = useCallback(
    async (action: "deploy" | "destroy") => {
      setActionLoading(action);
      try {
        await api.post(`/api/v1/labs/${id}/${action}`, {});
        const updated = await api.get<LabResponse>(`/api/v1/labs/${id}`);
        setLab(updated);
        startPolling();
      } finally { setActionLoading(""); }
    },
    [id, startPolling],
  );

  const handleClone = useCallback(async () => {
    setActionLoading("clone");
    try {
      await api.post(`/api/v1/labs/${id}/clone`, {});
    } finally { setActionLoading(""); }
  }, [id]);

  const handleDelete = useCallback(async () => {
    await api.del(`/api/v1/labs/${id}`);
    router.push("/");
  }, [id, router]);

  /* ── Derived ── */
  if (!lab) {
    return (
      <div style={{ backgroundColor: "#F3EFE7", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Manrope', -apple-system, sans-serif" }}>
        <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, opacity: 0.4, color: "#121212" }}>LOADING LAB...</span>
      </div>
    );
  }

  const nodeStates: Record<string, string> = {};
  lab.nodes?.forEach((n) => { nodeStates[n.name] = n.state; });
  const isLive = lab.state === "running" || lab.state === "deploying";
  const canDeploy = lab.state === "stopped" || lab.state === "failed" || lab.state === "scheduled";
  const selectedNodeData = lab.nodes?.find((n) => n.name === selectedNode);
  const { category: cmdCategory, commands: quickCommands } = getCommandsForImage(selectedNodeData?.image || "");

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return "\u2014";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const nodeCount = lab.nodes?.length || 0;
  const runningNodes = lab.nodes?.filter((n) => n.state === "running").length || 0;

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      backgroundColor: "#F3EFE7",
      color: "#121212",
      fontFamily: "'Manrope', -apple-system, sans-serif",
      WebkitFontSmoothing: "antialiased",
      overflow: "hidden",
    }}>
      {/* ── Left sidebar (48px) ── */}
      <aside style={{
        width: "48px",
        borderRight: "1px solid #121212",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1rem 0",
        flexShrink: 0,
        backgroundColor: "#F3EFE7",
        zIndex: 10,
      }}>
        {/* Hamburger */}
        <div style={{ width: "24px", height: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: "2rem", cursor: "pointer" }}>
          <span style={{ display: "block", height: "1px", backgroundColor: "#121212", width: "100%" }} />
          <span style={{ display: "block", height: "1px", backgroundColor: "#121212", width: "100%" }} />
          <span style={{ display: "block", height: "1px", backgroundColor: "#121212", width: "100%" }} />
        </div>
        {/* Vertical text */}
        <div style={{ writingMode: "vertical-rl", transform: "scale(-1)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", gap: "1rem", display: "flex" }}>
          <span style={{ opacity: 1 }}>CLI</span>
          <span style={{ opacity: 0.5, cursor: "pointer" }}>GUI</span>
          <span style={{ opacity: 0.5, cursor: "pointer" }}>API</span>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── Top nav (48px) ── */}
        <nav style={{
          height: "48px",
          borderBottom: "1px solid #121212",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#F3EFE7",
          zIndex: 5,
        }}>
          <div style={{ display: "flex", height: "100%" }}>
            <Link href="/" style={{
              padding: "0 1.5rem", display: "flex", alignItems: "center",
              borderRight: "1px solid #121212", fontSize: "0.75rem", textTransform: "uppercase",
              letterSpacing: "0.05em", fontWeight: 800, cursor: "pointer", textDecoration: "none", color: "#121212",
            }}>
              LABBED
            </Link>
            <Link href="/" style={{
              padding: "0 1.5rem", display: "flex", alignItems: "center",
              borderRight: "1px solid #121212", fontSize: "0.75rem", textTransform: "uppercase",
              letterSpacing: "0.05em", fontWeight: 700, cursor: "pointer", textDecoration: "none", color: "#121212",
            }}>
              &larr; BACK TO TOPOLOGIES
            </Link>
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            <Link href="/" style={{
              padding: "0 1.5rem", display: "flex", alignItems: "center",
              borderLeft: "1px solid #121212", fontSize: "0.75rem", textTransform: "uppercase",
              letterSpacing: "0.05em", fontWeight: 700, cursor: "pointer", textDecoration: "none", color: "#121212",
            }}>
              DASHBOARD
            </Link>
            <div style={{
              padding: "0 1.5rem", display: "flex", alignItems: "center",
              borderLeft: "1px solid #121212", fontSize: "0.75rem", textTransform: "uppercase",
              letterSpacing: "0.05em", fontWeight: 700,
              backgroundColor: isLive ? "#E4CB6A" : "transparent",
            }}>
              {isLive ? "LIVE SESSION \u2022 ACTIVE" : `STATUS \u2022 ${lab.state.toUpperCase()}`}
            </div>
          </div>
        </nav>

        {/* ── 2-column workspace ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", flexGrow: 1, overflow: "hidden" }}>

          {/* ═══ LEFT: Canvas area ═══ */}
          <section style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #121212", position: "relative", background: "#fff" }}>

            {/* Canvas header */}
            <header style={{
              padding: "2rem",
              borderBottom: "1px solid #121212",
              backgroundColor: "#F3EFE7",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}>
              <div>
                <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: "#ED6A4A" }}>
                  PROJECT ID: {lab.uuid.slice(0, 8).toUpperCase()}
                </span>
                <h1 style={{
                  fontFamily: "'Manrope', -apple-system, sans-serif",
                  fontWeight: 200,
                  fontSize: "clamp(2.5rem, 4vw, 4rem)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  marginTop: "0.25rem",
                }}>
                  {lab.name}
                </h1>
                <div style={{ display: "flex", gap: "2rem", marginTop: "1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>NODES</span>
                    <span style={{ fontSize: "0.75rem", lineHeight: 1.4 }}>
                      {String(nodeCount).padStart(2, "0")} Virtual Instances
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>STATUS</span>
                    <span style={{ fontSize: "0.75rem", lineHeight: 1.4 }}>
                      {runningNodes}/{nodeCount} Running
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>DEPLOYED</span>
                    <span style={{ fontSize: "0.75rem", lineHeight: 1.4 }}>{timeAgo(lab.deployedAt)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>TOPOLOGY</span>
                    <span style={{ fontSize: "0.75rem", lineHeight: 1.4 }}>{topology?.name || lab.topologyId.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
            </header>

            {/* Topology view */}
            <div style={{ flexGrow: 1, position: "relative", overflow: "hidden", minHeight: 280 }}>
              {/* Grid overlay */}
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: "linear-gradient(to right, rgba(18,18,18,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(18,18,18,0.05) 1px, transparent 1px)",
                backgroundSize: "30px 30px",
                pointerEvents: "none",
                zIndex: 0,
              }} />
              {topology ? (
                <TopologyCanvas
                  definition={topology.definition}
                  selectedNode={selectedNode}
                  onSelectNode={setSelectedNode}
                  nodeStates={nodeStates}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.3 }}>
                  <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>TOPOLOGY CANVAS</span>
                </div>
              )}
            </div>

            {/* Actions bar */}
            <div style={{
              padding: "1rem 2rem",
              borderTop: "1px solid #121212",
              backgroundColor: "#F3EFE7",
              display: "flex",
              gap: "1rem",
              alignItems: "center",
            }}>
              {canDeploy ? (
                <Pill variant="primary" onClick={() => handleAction("deploy")} disabled={!!actionLoading}>
                  {actionLoading === "deploy" ? "DEPLOYING..." : "DEPLOY TO CLUSTER"} &darr;
                </Pill>
              ) : (
                <Pill variant="primary" disabled style={{ backgroundColor: "#A8EAB5" }}>
                  DEPLOYED
                </Pill>
              )}
              <Pill variant="secondary" onClick={handleClone} disabled={!!actionLoading}>
                CLONE TOPOLOGY
              </Pill>
              <Pill>EXPORT YAML</Pill>
              {isLive && (
                <Pill
                  onClick={() => handleAction("destroy")}
                  disabled={!!actionLoading}
                  style={{ borderStyle: "dashed", color: "#ED6A4A" }}
                >
                  {actionLoading === "destroy" ? "DESTROYING..." : "DESTROY"}
                </Pill>
              )}
              <div style={{ flexGrow: 1 }} />
              <Pill onClick={handleDelete} style={{ borderStyle: "dashed" }}>
                DELETE LAB
              </Pill>
            </div>

            {/* Error message if any */}
            {lab.errorMessage && (
              <div style={{
                padding: "0.6rem 2rem",
                backgroundColor: "#ED6A4A",
                color: "#fff",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                ERROR: {lab.errorMessage}
              </div>
            )}
          </section>

          {/* ═══ RIGHT: Terminal panel ═══ */}
          <aside style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#121212",
            color: "#F3EFE7",
            overflow: "hidden",
          }}>
            {/* Terminal header */}
            <div style={{
              padding: "1rem",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, opacity: 0.7 }}>
                CLI OUTPUT {selectedNode ? `\u2014 ${selectedNode}` : ""}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff5f56" }} />
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ffbd2e" }} />
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#27c93f" }} />
              </div>
            </div>

            {selectedNode && isLive ? (
              <>
                {/* Terminal output */}
                <div
                  ref={scrollRef}
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    minHeight: 0,
                    padding: "1.5rem",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.8rem",
                    lineHeight: 1.6,
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {termLines.map((line, i) => (
                    <div key={i}>
                      {line.type === "input" ? (
                        <>
                          <span style={{ color: "#EAA8C6" }}>{selectedNode}#</span>{" "}
                          <span style={{ color: "#E4CB6A" }}>{line.text}</span>
                        </>
                      ) : (
                        <span style={{ opacity: 0.5 }}>{line.text}</span>
                      )}
                    </div>
                  ))}

                  {/* Input line */}
                  <div style={{ display: "flex" }}>
                    <span style={{ color: "#EAA8C6" }}>{selectedNode}#</span>&nbsp;
                    <input
                      ref={inputRef}
                      value={termInput}
                      onChange={(e) => setTermInput(e.target.value)}
                      onKeyDown={handleTermKeyDown}
                      style={{
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: "#E4CB6A",
                        fontFamily: "'Space Mono', monospace",
                        fontSize: "0.8rem",
                        flexGrow: 1,
                        caretColor: "#E4CB6A",
                      }}
                      autoFocus
                      spellCheck={false}
                      placeholder="_"
                    />
                  </div>
                </div>

                {/* Quick commands */}
                <div style={{
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  padding: "0.6rem 1rem",
                  flexShrink: 0,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, opacity: 0.4 }}>
                      QUICK COMMANDS &mdash; {cmdCategory}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {quickCommands.map((qc) => (
                      <button
                        key={qc.label}
                        onClick={() => runCommand(qc.cmd)}
                        title={`${qc.description}\n${qc.cmd}`}
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "99px",
                          color: "#F3EFE7",
                          fontSize: "0.55rem",
                          padding: "0.25rem 0.6rem",
                          cursor: "pointer",
                          fontFamily: "'Manrope', -apple-system, sans-serif",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                        }}
                      >
                        {qc.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{
                flexGrow: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
              }}>
                <span style={{
                  fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em",
                  fontWeight: 700, opacity: 0.3, textAlign: "center",
                }}>
                  {isLive ? "SELECT A NODE TO OPEN TERMINAL" : "DEPLOY LAB TO ACCESS TERMINAL"}
                </span>
              </div>
            )}

            {/* Terminal footer */}
            <div style={{
              padding: "1rem",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, opacity: 0.5 }}>
                CONNECTED VIA SSH V2
              </span>
              <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: "#EAA8C6" }}>
                LATENCY: 4MS
              </span>
            </div>
          </aside>
        </div>
      </main>

      {/* Global styles for fonts + animations */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;500;700;800&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        @keyframes dash { to { stroke-dashoffset: -1000; } }
        .svg-animated path {
          stroke: #121212;
          stroke-width: 1.5px;
          fill: none;
          stroke-dasharray: 6;
          animation: dash 30s linear infinite;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #121212; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
      `}</style>
    </div>
  );
}
