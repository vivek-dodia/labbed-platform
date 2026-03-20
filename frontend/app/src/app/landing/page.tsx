"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const FONT = "'Manrope', -apple-system, sans-serif";
const MONO = "'Space Mono', monospace";
const GREEN = "#79f673";

/* Terminal lines that type out */
const terminalLines = [
  { prompt: "labbed", cmd: "deploy --template vpc-peering", delay: 0 },
  { prompt: "", cmd: "  Deploying 2 VPCs + peering connection...", delay: 800, isOutput: true },
  { prompt: "", cmd: "  Terraform apply: 9 resources created", delay: 1600, isOutput: true },
  { prompt: "", cmd: "  Lab running \u2714", delay: 2400, isOutput: true, isGreen: true },
  { prompt: "labbed", cmd: "exec r1 -- vtysh -c 'show ip route'", delay: 3500 },
  { prompt: "", cmd: "  S>* 10.1.0.0/16 via 10.0.1.1, eth1", delay: 4300, isOutput: true },
];

/* Feature cards */
const features = [
  { tag: "01", title: "Network Labs", desc: "Deploy containerlab topologies with FRR, MikroTik, OpenWrt, FreeBSD. Shell access, packet capture, config diff.", badge: "NETWORK" },
  { tag: "02", title: "Cloud Labs", desc: "Emulate AWS networking with Terraform + Moto. VPCs, subnets, security groups, peering. Full AWS CLI.", badge: "CLOUD" },
  { tag: "03", title: "Real-Time", desc: "Live topology visualization, WebSocket deployment logs, interactive terminal, bulk commands across all nodes.", badge: "LIVE" },
  { tag: "04", title: "Multi-Tenant", desc: "Organizations, RBAC, collections. Auto-pause on inactivity. Zero wasted compute.", badge: "RBAC" },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [visible, setVisible] = useState(false);
  const [typedLines, setTypedLines] = useState(0);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Terminal typing effect
  useEffect(() => {
    if (!visible) return;
    const timers = terminalLines.map((line, i) =>
      setTimeout(() => setTypedLines(i + 1), line.delay + 1000)
    );
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  if (loading || user) return null;

  return (
    <div style={{ fontFamily: FONT, color: "#fff", background: "#000" }}>
      {/* ── Hero section ── */}
      <section style={{ position: "relative", height: "100vh", overflow: "hidden", display: "flex" }}>

        {/* Signature 48px sidebar */}
        <aside style={{
          width: 48, minWidth: 48,
          borderRight: "1px solid rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "1rem 0", zIndex: 20, background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(20px)",
        }}>
          <div style={{ width: 20, height: 16, display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: "2rem" }}>
            <span style={{ display: "block", height: 1, backgroundColor: "rgba(255,255,255,0.3)", width: "100%" }} />
            <span style={{ display: "block", height: 1, backgroundColor: "rgba(255,255,255,0.3)", width: "100%" }} />
            <span style={{ display: "block", height: 1, backgroundColor: "rgba(255,255,255,0.3)", width: "100%" }} />
          </div>
          <div style={{
            writingMode: "vertical-rl", transform: "scale(-1)",
            fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase",
            gap: "0.8rem", display: "flex", marginTop: "auto", marginBottom: "2rem",
            color: "rgba(255,255,255,0.2)",
          }}>
            <span>CLI</span>
            <span>GUI</span>
            <span>API</span>
          </div>
        </aside>

        {/* Video background */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <video
            ref={videoRef}
            autoPlay muted loop playsInline
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              opacity: 0.5,
              transform: `scale(${1 + scrollY * 0.0003})`,
              transition: "transform 0.1s linear",
            }}
          >
            <source src="/landing-bg.mp4" type="video/mp4" />
          </video>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.6) 80%, #000 100%)",
          }} />
        </div>

        {/* Main hero area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 10 }}>

          {/* Top nav */}
          <nav style={{
            height: 48, display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "0 2rem",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(0,0,0,0.3)", backdropFilter: "blur(20px)",
            opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(-10px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", paddingRight: "1.5rem", borderRight: "1px solid rgba(255,255,255,0.08)" }}>LABBED</span>
              <span style={{ padding: "0 1.5rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.4 }}>Platform</span>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <Link href="/login" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.03em" }}>Log In</Link>
              <Link href="/login" style={{
                background: GREEN, color: "#000", textDecoration: "none",
                fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                padding: "0.45rem 1.2rem", borderRadius: 99,
              }}>Get Started</Link>
            </div>
          </nav>

          {/* Hero content */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3rem" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", maxWidth: 1100, width: "100%", alignItems: "center",
              opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(30px)",
              transition: "opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s",
            }}>
              {/* Left: text */}
              <div>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
                  <span style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 99, background: "rgba(121,246,115,0.15)", color: GREEN }}>Network</span>
                  <span style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 99, background: "rgba(56,189,248,0.15)", color: "#38bdf8" }}>Cloud</span>
                </div>
                <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)", fontWeight: 200, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 1.2rem" }}>
                  Build labs.<br /><span style={{ fontWeight: 600 }}>Break things.</span>
                </h1>
                <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "rgba(255,255,255,0.5)", maxWidth: 420, margin: "0 0 2rem" }}>
                  Deploy containerlab network topologies and emulated AWS cloud environments. Interactive terminals, live visualization, zero config.
                </p>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <Link href="/login" style={{
                    background: GREEN, color: "#000", textDecoration: "none",
                    fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                    padding: "0.75rem 2rem", borderRadius: 99,
                  }}>Start Building</Link>
                  <a href="#features" style={{
                    background: "transparent", color: "#fff", textDecoration: "none",
                    fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
                    padding: "0.75rem 2rem", borderRadius: 99,
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}>Learn More</a>
                </div>
              </div>

              {/* Right: mock terminal */}
              <div style={{
                background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, overflow: "hidden", backdropFilter: "blur(20px)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 1s ease 0.5s, transform 1s ease 0.5s",
              }}>
                {/* Terminal title bar */}
                <div style={{
                  padding: "0.6rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
                  </div>
                  <span style={{ fontSize: "0.6rem", fontFamily: MONO, color: "rgba(255,255,255,0.25)" }}>labbed-terminal</span>
                </div>
                {/* Terminal content */}
                <div style={{ padding: "1rem 1.2rem", fontFamily: MONO, fontSize: "0.75rem", lineHeight: 1.8, minHeight: 200 }}>
                  {terminalLines.slice(0, typedLines).map((line, i) => (
                    <div key={i}>
                      {line.prompt ? (
                        <>
                          <span style={{ color: GREEN, opacity: 0.6 }}>{line.prompt}</span>
                          <span style={{ color: "rgba(255,255,255,0.3)" }}> $ </span>
                          <span style={{ color: "#fff" }}>{line.cmd}</span>
                        </>
                      ) : (
                        <span style={{ color: line.isGreen ? GREEN : "rgba(255,255,255,0.5)" }}>{line.cmd}</span>
                      )}
                    </div>
                  ))}
                  {typedLines < terminalLines.length && (
                    <span style={{ display: "inline-block", width: 8, height: 14, background: GREEN, opacity: 0.6, animation: "blink 1s step-end infinite", verticalAlign: "text-bottom" }} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div style={{
            position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)",
            opacity: visible ? 0.3 : 0, transition: "opacity 1.5s ease 1.5s",
            animation: "bounce 2s infinite",
          }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5}>
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Features section ── */}
      <section id="features" style={{ background: "#000", padding: "8rem 3rem", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GREEN, marginBottom: "1rem" }}>
          Capabilities
        </div>
        <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 200, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: "4rem", maxWidth: 450 }}>
          Everything you need to lab.
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 1 }}>
          {features.map((f) => (
            <div key={f.tag} style={{
              background: "rgba(255,255,255,0.02)", padding: "2.5rem 2rem", borderRadius: 2,
              borderLeft: `2px solid ${GREEN}22`,
              transition: "background 0.3s, border-color 0.3s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.1em", color: GREEN, fontFamily: MONO }}>{f.tag}</span>
                <span style={{
                  fontSize: "0.5rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                  padding: "2px 8px", borderRadius: 3, background: "rgba(121,246,115,0.1)", color: GREEN,
                }}>{f.badge}</span>
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 0.5rem", letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: "0.8rem", lineHeight: 1.6, color: "rgba(255,255,255,0.4)", margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Supported platforms ── */}
      <section style={{ background: "#000", padding: "3rem 3rem 6rem", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap", opacity: 0.25 }}>
          {["FRRouting", "MikroTik", "OpenWrt", "FreeBSD", "AWS (Moto)", "Terraform"].map((name) => (
            <span key={name} style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: MONO }}>{name}</span>
          ))}
        </div>
      </section>

      {/* ── CTA footer (green) ── */}
      <section style={{ background: GREEN, color: "#000", padding: "5rem 3rem", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", fontWeight: 200, lineHeight: 1.15, marginBottom: "1rem" }}>
          Ready to lab?
        </h2>
        <p style={{ fontSize: "0.9rem", color: "rgba(0,0,0,0.5)", maxWidth: 380, margin: "0 auto 2rem" }}>
          Deploy your first network or cloud lab in under a minute.
        </p>
        <Link href="/login" style={{
          background: "#000", color: GREEN, textDecoration: "none",
          fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
          padding: "0.75rem 2rem", borderRadius: 99, display: "inline-block",
        }}>Get Started</Link>
        <div style={{ marginTop: "3rem", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.25 }}>LABBED</div>
        <div style={{ marginTop: "1.5rem", fontSize: "0.6rem", color: "rgba(0,0,0,0.3)", lineHeight: 1.6 }}>
          AWS is a trademark of Amazon.com, Inc. Containerlab is a project by SRL Labs.
        </div>
      </section>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
