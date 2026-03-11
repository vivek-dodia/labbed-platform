"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { CollectionResponse } from "@/types/api";

export default function CollectionsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [publicRead, setPublicRead] = useState(false);
  const [publicDeploy, setPublicDeploy] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    api
      .get<CollectionResponse[]>("/api/v1/collections")
      .then(setCollections)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await api.post<CollectionResponse>(
        "/api/v1/collections",
        { name: newName, publicRead, publicDeploy }
      );
      setCollections((prev) => [created, ...prev]);
      setShowCreate(false);
      setNewName("");
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
    border: "1px solid #121212",
    background: active ? "#121212" : "transparent",
    color: active ? "#F3EFE7" : "#121212",
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    cursor: "pointer",
    fontFamily: "'Manrope', sans-serif",
    transition: "transform 0.15s, box-shadow 0.15s",
  });

  const navItemStyle: React.CSSProperties = {
    padding: "0 1.5rem",
    display: "flex",
    alignItems: "center",
    borderRight: "1px solid #121212",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    color: "#121212",
    height: "100%",
    transition: "background 0.15s, color 0.15s",
    fontFamily: "'Manrope', sans-serif",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F3EFE7", color: "#121212", fontFamily: "'Manrope', sans-serif" }}>
      {/* Sidebar */}
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
        <div style={{ width: "24px", height: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: "2rem", cursor: "pointer" }}>
          <span style={{ display: "block", height: "1px", backgroundColor: "#121212", width: "100%" }} />
          <span style={{ display: "block", height: "1px", backgroundColor: "#121212", width: "100%" }} />
          <span style={{ display: "block", height: "1px", backgroundColor: "#121212", width: "100%" }} />
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
        <nav style={{ height: "48px", borderBottom: "1px solid #121212", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", height: "100%" }}>
            <Link href="/" style={{ ...navItemStyle, fontWeight: 800, fontSize: "0.85rem" }}>LABBED</Link>
            <Link href="/" style={navItemStyle}>Dashboard</Link>
            <Link href="/topologies" style={navItemStyle}>Topologies</Link>
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            <span style={{ ...navItemStyle, borderLeft: "1px solid #121212" }}>{user?.displayName || user?.email || ""}</span>
            <button onClick={() => logout?.()} style={{ ...navItemStyle, background: "none", border: "none", borderLeft: "1px solid #121212" }}>Logout</button>
          </div>
        </nav>

        {/* Content */}
        <div style={{ flexGrow: 1, padding: "3rem 3.5rem" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3rem" }}>
            <div>
              <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                Collections
              </h1>
              <p style={{ ...labelStyle, marginTop: "0.75rem", opacity: 0.5 }}>
                {collections.length} COLLECTION{collections.length !== 1 ? "S" : ""}
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{ ...pillBtn(), backgroundColor: "#ED6A4A", color: "#121212" }}
            >
              New Collection +
            </button>
          </div>

          {/* Collection grid */}
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <span style={{ ...labelStyle, opacity: 0.4 }}>LOADING...</span>
            </div>
          ) : collections.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <span style={{ ...labelStyle, opacity: 0.4 }}>NO COLLECTIONS FOUND</span>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {collections.map((c) => (
                <div
                  key={c.uuid}
                  onClick={() => router.push(`/collections/${c.uuid}`)}
                  style={{
                    borderRight: "1px solid #121212",
                    borderBottom: "1px solid #121212",
                    padding: "2rem",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <h3 style={{ fontWeight: 500, fontSize: "1.15rem", lineHeight: 1.2, marginBottom: "0.75rem" }}>
                    {c.name}
                  </h3>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <span style={{
                      ...labelStyle,
                      fontSize: "0.6rem",
                      padding: "2px 8px",
                      border: "1px solid #121212",
                      borderRadius: "99px",
                      backgroundColor: c.publicRead ? "#A8EAB5" : "transparent",
                    }}>
                      {c.publicRead ? "PUBLIC" : "PRIVATE"}
                    </span>
                    {c.publicDeploy && (
                      <span style={{
                        ...labelStyle,
                        fontSize: "0.6rem",
                        padding: "2px 8px",
                        border: "1px solid #121212",
                        borderRadius: "99px",
                        backgroundColor: "#A2C2ED",
                      }}>
                        DEPLOY
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.7rem", opacity: 0.35, display: "block", marginTop: "1rem" }}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(18,18,18,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#F3EFE7", border: "1px solid #121212", padding: "2.5rem", maxWidth: "480px", width: "90%" }}>
            <span style={{ ...labelStyle, opacity: 0.5 }}>LABBED -- CREATE</span>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "1.8rem", margin: "1rem 0 1.5rem" }}>
              New Collection
            </h2>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>COLLECTION NAME</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="my-network-labs"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #121212", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Space Mono', monospace", outline: "none", color: "#121212" }}
              />
            </div>
            <div style={{ display: "flex", gap: "2rem", marginBottom: "1.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={publicRead} onChange={(e) => setPublicRead(e.target.checked)} />
                <span style={labelStyle}>PUBLIC READ</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={publicDeploy} onChange={(e) => setPublicDeploy(e.target.checked)} />
                <span style={labelStyle}>PUBLIC DEPLOY</span>
              </label>
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={handleCreate} disabled={creating} style={{ ...pillBtn(true), opacity: creating ? 0.5 : 1 }}>
                {creating ? "Creating..." : "Create Collection"}
              </button>
              <button onClick={() => setShowCreate(false)} style={pillBtn()}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
