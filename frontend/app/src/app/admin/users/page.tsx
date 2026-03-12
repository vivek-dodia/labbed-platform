"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { UserResponse } from "@/types/api";

export default function UsersPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.isAdmin) { router.push("/"); return; }
    api.get<UserResponse[]>("/api/v1/users")
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  async function handleCreate() {
    if (!email.trim() || !password.trim() || !displayName.trim()) return;
    setCreating(true);
    try {
      const u = await api.post<UserResponse>("/api/v1/users", {
        email, password, displayName, isAdmin,
      });
      setUsers((prev) => [u, ...prev]);
      setShowCreate(false);
      setEmail(""); setPassword(""); setDisplayName("");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(uuid: string) {
    await api.del(`/api/v1/users/${uuid}`);
    setUsers((prev) => prev.filter((u) => u.uuid !== uuid));
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    fontWeight: 700,
    letterSpacing: "0.05em",
    fontFamily: "'Manrope', sans-serif",
  };

  const pillBtn = (variant?: "default" | "filled" | "orange"): React.CSSProperties => ({
    padding: "0.5rem 1.2rem",
    borderRadius: "99px",
    border: "1px solid #000000",
    background: variant === "filled" ? "#000000" : variant === "orange" ? "#000000" : "transparent",
    color: variant === "filled" || variant === "orange" ? "#79f673" : "#000000",
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
          <span style={{ opacity: 0.5 }}>SYS</span>
          <span style={{ opacity: 0.5 }}>ADM</span>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Nav */}
        <nav style={{ height: "48px", borderBottom: "1px solid #000000", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", height: "100%" }}>
            <Link href="/" style={{ ...navItemStyle, fontWeight: 800, fontSize: "0.85rem" }}>LABBED</Link>
            <Link href="/" style={navItemStyle}>Dashboard</Link>
            <Link href="/admin/workers" style={navItemStyle}>Workers</Link>
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
              <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                User Registry
              </h1>
              <p style={{ ...labelStyle, marginTop: "0.75rem", opacity: 0.5 }}>
                {users.length} USER{users.length !== 1 ? "S" : ""} / ADMIN
              </p>
            </div>
            <button onClick={() => setShowCreate(true)} style={pillBtn("orange")}>
              Create User +
            </button>
          </div>

          {/* User table */}
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <span style={{ ...labelStyle, opacity: 0.4 }}>LOADING...</span>
            </div>
          ) : (
            <div style={{ border: "1px solid #000000" }}>
              {/* Header row */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.5fr 0.8fr 1fr 0.4fr",
                borderBottom: "1px solid #000000",
                backgroundColor: "rgba(0,0,0,0.03)",
              }}>
                {["EMAIL", "DISPLAY NAME", "ROLE", "CREATED", ""].map((h) => (
                  <div key={h} style={{ padding: "0.75rem 1.2rem", ...labelStyle }}>{h}</div>
                ))}
              </div>
              {users.map((u) => (
                <div
                  key={u.uuid}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.5fr 0.8fr 1fr 0.4fr",
                    borderBottom: "1px solid rgba(0,0,0,0.1)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ padding: "0.75rem 1.2rem", fontWeight: 500, fontSize: "0.9rem" }}>{u.email}</div>
                  <div style={{ padding: "0.75rem 1.2rem", fontSize: "0.9rem" }}>{u.displayName}</div>
                  <div style={{ padding: "0.75rem 1.2rem" }}>
                    <span style={{
                      ...labelStyle,
                      fontSize: "0.6rem",
                      padding: "2px 8px",
                      border: "1px solid #000000",
                      borderRadius: "99px",
                      backgroundColor: u.isAdmin ? "#000000" : "transparent",
                      color: u.isAdmin ? "#79f673" : "#000000",
                    }}>
                      {u.isAdmin ? "ADMIN" : "MEMBER"}
                    </span>
                  </div>
                  <div style={{ padding: "0.75rem 1.2rem", fontFamily: "'Space Mono', monospace", fontSize: "0.7rem", opacity: 0.5 }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ padding: "0.75rem 1.2rem", display: "flex", alignItems: "center" }}>
                    <button
                      onClick={() => handleDelete(u.uuid)}
                      style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.3, fontSize: "0.8rem", fontFamily: "inherit" }}
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#79f673", border: "1px solid #000000", padding: "2.5rem", maxWidth: "480px", width: "90%" }}>
            <span style={{ ...labelStyle, opacity: 0.5 }}>LABBED -- ADMIN</span>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "1.8rem", margin: "1rem 0 1.5rem" }}>Create User</h2>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>EMAIL</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #000000", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Space Mono', monospace", outline: "none", color: "#000000" }}
              />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>PASSWORD</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 characters"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #000000", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Space Mono', monospace", outline: "none", color: "#000000" }}
              />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>DISPLAY NAME</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #000000", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Space Mono', monospace", outline: "none", color: "#000000" }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "1.5rem" }}>
              <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
              <span style={labelStyle}>ADMIN PRIVILEGES</span>
            </label>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={handleCreate} disabled={creating} style={{ ...pillBtn("filled"), opacity: creating ? 0.5 : 1 }}>
                {creating ? "Creating..." : "Create User"}
              </button>
              <button onClick={() => setShowCreate(false)} style={pillBtn()}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
