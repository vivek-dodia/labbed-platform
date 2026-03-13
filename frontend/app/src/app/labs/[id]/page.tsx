"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import TopologyCanvas, { type LinkEndpoint } from "@/components/topology/TopologyCanvas";
import StatusBadge from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { useWSChannel, useShellInput, useWSStatus } from "@/hooks/useWebSocket";
import { api } from "@/lib/api";
import { parseContainerlabYAML } from "@/lib/yaml-parser";
import DeployConfigModal from "@/components/DeployConfigModal";
import type { LabResponse, NodeResponse, TopologyResponse, LabEventResponse, PaginatedResponse, BindFileResponse } from "@/types/api";

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
  const parts = name.split("-");
  if (parts.length > 2 && parts[0] === "clab") return parts.slice(2).join("-");
  return name;
}

/** Format elapsed time as HH:MM:SS */
function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Format relative time for events */
function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* Router detection for routing table feature */
const ROUTER_IMAGES = ["frr", "frrouting", "srl", "ceos", "xrd", "vyos", "bird", "quagga", "gobgp"];
function isRouterNode(node: NodeResponse): boolean {
  const img = node.image.toLowerCase();
  return ROUTER_IMAGES.some((r) => img.includes(r));
}

/* ── YAML syntax highlighting ── */
function highlightYamlLine(line: string): React.ReactNode {
  // Comment
  if (line.trimStart().startsWith("#")) {
    return <span style={{ color: "rgba(121,246,115,0.35)", fontStyle: "italic" }}>{line}</span>;
  }

  // Key: value pattern
  const kvMatch = line.match(/^(\s*)([\w-]+)(\s*:\s*)(.*)/);
  if (kvMatch) {
    const [, indent, key, colon, value] = kvMatch;
    let valueEl: React.ReactNode = <span style={{ color: "#79f673" }}>{value}</span>;

    // Highlight specific value types
    const trimVal = value.trim();
    if (trimVal === "true" || trimVal === "false") {
      valueEl = <span style={{ color: "#ffbd2e" }}>{value}</span>;
    } else if (/^\d+$/.test(trimVal)) {
      valueEl = <span style={{ color: "#ffbd2e" }}>{value}</span>;
    } else if (trimVal.startsWith('"') || trimVal.startsWith("'")) {
      valueEl = <span style={{ color: "#a8e6a1" }}>{value}</span>;
    } else if (trimVal === "" || trimVal === "|" || trimVal === ">") {
      valueEl = <span style={{ color: "rgba(121,246,115,0.5)" }}>{value}</span>;
    }

    return (
      <>
        <span>{indent}</span>
        <span style={{ color: "#4af" }}>{key}</span>
        <span style={{ color: "rgba(121,246,115,0.4)" }}>{colon}</span>
        {valueEl}
      </>
    );
  }

  // List item: "- something"
  const listMatch = line.match(/^(\s*)(- )(.*)/);
  if (listMatch) {
    const [, indent, dash, rest] = listMatch;
    return (
      <>
        <span>{indent}</span>
        <span style={{ color: "#ffbd2e" }}>{dash}</span>
        <span style={{ color: "#79f673" }}>{rest}</span>
      </>
    );
  }

  return <span style={{ color: "#79f673" }}>{line}</span>;
}

/* ── Simple line diff ── */
function computeLineDiff(a: string, b: string): { type: "same" | "added" | "removed"; line: string }[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const result: { type: "same" | "added" | "removed"; line: string }[] = [];

  const aSet = new Set(aLines);
  const bSet = new Set(bLines);

  // Show lines from B (running config) annotated against A (startup config)
  for (const line of bLines) {
    if (aSet.has(line)) {
      result.push({ type: "same", line });
    } else {
      result.push({ type: "added", line });
    }
  }
  // Lines in A not in B (removed)
  for (const line of aLines) {
    if (!bSet.has(line) && line.trim() !== "") {
      result.push({ type: "removed", line });
    }
  }

  return result;
}

const BG = "#79f673";
const INK = "#000000";
const BORDER = "1px solid #000000";
const FONT = "'Manrope', -apple-system, sans-serif";
const MONO = "'Space Mono', monospace";
const LABEL: React.CSSProperties = { fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 };

type BottomTab = "terminal" | "logs" | "events" | "yaml" | "bulk";

/* ── Terminal line type ── */
interface TermLine { type: "input" | "output"; text: string }

