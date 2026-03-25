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
  const { user, activeOrg, loading: authLoading } = useAuth();
  const router = useRouter();
  const [labs, setLabs] = useState<LabResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "running" | "stopped" | "failed">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/landing");
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
  const networkLabs = labs.filter((l) => l.type !== "cloud").length;
  const cloudLabs = labs.filter((l) => l.type === "cloud").length;

  const filtered = filter === "all" ? labs : labs.filter((l) => {
    if (filter === "running") return l.state === "running" || l.state === "deploying";
    if (filter === "stopped") return l.state === "stopped" || l.state === "scheduled";
    if (filter === "failed") return l.state === "failed";
    return true;
  });

  return (
    <AppShell
      navItems={[
        { label: "Templates", href: "/templates" },
        { label: "Collections", href: "/collections" },
      ]}
    >
      {/* Page header */}
      <header style={{ padding: "2.5rem 3rem 2rem", borderBottom: T.border }}>
        <span style={{ ...label, opacity: 0.4, display: "block", marginBottom: "0.5rem" }}>
          {activeOrg?.name?.toUpperCase() || "WORKSPACE"}
        </span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <h1 style={{ fontWeight: 200, fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            Labs
          </h1>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "1rem" }}>
              <span style={{ ...label, opacity: 0.4, fontFamily: T.mono, fontSize: "0.6rem" }}>
                {runningLabs} running
              </span>
              <span style={{ ...label, opacity: 0.4, fontFamily: T.mono, fontSize: "0.6rem" }}>
                {networkLabs} network
              </span>
              <span style={{ ...label, opacity: 0.4, fontFamily: T.mono, fontSize: "0.6rem" }}>
                {cloudLabs} cloud
              </span>
            </div>
            <Link
              href="/templates"
              style={{
                backgroundColor: T.ink,
                color: T.bg,
                padding: "0.5rem 1.2rem",
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textDecoration: "none",
                fontFamily: T.mono,
              }}
            >
              NEW LAB +
            </Link>
          </div>
        </div>

        {/* Filter pills */}
        {labs.length > 0 && (
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "1.25rem" }}>
            {(["all", "running", "stopped", "failed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "0.3rem 0.8rem",
                  border: T.border,
                  background: filter === f ? T.ink : "transparent",
                  color: filter === f ? T.bg : T.ink,
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  fontFamily: T.mono,
                  transition: "all 0.1s",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </header>

      {filtered.length > 0 ? (
        <div style={{ flexGrow: 1 }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 70px 100px 90px 110px 120px",
            padding: "0.6rem 3rem",
            borderBottom: T.border,
            gap: "1rem",
          }}>
            <span style={label}>NAME</span>
            <span style={label}>TYPE</span>
            <span style={label}>STATUS</span>
            <span style={label}>NODES</span>
            <span style={label}>TEMPLATE</span>
            <span style={{ ...label, textAlign: "right" }}>ACTIVITY</span>
          </div>

          {filtered.map((lab) => (
            <LabRow key={lab.uuid} lab={lab} />
          ))}
        </div>
      ) : labs.length > 0 ? (
        /* Filter returned empty */
        <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem" }}>
          <span style={{ ...label, opacity: 0.3 }}>NO {filter.toUpperCase()} LABS</span>
        </div>
      ) : (
        /* Empty state */
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem", gap: "1.5rem" }}>
          <h2 style={{ fontWeight: 200, fontSize: "2rem", letterSpacing: "-0.01em" }}>
            No labs yet
          </h2>
          <p style={{ fontSize: "0.85rem", opacity: 0.5, maxWidth: 380, textAlign: "center", lineHeight: 1.6 }}>
            Deploy your first network or cloud lab from a template to get started.
          </p>
          <Link
            href="/templates"
            style={{
              backgroundColor: T.ink,
              color: T.bg,
              padding: "0.7rem 1.5rem",
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              textDecoration: "none",
              fontFamily: T.mono,
            }}
          >
            BROWSE TEMPLATES
          </Link>
        </div>
      )}
    </AppShell>
  );
}

function LabRow({ lab }: { lab: LabResponse }) {
  const [hovered, setHovered] = useState(false);
  const nodeCount = lab.nodes?.length || 0;
  const isCloud = lab.type === "cloud";

  return (
    <Link
      href={`/labs/${lab.uuid}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 70px 100px 90px 110px 120px",
        padding: "0.85rem 3rem",
        borderBottom: T.border,
        gap: "1rem",
        alignItems: "center",
        backgroundColor: hovered ? "rgba(0,0,0,0.04)" : "transparent",
        transition: "background 0.15s",
        cursor: "pointer",
      }}>
        {/* Name */}
        <div>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{lab.name}</span>
          <span style={{ fontSize: "0.6rem", opacity: 0.3, marginLeft: "0.5rem", fontFamily: T.mono }}>
            {lab.uuid.slice(0, 8)}
          </span>
        </div>

        {/* Type */}
        <span style={{
          fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em", padding: "2px 6px",
          border: isCloud ? "1px solid rgba(0,120,255,0.3)" : "1px solid rgba(0,0,0,0.15)",
          color: isCloud ? "#0070f3" : "rgba(0,0,0,0.5)",
          fontFamily: T.mono, display: "inline-block", width: "fit-content",
        }}>
          {isCloud ? "CLOUD" : "NET"}
        </span>

        {/* Status */}
        <StatusBadge state={lab.state} />

        {/* Nodes */}
        <span style={{ fontFamily: T.mono, fontSize: "0.75rem", opacity: 0.6 }}>
          {nodeCount > 0 ? nodeCount : "\u2014"}
        </span>

        {/* Template */}
        <span style={{ fontFamily: T.mono, fontSize: "0.65rem", opacity: 0.4 }}>
          {lab.templateId?.slice(0, 8) || "\u2014"}
        </span>

        {/* Last activity */}
        <span style={{ fontSize: "0.7rem", opacity: 0.4, textAlign: "right", fontFamily: T.mono }}>
          {timeAgo(lab.deployedAt || lab.createdAt)}
        </span>
      </div>
    </Link>
  );
}
