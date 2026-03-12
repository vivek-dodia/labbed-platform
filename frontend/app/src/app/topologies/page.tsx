"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type {
  TopologyResponse,
  CollectionResponse,
  CreateTopologyRequest,
} from "@/types/api";

export default function TopologiesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [topologies, setTopologies] = useState<TopologyResponse[]>([]);
  const [collections, setCollections] = useState<CollectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("");

  // create form state
  const [newName, setNewName] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const [newDef, setNewDef] = useState(
    'name: my-lab\ntopology:\n  nodes:\n    router1:\n      kind: linux\n      image: quay.io/frrouting/frr:10.3.1\n  links:\n'
  );
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    Promise.all([
      api.get<TopologyResponse[]>("/api/v1/topologies").catch(() => []),
      api.get<CollectionResponse[]>("/api/v1/collections").catch(() => []),
    ]).then(([t, c]) => {
      setTopologies(t);
      setCollections(c);
      if (c.length > 0) setNewCollection(c[0].uuid);
      setLoading(false);
    });
  }, [user, authLoading, router]);

  const filtered = filter
    ? topologies.filter((t) => t.collectionId === filter)
    : topologies;

  const collectionName = (id: string) =>
    collections.find((c) => c.uuid === id)?.name || id.slice(0, 8);

  const nodeCount = (def: string) => {
    const m = def.match(/^\s{4}\S+:/gm);
    return m ? m.length : 0;
  };

  async function handleCreate() {
    if (!newName.trim() || !newCollection) return;
    setCreating(true);
    try {
      const req: CreateTopologyRequest = {
        name: newName,
        definition: newDef,
        collectionId: newCollection,
      };
      const created = await api.post<TopologyResponse>(
        "/api/v1/topologies",
        req
      );
      setTopologies((prev) => [created, ...prev]);
      setShowCreate(false);
      setNewName("");
    } catch {
      // handle error
    } finally {
      setCreating(false);
    }
  }

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
                Topologies
              </h1>
              <p style={{ ...labelStyle, marginTop: "0.75rem", opacity: 0.5 }}>02 / TEMPLATES</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                ...pillBtn(),
                backgroundColor: "#000000",
                color: "#79f673",
              }}
            >
              New Topology +
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

          {/* Topology grid */}
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
                  onClick={() => router.push(`/topologies/${t.uuid}`)}
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
                  <span style={{ ...labelStyle, fontSize: "0.6rem", opacity: 0.5 }}>
                    {collectionName(t.collectionId)}
                  </span>
                  <h3 style={{ fontWeight: 500, fontSize: "1.15rem", lineHeight: 1.2, margin: "0.75rem 0 0.5rem" }}>
                    {t.name}
                  </h3>
                  <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", opacity: 0.5 }}>
                      {nodeCount(t.definition)} nodes
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

      {/* Create modal */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#79f673",
              border: "1px solid #000000",
              padding: "2.5rem",
              maxWidth: "520px",
              width: "90%",
            }}
          >
            <span style={{ ...labelStyle, opacity: 0.5 }}>LABBED -- CREATE</span>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "1.8rem", margin: "1rem 0 1.5rem" }}>
              New Topology
            </h2>

            {/* Name */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>TOPOLOGY NAME</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="BGP-TRIANGLE-LAB"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #000000",
                  padding: "0.5rem 0",
                  fontSize: "1rem",
                  fontFamily: "'Space Mono', monospace",
                  outline: "none",
                  color: "#000000",
                }}
              />
            </div>

            {/* Collection */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>COLLECTION</label>
              <select
                value={newCollection}
                onChange={(e) => setNewCollection(e.target.value)}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #000000",
                  padding: "0.5rem 0",
                  fontSize: "1rem",
                  fontFamily: "'Manrope', sans-serif",
                  outline: "none",
                  color: "#000000",
                }}
              >
                {collections.map((c) => (
                  <option key={c.uuid} value={c.uuid}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* YAML */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>DEFINITION (YAML)</label>
              <textarea
                value={newDef}
                onChange={(e) => setNewDef(e.target.value)}
                rows={10}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "1px solid #000000",
                  padding: "0.8rem",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "0.8rem",
                  outline: "none",
                  resize: "vertical",
                  color: "#000000",
                  lineHeight: 1.5,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  ...pillBtn(),
                  backgroundColor: "#000000",
                  color: "#79f673",
                  opacity: creating ? 0.5 : 1,
                }}
              >
                {creating ? "Creating..." : "Create Topology"}
              </button>
              <button onClick={() => setShowCreate(false)} style={pillBtn()}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