export default function LabDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const wsStatus = useWSStatus();

  const [lab, setLab] = useState<LabResponse | null>(null);
  const [topology, setTopology] = useState<TopologyResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState("");
  const [showDeployModal, setShowDeployModal] = useState(false);

  /* Bottom panel state */
  const [bottomTab, setBottomTab] = useState<BottomTab>("terminal");
  const [bottomOpen, setBottomOpen] = useState(false);

  /* ── Terminal persistence per node ── */
  const nodeTermBuffers = useRef<Map<string, TermLine[]>>(new Map());
  const [termLines, setTermLines] = useState<TermLine[]>([]);
  const [termInput, setTermInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendInput = useShellInput();

  /* ── Command history ── */
  const cmdHistory = useRef<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  /* Deployment logs state */
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const logsScrollRef = useRef<HTMLDivElement>(null);

  /* Events state */
  const [events, setEvents] = useState<LabEventResponse[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const eventsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Copy feedback state */
  const [copiedField, setCopiedField] = useState<string | null>(null);

  /* Uptime state */
  const [uptime, setUptime] = useState(0);

  /* Ping test state */
  const [pingTarget, setPingTarget] = useState("");
  const [pingResult, setPingResult] = useState<{ status: "pass" | "fail" | "running" | null; output: string }>({ status: null, output: "" });
  const pingOutputRef = useRef<string[]>([]);
  const pingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Traceroute state */
  const [traceTarget, setTraceTarget] = useState("");
  const [traceResult, setTraceResult] = useState<{ status: "running" | "done" | null; output: string }>({ status: null, output: "" });
  const traceOutputRef = useRef<string[]>([]);
  const traceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Bulk command state */
  const [bulkCmd, setBulkCmd] = useState("");
  const [bulkResults, setBulkResults] = useState<Record<string, { status: "running" | "done" | "error"; output: string }>>({});
  const bulkOutputsRef = useRef<Record<string, string[]>>({});
  const bulkTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /* Routing table state */
  const [routeResults, setRouteResults] = useState<Record<string, { status: "running" | "done"; output: string }>>({});
  const routeOutputsRef = useRef<Record<string, string[]>>({});
  const routeTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /* Config diff state */
  const [showConfig, setShowConfig] = useState(false);
  const [configMode, setConfigMode] = useState<"running" | "diff">("running");
  const [runningConfig, setRunningConfig] = useState<{ status: "idle" | "running" | "done"; output: string }>({ status: "idle", output: "" });
  const [startupConfigContent, setStartupConfigContent] = useState<string | null>(null);
  const configOutputRef = useRef<string[]>([]);
  const configTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Packet capture state */
  const [captureActive, setCaptureActive] = useState(false);
  const [captureLink, setCaptureLink] = useState<{ a: LinkEndpoint; b: LinkEndpoint } | null>(null);
  const [captureSide, setCaptureSide] = useState<"a" | "b">("a");
  const [captureFilter, setCaptureFilter] = useState("");
  const [captureLines, setCaptureLines] = useState<string[]>([]);
  const [captureCount, setCaptureCount] = useState(50);
  const captureScrollRef = useRef<HTMLDivElement>(null);

  const shellChannel = lab && selectedNode ? `shell:${lab.uuid}:${selectedNode}` : null;

  /* ── Save current node's term buffer before switching ── */
  const prevNodeRef = useRef<string | null>(null);

  const handleShellMessage = useCallback((data: unknown) => {
    const d = data as { output?: string };
    if (d.output) {
      const line: TermLine = { type: "output", text: d.output! };
      setTermLines((prev) => [...prev, line]);
      // Also save to the per-node buffer
      if (prevNodeRef.current) {
        const buf = nodeTermBuffers.current.get(prevNodeRef.current) || [];
        buf.push(line);
        nodeTermBuffers.current.set(prevNodeRef.current, buf);
      }
    }
  }, []);
  useWSChannel(shellChannel, handleShellMessage);

  /* Deploy logs WS channel */
  const logsChannel = lab && (lab.state === "deploying" || lab.state === "stopping") ? `lab:${lab.uuid}:logs` : null;
  const handleLogMessage = useCallback((data: unknown) => {
    const d = data as { line?: string; message?: string };
    const line = d.line || d.message || String(data);
    setDeployLogs((prev) => [...prev, line]);
  }, []);
  useWSChannel(logsChannel, handleLogMessage);

  /* Auto-switch to logs tab when deploying */
  useEffect(() => {
    if (lab?.state === "deploying") {
      setBottomOpen(true);
      setBottomTab("logs");
      setDeployLogs([]);
    }
  }, [lab?.state]);

  /* Auto-scroll logs */
  useEffect(() => { logsScrollRef.current?.scrollTo(0, logsScrollRef.current.scrollHeight); }, [deployLogs]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [termLines]);

  /* ── Node switch: save old buffer, restore new buffer ── */
  useEffect(() => {
    // Save current lines to previous node's buffer
    if (prevNodeRef.current && termLines.length > 0) {
      nodeTermBuffers.current.set(prevNodeRef.current, [...termLines]);
    }

    // Restore new node's buffer (or empty)
    if (selectedNode) {
      const restored = nodeTermBuffers.current.get(selectedNode);
      setTermLines(restored ? [...restored] : []);
    } else {
      setTermLines([]);
    }

    setTermInput("");
    setHistoryIndex(-1);
    prevNodeRef.current = selectedNode;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode]);

  /* Uptime timer */
  useEffect(() => {
    if (lab?.state !== "running" || !lab?.deployedAt) {
      setUptime(0);
      return;
    }
    const deployedTime = new Date(lab.deployedAt).getTime();
    const update = () => setUptime(Math.floor((Date.now() - deployedTime) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lab?.state, lab?.deployedAt]);

  /* Open bottom panel when node selected + live, close on deselect */
  useEffect(() => {
    if (selectedNode && (lab?.state === "running" || lab?.state === "deploying")) {
      setBottomOpen(true);
      if (bottomTab !== "logs" || lab?.state !== "deploying") {
        setBottomTab("terminal");
      }
    } else if (!selectedNode) {
      setBottomOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode]);

  const runCommand = useCallback((cmd: string) => {
    if (!shellChannel) return;
    const line: TermLine = { type: "input", text: cmd };
    setTermLines((prev) => [...prev, line]);
    // Save to per-node buffer
    if (prevNodeRef.current) {
      const buf = nodeTermBuffers.current.get(prevNodeRef.current) || [];
      buf.push(line);
      nodeTermBuffers.current.set(prevNodeRef.current, buf);
    }
    sendInput(shellChannel, cmd + "\n");
    // Add to command history
    if (cmd.trim()) {
      cmdHistory.current = [cmd, ...cmdHistory.current.filter((c) => c !== cmd)].slice(0, 100);
      setHistoryIndex(-1);
    }
    inputRef.current?.focus();
  }, [shellChannel, sendInput]);

  const handleTermKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && termInput.trim()) {
      runCommand(termInput);
      setTermInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIdx = Math.min(historyIndex + 1, cmdHistory.current.length - 1);
      if (newIdx >= 0 && cmdHistory.current[newIdx]) {
        setHistoryIndex(newIdx);
        setTermInput(cmdHistory.current[newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIdx = historyIndex - 1;
      if (newIdx < 0) {
        setHistoryIndex(-1);
        setTermInput("");
      } else {
        setHistoryIndex(newIdx);
        setTermInput(cmdHistory.current[newIdx]);
      }
    }
  };

  /* Clear terminal */
  const clearTerminal = useCallback(() => {
    setTermLines([]);
    if (prevNodeRef.current) {
      nodeTermBuffers.current.set(prevNodeRef.current, []);
    }
  }, []);

  /* Copy to clipboard */
  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  }, []);

  /* Load lab + topology */
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    api.get<LabResponse>(`/api/v1/labs/${id}`).then((l) => {
      setLab(l);
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
        if (updated.state !== "deploying" && updated.state !== "stopping") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [id]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  /* Actions */
  const handleAction = useCallback(async (action: "deploy" | "destroy") => {
    if (action === "deploy") {
      setShowDeployModal(true);
      return;
    }
    setActionLoading(action);
    try {
      await api.post(`/api/v1/labs/${id}/${action}`, {});
      const updated = await api.get<LabResponse>(`/api/v1/labs/${id}`);
      setLab(updated);
      startPolling();
    } finally { setActionLoading(""); }
  }, [id, startPolling]);

  const handleDeployWithImages = useCallback(async (nodeImages: Record<string, string>) => {
    setActionLoading("deploy");
    try {
      await api.post(`/api/v1/labs/${id}/deploy`, {
        nodeImages: Object.keys(nodeImages).length > 0 ? nodeImages : undefined,
      });
      setShowDeployModal(false);
      const updated = await api.get<LabResponse>(`/api/v1/labs/${id}`);
      setLab(updated);
      startPolling();
    } finally { setActionLoading(""); }
  }, [id, startPolling]);

  const handleClone = useCallback(async () => {
    setActionLoading("clone");
    try {
      const cloned = await api.post<LabResponse>(`/api/v1/labs/${id}/clone`, {});
      router.push(`/labs/${cloned.uuid}`);
    } finally { setActionLoading(""); }
  }, [id, router]);

  const handleDelete = useCallback(async () => {
    await api.del(`/api/v1/labs/${id}`);
    router.push("/");
  }, [id, router]);

  /* ── Events: load + auto-refresh ── */
  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<LabEventResponse>>(`/api/v1/labs/${id}/events?limit=100`);
      setEvents(res.data || []);
      setEventsLoaded(true);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    if (bottomTab === "events" && bottomOpen) {
      fetchEvents();
      // Auto-refresh events every 10s while tab is open
      if (eventsIntervalRef.current) clearInterval(eventsIntervalRef.current);
      eventsIntervalRef.current = setInterval(fetchEvents, 10000);
      return () => {
        if (eventsIntervalRef.current) { clearInterval(eventsIntervalRef.current); eventsIntervalRef.current = null; }
      };
    } else {
      if (eventsIntervalRef.current) { clearInterval(eventsIntervalRef.current); eventsIntervalRef.current = null; }
    }
  }, [bottomTab, bottomOpen, fetchEvents]);

  useEffect(() => { eventsScrollRef.current?.scrollTo(0, eventsScrollRef.current.scrollHeight); }, [events]);

  /* ── Ping test exec via shell relay ── */
  const pingChannel = lab && pingTarget ? `shell:${lab.uuid}:${pingTarget}` : null;

  useWSChannel(pingChannel && pingResult.status === "running" ? pingChannel : null, useCallback((data: unknown) => {
    const d = data as { output?: string };
    if (d.output) {
      pingOutputRef.current.push(d.output);
      if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
      pingTimerRef.current = setTimeout(() => {
        const output = pingOutputRef.current.join("");
        const pass = output.includes("bytes from") || output.includes("0% packet loss");
        setPingResult({ status: pass ? "pass" : "fail", output });
      }, 3000);
    }
  }, [pingResult.status]));

  const runPing = useCallback((targetNode: string) => {
    if (!lab) return;
    const target = lab.nodes?.find((n) => n.name === targetNode);
    if (!target?.ipv4 || !selectedNode) return;
    pingOutputRef.current = [];
    setPingResult({ status: "running", output: "" });
    const channel = `shell:${lab.uuid}:${selectedNode}`;
    sendInput(channel, `ping -c 3 ${target.ipv4}\n`);
    pingTimerRef.current = setTimeout(() => {
      const output = pingOutputRef.current.join("");
      setPingResult({ status: output ? "fail" : "fail", output: output || "Timeout - no response" });
    }, 10000);
  }, [lab, selectedNode, sendInput]);

  /* ── Traceroute exec via shell relay ── */
  const runTraceroute = useCallback((targetNode: string) => {
    if (!lab) return;
    const target = lab.nodes?.find((n) => n.name === targetNode);
    if (!target?.ipv4 || !selectedNode) return;
    traceOutputRef.current = [];
    setTraceResult({ status: "running", output: "" });
    const channel = `shell:${lab.uuid}:${selectedNode}`;
    sendInput(channel, `traceroute -n -w 2 -m 10 ${target.ipv4}\n`);
    traceTimerRef.current = setTimeout(() => {
      setTraceResult({ status: "done", output: traceOutputRef.current.join("") || "Timeout - no response" });
    }, 15000);
  }, [lab, selectedNode, sendInput]);

  // Collect traceroute output (reuses shell channel — same as terminal output)
  useEffect(() => {
    if (traceResult.status !== "running") return;
    const lastLines = termLines.slice(-1);
    if (lastLines.length > 0 && lastLines[0].type === "output") {
      traceOutputRef.current.push(lastLines[0].text);
      if (traceTimerRef.current) clearTimeout(traceTimerRef.current);
      traceTimerRef.current = setTimeout(() => {
        setTraceResult({ status: "done", output: traceOutputRef.current.join("\n") });
      }, 3000);
    }
  }, [termLines, traceResult.status]);

  /* ── Bulk command exec ── */
  const runBulkCommand = useCallback(() => {
    if (!lab || !bulkCmd.trim()) return;
    const nodes = lab.nodes || [];
    const results: Record<string, { status: "running" | "done" | "error"; output: string }> = {};
    bulkOutputsRef.current = {};
    Object.values(bulkTimersRef.current).forEach(clearTimeout);
    bulkTimersRef.current = {};

    nodes.forEach((node) => {
      results[node.name] = { status: "running", output: "" };
      bulkOutputsRef.current[node.name] = [];
      const channel = `shell:${lab.uuid}:${node.name}`;
      sendInput(channel, bulkCmd.trim() + "\n");
      bulkTimersRef.current[node.name] = setTimeout(() => {
        setBulkResults((prev) => ({
          ...prev,
          [node.name]: { status: "done", output: bulkOutputsRef.current[node.name]?.join("") || "(no output)" },
        }));
      }, 4000);
    });
    setBulkResults(results);
  }, [lab, bulkCmd, sendInput]);

  /* ── Routing table fetch ── */
  const fetchRoutes = useCallback(() => {
    if (!lab) return;
    const routers = (lab.nodes || []).filter(isRouterNode);
    const results: Record<string, { status: "running" | "done"; output: string }> = {};
    routeOutputsRef.current = {};
    Object.values(routeTimersRef.current).forEach(clearTimeout);
    routeTimersRef.current = {};

    routers.forEach((node) => {
      results[node.name] = { status: "running", output: "" };
      routeOutputsRef.current[node.name] = [];
      const channel = `shell:${lab.uuid}:${node.name}`;
      sendInput(channel, "vtysh -c 'show ip route'\n");
      routeTimersRef.current[node.name] = setTimeout(() => {
        setRouteResults((prev) => ({
          ...prev,
          [node.name]: { status: "done", output: routeOutputsRef.current[node.name]?.join("") || "(no output)" },
        }));
      }, 4000);
    });
    setRouteResults(results);
  }, [lab, sendInput]);

  /* ── Config diff ── */
  const fetchRunningConfig = useCallback(() => {
    if (!lab || !selectedNode) return;
    configOutputRef.current = [];
    setRunningConfig({ status: "running", output: "" });
    setShowConfig(true);
    setConfigMode("running");
    const channel = `shell:${lab.uuid}:${selectedNode}`;
    const nodeData = lab.nodes?.find((n) => n.name === selectedNode);
    const cmd = isRouterNode(nodeData!) ? "vtysh -c 'show running-config'" : "cat /etc/network/interfaces 2>/dev/null; ip addr show";
    sendInput(channel, cmd + "\n");
    configTimerRef.current = setTimeout(() => {
      setRunningConfig({ status: "done", output: configOutputRef.current.join("") || "(no output)" });
    }, 4000);

    // Try to load startup config from bind files for diff
    if (topology) {
      const sn = shortName(selectedNode);
      const bindFile = topology.bindFiles?.find((bf: BindFileResponse) => bf.filePath.includes(sn));
      if (bindFile) {
        if (bindFile.content) {
          setStartupConfigContent(bindFile.content);
        } else {
          // Try fetching bind file content
          api.get<BindFileResponse>(`/api/v1/topologies/${topology.uuid}/bind-files/${bindFile.uuid}`)
            .then((bf) => setStartupConfigContent(bf.content || null))
            .catch(() => setStartupConfigContent(null));
        }
      } else {
        setStartupConfigContent(null);
      }
    }
  }, [lab, selectedNode, sendInput, topology]);

  /* Collect config output from terminal lines */
  useEffect(() => {
    if (runningConfig.status !== "running") return;
    const lastLines = termLines.slice(-1);
    if (lastLines.length > 0 && lastLines[0].type === "output") {
      configOutputRef.current.push(lastLines[0].text);
      if (configTimerRef.current) clearTimeout(configTimerRef.current);
      configTimerRef.current = setTimeout(() => {
        setRunningConfig({ status: "done", output: configOutputRef.current.join("\n") });
      }, 3000);
    }
  }, [termLines, runningConfig.status]);

  /* ── Packet capture (via platform REST API → worker host-side tcpdump) ── */
  const captureShortNode = captureLink ? (captureSide === "a" ? captureLink.a.node : captureLink.b.node) : null;
  const captureIface = captureLink ? (captureSide === "a" ? captureLink.a.iface : captureLink.b.iface) : null;
  // Resolve short YAML name (e.g. "r1") to full container name (e.g. "clab-ospf-lab-r1")
  const captureNode = captureShortNode && lab?.nodes
    ? (lab.nodes.find((n) => n.name === captureShortNode || n.name.endsWith(`-${captureShortNode}`))?.name ?? captureShortNode)
    : captureShortNode;
  const captureAbortRef = useRef<AbortController | null>(null);

  useEffect(() => { captureScrollRef.current?.scrollTo(0, captureScrollRef.current.scrollHeight); }, [captureLines]);

  const handleLinkClick = useCallback((a: LinkEndpoint, b: LinkEndpoint) => {
    if (!lab || (lab.state !== "running" && lab.state !== "deploying")) return;
    setCaptureLink({ a, b });
    setCaptureSide("a");
    setCaptureLines([]);
    setCaptureActive(false);
    setCaptureFilter("");
    setBottomOpen(true);
  }, [lab]);

  const startCapture = useCallback(async () => {
    if (!lab || !captureNode || !captureIface) return;
    setCaptureLines([]);
    setCaptureActive(true);

    const abort = new AbortController();
    captureAbortRef.current = abort;

    try {
      const resp = await api.post<{ output: string }>(`/api/v1/labs/${lab.uuid}/capture`, {
        nodeName: captureNode,
        interface: captureIface,
        count: captureCount,
        filter: captureFilter.trim(),
      });
      if (!abort.signal.aborted && resp.output) {
        const lines = resp.output.split("\n").filter((l) => l.trim() !== "");
        setCaptureLines(lines);
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        setCaptureLines([`Error: ${err instanceof Error ? err.message : "capture failed"}`]);
      }
    } finally {
      if (!abort.signal.aborted) setCaptureActive(false);
      captureAbortRef.current = null;
    }
  }, [lab, captureNode, captureIface, captureFilter, captureCount]);

  const stopCapture = useCallback(() => {
    captureAbortRef.current?.abort();
    setCaptureActive(false);
  }, []);

  const closeCapture = useCallback(() => {
    stopCapture();
    setCaptureLink(null);
    setCaptureLines([]);
  }, [stopCapture]);

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
  const showBottomPanel = bottomOpen;

  /* Nodes with IPv4 for ping/trace target dropdown (exclude selected) */
  const pingTargets = (lab.nodes || []).filter((n) => n.ipv4 && n.name !== selectedNode);

  /* Line numbers for YAML */
  const yamlLines = topology?.definition?.split("\n") || [];

  /* WS status indicator color */
  const wsColor = wsStatus === "connected" ? "#27c93f" : wsStatus === "connecting" ? "#ffbd2e" : "#ff5f56";
  const wsLabel = wsStatus === "connected" ? "WS" : wsStatus === "connecting" ? "WS..." : "WS OFF";

  /* Config diff lines */
  const diffLines = configMode === "diff" && startupConfigContent && runningConfig.output
    ? computeLineDiff(startupConfigContent, runningConfig.output)
    : null;

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
            {lab.state === "running" && lab.deployedAt && (
              <span style={{ ...LABEL, opacity: 0.5, fontFamily: MONO, fontSize: "0.65rem" }}>
                {formatUptime(uptime)}
              </span>
            )}
            {/* WS connection status */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }} title={`WebSocket: ${wsStatus}`}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: wsColor }} />
              <span style={{ ...LABEL, fontSize: "0.55rem", opacity: 0.4 }}>{wsLabel}</span>
            </div>
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
            <button onClick={handleClone} disabled={!!actionLoading} style={pillStyle}>
              {actionLoading === "clone" ? "..." : "CLONE"}
            </button>
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

          {/* ── Canvas section ── */}
          <div style={{ flex: showBottomPanel ? undefined : 1, height: showBottomPanel ? "40%" : undefined, minHeight: showBottomPanel ? 180 : undefined, display: "flex", borderBottom: showBottomPanel ? BORDER : "none", overflow: "hidden", transition: "height 0.2s" }}>

            {/* Topology canvas */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
              <div style={{ padding: "0.5rem 1rem", borderBottom: BORDER, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={LABEL}>TOPOLOGY</span>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <button
                    onClick={() => setBottomOpen(!bottomOpen)}
                    style={{ ...LABEL, opacity: 0.4, cursor: "pointer", background: "none", border: "none", color: INK, fontFamily: FONT, fontSize: "0.6rem" }}
                  >
                    {bottomOpen ? "\u25BC HIDE PANEL" : "\u25B2 SHOW PANEL"}
                  </button>
                  <span style={{ ...LABEL, opacity: 0.4 }}>{topology?.name || ""}</span>
                </div>
              </div>
              <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                {topology ? (
                  <TopologyCanvas
                    definition={topology.definition}
                    selectedNode={selectedNode}
                    onSelectNode={(name) => setSelectedNode(name || null)}
                    onLinkClick={isLive ? handleLinkClick : undefined}
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
                  <div style={{ borderTop: BORDER, padding: "0.6rem 0.75rem", overflowY: "auto" }}>
                    <div style={{ ...LABEL, opacity: 0.5, marginBottom: "0.3rem", fontSize: "0.6rem" }}>SELECTED</div>
                    <div style={{ fontSize: "0.65rem", fontFamily: MONO, lineHeight: 1.7 }}>
                      <div>IMAGE: {selectedNodeData.image?.split("/").pop()}</div>
                      <div
                        style={{ cursor: selectedNodeData.ipv4 ? "pointer" : "default" }}
                        onClick={() => selectedNodeData.ipv4 && copyToClipboard(selectedNodeData.ipv4, "ipv4")}
                        title={selectedNodeData.ipv4 ? "Click to copy" : undefined}
                      >
                        IPv4: {selectedNodeData.ipv4 || "\u2014"}
                        {copiedField === "ipv4" && <span style={{ color: BG, marginLeft: 6, fontSize: "0.55rem", fontWeight: 700 }}>COPIED</span>}
                      </div>
                      <div
                        style={{ cursor: selectedNodeData.containerId ? "pointer" : "default" }}
                        onClick={() => selectedNodeData.containerId && copyToClipboard(selectedNodeData.containerId, "cid")}
                        title={selectedNodeData.containerId ? "Click to copy" : undefined}
                      >
                        ID: {(selectedNodeData.containerId || "\u2014").slice(0, 12)}
                        {copiedField === "cid" && <span style={{ color: BG, marginLeft: 6, fontSize: "0.55rem", fontWeight: 700 }}>COPIED</span>}
                      </div>
                    </div>
                    {links.length > 0 && (
                      <div style={{ marginTop: "0.4rem" }}>
                        <div style={{ ...LABEL, opacity: 0.5, marginBottom: "0.2rem", fontSize: "0.55rem" }}>INTERFACES</div>
                        {links.map((l, i) => (
                          <div key={i} style={{ fontSize: "0.6rem", fontFamily: MONO, lineHeight: 1.6, opacity: 0.7 }}>
                            {l.local} \u2192 {l.peer}:{l.remote}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Ping + Traceroute */}
                    {isLive && pingTargets.length > 0 && (
                      <div style={{ marginTop: "0.5rem", borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: "0.4rem" }}>
                        <div style={{ ...LABEL, opacity: 0.5, marginBottom: "0.2rem", fontSize: "0.55rem" }}>NETWORK TEST</div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <select
                            value={pingTarget}
                            onChange={(e) => { setPingTarget(e.target.value); setTraceTarget(e.target.value); setPingResult({ status: null, output: "" }); setTraceResult({ status: null, output: "" }); }}
                            style={{ flex: 1, fontSize: "0.6rem", fontFamily: MONO, padding: "2px 4px", border: BORDER, background: "transparent" }}
                          >
                            <option value="">Target...</option>
                            {pingTargets.map((n) => (
                              <option key={n.name} value={n.name}>{shortName(n.name)} ({n.ipv4})</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          <button
                            onClick={() => pingTarget && runPing(pingTarget)}
                            disabled={!pingTarget || pingResult.status === "running"}
                            style={{ ...LABEL, fontSize: "0.55rem", padding: "2px 6px", border: BORDER, background: INK, color: BG, cursor: "pointer", flex: 1 }}
                          >
                            PING
                          </button>
                          <button
                            onClick={() => traceTarget && runTraceroute(traceTarget)}
                            disabled={!traceTarget || traceResult.status === "running"}
                            style={{ ...LABEL, fontSize: "0.55rem", padding: "2px 6px", border: BORDER, background: INK, color: BG, cursor: "pointer", flex: 1 }}
                          >
                            TRACE
                          </button>
                        </div>
                        {pingResult.status && (
                          <div style={{
                            marginTop: "0.2rem",
                            fontSize: "0.55rem",
                            fontFamily: MONO,
                            color: pingResult.status === "pass" ? "#27c93f" : pingResult.status === "fail" ? "#ff5f56" : INK,
                            fontWeight: 700,
                          }}>
                            PING: {pingResult.status === "running" ? "..." : pingResult.status === "pass" ? "PASS" : "FAIL"}
                          </div>
                        )}
                        {traceResult.status && (
                          <div style={{ marginTop: "0.2rem", fontSize: "0.5rem", fontFamily: MONO, color: traceResult.status === "running" ? INK : "#4af", lineHeight: 1.4 }}>
                            {traceResult.status === "running" ? "TRACING..." : (
                              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.5rem", maxHeight: 80, overflowY: "auto" }}>
                                {traceResult.output}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Config button */}
                    {isLive && (
                      <div style={{ marginTop: "0.4rem" }}>
                        <button
                          onClick={fetchRunningConfig}
                          disabled={runningConfig.status === "running"}
                          style={{ ...LABEL, fontSize: "0.55rem", padding: "3px 8px", border: BORDER, background: INK, color: BG, cursor: "pointer", width: "100%" }}
                        >
                          {runningConfig.status === "running" ? "LOADING..." : "SHOW CONFIG"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Bottom tabbed panel ── */}
          {showBottomPanel && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: INK, color: BG, overflow: "hidden" }}>
              {/* Tab bar */}
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", flexShrink: 0 }}>
                {(["terminal", "logs", "events", "yaml", "bulk"] as BottomTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setBottomTab(tab)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: bottomTab === tab ? "rgba(255,255,255,0.1)" : "transparent",
                      border: "none",
                      borderRight: "1px solid rgba(255,255,255,0.06)",
                      color: bottomTab === tab ? BG : "rgba(121,246,115,0.4)",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      cursor: "pointer",
                      fontFamily: FONT,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tab === "bulk" ? "BULK CMD" : tab}
                    {tab === "logs" && deployLogs.length > 0 && (
                      <span style={{ marginLeft: 4, fontSize: "0.55rem", opacity: 0.5 }}>({deployLogs.length})</span>
                    )}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                {/* Node tabs in terminal mode */}
                {bottomTab === "terminal" && (
                  <div style={{ display: "flex", overflow: "auto", alignItems: "center" }}>
                    {/* Clear terminal button */}
                    <button
                      onClick={clearTerminal}
                      title="Clear terminal (Ctrl+L)"
                      style={{
                        padding: "0.5rem 0.6rem",
                        background: "transparent",
                        border: "none",
                        borderRight: "1px solid rgba(255,255,255,0.06)",
                        color: "rgba(121,246,115,0.3)",
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        cursor: "pointer",
                        fontFamily: FONT,
                        whiteSpace: "nowrap",
                      }}
                    >
                      CLEAR
                    </button>
                    {(lab.nodes || []).map((node) => {
                      const active = selectedNode === node.name;
                      const hasBuffer = (nodeTermBuffers.current.get(node.name)?.length || 0) > 0;
                      return (
                        <button
                          key={node.name}
                          onClick={() => setSelectedNode(node.name)}
                          style={{
                            padding: "0.5rem 0.75rem",
                            background: active ? "rgba(255,255,255,0.1)" : "transparent",
                            border: "none",
                            borderLeft: "1px solid rgba(255,255,255,0.06)",
                            color: active ? BG : hasBuffer ? "rgba(121,246,115,0.5)" : "rgba(121,246,115,0.3)",
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            cursor: "pointer",
                            fontFamily: FONT,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {shortName(node.name)}
                          {hasBuffer && !active && <span style={{ marginLeft: 3, fontSize: "0.45rem" }}>{"\u2022"}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: "flex", gap: 5, padding: "0 1rem", flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56", cursor: "pointer" }} onClick={() => setBottomOpen(false)} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
                </div>
              </div>

              {/* ── Tab content ── */}

              {/* TERMINAL TAB */}
              {bottomTab === "terminal" && (
                selectedNode && isLive ? (
                  <>
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
                )
              )}

              {/* LOGS TAB */}
              {bottomTab === "logs" && (
                <div
                  ref={logsScrollRef}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    padding: "1rem 1.25rem",
                    fontFamily: MONO,
                    fontSize: "0.8rem",
                    lineHeight: 1.7,
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {deployLogs.length === 0 ? (
                    <div style={{ opacity: 0.2, textAlign: "center", marginTop: "2rem" }}>
                      <span style={{ ...LABEL, fontSize: "0.8rem" }}>
                        {lab.state === "deploying" ? "WAITING FOR LOGS..." : "DEPLOY TO SEE LOGS"}
                      </span>
                    </div>
                  ) : (
                    deployLogs.map((line, i) => (
                      <div key={i} style={{ opacity: 0.7 }}>{line}</div>
                    ))
                  )}
                </div>
              )}

              {/* EVENTS TAB */}
              {bottomTab === "events" && (
                <div
                  ref={eventsScrollRef}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    padding: "1rem 1.25rem",
                    overflowY: "auto",
                  }}
                >
                  {events.length === 0 ? (
                    <div style={{ opacity: 0.2, textAlign: "center", marginTop: "2rem" }}>
                      <span style={{ ...LABEL, fontSize: "0.8rem" }}>
                        {eventsLoaded ? "NO EVENTS" : "LOADING EVENTS..."}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: "0.55rem", opacity: 0.3, marginBottom: "0.5rem", textAlign: "right", fontFamily: MONO }}>
                        AUTO-REFRESH 10s
                      </div>
                      {events.map((ev, i) => (
                        <div key={i} style={{ display: "flex", gap: "1rem", padding: "0.35rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "baseline" }}>
                          <span style={{ fontFamily: MONO, fontSize: "0.65rem", opacity: 0.4, flexShrink: 0, minWidth: 60 }}>
                            {timeAgo(ev.createdAt)}
                          </span>
                          <span style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            flexShrink: 0,
                            minWidth: 120,
                            color: ev.event.includes("fail") || ev.event.includes("error") ? "#ff5f56" :
                                   ev.event.includes("complete") || ev.event.includes("running") ? "#27c93f" :
                                   ev.event.includes("start") || ev.event.includes("deploy") ? "#ffbd2e" : BG,
                          }}>
                            {ev.event}
                          </span>
                          <span style={{ fontFamily: MONO, fontSize: "0.65rem", opacity: 0.6 }}>
                            {ev.details}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* YAML TAB */}
              {bottomTab === "yaml" && (
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "0.4rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                    <span style={{ ...LABEL, fontSize: "0.6rem", opacity: 0.4 }}>TOPOLOGY DEFINITION</span>
                    <button
                      onClick={() => topology?.definition && copyToClipboard(topology.definition, "yaml")}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 99,
                        color: BG,
                        fontSize: "0.6rem",
                        padding: "0.2rem 0.6rem",
                        cursor: "pointer",
                        fontFamily: FONT,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {copiedField === "yaml" ? "COPIED!" : "COPY"}
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 0" }}>
                    <pre style={{ margin: 0, fontFamily: MONO, fontSize: "0.8rem", lineHeight: 1.7 }}>
                      {yamlLines.map((line, i) => (
                        <div key={i} style={{ display: "flex" }}>
                          <span style={{ display: "inline-block", width: 40, textAlign: "right", paddingRight: 12, opacity: 0.2, userSelect: "none", flexShrink: 0, color: BG }}>
                            {i + 1}
                          </span>
                          {highlightYamlLine(line)}
                        </div>
                      ))}
                    </pre>
                  </div>
                </div>
              )}

              {/* BULK CMD TAB */}
              {bottomTab === "bulk" && (
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {/* Command input */}
                  <div style={{ padding: "0.6rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: "0.8rem", opacity: 0.4 }}>$</span>
                    <input
                      value={bulkCmd}
                      onChange={(e) => setBulkCmd(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && bulkCmd.trim()) runBulkCommand(); }}
                      placeholder="Enter command to run on all nodes..."
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: BG,
                        fontFamily: MONO,
                        fontSize: "0.8rem",
                        caretColor: BG,
                      }}
                      spellCheck={false}
                    />
                    <button
                      onClick={runBulkCommand}
                      disabled={!bulkCmd.trim() || !isLive}
                      style={{
                        ...LABEL,
                        fontSize: "0.6rem",
                        padding: "4px 12px",
                        border: `1px solid ${BG}`,
                        background: BG,
                        color: INK,
                        cursor: "pointer",
                        borderRadius: 99,
                        opacity: (!bulkCmd.trim() || !isLive) ? 0.3 : 1,
                      }}
                    >
                      RUN ON ALL
                    </button>
                    {isLive && (lab.nodes || []).some(isRouterNode) && (
                      <button
                        onClick={fetchRoutes}
                        style={{
                          ...LABEL,
                          fontSize: "0.6rem",
                          padding: "4px 12px",
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: "transparent",
                          color: BG,
                          cursor: "pointer",
                          borderRadius: 99,
                        }}
                      >
                        FETCH ROUTES
                      </button>
                    )}
                  </div>

                  {/* Results grid */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 1.25rem" }}>
                    {Object.keys(bulkResults).length > 0 && (
                      <>
                        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "0.3rem 0", marginBottom: "0.3rem" }}>
                          <span style={{ ...LABEL, fontSize: "0.55rem", opacity: 0.4, width: 120 }}>NODE</span>
                          <span style={{ ...LABEL, fontSize: "0.55rem", opacity: 0.4, width: 60 }}>STATUS</span>
                          <span style={{ ...LABEL, fontSize: "0.55rem", opacity: 0.4, flex: 1 }}>OUTPUT</span>
                        </div>
                        {Object.entries(bulkResults).map(([name, result]) => (
                          <div key={name} style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "0.3rem 0", alignItems: "flex-start" }}>
                            <span style={{ fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700, width: 120, flexShrink: 0, textTransform: "uppercase" }}>
                              {shortName(name)}
                            </span>
                            <span style={{
                              fontFamily: MONO,
                              fontSize: "0.6rem",
                              width: 60,
                              flexShrink: 0,
                              color: result.status === "running" ? "#ffbd2e" : result.status === "error" ? "#ff5f56" : "#27c93f",
                            }}>
                              {result.status === "running" ? "\u27F3" : result.status === "done" ? "\u2713" : "\u2715"}
                            </span>
                            <pre style={{ margin: 0, fontFamily: MONO, fontSize: "0.65rem", opacity: 0.7, flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                              {result.output}
                            </pre>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Routing table results */}
                    {Object.keys(routeResults).length > 0 && (
                      <div style={{ marginTop: "1rem" }}>
                        <div style={{ ...LABEL, fontSize: "0.6rem", opacity: 0.4, marginBottom: "0.5rem" }}>ROUTING TABLES</div>
                        {Object.entries(routeResults).map(([name, result]) => (
                          <div key={name} style={{ marginBottom: "1rem" }}>
                            <div style={{ fontFamily: MONO, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.3rem", display: "flex", alignItems: "center", gap: 8 }}>
                              {shortName(name)}
                              <span style={{ fontSize: "0.55rem", color: result.status === "running" ? "#ffbd2e" : "#27c93f", fontWeight: 400 }}>
                                {result.status === "running" ? "loading..." : "done"}
                              </span>
                            </div>
                            <pre style={{
                              margin: 0,
                              fontFamily: MONO,
                              fontSize: "0.65rem",
                              opacity: 0.7,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                              background: "rgba(255,255,255,0.03)",
                              padding: "0.5rem",
                              borderRadius: 4,
                            }}>
                              {result.output || "..."}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}

                    {Object.keys(bulkResults).length === 0 && Object.keys(routeResults).length === 0 && (
                      <div style={{ opacity: 0.2, textAlign: "center", marginTop: "2rem" }}>
                        <span style={{ ...LABEL, fontSize: "0.8rem" }}>
                          {isLive ? "ENTER A COMMAND AND CLICK RUN ON ALL" : "DEPLOY LAB FIRST"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Config diff overlay */}
          {showConfig && runningConfig.status !== "idle" && (
            <div style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.8)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }} onClick={() => { setShowConfig(false); setRunningConfig({ status: "idle", output: "" }); setStartupConfigContent(null); }}>
              <div
                style={{
                  width: "85%",
                  maxWidth: 1100,
                  maxHeight: "85vh",
                  backgroundColor: INK,
                  color: BG,
                  border: `2px solid ${BG}`,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(121,246,115,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ ...LABEL }}>
                      {configMode === "diff" ? "CONFIG DIFF" : "RUNNING CONFIG"} \u2014 {selectedNode ? shortName(selectedNode) : ""}
                    </span>
                    {startupConfigContent && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => setConfigMode("running")}
                          style={{
                            background: configMode === "running" ? "rgba(255,255,255,0.1)" : "transparent",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 99,
                            color: BG,
                            fontSize: "0.55rem",
                            padding: "0.15rem 0.5rem",
                            cursor: "pointer",
                            fontFamily: FONT,
                            textTransform: "uppercase",
                          }}
                        >
                          RUNNING
                        </button>
                        <button
                          onClick={() => setConfigMode("diff")}
                          style={{
                            background: configMode === "diff" ? "rgba(255,255,255,0.1)" : "transparent",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 99,
                            color: BG,
                            fontSize: "0.55rem",
                            padding: "0.15rem 0.5rem",
                            cursor: "pointer",
                            fontFamily: FONT,
                            textTransform: "uppercase",
                          }}
                        >
                          DIFF
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => runningConfig.output && copyToClipboard(runningConfig.output, "config")}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 99,
                        color: BG,
                        fontSize: "0.6rem",
                        padding: "0.2rem 0.6rem",
                        cursor: "pointer",
                        fontFamily: FONT,
                        textTransform: "uppercase",
                      }}
                    >
                      {copiedField === "config" ? "COPIED!" : "COPY"}
                    </button>
                    <button
                      onClick={() => { setShowConfig(false); setRunningConfig({ status: "idle", output: "" }); setStartupConfigContent(null); }}
                      style={{ background: "none", border: "none", color: BG, cursor: "pointer", fontSize: "1rem" }}
                    >
                      \u2715
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
                  {runningConfig.status === "running" ? (
                    <div style={{ opacity: 0.3, textAlign: "center", marginTop: "2rem" }}>
                      <span style={LABEL}>LOADING CONFIG...</span>
                    </div>
                  ) : configMode === "diff" && diffLines ? (
                    <pre style={{ margin: 0, fontFamily: MONO, fontSize: "0.75rem", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                      {diffLines.map((dl, i) => (
                        <div key={i} style={{
                          display: "flex",
                          backgroundColor: dl.type === "added" ? "rgba(39,201,63,0.1)" : dl.type === "removed" ? "rgba(255,95,86,0.1)" : "transparent",
                        }}>
                          <span style={{
                            display: "inline-block",
                            width: 20,
                            textAlign: "center",
                            opacity: 0.5,
                            userSelect: "none",
                            flexShrink: 0,
                            color: dl.type === "added" ? "#27c93f" : dl.type === "removed" ? "#ff5f56" : "rgba(121,246,115,0.3)",
                          }}>
                            {dl.type === "added" ? "+" : dl.type === "removed" ? "-" : " "}
                          </span>
                          <span style={{
                            display: "inline-block",
                            width: 35,
                            textAlign: "right",
                            paddingRight: 10,
                            opacity: 0.2,
                            userSelect: "none",
                            flexShrink: 0,
                          }}>
                            {i + 1}
                          </span>
                          <span style={{
                            color: dl.type === "added" ? "#27c93f" : dl.type === "removed" ? "#ff5f56" : BG,
                          }}>{dl.line}</span>
                        </div>
                      ))}
                    </pre>
                  ) : (
                    <pre style={{ margin: 0, fontFamily: MONO, fontSize: "0.75rem", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                      {runningConfig.output.split("\n").map((line, i) => (
                        <div key={i} style={{ display: "flex" }}>
                          <span style={{ display: "inline-block", width: 35, textAlign: "right", paddingRight: 10, opacity: 0.2, userSelect: "none", flexShrink: 0 }}>
                            {i + 1}
                          </span>
                          <span>{line}</span>
                        </div>
                      ))}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Packet capture overlay */}
          {captureLink && (
            <div style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.85)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }} onClick={closeCapture}>
              <div
                style={{
                  width: "85%",
                  maxWidth: 1000,
                  maxHeight: "85vh",
                  backgroundColor: INK,
                  color: BG,
                  border: `2px solid ${BG}`,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(121,246,115,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ ...LABEL }}>
                      PACKET CAPTURE
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: "0.65rem", opacity: 0.5 }}>
                      {captureLink.a.node}:{captureLink.a.iface} \u2194 {captureLink.b.node}:{captureLink.b.iface}
                    </span>
                    {captureActive && (
                      <span style={{ fontSize: "0.55rem", color: "#ff5f56", fontWeight: 700, letterSpacing: "0.08em" }}>
                        \u25CF LIVE
                      </span>
                    )}
                  </div>
                  <button
                    onClick={closeCapture}
                    style={{ background: "none", border: "none", color: BG, cursor: "pointer", fontSize: "1rem" }}
                  >
                    \u2715
                  </button>
                </div>

                {/* Controls */}
                <div style={{ padding: "0.6rem 1rem", borderBottom: "1px solid rgba(121,246,115,0.1)", display: "flex", gap: 8, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                  {/* Side selector */}
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => setCaptureSide("a")}
                      style={{
                        background: captureSide === "a" ? "rgba(255,255,255,0.1)" : "transparent",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 99,
                        color: BG,
                        fontSize: "0.6rem",
                        padding: "0.2rem 0.5rem",
                        cursor: "pointer",
                        fontFamily: MONO,
                      }}
                    >
                      {captureLink.a.node}:{captureLink.a.iface}
                    </button>
                    <button
                      onClick={() => setCaptureSide("b")}
                      style={{
                        background: captureSide === "b" ? "rgba(255,255,255,0.1)" : "transparent",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 99,
                        color: BG,
                        fontSize: "0.6rem",
                        padding: "0.2rem 0.5rem",
                        cursor: "pointer",
                        fontFamily: MONO,
                      }}
                    >
                      {captureLink.b.node}:{captureLink.b.iface}
                    </button>
                  </div>

                  {/* BPF filter */}
                  <input
                    value={captureFilter}
                    onChange={(e) => setCaptureFilter(e.target.value)}
                    placeholder="BPF filter (e.g. tcp port 179, icmp, arp)"
                    disabled={captureActive}
                    style={{
                      flex: 1,
                      minWidth: 180,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: BG,
                      fontFamily: MONO,
                      fontSize: "0.7rem",
                      padding: "4px 8px",
                      outline: "none",
                      caretColor: BG,
                    }}
                    spellCheck={false}
                  />

                  {/* Packet count */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: "0.55rem", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em" }}>PKT:</span>
                    <select
                      value={captureCount}
                      onChange={(e) => setCaptureCount(Number(e.target.value))}
                      disabled={captureActive}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: BG,
                        fontFamily: MONO,
                        fontSize: "0.65rem",
                        padding: "2px 4px",
                      }}
                    >
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={500}>500</option>
                    </select>
                  </div>

                  {/* Start/Stop */}
                  {captureActive ? (
                    <button
                      onClick={stopCapture}
                      style={{
                        ...LABEL,
                        fontSize: "0.6rem",
                        padding: "4px 14px",
                        border: "1px solid #ff5f56",
                        background: "rgba(255,95,86,0.15)",
                        color: "#ff5f56",
                        cursor: "pointer",
                        borderRadius: 99,
                      }}
                    >
                      STOP
                    </button>
                  ) : (
                    <button
                      onClick={startCapture}
                      style={{
                        ...LABEL,
                        fontSize: "0.6rem",
                        padding: "4px 14px",
                        border: `1px solid ${BG}`,
                        background: BG,
                        color: INK,
                        cursor: "pointer",
                        borderRadius: 99,
                      }}
                    >
                      START
                    </button>
                  )}

                  {/* Clear */}
                  {captureLines.length > 0 && !captureActive && (
                    <button
                      onClick={() => setCaptureLines([])}
                      style={{
                        ...LABEL,
                        fontSize: "0.55rem",
                        padding: "4px 10px",
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "transparent",
                        color: BG,
                        cursor: "pointer",
                        borderRadius: 99,
                      }}
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                {/* Capture output */}
                <div
                  ref={captureScrollRef}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "0.75rem 1rem",
                    fontFamily: MONO,
                    fontSize: "0.72rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {captureLines.length === 0 ? (
                    <div style={{ opacity: 0.2, textAlign: "center", marginTop: "3rem" }}>
                      <div style={{ ...LABEL, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                        {captureActive ? "LISTENING..." : "PACKET SNIFFER"}
                      </div>
                      <div style={{ fontSize: "0.65rem", opacity: 0.6, fontFamily: MONO }}>
                        {captureActive
                          ? `tcpdump -i ${captureIface} on ${captureShortNode}`
                          : "Click START to begin capturing packets on this link"}
                      </div>
                    </div>
                  ) : (
                    captureLines.map((line, i) => {
                      // Highlight packet lines with color coding
                      const isHeader = line.includes("listening on") || line.includes("verbose output");
                      const isStats = line.includes("packets captured") || line.includes("packets received") || line.includes("packets dropped");
                      return (
                        <div key={i} style={{
                          opacity: isHeader || isStats ? 0.4 : 0.8,
                          color: isStats ? "#ffbd2e" : isHeader ? "rgba(121,246,115,0.5)" : BG,
                          borderBottom: "1px solid rgba(255,255,255,0.02)",
                          padding: "1px 0",
                        }}>
                          <span style={{ color: "rgba(121,246,115,0.2)", userSelect: "none", marginRight: 8, fontSize: "0.6rem" }}>
                            {String(i + 1).padStart(4)}
                          </span>
                          {line}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer stats */}
                {captureLines.length > 0 && (
                  <div style={{ padding: "0.4rem 1rem", borderTop: "1px solid rgba(121,246,115,0.1)", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: "0.6rem", opacity: 0.4 }}>
                      {captureLines.length} lines captured
                    </span>
                    <button
                      onClick={() => copyToClipboard(captureLines.join("\n"), "capture")}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 99,
                        color: BG,
                        fontSize: "0.55rem",
                        padding: "0.15rem 0.5rem",
                        cursor: "pointer",
                        fontFamily: FONT,
                        textTransform: "uppercase",
                      }}
                    >
                      {copiedField === "capture" ? "COPIED!" : "COPY ALL"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deploy config modal */}
      {topology && (
        <DeployConfigModal
          isOpen={showDeployModal}
          onClose={() => setShowDeployModal(false)}
          onDeploy={handleDeployWithImages}
          definition={topology.definition}
          deploying={actionLoading === "deploy"}
        />
      )}
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
