"use client";

import { useState, useEffect, useRef, type FormEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { AuthConfigResponse, LoginResponse, GoogleAuthorizeResponse } from "@/types/api";

type Mode = "login" | "signup";

/* ── Design tokens ─────────────────────────────────────────── */
const T = {
  bg: "#79f673",
  ink: "#000000",
  orange: "#000000",
  blue: "#000000",
  yellow: "#000000",
  pink: "#000000",
} as const;

/* ── Animated network nodes (right panel) ──────────────────── */
const nodePositions = [
  [
    { top: "30%", left: "30%" },
    { top: "60%", left: "50%" },
    { top: "35%", left: "70%" },
  ],
  [
    { top: "20%", left: "60%" },
    { top: "70%", left: "20%" },
    { top: "40%", left: "40%" },
  ],
  [
    { top: "50%", left: "20%" },
    { top: "20%", left: "45%" },
    { top: "70%", left: "75%" },
  ],
];

const nodeColors = ["rgba(0,0,0,0.7)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.85)"];

const nodeData = [
  { label: "CORE-SW-01", meta: "VLAN 10.10.1.1" },
  { label: "DIST-RTR-02", meta: "BGP AS 65002" },
  { label: "EDGE-FW-01", meta: "EXT-INT Gi0/1" },
];

function VisualPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const nodeRefs: RefObject<HTMLDivElement | null>[] = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];
  const [stateIdx, setStateIdx] = useState(0);
  const [paths, setPaths] = useState({ p12: "", p23: "", p31: "" });
  const [handPos, setHandPos] = useState({ left: "45%", top: "55%" });
  const animFrameRef = useRef<number | null>(null);

  const updateLines = () => {
    if (!panelRef.current) return;
    const parentRect = panelRef.current.getBoundingClientRect();
    if (parentRect.width === 0 || parentRect.height === 0) return;

    const coords = nodeRefs.map((ref) => {
      if (!ref.current) return { x: 500, y: 500 };
      const rect = ref.current.getBoundingClientRect();
      return {
        x:
          ((rect.left + rect.width / 2 - parentRect.left) * 1000) /
          parentRect.width,
        y:
          ((rect.top + rect.height / 2 - parentRect.top) * 1000) /
          parentRect.height,
      };
    });

    setPaths({
      p12: `M ${coords[0].x} ${coords[0].y} L ${coords[1].x} ${coords[1].y}`,
      p23: `M ${coords[1].x} ${coords[1].y} L ${coords[2].x} ${coords[2].y}`,
      p31: `M ${coords[2].x} ${coords[2].y} L ${coords[0].x} ${coords[0].y}`,
    });

    setHandPos({
      left: coords[1].x / 10 + 2 + "%",
      top: coords[1].y / 10 + 2 + "%",
    });
  };

  const startLineAnimation = () => {
    let start: number | null = null;
    const duration = 1100;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      updateLines();
      if (timestamp - start < duration) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const t = setTimeout(() => updateLines(), 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setStateIdx((p) => (p + 1) % 3), 4000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const t = setTimeout(() => startLineAnimation(), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateIdx]);

  useEffect(() => {
    const h = () => updateLines();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const positions = nodePositions[stateIdx];

  return (
    <section
      ref={panelRef}
      style={{
        background: "rgba(0,0,0,0.03)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
      }}
    >
      {/* Faint grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Dashed animated SVG lines */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <style>{`
          .ed2-path {
            stroke: #000000;
            stroke-width: 1.5;
            fill: none;
            stroke-dasharray: 6;
            animation: dash 30s linear infinite;
          }
        `}</style>
        <path className="ed2-path" d={paths.p12} />
        <path className="ed2-path" d={paths.p23} />
        <path className="ed2-path" d={paths.p31} />
      </svg>

      {/* Network nodes */}
      {nodeData.map((node, i) => (
        <div
          key={i}
          ref={nodeRefs[i]}
          style={{
            position: "absolute",
            border: `1px solid ${T.ink}`,
            background: nodeColors[i],
            padding: "0.75rem 1.25rem",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
            boxShadow: "6px 6px 0 rgba(0,0,0,0.1)",
            transition:
              "top 1s cubic-bezier(0.4, 0, 0.2, 1), left 1s cubic-bezier(0.4, 0, 0.2, 1)",
            top: positions[i].top,
            left: positions[i].left,
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              letterSpacing: "0.05em",
              fontFamily: "'Manrope', -apple-system, sans-serif",
              color: "#ffffff",
            }}
          >
            {node.label}
          </span>
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.65rem",
              opacity: 0.7,
              color: "#ffffff",
            }}
          >
            {node.meta}
          </span>
        </div>
      ))}

      {/* Floating orange hand cursor */}
      <svg
        viewBox="0 0 40 40"
        fill="none"
        style={{
          position: "absolute",
          width: 40,
          height: 40,
          zIndex: 10,
          pointerEvents: "none",
          left: handPos.left,
          top: handPos.top,
          animation: "float-hand 4s ease-in-out infinite",
        }}
      >
        <style>{`
          @keyframes float-hand {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(10px, 10px); }
          }
        `}</style>
        <path
          d="M12 20L20 8L28 20"
          fill={T.orange}
          stroke={T.ink}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <rect
          x="16"
          y="20"
          width="8"
          height="14"
          fill={T.orange}
          stroke={T.ink}
          strokeWidth="2"
        />
        <path
          d="M28 20C32 20 34 22 34 25C34 28 30 34 24 34H16"
          stroke={T.ink}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </section>
  );
}

/* ── Label style helper ────────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.65rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontWeight: 700,
  marginBottom: "0.5rem",
};

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

  /* Focus tracking for input bg change */
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [orgFocused, setOrgFocused] = useState(false);
  const [primaryHover, setPrimaryHover] = useState(false);
  const [googleHover, setGoogleHover] = useState(false);

  useEffect(() => {
    api
      .get<AuthConfigResponse>("/api/v1/auth/config")
      .then(setAuthConfig)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await api.post<LoginResponse>("/api/v1/auth/signup", {
          email,
          password,
          name,
          orgName: orgName || name + "'s Org",
        });
        await login({ email, password });
      } else {
        await login({ email, password });
      }
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Authentication failed"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    try {
      const res = await api.get<GoogleAuthorizeResponse>(
        "/api/v1/auth/google/authorize"
      );
      sessionStorage.setItem("google_oauth_state", res.state);
      window.location.href = res.url;
    } catch {
      setError("Failed to initialize Google sign-in");
    }
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "1rem",
    border: `1px solid ${T.ink}`,
    background: focused ? "rgba(0,0,0,0.05)" : "transparent",
    fontFamily: "'Space Mono', monospace",
    fontSize: "0.9rem",
    outline: "none",
    color: T.ink,
    transition: "background 0.2s",
    borderRadius: 0,
  });

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: T.bg,
        color: T.ink,
        fontFamily: "'Manrope', -apple-system, sans-serif",
        WebkitFontSmoothing: "antialiased",
        overflow: "hidden",
      }}
    >
      {/* ── 48px Sidebar ─────────────────────────────────── */}
      <aside
        style={{
          width: 48,
          borderRight: `1px solid ${T.ink}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "1rem 0",
          flexShrink: 0,
          backgroundColor: T.bg,
          zIndex: 10,
        }}
      >
        {/* Hamburger */}
        <div
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
          <span
            style={{
              display: "block",
              height: 1,
              backgroundColor: T.ink,
              width: "100%",
            }}
          />
          <span
            style={{
              display: "block",
              height: 1,
              backgroundColor: T.ink,
              width: "100%",
            }}
          />
          <span
            style={{
              display: "block",
              height: 1,
              backgroundColor: T.ink,
              width: "100%",
            }}
          />
        </div>

        {/* Vertical CLI / GUI / API */}
        <div
          style={{
            writingMode: "vertical-rl",
            transform: "scale(-1)",
            fontSize: "0.65rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            gap: "1rem",
            display: "flex",
          }}
        >
          <span style={{ opacity: 0.5 }}>CLI</span>
          <span style={{ opacity: 0.5 }}>GUI</span>
          <span style={{ opacity: 0.5 }}>API</span>
        </div>
      </aside>

      {/* ── Main container ───────────────────────────────── */}
      <main
        style={{
          flexGrow: 1,
          display: "grid",
          gridTemplateColumns: "500px 1fr",
        }}
      >
        {/* ── Form Panel ─────────────────────────────────── */}
        <section
          style={{
            borderRight: `1px solid ${T.ink}`,
            display: "flex",
            flexDirection: "column",
            backgroundColor: T.bg,
            zIndex: 2,
          }}
        >
          {/* Mini nav bar */}
          <nav
            style={{
              height: 48,
              borderBottom: `1px solid ${T.ink}`,
              display: "flex",
              alignItems: "center",
            }}
          >
            <a
              href="#"
              style={{
                padding: "0 1.5rem",
                display: "flex",
                alignItems: "center",
                height: "100%",
                borderRight: `1px solid ${T.ink}`,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 800,
                textDecoration: "none",
                color: T.ink,
              }}
            >
              LABBED
            </a>
          </nav>

          {/* Form content */}
          <div
            style={{
              flexGrow: 1,
              padding: "4rem 3rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              overflowY: "auto",
            }}
          >
            <h1
              style={{
                fontFamily: "'Manrope', -apple-system, sans-serif",
                fontWeight: 200,
                fontSize: "3.5rem",
                letterSpacing: "-0.02em",
                marginBottom: "2.5rem",
              }}
            >
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>

            <form onSubmit={handleSubmit}>
              {/* Signup-only fields */}
              {mode === "signup" && (
                <>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <span style={labelStyle}>Display Name</span>
                    <input
                      type="text"
                      placeholder="Your name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                      style={inputStyle(nameFocused)}
                    />
                  </div>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <span style={labelStyle}>Organization</span>
                    <input
                      type="text"
                      placeholder="Your team or org name"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      onFocus={() => setOrgFocused(true)}
                      onBlur={() => setOrgFocused(false)}
                      style={inputStyle(orgFocused)}
                    />
                  </div>
                </>
              )}

              {/* Email */}
              <div style={{ marginBottom: "1.5rem" }}>
                <span style={labelStyle}>Email Address</span>
                <input
                  type="email"
                  placeholder="engineer@network.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={inputStyle(emailFocused)}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: "1.5rem" }}>
                <span style={labelStyle}>Password</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  style={inputStyle(passwordFocused)}
                />
              </div>

              {/* Error */}
              {error && (
                <p
                  style={{
                    color: T.orange,
                    fontSize: "0.8rem",
                    marginBottom: "1rem",
                  }}
                >
                  {error}
                </p>
              )}

              {/* Primary submit button */}
              <button
                type="submit"
                disabled={loading}
                onMouseEnter={() => setPrimaryHover(true)}
                onMouseLeave={() => setPrimaryHover(false)}
                style={{
                  width: "100%",
                  padding: "1rem",
                  border: `1px solid ${T.ink}`,
                  fontFamily: "'Manrope', -apple-system, sans-serif",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontSize: "0.75rem",
                  cursor: loading ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  transition: "all 0.2s",
                  marginTop: "1rem",
                  background: primaryHover ? T.orange : T.ink,
                  color: primaryHover ? T.ink : T.bg,
                  opacity: loading ? 0.7 : 1,
                  borderRadius: 0,
                }}
              >
                {loading
                  ? mode === "login"
                    ? "Accessing..."
                    : "Creating..."
                  : mode === "login"
                  ? "Access Console \u2198"
                  : "Create Account \u2198"}
              </button>
            </form>

            {/* Divider + SSO */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                margin: "2rem 0",
                fontSize: "0.65rem",
                textTransform: "uppercase",
                fontWeight: 700,
                opacity: 0.5,
              }}
            >
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: T.ink,
                  opacity: 0.2,
                  marginRight: "1rem",
                }}
              />
              Or continue with
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: T.ink,
                  opacity: 0.2,
                  marginLeft: "1rem",
                }}
              />
            </div>

            {/* Google SSO button (always rendered visually, but only functional if enabled) */}
            <button
              type="button"
              onClick={authConfig?.enableGoogle ? handleGoogleAuth : undefined}
              onMouseEnter={() => setGoogleHover(true)}
              onMouseLeave={() => setGoogleHover(false)}
              style={{
                width: "100%",
                padding: "1rem",
                border: `1px solid ${T.ink}`,
                fontFamily: "'Manrope', -apple-system, sans-serif",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.75rem",
                cursor: authConfig?.enableGoogle ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "all 0.2s",
                background: googleHover ? "rgba(0,0,0,0.08)" : "transparent",
                color: T.ink,
                opacity: authConfig?.enableGoogle ? 1 : 0.4,
                borderRadius: 0,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.162-1.908 4.162-1.229 1.23-3.145 2.568-6.932 2.568-6.12 0-10.88-4.94-10.88-11.06s4.76-11.06 10.88-11.06c3.303 0 5.683 1.306 7.468 3.016l2.316-2.316c-2.022-1.936-4.707-3.392-9.784-3.392-8.843 0-16 7.157-16 16s7.157 16 16 16c4.76 0 8.358-1.573 11.235-4.573 2.973-2.973 3.903-7.143 3.903-10.518 0-.998-.078-1.957-.223-2.868h-14.915z" />
              </svg>
              Google SSO
            </button>

            {/* Footer: toggle login/signup */}
            <div
              style={{
                marginTop: "3rem",
                paddingTop: "2rem",
                borderTop: `1px solid ${T.ink}`,
                opacity: 0.8,
              }}
            >
              <p
                style={{
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontWeight: 700,
                  opacity: 0.5,
                }}
              >
                {mode === "login"
                  ? "New to the engine?"
                  : "Already have an account?"}
              </p>
              <p style={{ marginTop: "0.5rem", fontWeight: 700 }}>
                {mode === "login" ? "Start for free \u2014 " : "Sign in \u2014 "}
                <span
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  style={{
                    textDecoration: "underline",
                    cursor: "pointer",
                    color: T.orange,
                  }}
                >
                  {mode === "login" ? "Create Account" : "Back to Login"}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* ── Visual Panel (right) ───────────────────────── */}
        <VisualPanel />
      </main>
    </div>
  );
}
