"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { WorkerResponse } from "@/types/api";

export default function WorkersPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [workers, setWorkers] = useState<WorkerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.isAdmin) { router.push("/"); return; }
    api.get<WorkerResponse[]>("/api/v1/workers")
      .then(setWorkers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  async function handleCreate() {
    if (!name.trim() || !address.trim()) return;
    setCreating(true);
    try {
      const w = await api.post<WorkerResponse>("/api/v1/workers", {
        name,
        address,
        capacity: parseInt(capacity) || 10,
      });
      setWorkers((prev) => [w, ...prev]);
      setShowCreate(false);
      setName("");
      setAddress("");
    } finally {
      setCreating(false);
    }
  }

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return "never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
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
    border: "1px solid #121212",
    background: variant === "filled" ? "#121212" : variant === "orange" ? "#ED6A4A" : "transparent",
    color: variant === "filled" ? "#F3EFE7" : "#121212",
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

  const statusColor = (state: string) => {
    switch (state) {
      case "online": return "#A8EAB5";
      case "draining": return "#E4CB6A";
      default: return "transparent";
    }
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
          <span style={{ opacity: 0.5 }}>SYS</span>
          <span style={{ opacity: 0.5 }}>ADM</span>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Nav */}
        <nav style={{ height: "48px", borderBottom: "1px solid #121212", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", height: "100%" }}>
            <Link href="/" style={{ ...navItemStyle, fontWeight: 800, fontSize: "0.85rem" }}>LABBED</Link>
            <Link href="/" style={navItemStyle}>Dashboard</Link>
            <Link href="/admin/users" style={navItemStyle}>Users</Link>
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            <span style={{ ...navItemStyle, borderLeft: "1px solid #121212" }}>{user?.displayName || ""}</span>
            <button onClick={() => logout?.()} style={{ ...navItemStyle, background: "none", border: "none", borderLeft: "1px solid #121212" }}>Logout</button>
          </div>
        </nav>

        {/* Content */}
        <div style={{ flexGrow: 1, padding: "3rem 3.5rem" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3rem" }}>
            <div>
              <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                Worker Fleet
              </h1>
              <p style={{ ...labelStyle, marginTop: "0.75rem", opacity: 0.5 }}>
                {workers.filter((w) => w.state === "online").length} ONLINE / {workers.length} TOTAL
              </p>
            </div>
            <button onClick={() => setShowCreate(true)} style={pillBtn("orange")}>
              Register Worker +
            </button>
          </div>

          {/* Worker cards */}
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <span style={{ ...labelStyle, opacity: 0.4 }}>LOADING...</span>
            </div>
          ) : workers.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <span style={{ ...labelStyle, opacity: 0.4 }}>NO WORKERS REGISTERED</span>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
              {workers.map((w) => (
                <div
                  key={w.uuid}
                  style={{
                    borderRight: "1px solid #121212",
                    borderBottom: "1px solid #121212",
                    padding: "2rem",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Status + Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                    <div style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "99px",
                      border: "1px solid #121212",
                      backgroundColor: statusColor(w.state),
                    }} />
                    <span style={{ ...labelStyle, fontSize: "0.6rem" }}>{w.state.toUpperCase()}</span>
                  </div>
                  <h3 style={{ fontWeight: 500, fontSize: "1.15rem", lineHeight: 1.2, marginBottom: "0.5rem" }}>
                    {w.name}
                  </h3>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", opacity: 0.6, marginBottom: "1rem" }}>
                    {w.address}
                  </p>
                  <div style={{ display: "flex", gap: "1.5rem" }}>
                    <div>
                      <span style={{ ...labelStyle, fontSize: "0.55rem", opacity: 0.4 }}>CAPACITY</span>
                      <p style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: "0.15rem" }}>{w.capacity}</p>
                    </div>
                    <div>
                      <span style={{ ...labelStyle, fontSize: "0.55rem", opacity: 0.4 }}>ACTIVE</span>
                      <p style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: "0.15rem" }}>{w.activeLabs}</p>
                    </div>
                    <div>
                      <span style={{ ...labelStyle, fontSize: "0.55rem", opacity: 0.4 }}>HEARTBEAT</span>
                      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.75rem", marginTop: "0.25rem", opacity: 0.5 }}>{timeAgo(w.lastHeartbeat)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Register modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(18,18,18,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#F3EFE7", border: "1px solid #121212", padding: "2.5rem", maxWidth: "480px", width: "90%" }}>
            <span style={{ ...labelStyle, opacity: 0.5 }}>LABBED -- ADMIN</span>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "1.8rem", margin: "1rem 0 1.5rem" }}>Register Worker</h2>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>WORKER NAME</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="worker-01"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #121212", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Space Mono', monospace", outline: "none", color: "#121212" }}
              />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>ADDRESS</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="http://10.0.0.5:8081"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #121212", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Space Mono', monospace", outline: "none", color: "#121212" }}
              />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>CAPACITY</label>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)}
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #121212", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Space Mono', monospace", outline: "none", color: "#121212" }}
              />
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={handleCreate} disabled={creating} style={{ ...pillBtn("filled"), opacity: creating ? 0.5 : 1 }}>
                {creating ? "Registering..." : "Register"}
              </button>
              <button onClick={() => setShowCreate(false)} style={pillBtn()}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
