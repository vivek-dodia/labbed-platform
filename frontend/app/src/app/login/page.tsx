"use client";

import { useState, useEffect, useRef, type FormEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { AuthConfigResponse, LoginResponse, GoogleAuthorizeResponse } from "@/types/api";

type Mode = "login" | "signup";

const FONT = "'Manrope', -apple-system, sans-serif";
const MONO = "'Space Mono', monospace";
const GREEN = "#79f673";
const BORDER = "rgba(255,255,255,0.1)";

/* ── Animated network nodes (right panel) ──────────────────── */
const nodePositions = [
  [{ top: "25%", left: "25%" }, { top: "55%", left: "55%" }, { top: "30%", left: "72%" }, { top: "70%", left: "25%" }],
  [{ top: "18%", left: "55%" }, { top: "65%", left: "20%" }, { top: "38%", left: "38%" }, { top: "55%", left: "75%" }],
  [{ top: "45%", left: "18%" }, { top: "18%", left: "42%" }, { top: "65%", left: "70%" }, { top: "40%", left: "65%" }],
];

const nodeData = [
  { label: "CORE-RTR-01", meta: "OSPF Area 0", color: GREEN },
  { label: "DIST-SW-02", meta: "VLAN 10.10.1.0/24", color: GREEN },
  { label: "EDGE-FW-01", meta: "BGP AS 65001", color: "#38bdf8" },
  { label: "AWS-VPC", meta: "10.0.0.0/16", color: "#38bdf8" },
];

function VisualPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const nodeRefs: RefObject<HTMLDivElement | null>[] = [
    useRef(null), useRef(null), useRef(null), useRef(null),
  ];
  const [stateIdx, setStateIdx] = useState(0);
  const [paths, setPaths] = useState<string[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const updateLines = () => {
    if (!panelRef.current) return;
    const pr = panelRef.current.getBoundingClientRect();
    if (pr.width === 0) return;
    const coords = nodeRefs.map((ref) => {
      if (!ref.current) return { x: 500, y: 500 };
      const r = ref.current.getBoundingClientRect();
      return { x: ((r.left + r.width / 2 - pr.left) * 1000) / pr.width, y: ((r.top + r.height / 2 - pr.top) * 1000) / pr.height };
    });
    const lines = [];
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const dx = coords[i].x - coords[j].x, dy = coords[i].y - coords[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < 600) {
          lines.push(`M ${coords[i].x} ${coords[i].y} L ${coords[j].x} ${coords[j].y}`);
        }
      }
    }
    setPaths(lines);
  };

  useEffect(() => { const t = setTimeout(updateLines, 100); return () => clearTimeout(t); }, []);
  useEffect(() => { const iv = setInterval(() => setStateIdx((p) => (p + 1) % 3), 4000); return () => clearInterval(iv); }, []);
  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    let start: number | null = null;
    const animate = (ts: number) => { if (!start) start = ts; updateLines(); if (ts - start < 1100) animFrameRef.current = requestAnimationFrame(animate); };
    const t = setTimeout(() => { animFrameRef.current = requestAnimationFrame(animate); }, 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateIdx]);
  useEffect(() => { const h = () => updateLines(); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const positions = nodePositions[stateIdx];

  return (
    <section ref={panelRef} style={{ background: "rgba(121,246,115,0.015)", position: "relative", overflow: "hidden", flex: 1 }}>
      {/* Grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(to right, rgba(121,246,115,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(121,246,115,0.04) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />

      {/* Lines */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }} viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="rgba(121,246,115,0.15)" strokeWidth="1" fill="none" strokeDasharray="8 6">
            <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="2s" repeatCount="indefinite" />
          </path>
        ))}
      </svg>

      {/* Nodes */}
      {nodeData.map((node, i) => (
        <div key={i} ref={nodeRefs[i]} style={{
          position: "absolute", zIndex: 2,
          border: `1px solid ${node.color}30`,
          background: `${node.color}0a`,
          backdropFilter: "blur(12px)",
          padding: "0.65rem 1rem",
          display: "flex", flexDirection: "column", gap: "0.15rem",
          transition: "top 1.2s cubic-bezier(0.4, 0, 0.2, 1), left 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          top: positions[i].top, left: positions[i].left,
        }}>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em", fontFamily: MONO, color: node.color }}>{node.label}</span>
          <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: "rgba(255,255,255,0.4)" }}>{node.meta}</span>
        </div>
      ))}

      {/* Subtle label */}
      <div style={{ position: "absolute", bottom: 20, right: 20, fontSize: "0.55rem", fontFamily: MONO, color: "rgba(255,255,255,0.1)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        live topology preview
      </div>
    </section>
  );
}

