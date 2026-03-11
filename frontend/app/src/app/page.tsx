"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { LabResponse, WorkerResponse, PaginatedResponse } from "@/types/api";

/* ── design tokens ─────────────────────────────────────── */
const T = {
  bg: "#F3EFE7",
  ink: "#121212",
  orange: "#ED6A4A",
  blue: "#A2C2ED",
  yellow: "#E4CB6A",
  pink: "#EAA8C6",
  green: "#A8EAB5",
  lilac: "#D0C3DF",
  border: "1px solid #121212",
  font: "'Manrope', -apple-system, sans-serif",
  mono: "'Space Mono', monospace",
};

const label: React.CSSProperties = {
  fontSize: "0.65rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 700,
};

/* ── status colour map ─────────────────────────────────── */
function statusColor(state: string): string {
  switch (state) {
    case "running":
      return T.green;
    case "stopped":
    case "destroyed":
      return "#ddd";
    case "draft":
    case "pending":
      return T.lilac;
    default:
      return "#ddd";
  }
}

/* ── deterministic mini-preview nodes per lab ──────────── */
const previewColors = [T.blue, T.yellow, T.pink, T.green, T.orange, T.lilac];

function CanvasPreview({ nodeCount }: { nodeCount: number }) {
  const count = Math.min(Math.max(nodeCount, 1), 5);
  const positions = [
    { top: 40, left: 60 },
    { top: 100, left: 160 },
    { top: 50, left: 230 },
    { top: 110, left: 80 },
    { top: 70, left: 200 },
  ];
  return (
    <div
      style={{
        height: "180px",
        borderBottom: T.border,
        position: "relative",
        backgroundColor: "#fff",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* faint grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.15,
          backgroundImage:
            "linear-gradient(to right,rgba(18,18,18,0.2) 1px,transparent 1px),linear-gradient(to bottom,rgba(18,18,18,0.2) 1px,transparent 1px)",
          backgroundSize: "15px 15px",
        }}
      />
      {/* mini nodes */}
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 40,
            height: 24,
            border: T.border,
            backgroundColor: previewColors[i % previewColors.length],
            top: positions[i].top,
            left: positions[i].left,
            zIndex: 2,
          }}
        />
      ))}
      {/* dashed link line between first two */}
      {count >= 2 && (
        <div
          style={{
            position: "absolute",
            borderTop: "1px dashed #121212",
            width: 100,
            transform: "rotate(35deg)",
            top: 60,
            left: 90,
            zIndex: 1,
          }}
        />
      )}
    </div>
  );
}

/* ── hover-hand cursor SVG ─────────────────────────────── */
function HoverHand({ visible }: { visible: boolean }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      style={{
        position: "absolute",
        width: 30,
        height: 30,
        right: 15,
        top: 15,
        zIndex: 10,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "all 0.2s cubic-bezier(0.175,0.885,0.32,1.275)",
      }}
    >
      <path d="M12 20L20 8L28 20" fill={T.orange} stroke={T.ink} strokeWidth="2" />
      <rect x="16" y="20" width="8" height="14" fill={T.orange} stroke={T.ink} strokeWidth="2" />
    </svg>
  );
}

