"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "@/lib/api";

interface AwsCliTerminalProps {
  labId: string;
  disabled?: boolean;
}

interface TermLine {
  type: "input" | "output" | "error";
  text: string;
}

const MONO = "'Space Mono', monospace";

const AWS_COMMANDS = [
  { label: "VPCs", cmd: "aws ec2 describe-vpcs", description: "List VPCs" },
  { label: "Subnets", cmd: "aws ec2 describe-subnets", description: "List subnets" },
  { label: "IGWs", cmd: "aws ec2 describe-internet-gateways", description: "Internet gateways" },
  { label: "Route Tables", cmd: "aws ec2 describe-route-tables", description: "Route tables" },
  { label: "Security Groups", cmd: "aws ec2 describe-security-groups", description: "Security groups" },
  { label: "NAT GWs", cmd: "aws ec2 describe-nat-gateways", description: "NAT gateways" },
  { label: "EIPs", cmd: "aws ec2 describe-addresses", description: "Elastic IPs" },
  { label: "Peering", cmd: "aws ec2 describe-vpc-peering-connections", description: "VPC peering" },
];

export default function AwsCliTerminal({ labId, disabled }: AwsCliTerminalProps) {
  const [lines, setLines] = useState<TermLine[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || disabled) return;
    setLines((prev) => [...prev, { type: "input", text: cmd }]);
    historyRef.current = [cmd, ...historyRef.current.filter((c) => c !== cmd)].slice(0, 50);
    setHistoryIndex(-1);
    setRunning(true);
    try {
      const res = await api.post<{ output: string; error?: string }>(
        `/api/v1/labs/${labId}/aws-exec`,
        { command: cmd }
      );
      if (res.output) {
        setLines((prev) => [...prev, { type: "output", text: res.output }]);
      }
      if (res.error) {
        setLines((prev) => [...prev, { type: "error" as const, text: res.error! }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLines((prev) => [...prev, { type: "error", text: msg }]);
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  }, [labId, disabled]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim() && !running) {
      runCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIdx = Math.min(historyIndex + 1, historyRef.current.length - 1);
      if (newIdx >= 0 && historyRef.current[newIdx]) {
        setHistoryIndex(newIdx);
        setInput(historyRef.current[newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIdx = historyIndex - 1;
      if (newIdx < 0) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(newIdx);
        setInput(historyRef.current[newIdx]);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Quick commands */}
      <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid rgba(121,246,115,0.1)", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {AWS_COMMANDS.map((c) => (
          <button
            key={c.label}
            onClick={() => runCommand(c.cmd)}
            disabled={running || disabled}
            title={c.description}
            style={{
              padding: "2px 8px",
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              background: "rgba(121,246,115,0.08)",
              border: "1px solid rgba(121,246,115,0.15)",
              borderRadius: 3,
              color: "rgba(121,246,115,0.6)",
              cursor: disabled ? "not-allowed" : "pointer",
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Output */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.5rem 1rem",
          fontFamily: MONO,
          fontSize: "0.8rem",
          lineHeight: 1.5,
          cursor: "text",
        }}
      >
        {lines.map((l, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {l.type === "input" ? (
              <span>
                <span style={{ color: "#79f673", opacity: 0.6 }}>$ </span>
                <span style={{ color: "#79f673" }}>{l.text}</span>
              </span>
            ) : l.type === "error" ? (
              <span style={{ color: "#ff6b6b" }}>{l.text}</span>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.8)" }}>{l.text}</span>
            )}
          </div>
        ))}
        {running && (
          <div style={{ color: "rgba(121,246,115,0.4)" }}>Running...</div>
        )}
      </div>

      {/* Input */}
      <div style={{
        display: "flex",
        alignItems: "center",
        borderTop: "1px solid rgba(121,246,115,0.1)",
        padding: "0 1rem",
        background: "rgba(0,0,0,0.2)",
      }}>
        <span style={{ color: "#79f673", opacity: 0.6, fontFamily: MONO, fontSize: "0.8rem", marginRight: 6 }}>$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="aws ec2 describe-vpcs"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: MONO,
            fontSize: "0.8rem",
            color: "#79f673",
            padding: "0.6rem 0",
          }}
          spellCheck={false}
          autoFocus
        />
      </div>
    </div>
  );
}