/* ── Main page ─────────────────────────────────────────────── */
export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfigResponse | null>(null);
  const { login, loginWithTokens } = useAuth();
  const router = useRouter();
  const [focused, setFocused] = useState("");

  useEffect(() => { api.get<AuthConfigResponse>("/api/v1/auth/config").then(setAuthConfig).catch(() => {}); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await api.post<LoginResponse>("/api/v1/auth/signup", { email, password, name, orgName: orgName || name + "'s Org" });
        await login({ email, password });
      } else {
        await login({ email, password });
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    try {
      const res = await api.get<GoogleAuthorizeResponse>("/api/v1/auth/google/authorize");
      sessionStorage.setItem("google_oauth_state", res.state);
      window.location.href = res.url;
    } catch { setError("Failed to initialize Google sign-in"); }
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%", padding: "0.85rem 1rem",
    border: `1px solid ${focused === field ? GREEN + "66" : BORDER}`,
    background: focused === field ? "rgba(121,246,115,0.03)" : "rgba(255,255,255,0.03)",
    fontFamily: MONO, fontSize: "0.85rem", outline: "none", color: "#fff",
    transition: "all 0.2s",
  });

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.6rem", textTransform: "uppercase",
    letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.4rem",
    color: "rgba(255,255,255,0.4)", fontFamily: MONO,
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#000", color: "#fff", fontFamily: FONT, overflow: "hidden" }}>

      {/* Grain overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, opacity: 0.12,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat", backgroundSize: "256px 256px", mixBlendMode: "screen",
      }} />

      {/* ── Form side ── */}
      <div style={{ width: 480, minWidth: 480, display: "flex", flexDirection: "column", borderRight: `1px solid ${BORDER}`, position: "relative", zIndex: 2 }}>
        {/* Nav */}
        <nav style={{ height: 48, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 2rem" }}>
          <a href="/landing" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", color: "#fff" }}>
            <img src="/logo.png" alt="" style={{ width: 20, height: 20, borderRadius: 3 }} />
            <span style={{ fontSize: "0.8rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>LABBED</span>
          </a>
        </nav>

        {/* Form */}
        <div style={{ flex: 1, padding: "3rem 2.5rem", display: "flex", flexDirection: "column", justifyContent: "center", overflowY: "auto" }}>
          <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: GREEN, marginBottom: "0.75rem", fontFamily: MONO }}>
            {mode === "login" ? "Welcome back" : "Get started"}
          </div>
          <h1 style={{ fontWeight: 200, fontSize: "2.5rem", letterSpacing: "-0.02em", marginBottom: "2rem", lineHeight: 1.1 }}>
            {mode === "login" ? "Sign in to\nyour console" : "Create your\naccount"}
          </h1>

          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <>
                <div style={{ marginBottom: "1.25rem" }}>
                  <span style={labelStyle}>Name</span>
                  <input type="text" placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)}
                    onFocus={() => setFocused("name")} onBlur={() => setFocused("")} style={inputStyle("name")} />
                </div>
                <div style={{ marginBottom: "1.25rem" }}>
                  <span style={labelStyle}>Organization</span>
                  <input type="text" placeholder="Team or org name" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                    onFocus={() => setFocused("org")} onBlur={() => setFocused("")} style={inputStyle("org")} />
                </div>
              </>
            )}

            <div style={{ marginBottom: "1.25rem" }}>
              <span style={labelStyle}>Email</span>
              <input type="email" placeholder="engineer@network.com" required value={email} onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")} onBlur={() => setFocused("")} style={inputStyle("email")} />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <span style={labelStyle}>Password</span>
              <input type="password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("pass")} onBlur={() => setFocused("")} style={inputStyle("pass")} />
            </div>

            {error && <p style={{ color: "#ff6b6b", fontSize: "0.75rem", marginBottom: "1rem", fontFamily: MONO }}>{error}</p>}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "0.85rem", border: "none",
              fontFamily: MONO, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.7rem",
              cursor: loading ? "wait" : "pointer",
              background: GREEN, color: "#000", opacity: loading ? 0.6 : 1,
              marginTop: "0.5rem", transition: "opacity 0.2s",
            }}>
              {loading ? "..." : mode === "login" ? "ACCESS CONSOLE \u2198" : "CREATE ACCOUNT \u2198"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0", gap: "0.75rem" }}>
            <span style={{ flex: 1, height: 1, background: BORDER }} />
            <span style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", fontFamily: MONO }}>or</span>
            <span style={{ flex: 1, height: 1, background: BORDER }} />
          </div>

          {/* Google */}
          <button type="button" onClick={authConfig?.enableGoogle ? handleGoogleAuth : undefined} style={{
            width: "100%", padding: "0.85rem",
            border: `1px solid ${BORDER}`, background: "transparent",
            fontFamily: MONO, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.7rem",
            cursor: authConfig?.enableGoogle ? "pointer" : "not-allowed",
            color: "#fff", opacity: authConfig?.enableGoogle ? 1 : 0.3,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.162-1.908 4.162-1.229 1.23-3.145 2.568-6.932 2.568-6.12 0-10.88-4.94-10.88-11.06s4.76-11.06 10.88-11.06c3.303 0 5.683 1.306 7.468 3.016l2.316-2.316c-2.022-1.936-4.707-3.392-9.784-3.392-8.843 0-16 7.157-16 16s7.157 16 16 16c4.76 0 8.358-1.573 11.235-4.573 2.973-2.973 3.903-7.143 3.903-10.518 0-.998-.078-1.957-.223-2.868h-14.915z" />
            </svg>
            GOOGLE SSO
          </button>

          {/* Toggle */}
          <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: "0.6rem", fontFamily: MONO, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>
              {mode === "login" ? "No account? " : "Have an account? "}
            </span>
            <span onClick={() => setMode(mode === "login" ? "signup" : "login")} style={{
              fontSize: "0.6rem", fontFamily: MONO, color: GREEN, cursor: "pointer", letterSpacing: "0.05em", fontWeight: 700,
            }}>
              {mode === "login" ? "CREATE ONE" : "SIGN IN"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Visual panel ── */}
      <VisualPanel />
    </div>
  );
}
