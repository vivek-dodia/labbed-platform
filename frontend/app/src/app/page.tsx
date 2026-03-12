"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/ui/StatusBadge";
import type { LabResponse, PaginatedResponse } from "@/types/api";

const T = {
  bg: "#79f673",
  ink: "#000000",
  border: "1px solid #000000",
  font: "'Manrope', -apple-system, sans-serif",
  mono: "'Space Mono', monospace",
};

const label: React.CSSProperties = {
  fontSize: "0.65rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 700,
};

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "\u2014";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const { user, activeOrg, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [labs, setLabs] = useState<LabResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    api
      .get<PaginatedResponse<LabResponse>>("/api/v1/labs")
      .then((r) => setLabs(r.data || []))
      .catch(() => setLabs([]))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div style={{ backgroundColor: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
        <span style={{ ...label, opacity: 0.4 }}>LOADING...</span>
      </div>
    );
  }

  const runningLabs = labs.filter((l) => l.state === "running").length;
  const totalNodes = labs.reduce((sum, l) => sum + (l.nodes?.length || 0), 0);

  return (
    <AppShell
      navItems={[
        { label: "TOPOLOGIES", href: "/topologies" },
        { label: "COLLECTIONS", href: "/collections" },
      ]}
    >
      {/* Page header */}
      <header style={{ padding: "3rem 3rem 2rem", borderBottom: T.border }}>
        <span style={{ ...label, opacity: 0.5, display: "block", marginBottom: "0.5rem" }}>
          {activeOrg?.name?.toUpperCase() || "WORKSPACE"}
        </span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <h1 style={{ fontWeight: 200, fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            My Labs
          </h1>
          <div style={{ display: "flex", gap: "2rem", alignItems: "baseline" }}>
            <span style={{ ...label, opacity: 0.5 }}>
              {labs.length} lab{labs.length !== 1 ? "s"  : ""} &middot; {runningLabs} running &middot; {totalNodes} nodes
            </span>
            <Link
              href="/topologies"
              style={{
                backgroundColor: T.ink,
                color: T.bg,
                padding: "0.6rem 1.5rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontFamily: T.font,
              }}
            >
              NEW LAB +
            </Link>
          </div>
        </div>
      </header>

      {labs.length > 0 ? (
        /* Lab table */
        <div style={{ flexGrow: 1 }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px 100px 120px 140px",
            padding: "0.75rem 3rem",
            borderBottom: T.border,
            gap: "1rem",
          }}>
            <span style={label}>NAME</span>
            <span style={label}>STATUS</span>
            <span style={label}>NODES</span>
            <span style={label}>TOPOLOGY</span>
            <span style={{ ...label, textAlign: "right" }}>LAST ACTIVITY</span>
          </div>

          {/* Lab rows */}
          {labs.map((lab) => (
            <LabRow key={lab.uuid} lab={lab} />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem", gap: "1.5rem" }}>
          <h2 style={{ fontWeight: 200, fontSize: "2rem", letterSpacing: "-0.01em" }}>
            No labs yet
          </h2>
          <p style={{ fontSize: "0.9rem", opacity: 0.6, maxWidth: 400, textAlign: "center", lineHeight: 1.6 }}>
            Deploy your first lab from a topology template to get started.
          </p>
          <Link
            href="/topologies"
            style={{
              backgroundColor: T.ink,
              color: T.bg,
              padding: "0.8rem 2rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              textDecoration: "none",
              fontFamily: T.font,
            }}
          >
            BROWSE TOPOLOGIES
          </Link>
        </div>
      )}
    </AppShell>
  );
}

function LabRow({ lab }: { lab: LabResponse }) {
  const [hovered, setHovered] = useState(false);
  const nodeCount = lab.nodes?.length || 0;
  const runningNodes = lab.nodes?.filter((n) => n.state === "running").length || 0;

  return (
    <Link
      href={`/labs/${lab.uuid}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 100px 120px 140px",
        padding: "1rem 3rem",
        borderBottom: T.border,
        gap: "1rem",
        alignItems: "center",
        backgroundColor: hovered ? "rgba(0,0,0,0.04)" : "transparent",
        transition: "background 0.15s",
        cursor: "pointer",
      }}>
        {/* Name */}
        <div>
          <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>{lab.name}</span>
          <span style={{ fontSize: "0.7rem", opacity: 0.4, marginLeft: "0.75rem", fontFamily: T.mono }}>
            {lab.uuid.slice(0, 8)}
          </span>
        </div>

        {/* Status */}
        <div>
          <StatusBadge state={lab.state} />
        </div>

        {/* Nodes */}
        <span style={{ fontFamily: T.mono, fontSize: "0.8rem" }}>
          {lab.state === "running" ? `${runningNodes}/${nodeCount}` : nodeCount > 0 ? `${nodeCount}` : "\u2014"}
        </span>

        {/* Topology ID */}
        <span style={{ fontFamily: T.mono, fontSize: "0.75rem", opacity: 0.5 }}>
          {lab.topologyId?.slice(0, 8) || "\u2014"}
        </span>

        {/* Last activity */}
        <span style={{ fontSize: "0.75rem", opacity: 0.5, textAlign: "right" }}>
          {timeAgo(lab.deployedAt || lab.createdAt)}
        </span>
      </div>
    </Link>
  );
}
