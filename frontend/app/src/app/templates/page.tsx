"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import type { TemplateResponse, CollectionResponse } from "@/types/api";

const MONO = "'Space Mono', monospace";
const LABEL: React.CSSProperties = { fontSize: "0.65rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" };
const BORDER = "1px solid #000000";

export default function TemplatesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [collections, setCollections] = useState<CollectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionFilter, setCollectionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "network" | "cloud">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    Promise.all([
      api.get<TemplateResponse[]>("/api/v1/templates").catch(() => []),
      api.get<CollectionResponse[]>("/api/v1/collections").catch(() => []),
    ]).then(([t, c]) => { setTemplates(t); setCollections(c); setLoading(false); });
  }, [user, authLoading, router]);

  const collectionName = (id: string) => collections.find((c) => c.uuid === id)?.name || id.slice(0, 8);
  const nodeCount = (def: string) => { const m = def.match(/^\s{4}\S+:/gm); return m ? m.length : 0; };

  const filtered = templates.filter((t) => {
    if (collectionFilter && t.collectionId !== collectionFilter) return false;
    if (typeFilter && t.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !collectionName(t.collectionId).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const networkCount = templates.filter((t) => t.type !== "cloud").length;
  const cloudCount = templates.filter((t) => t.type === "cloud").length;

  const filterBtn = (active: boolean): React.CSSProperties => ({
    padding: "0.3rem 0.8rem",
    border: BORDER,
    background: active ? "#000" : "transparent",
    color: active ? "#79f673" : "#000",
    fontSize: "0.6rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    cursor: "pointer",
    fontFamily: MONO,
    transition: "all 0.1s",
  });

  return (
    <AppShell
      navItems={[
        { label: "Templates", href: "/templates" },
        { label: "Collections", href: "/collections" },
      ]}
      activeNav="/templates"
    >
      {/* Header */}
      <header style={{ padding: "2.5rem 3rem 1.5rem", borderBottom: BORDER }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontWeight: 200, fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
              Templates
            </h1>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
              <span style={{ ...LABEL, opacity: 0.4, fontFamily: MONO, fontSize: "0.6rem" }}>{templates.length} total</span>
              <span style={{ ...LABEL, opacity: 0.4, fontFamily: MONO, fontSize: "0.6rem" }}>{networkCount} network</span>
              <span style={{ ...LABEL, opacity: 0.4, fontFamily: MONO, fontSize: "0.6rem" }}>{cloudCount} cloud</span>
            </div>
          </div>
          <button
            onClick={() => router.push("/templates/new")}
            style={{
              background: "#000", color: "#79f673",
              padding: "0.5rem 1.2rem", fontSize: "0.7rem",
              fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
              border: "none", cursor: "pointer", fontFamily: MONO,
            }}
          >
            NEW TEMPLATE +
          </button>
        </div>

        {/* Search + filters */}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            style={{
              padding: "0.35rem 0.8rem",
              border: BORDER,
              background: "transparent",
              fontFamily: MONO,
              fontSize: "0.65rem",
              outline: "none",
              width: 200,
              color: "#000",
            }}
          />

          {/* Type filter */}
          <button onClick={() => setTypeFilter("")} style={filterBtn(!typeFilter)}>All Types</button>
          <button onClick={() => setTypeFilter("network")} style={filterBtn(typeFilter === "network")}>Network</button>
          <button onClick={() => setTypeFilter("cloud")} style={filterBtn(typeFilter === "cloud")}>Cloud</button>

          <span style={{ width: 1, height: 16, background: "rgba(0,0,0,0.15)" }} />

          {/* Collection filter */}
          <button onClick={() => setCollectionFilter("")} style={filterBtn(!collectionFilter)}>All Collections</button>
          {collections.map((c) => (
            <button key={c.uuid} onClick={() => setCollectionFilter(c.uuid)} style={filterBtn(collectionFilter === c.uuid)}>
              {c.name}
            </button>
          ))}
        </div>
      </header>

      {/* Grid */}
      <div style={{ flexGrow: 1 }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <span style={{ ...LABEL, opacity: 0.4 }}>LOADING...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <span style={{ ...LABEL, opacity: 0.4 }}>
              {search || typeFilter || collectionFilter ? "NO MATCHING TEMPLATES" : "NO TEMPLATES YET"}
            </span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {filtered.map((t) => (
              <div
                key={t.uuid}
                onClick={() => router.push(`/templates/${t.uuid}`)}
                style={{
                  borderRight: BORDER, borderBottom: BORDER,
                  padding: "1.5rem 1.75rem",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ ...LABEL, fontSize: "0.55rem", opacity: 0.4 }}>
                    {collectionName(t.collectionId)}
                  </span>
                  <span style={{
                    fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.06em", padding: "1px 5px",
                    border: t.type === "cloud" ? "1px solid rgba(0,120,255,0.25)" : "1px solid rgba(0,0,0,0.12)",
                    color: t.type === "cloud" ? "#0070f3" : "rgba(0,0,0,0.45)",
                    fontFamily: MONO,
                  }}>
                    {t.type === "cloud" ? "CLOUD" : "NET"}
                  </span>
                </div>
                <h3 style={{ fontWeight: 600, fontSize: "1rem", lineHeight: 1.2, margin: "0.6rem 0 0.4rem" }}>
                  {t.name}
                </h3>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                  <span style={{ fontFamily: MONO, fontSize: "0.65rem", opacity: 0.4 }}>
                    {t.type === "cloud" ? "HCL" : `${nodeCount(t.definition)} nodes`}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: "0.6rem", opacity: 0.25 }}>
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
