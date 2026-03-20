"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type {
  TemplateResponse,
  CollectionResponse,
} from "@/types/api";

export default function TopologiesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [collections, setCollections] = useState<CollectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    Promise.all([
      api.get<TemplateResponse[]>("/api/v1/templates").catch(() => []),
      api.get<CollectionResponse[]>("/api/v1/collections").catch(() => []),
    ]).then(([t, c]) => {
      setTemplates(t);
      setCollections(c);
      setLoading(false);
    });
  }, [user, authLoading, router]);

  const filtered = filter
    ? templates.filter((t) => t.collectionId === filter)
    : templates;

  const collectionName = (id: string) =>
    collections.find((c) => c.uuid === id)?.name || id.slice(0, 8);

  const nodeCount = (def: string) => {
    const m = def.match(/^\s{4}\S+:/gm);
    return m ? m.length : 0;
  };

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

  const navItemStyle: React.CSSProperties = {
    padding: "0 1.5rem",
    display: "flex",
    alignItems: "center",
    borderRight: "1px solid #000000",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    color: "#000000",
    height: "100%",
    transition: "background 0.15s, color 0.15s",
    fontFamily: "'Manrope', sans-serif",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#79f673", color: "#000000", fontFamily: "'Manrope', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: "48px",
        borderRight: "1px solid #000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1rem 0",
        flexShrink: 0,
        backgroundColor: "#79f673",
        zIndex: 10,
      }}>
        <div style={{ width: "24px", height: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: "2rem", cursor: "pointer" }}>
          <span style={{ display: "block", height: "1px", backgroundColor: "#000000", width: "100%" }} />
          <span style={{ display: "block", height: "1px", backgroundColor: "#000000", width: "100%" }} />
          <span style={{ display: "block", height: "1px", backgroundColor: "#000000", width: "100%" }} />
        </div>
        <div style={{ writingMode: "vertical-rl", transform: "scale(-1)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", gap: "1rem", display: "flex", marginTop: "auto", marginBottom: "2rem" }}>
          <span style={{ opacity: 0.5 }}>CLI</span>
          <span style={{ opacity: 0.5 }}>GUI</span>
          <span style={{ opacity: 0.5 }}>API</span>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Nav */}
        <nav style={{ height: "48px", borderBottom: "1px solid #000000", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", height: "100%" }}>
            <Link href="/" style={{ ...navItemStyle, fontWeight: 800, fontSize: "0.85rem" }}>LABBED</Link>
            <Link href="/" style={navItemStyle}>Dashboard</Link>
            <Link href="/collections" style={navItemStyle}>Collections</Link>
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            <span style={{ ...navItemStyle, borderLeft: "1px solid #000000" }}>{user?.displayName || user?.email || ""}</span>
            <button onClick={() => logout?.()} style={{ ...navItemStyle, background: "none", border: "none", borderLeft: "1px solid #000000" }}>Logout</button>
          </div>
        </nav>

        {/* Content */}
        <div style={{ flexGrow: 1, padding: "3rem 3.5rem" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3rem" }}>
            <div>
              <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                Templates
              </h1>
              <p style={{ ...labelStyle, marginTop: "0.75rem", opacity: 0.5 }}>02 / TEMPLATES</p>
            </div>
            <button
              onClick={() => router.push("/templates/new")}
              style={{
                ...pillBtn(),
                backgroundColor: "#000000",
                color: "#79f673",
              }}
            >
              New Template +
            </button>
          </div>

          {/* Collection filter pills */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
            <button onClick={() => setFilter("")} style={pillBtn(!filter)}>All</button>
            {collections.map((c) => (
              <button key={c.uuid} onClick={() => setFilter(c.uuid)} style={pillBtn(filter === c.uuid)}>
                {c.name}
              </button>
            ))}
          </div>

          {/* Template grid */}
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <span style={{ ...labelStyle, opacity: 0.4 }}>LOADING...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <span style={{ ...labelStyle, opacity: 0.4 }}>NO TOPOLOGIES FOUND</span>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {filtered.map((t) => (
                <div
                  key={t.uuid}
                  onClick={() => router.push(`/templates/${t.uuid}`)}
                  style={{
                    borderRight: "1px solid #000000",
                    borderBottom: "1px solid #000000",
                    padding: "2rem",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ ...labelStyle, fontSize: "0.6rem", opacity: 0.5 }}>
                      {collectionName(t.collectionId)}
                    </span>
                    <span style={{
                      fontSize: "0.55rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: t.type === "cloud" ? "rgba(0,120,255,0.12)" : "rgba(0,0,0,0.06)",
                      color: t.type === "cloud" ? "#0070f3" : "rgba(0,0,0,0.5)",
                      fontFamily: "'Manrope', sans-serif",
                    }}>
                      {t.type === "cloud" ? "CLOUD" : "NETWORK"}
                    </span>
                  </div>
                  <h3 style={{ fontWeight: 500, fontSize: "1.15rem", lineHeight: 1.2, margin: "0.75rem 0 0.5rem" }}>
                    {t.name}
                  </h3>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", opacity: 0.5 }}>
                      {t.type === "cloud" ? "HCL" : `${nodeCount(t.definition)} nodes`}
                    </span>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.7rem", opacity: 0.35 }}>
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
