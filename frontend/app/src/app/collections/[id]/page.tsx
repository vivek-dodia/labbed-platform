"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { CollectionResponse, TopologyResponse } from "@/types/api";

export default function CollectionDetailPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [collection, setCollection] = useState<CollectionResponse | null>(null);
  const [topologies, setTopologies] = useState<TopologyResponse[]>([]);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"editor" | "deployer" | "viewer">("viewer");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    Promise.all([
      api.get<CollectionResponse>(`/api/v1/collections/${id}`),
      api.get<TopologyResponse[]>("/api/v1/topologies").catch(() => []),
    ]).then(([c, t]) => {
      setCollection(c);
      setEditName(c.name);
      setTopologies(t.filter((tp) => tp.collectionId === c.uuid));
    });
  }, [id, user, authLoading, router]);

  async function handleSave() {
    if (!collection) return;
    setSaving(true);
    try {
      const updated = await api.put<CollectionResponse>(
        `/api/v1/collections/${id}`,
        { name: editName }
      );
      setCollection(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(field: "publicRead" | "publicDeploy") {
    if (!collection) return;
    const updated = await api.put<CollectionResponse>(
      `/api/v1/collections/${id}`,
      { [field]: !collection[field] }
    );
    setCollection(updated);
  }

  async function handleAddMember() {
    if (!memberUserId.trim()) return;
    await api.post(`/api/v1/collections/${id}/members`, {
      userId: memberUserId,
      role: memberRole,
    });
    setShowAddMember(false);
    setMemberUserId("");
  }

  async function handleDelete() {
    await api.del(`/api/v1/collections/${id}`);
    router.push("/collections");
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    fontWeight: 700,
    letterSpacing: "0.05em",
    fontFamily: "'Manrope', sans-serif",
  };

  const pillBtn = (variant?: "default" | "filled" | "danger"): React.CSSProperties => ({
    padding: "0.5rem 1.2rem",
    borderRadius: "99px",
    border: "1px solid #000000",
    background: variant === "filled" ? "#000000" : variant === "danger" ? "#000000" : "transparent",
    color: variant === "filled" || variant === "danger" ? "#79f673" : "#000000",
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

  if (!collection) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#79f673", color: "#000000", fontFamily: "'Manrope', sans-serif", alignItems: "center", justifyContent: "center" }}>
        <span style={{ ...labelStyle, opacity: 0.4 }}>LOADING...</span>
      </div>
    );
  }

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
            <Link href="/collections" style={navItemStyle}>Collections</Link>
            <span style={{ ...navItemStyle, opacity: 0.5, cursor: "default" }}>{collection.name}</span>
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            <span style={{ ...navItemStyle, borderLeft: "1px solid #000000" }}>{user?.displayName || ""}</span>
            <button onClick={() => logout?.()} style={{ ...navItemStyle, background: "none", border: "none", borderLeft: "1px solid #000000" }}>Logout</button>
          </div>
        </nav>

        {/* Content */}
        <div style={{ flexGrow: 1, padding: "3rem 3.5rem" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3rem" }}>
            <div>
              <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                {collection.name}
              </h1>
              <p style={{ ...labelStyle, marginTop: "0.75rem", opacity: 0.5 }}>COLLECTION DETAIL</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={handleSave} disabled={saving} style={pillBtn("filled")}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={handleDelete} style={pillBtn("danger")}>Delete</button>
            </div>
          </div>

          {/* Settings section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem", marginBottom: "3rem" }}>
            {/* Left: edit name + toggles */}
            <div>
              <span style={{ ...labelStyle, opacity: 0.5, display: "block", marginBottom: "1.5rem" }}>SETTINGS</span>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>NAME</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #000000", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Space Mono', monospace", outline: "none", color: "#000000" }}
                />
              </div>
              <div style={{ display: "flex", gap: "2rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={collection.publicRead} onChange={() => handleToggle("publicRead")} />
                  <span style={labelStyle}>PUBLIC READ</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={collection.publicDeploy} onChange={() => handleToggle("publicDeploy")} />
                  <span style={labelStyle}>PUBLIC DEPLOY</span>
                </label>
              </div>
              <div style={{ marginTop: "1.5rem" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.7rem", opacity: 0.3 }}>
                  UUID: {collection.uuid}
                </span>
              </div>
            </div>

            {/* Right: Members */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <span style={{ ...labelStyle, opacity: 0.5 }}>MEMBERS</span>
                <button onClick={() => setShowAddMember(true)} style={pillBtn()}>+ Add Member</button>
              </div>
              <p style={{ fontSize: "0.8rem", opacity: 0.4 }}>
                Member management available via API. Use the Add Member button to invite users by UUID.
              </p>
            </div>
          </div>

          {/* Topologies in collection */}
          {topologies.length > 0 && (
            <div>
              <span style={{ ...labelStyle, opacity: 0.5, display: "block", marginBottom: "1rem" }}>TOPOLOGIES IN COLLECTION</span>
              <div style={{ border: "1px solid #000000" }}>
                {/* Header row */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", borderBottom: "1px solid #000000", backgroundColor: "rgba(0,0,0,0.03)" }}>
                  <div style={{ padding: "0.75rem 1.2rem", ...labelStyle }}>NAME</div>
                  <div style={{ padding: "0.75rem 1.2rem", ...labelStyle }}>UPDATED</div>
                  <div style={{ padding: "0.75rem 1.2rem", ...labelStyle, width: "60px" }}></div>
                </div>
                {topologies.map((t) => (
                  <div
                    key={t.uuid}
                    onClick={() => router.push(`/topologies/${t.uuid}`)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr auto",
                      borderBottom: "1px solid rgba(0,0,0,0.1)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ padding: "0.75rem 1.2rem", fontWeight: 500 }}>{t.name}</div>
                    <div style={{ padding: "0.75rem 1.2rem", fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", opacity: 0.5 }}>
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </div>
                    <div style={{ padding: "0.75rem 1.2rem", width: "60px", textAlign: "center" }}>&#8594;</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add member modal */}
      {showAddMember && (
        <div onClick={() => setShowAddMember(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#79f673", border: "1px solid #000000", padding: "2.5rem", maxWidth: "480px", width: "90%" }}>
            <span style={{ ...labelStyle, opacity: 0.5 }}>LABBED -- MEMBERS</span>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "1.8rem", margin: "1rem 0 1.5rem" }}>Add Member</h2>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>USER UUID</label>
              <input
                value={memberUserId}
                onChange={(e) => setMemberUserId(e.target.value)}
                placeholder="user-uuid-here"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #000000", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Space Mono', monospace", outline: "none", color: "#000000" }}
              />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>ROLE</label>
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as typeof memberRole)}
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #000000", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Manrope', sans-serif", outline: "none", color: "#000000" }}
              >
                <option value="viewer">VIEWER</option>
                <option value="deployer">DEPLOYER</option>
                <option value="editor">EDITOR</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={handleAddMember} style={{ ...pillBtn("filled") }}>Add Member</button>
              <button onClick={() => setShowAddMember(false)} style={pillBtn()}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
