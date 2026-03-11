"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWSChannel, useShellInput } from "@/hooks/useWebSocket";

interface QuickCmd {
  label: string;
  cmd: string;
  description: string;
}

const FRR_COMMANDS: QuickCmd[] = [
  { label: "SHOW ROUTES", cmd: "vtysh -c 'show ip route'", description: "IP routing table" },
  { label: "BGP SUMMARY", cmd: "vtysh -c 'show bgp summary'", description: "BGP peer status" },
  { label: "BGP ROUTES", cmd: "vtysh -c 'show bgp ipv4 unicast'", description: "BGP learned routes" },
  { label: "OSPF NEIGHBORS", cmd: "vtysh -c 'show ip ospf neighbor'", description: "OSPF adjacencies" },
  { label: "OSPF ROUTES", cmd: "vtysh -c 'show ip ospf route'", description: "OSPF route table" },
  { label: "INTERFACES", cmd: "vtysh -c 'show interface brief'", description: "Interface status" },
  { label: "RUNNING CONFIG", cmd: "vtysh -c 'show running-config'", description: "Active configuration" },
  { label: "PING LOOPBACK", cmd: "ping -c 3 127.0.0.1", description: "Connectivity test" },
];

const LINUX_COMMANDS: QuickCmd[] = [
  { label: "IP ADDR", cmd: "ip addr show", description: "Interface addresses" },
  { label: "IP ROUTE", cmd: "ip route show", description: "Routing table" },
  { label: "PING TEST", cmd: "ping -c 3 8.8.8.8", description: "Internet connectivity" },
  { label: "ARP TABLE", cmd: "ip neigh show", description: "ARP/neighbor cache" },
  { label: "TRACEROUTE", cmd: "traceroute -n -m 10 8.8.8.8", description: "Trace path to host" },
  { label: "NETSTAT", cmd: "netstat -tlnp 2>/dev/null || ss -tlnp", description: "Listening ports" },
  { label: "DNS RESOLVE", cmd: "nslookup google.com 2>/dev/null || cat /etc/resolv.conf", description: "DNS config" },
  { label: "PROCESSES", cmd: "ps aux", description: "Running processes" },
];

const DNSMASQ_COMMANDS: QuickCmd[] = [
  { label: "DHCP LEASES", cmd: "cat /var/lib/misc/dnsmasq.leases 2>/dev/null || echo 'No leases file'", description: "Active DHCP leases" },
  { label: "DNSMASQ CONF", cmd: "cat /etc/dnsmasq.conf", description: "Dnsmasq configuration" },
  { label: "IP ADDR", cmd: "ip addr show", description: "Interface addresses" },
  { label: "LISTENING", cmd: "netstat -ulnp 2>/dev/null || ss -ulnp", description: "UDP listeners" },
  { label: "DNS TEST", cmd: "nslookup localhost 127.0.0.1", description: "Local DNS query" },
  { label: "IP ROUTE", cmd: "ip route show", description: "Routing table" },
  { label: "PROCESSES", cmd: "ps aux", description: "Running processes" },
  { label: "PING TEST", cmd: "ping -c 3 8.8.8.8", description: "Connectivity test" },
];

function getCommandsForImage(image: string): { category: string; commands: QuickCmd[] } {
  const img = image.toLowerCase();
  if (img.includes("frr") || img.includes("frrouting")) {
    return { category: "FRR", commands: FRR_COMMANDS };
  }
  if (img.includes("dnsmasq") || img.includes("kea")) {
    return { category: "DHCP/DNS", commands: DNSMASQ_COMMANDS };
  }
  return { category: "LINUX", commands: LINUX_COMMANDS };
}

interface Props {
  labUuid: string;
  nodeName: string;
  nodeImage?: string;
}

interface TermLine {
  type: "input" | "output";
  text: string;
}

export default function TerminalPanel({ labUuid, nodeName, nodeImage }: Props) {
  const [lines, setLines] = useState<TermLine[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendInput = useShellInput();
  const channel = `shell:${labUuid}:${nodeName}`;

  const handleMessage = useCallback((data: unknown) => {
    const d = data as { output?: string };
    if (d.output) {
      setLines((prev) => [...prev, { type: "output", text: d.output! }]);
    }
  }, []);

  useWSChannel(channel, handleMessage);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  // reset on node change
  useEffect(() => {
    setLines([]);
    setInput("");
  }, [nodeName]);

  const runCommand = useCallback(
    (cmd: string) => {
      setLines((prev) => [...prev, { type: "input", text: cmd }]);
      sendInput(channel, cmd + "\n");
      inputRef.current?.focus();
    },
    [channel, sendInput]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      runCommand(input);
      setInput("");
    }
  };

  const { category, commands } = getCommandsForImage(nodeImage || "");

  return (
    <div
      style={{
        backgroundColor: "#0A0A0A",
        color: "#F2F2F2",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* header */}
      <div
        style={{
          padding: "0.8rem 1rem",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="label" style={{ opacity: 0.7, fontSize: "0.65rem" }}>
          TERMINAL — {nodeName}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5f56" }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffbd2e" }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27c93f" }} />
        </div>
      </div>

      {/* output */}
      <div
        ref={scrollRef}
        style={{
          flexGrow: 1,
          flexShrink: 1,
          minHeight: 0,
          padding: "1rem",
          fontFamily: "'Courier New', monospace",
          fontSize: "0.75rem",
          lineHeight: 1.6,
          overflowY: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {lines.map((line, i) => (
          <div key={i}>
            {line.type === "input" ? (
              <>
                <span style={{ color: "#f6539f" }}>{nodeName}#</span>{" "}
                <span style={{ color: "#c1755f" }}>{line.text}</span>
              </>
            ) : (
              <span style={{ opacity: 0.7 }}>{line.text}</span>
            )}
          </div>
        ))}

        {/* input line */}
        <div style={{ display: "flex" }}>
          <span style={{ color: "#f6539f" }}>{nodeName}#</span>&nbsp;
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#c1755f",
              fontFamily: "'Courier New', monospace",
              fontSize: "0.75rem",
              flexGrow: 1,
              caretColor: "#c1755f",
            }}
            autoFocus
            spellCheck={false}
          />
        </div>
      </div>

      {/* quick commands */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          padding: "0.6rem 1rem",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <span
            className="label"
            style={{ fontSize: "0.55rem", opacity: 0.4, letterSpacing: "0.1em" }}
          >
            QUICK COMMANDS — {category}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
          }}
        >
          {commands.map((qc) => (
            <button
              key={qc.label}
              onClick={() => runCommand(qc.cmd)}
              title={`${qc.description}\n${qc.cmd}`}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#F2F2F2",
                fontSize: "0.55rem",
                padding: "0.25rem 0.5rem",
                cursor: "pointer",
                fontFamily: "inherit",
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

      {/* status bar */}
      <div
        style={{
          padding: "0.5rem 1rem",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.6rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          opacity: 0.5,
          flexShrink: 0,
        }}
      >
        <span>CONNECTED VIA WEBSOCKET</span>
        <span>CHANNEL: {channel}</span>
      </div>
    </div>
  );
}