/* ── lab card ───────────────────────────────────────────── */
function LabCard({ lab }: { lab: LabResponse }) {
  const [hovered, setHovered] = useState(false);
  const nodeCount = lab.nodes?.length || 0;
  const timeAgo = lab.deployedAt
    ? new Date(lab.deployedAt).toLocaleDateString()
    : new Date(lab.createdAt).toLocaleDateString();

  return (
    <Link
      href={`/labs/${lab.uuid}`}
      style={{ textDecoration: "none", color: "inherit" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          borderRight: T.border,
          borderBottom: T.border,
          backgroundColor: hovered ? "#fff" : T.bg,
          display: "flex",
          flexDirection: "column",
          transition: "background 0.2s",
          cursor: "pointer",
          position: "relative",
        }}
      >
        {/* preview canvas */}
        <div style={{ position: "relative" }}>
          <CanvasPreview nodeCount={nodeCount} />
          <HoverHand visible={hovered} />
        </div>

        {/* content */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", flexGrow: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ fontWeight: 500, fontSize: "1.25rem", lineHeight: 1.2 }}>{lab.name}</h3>
            <span
              style={{
                fontSize: "0.6rem",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "0.15rem 0.5rem",
                border: T.border,
                borderRadius: 4,
                backgroundColor: statusColor(lab.state),
              }}
            >
              {lab.state}
            </span>
          </div>
          <p style={{ fontSize: "0.75rem", lineHeight: 1.4, opacity: 0.7 }}>
            {nodeCount} node{nodeCount !== 1 ? "s" : ""} &middot; {lab.uuid.slice(0, 8)}
          </p>
        </div>

        {/* footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: T.border,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "0.75rem", lineHeight: 1.4, opacity: 0.5 }}>{timeAgo}</span>
          <div style={{ opacity: hovered ? 1 : 0.4, transition: "opacity 0.2s" }}>
            <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor">
              <circle cx="2" cy="2" r="2" />
              <circle cx="8" cy="2" r="2" />
              <circle cx="14" cy="2" r="2" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── pill filter button (inline) ───────────────────────── */
function Pill({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.2rem 0.8rem",
        borderRadius: 99,
        border: T.border,
        fontSize: "0.7rem",
        fontWeight: 500,
        cursor: "pointer",
        gap: "0.4rem",
        backgroundColor: T.bg,
        whiteSpace: "nowrap",
        transition: "all 0.2s",
        transform: hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? `2px 2px 0 ${T.ink}` : "none",
      }}
    >
      {children}
    </div>
  );
}

/* ── nav item (inline) ─────────────────────────────────── */
function NavItem({
  children,
  href,
  onClick,
  style,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const common: React.CSSProperties = {
    padding: "0 1.5rem",
    display: "flex",
    alignItems: "center",
    borderRight: T.border,
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    color: hovered ? T.bg : T.ink,
    backgroundColor: hovered ? T.ink : "transparent",
    transition: "background 0.15s, color 0.15s",
    height: "100%",
    border: "none",
    fontFamily: T.font,
    ...style,
  };

  if (href) {
    return (
      <Link
        href={href}
        style={common}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      onClick={onClick}
      style={common}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

/* ── empty-state hero ──────────────────────────────────── */
function EmptyHero() {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        flexGrow: 1,
        borderBottom: T.border,
      }}
    >
      <div
        style={{
          padding: "4rem 3rem",
          borderRight: T.border,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "2rem",
        }}
      >
        <span style={{ ...label, opacity: 0.5 }}>TOPOLOGIES / NEW</span>
        <h1
          style={{
            fontFamily: T.font,
            fontWeight: 200,
            fontSize: "clamp(3rem, 6vw, 6rem)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Your first lab is one click away.
        </h1>
        <p style={{ maxWidth: 450, fontSize: "1rem", lineHeight: 1.6 }}>
          Welcome to Labbed. The canvas is clear and ready for your next architectural breakthrough.
          Start from scratch or browse topologies to begin.
        </p>
        <Link
          href="/topologies"
          style={{
            backgroundColor: T.ink,
            color: T.bg,
            padding: "1.5rem 2.5rem",
            fontSize: "1.25rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "inline-flex",
            alignItems: "center",
            gap: "1rem",
            cursor: "pointer",
            alignSelf: "flex-start",
            textDecoration: "none",
            transition: "transform 0.2s, box-shadow 0.2s",
            fontFamily: T.font,
          }}
        >
          BROWSE TOPOLOGIES
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ghost canvas */}
      <div
        style={{
          backgroundColor: "#fff",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          minHeight: 300,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(to right,rgba(18,18,18,0.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(18,18,18,0.05) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* ghost nodes */}
        <div
          style={{
            width: 120,
            height: 60,
            border: "1px dashed #121212",
            opacity: 0.2,
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.5rem",
            fontWeight: 700,
            top: "25%",
            left: "30%",
          }}
        >
          DRAG NODE HERE
        </div>
        <div
          style={{
            width: 120,
            height: 60,
            border: "1px dashed #121212",
            opacity: 0.2,
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.5rem",
            fontWeight: 700,
            top: "55%",
            left: "55%",
          }}
        >
          DEVICE_02
        </div>
        <div style={{ textAlign: "center", zIndex: 1, pointerEvents: "none" }}>
          <span
            style={{
              fontSize: "1.5rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 700,
              opacity: 0.2,
            }}
          >
            TABULA RASA
          </span>
        </div>
      </div>
    </section>
  );
}

/* ── main page ─────────────────────────────────────────── */
export default function DashboardPage() {
  const { user, activeOrg, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [labs, setLabs] = useState<LabResponse[]>([]);
  const [workers, setWorkers] = useState<WorkerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    Promise.all([
      api
        .get<PaginatedResponse<LabResponse>>("/api/v1/labs")
        .then((r) => r.data || [])
        .catch(() => [] as LabResponse[]),
      user.isAdmin
        ? api.get<WorkerResponse[]>("/api/v1/workers").catch(() => [])
        : Promise.resolve([]),
    ]).then(([l, w]) => {
      setLabs(l);
      setWorkers(w);
      setLoading(false);
    });
  }, [user, authLoading, router]);

  /* ── loading state ────────────────────────────────────── */
  if (authLoading || loading) {
    return (
      <div
        style={{
          backgroundColor: T.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: T.font,
          color: T.ink,
        }}
      >
        <span style={{ ...label, opacity: 0.4 }}>LOADING SYSTEM DATA...</span>
      </div>
    );
  }

  /* ── computed stats ───────────────────────────────────── */
  const runningLabs = labs.filter((l) => l.state === "running").length;
  const activeNodes = labs
    .filter((l) => l.state === "running")
    .reduce((sum, l) => sum + (l.nodes?.length || 0), 0);
  const onlineWorkers = workers.filter((w) => w.state === "online").length;
  const totalNodes = labs.reduce((sum, l) => sum + (l.nodes?.length || 0), 0);

  return (
    <>
      {/* ── menu drawer overlay ─────────────────────────── */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(18,18,18,0.4)",
            zIndex: 50,
            display: "flex",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 280,
              backgroundColor: T.bg,
              borderRight: T.border,
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
              <span style={label}>NAVIGATION</span>
              <button
                onClick={() => setMenuOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", fontWeight: 700, color: T.ink }}
              >
                X
              </button>
            </div>
            {[
              { label: "LABS", href: "/" },
              { label: "TOPOLOGIES", href: "/topologies" },
              { label: "COLLECTIONS", href: "/collections" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: "1rem 0",
                  borderBottom: T.border,
                  fontSize: "1.25rem",
                  fontWeight: 200,
                  fontFamily: T.font,
                  letterSpacing: "-0.01em",
                  cursor: "pointer",
                  textDecoration: "none",
                  color: T.ink,
                  display: "block",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── app shell ───────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          backgroundColor: T.bg,
          color: T.ink,
          fontFamily: T.font,
          WebkitFontSmoothing: "antialiased",
          overflowX: "hidden",
        }}
      >
        {/* ── sidebar (48px) ───────────────────────────── */}
        <aside
          style={{
            width: 48,
            borderRight: T.border,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "1rem 0",
            flexShrink: 0,
            backgroundColor: T.bg,
            zIndex: 10,
          }}
        >
          {/* hamburger */}
          <div
            onClick={() => setMenuOpen(true)}
            style={{
              width: 24,
              height: 20,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              marginBottom: "2rem",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "block", height: 1, backgroundColor: T.ink, width: "100%" }} />
            <span style={{ display: "block", height: 1, backgroundColor: T.ink, width: "100%" }} />
            <span style={{ display: "block", height: 1, backgroundColor: T.ink, width: "100%" }} />
          </div>

          {/* vertical text */}
          <div
            style={{
              writingMode: "vertical-rl",
              transform: "scale(-1)",
              fontSize: "0.65rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              gap: "1.5rem",
              display: "flex",
              marginTop: "auto",
              marginBottom: "2rem",
            }}
          >
            {["SETTINGS", "ARCHIVE", "LABS"].map((t) => (
              <span key={t} style={{ cursor: "pointer", opacity: t === "LABS" ? 1 : 0.5, transition: "opacity 0.2s" }}>
                {t}
              </span>
            ))}
          </div>
        </aside>

        {/* ── main content ─────────────────────────────── */}
        <main style={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* ── top nav (48px) ──────────────────────────── */}
          <nav
            style={{
              height: 48,
              borderBottom: T.border,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", height: "100%" }}>
              <NavItem href="/" style={{ fontWeight: 800, borderRight: T.border }}>
                LABBED
              </NavItem>
              <NavItem href="/topologies" style={{ borderRight: T.border }}>
                TOPOLOGIES
              </NavItem>
              <NavItem href="/collections" style={{ borderRight: T.border }}>
                COLLECTIONS
              </NavItem>
            </div>
            <div style={{ display: "flex", height: "100%" }}>
              <NavItem style={{ borderLeft: T.border, borderRight: T.border, gap: 8 }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    backgroundColor: T.pink,
                    borderRadius: "50%",
                    border: T.border,
                  }}
                />
                {user?.email || "USER"}
              </NavItem>
              <NavItem onClick={logout} style={{ borderRight: "none" }}>
                LOGOUT
              </NavItem>
            </div>
          </nav>

          {/* ── usage bar (#121212 strip) ────────────────── */}
          <div
            style={{
              height: 48,
              borderBottom: T.border,
              display: "flex",
              alignItems: "center",
              padding: "0 2rem",
              backgroundColor: T.ink,
              color: T.bg,
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ ...label, opacity: 0.6, color: T.bg }}>Storage:</span>
              <div style={{ width: 200, height: 6, backgroundColor: "rgba(255,255,255,0.2)", position: "relative", margin: "0 1rem" }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", backgroundColor: T.orange, width: "65%" }} />
              </div>
              <span style={{ fontSize: "0.75rem", lineHeight: 1.4, fontFamily: T.mono }}>6.5GB / 10GB</span>
            </div>
            <div style={{ display: "flex", gap: "2rem", fontSize: "0.75rem", lineHeight: 1.4 }}>
              <span>
                Nodes active: <strong>{activeNodes} / 50</strong>
              </span>
              {activeOrg && (
                <span>
                  Org: <strong>{activeOrg.name}</strong>
                </span>
              )}
            </div>
          </div>

          {/* ── page header ─────────────────────────────── */}
          <header
            style={{
              padding: "3rem 2rem",
              borderBottom: T.border,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div>
              <span style={{ ...label, display: "block", marginBottom: "0.5rem" }}>
                WORKSPACE / {activeOrg?.name?.toUpperCase() || "DEFAULT"}
              </span>
              <h1
                style={{
                  fontFamily: T.font,
                  fontWeight: 200,
                  fontSize: "clamp(3rem, 6vw, 6rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                My Labs
              </h1>
            </div>
            <Link
              href="/topologies"
              style={{
                backgroundColor: T.orange,
                color: T.ink,
                border: T.border,
                padding: "1rem 2rem",
                fontWeight: 700,
                textTransform: "uppercase",
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                fontFamily: T.font,
                transition: "transform 0.1s",
                textDecoration: "none",
              }}
            >
              <span>New Topology</span>
              <span style={{ fontSize: "1.2rem" }}>+</span>
            </Link>
          </header>

          {labs.length > 0 ? (
            <>
              {/* ── filter bar ──────────────────────────── */}
              <div
                style={{
                  padding: "1rem 2rem",
                  borderBottom: T.border,
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <span style={label}>Sort by:</span>
                <Pill>Recently Modified</Pill>
                <Pill>Status: All</Pill>
                <Pill>Tags</Pill>
                <div style={{ flexGrow: 1 }} />
                <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>
                  {labs.length} lab{labs.length !== 1 ? "s" : ""} &middot; {runningLabs} running &middot;{" "}
                  {user?.isAdmin ? `${onlineWorkers} worker${onlineWorkers !== 1 ? "s" : ""}` : `${totalNodes} nodes`}
                </div>
              </div>

              {/* ── lab card grid ───────────────────────── */}
              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                  borderBottom: T.border,
                }}
              >
                {labs.map((lab) => (
                  <LabCard key={lab.uuid} lab={lab} />
                ))}
              </section>
            </>
          ) : (
            /* ── empty state hero ───────────────────────── */
            <EmptyHero />
          )}
        </main>
      </div>
    </>
  );
}
