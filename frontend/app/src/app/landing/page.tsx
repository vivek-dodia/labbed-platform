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
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingRight: "1.5rem", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
                <img src="/logo.png" alt="LABBED" style={{ width: 22, height: 22, borderRadius: 4 }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>LABBED</span>
              </div>
              <span style={{ padding: "0 1.5rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.4 }}>Platform</span>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <Link href="/login" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: MONO }}>Log In</Link>
              <Link href="/login" style={{
                background: GREEN, color: "#000", textDecoration: "none",
                fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "0.5rem 1.2rem", fontFamily: MONO,
              }}>GET STARTED &darr;</Link>
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
                  <span style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 8px", border: `1px solid ${GREEN}44`, color: GREEN, fontFamily: MONO }}>Network</span>
                  <span style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 8px", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8", fontFamily: MONO }}>Cloud</span>
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
                    fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    padding: "0.8rem 2rem", fontFamily: MONO,
                  }}>START BUILDING &darr;</Link>
                  <a href="#features" style={{
                    background: "transparent", color: "#fff", textDecoration: "none",
                    fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    padding: "0.8rem 2rem", fontFamily: MONO,
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}>LEARN MORE</a>
                </div>
              </div>

              {/* Right: mock terminal */}
              <div style={{
                background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 0, overflow: "hidden", backdropFilter: "blur(20px)",
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
        <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 200, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: "4rem", whiteSpace: "nowrap" }}>
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
              <p style={{ fontSize: "0.8rem", lineHeight: 1.6, color: "rgba(255,255,255,0.55)", margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ background: "#000", padding: "6rem 3rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GREEN, marginBottom: "1rem" }}>
            How It Works
          </div>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 200, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: "4rem" }}>
            Three steps. Real infrastructure.
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem" }}>
            {[
              { num: "01", title: "Pick a template", desc: "Choose from ready-made network or cloud topologies. OSPF mesh, VPC peering, campus network \u2014 or write your own YAML/HCL.", icon: "\u25A1" },
              { num: "02", title: "Deploy", desc: "One click. Containerlab spins up real router containers, or Terraform provisions emulated AWS resources via Moto. Running in seconds.", icon: "\u25B7" },
              { num: "03", title: "Interact", desc: "Shell into any node. Run show commands. Capture packets on any link. Query the AWS CLI. See how traffic actually flows.", icon: "\u25C7" },
            ].map((step) => (
              <div key={step.num} style={{ position: "relative" }}>
                <div style={{ fontSize: "3rem", fontWeight: 200, color: GREEN, opacity: 0.15, fontFamily: MONO, lineHeight: 1 }}>{step.num}</div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0.75rem 0 0.5rem" }}>{step.title}</h3>
                <p style={{ fontSize: "0.8rem", lineHeight: 1.7, color: "rgba(255,255,255,0.55)", margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ready-made templates ── */}
      <section style={{ background: "#000", padding: "6rem 3rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GREEN, marginBottom: "1rem" }}>
            Templates
          </div>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 200, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: "1rem" }}>
            Ready-made. Or roll your own.
          </h2>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "rgba(255,255,255,0.55)", maxWidth: 600, marginBottom: "3rem" }}>
            Start from curated templates across routing, switching, security, services, and cloud networking. Or write your own in declarative YAML (network) or Terraform HCL (cloud) and deploy in minutes.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
            {[
              { collection: "Routing", templates: ["eBGP Multi-AS Peering", "OSPF Multi-Area", "Full Mesh iBGP + RR", "Static + Connected Routes"], color: GREEN },
              { collection: "Cloud Networking", templates: ["VPC Basics", "Public/Private Subnets", "Security Groups", "VPC Peering", "Multi-AZ VPC"], color: "#38bdf8" },
              { collection: "Campus & Services", templates: ["Campus L2/L3 Design", "Firewall Zones", "DNS + DHCP Stack", "Load Balanced Web Tier"], color: "#f59e0b" },
            ].map((col) => (
              <div key={col.collection} style={{
                background: "rgba(255,255,255,0.015)", padding: "1.5rem",
                borderTop: `2px solid ${col.color}33`,
              }}>
                <span style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: col.color, fontFamily: MONO }}>{col.collection}</span>
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {col.templates.map((t) => (
                    <div key={t} style={{
                      fontSize: "0.8rem", color: "rgba(255,255,255,0.7)",
                      padding: "0.4rem 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      display: "flex", alignItems: "center", gap: "0.5rem",
                    }}>
                      <span style={{ color: col.color, fontSize: "0.6rem", fontFamily: MONO }}>&gt;</span>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "2rem", display: "flex", gap: "2rem", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", fontWeight: 200, color: GREEN, fontFamily: MONO }}>YAML</div>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "0.3rem" }}>Network topologies</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", fontWeight: 200, color: "#38bdf8", fontFamily: MONO }}>HCL</div>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "0.3rem" }}>Cloud infrastructure</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", fontWeight: 200, color: "#f59e0b", fontFamily: MONO }}>&lt;60s</div>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "0.3rem" }}>Deploy time</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What can you lab? ── */}
      <section style={{ background: "#000", padding: "6rem 3rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GREEN, marginBottom: "1rem" }}>
            What Can You Lab?
          </div>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 200, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: "1rem" }}>
            Deploy it. Break it. Understand it.
          </h2>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "rgba(255,255,255,0.55)", maxWidth: 600, marginBottom: "3.5rem" }}>
            Stop reading docs and start building. Deploy real topologies in minutes, trace packets across every hop, and understand how networks actually work \u2014 down to the wire.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 1 }}>
            {[
              { label: "ROUTING", title: "OSPF & IS-IS Mesh", desc: "Full adjacency formation, SPF calculation, link-state flooding. Watch convergence happen in real time across FRR routers." },
              { label: "ROUTING", title: "eBGP Multi-AS Peering", desc: "Internet-scale BGP with multiple autonomous systems, route policies, communities, and path selection you can actually trace." },
              { label: "ROUTING", title: "MPLS & L3VPN", desc: "Label switching, VRFs, PE-CE routing. Build a service provider core and see how labels get pushed, swapped, and popped." },
              { label: "CAMPUS", title: "Campus Network Design", desc: "Access, distribution, core tiers with VLANs, STP, DHCP relay, and inter-VLAN routing. Full enterprise stack." },
              { label: "CLOUD", title: "VPC Peering & Transit", desc: "Multi-VPC architectures with peering connections, route tables, and cross-VPC reachability. Terraform + AWS CLI." },
              { label: "CLOUD", title: "Public & Private Subnets", desc: "IGW, NAT gateway, route table associations. Understand how public vs private networking actually works in AWS." },
              { label: "CLOUD", title: "Security Groups & NACLs", desc: "Layered security with web, app, and database tiers. Test ingress rules, see what gets blocked and why." },
              { label: "HYBRID", title: "Cloud + On-Prem Hybrid", desc: "Connect containerlab routers to emulated AWS VPCs. BGP over tunnel overlays, Direct Connect simulation, route leaking." },
              { label: "SECURITY", title: "Firewall & ACL Labs", desc: "Zone-based policies, stateful inspection, NAT. Deploy OpenWrt or FreeBSD firewalls and test traffic flows with tcpdump." },
              { label: "SERVICES", title: "DNS, DHCP & Load Balancing", desc: "CoreDNS resolvers, Kea DHCP servers, Nginx load balancers. Full service stack with real traffic." },
            ].map((item, i) => (
              <div key={i} style={{
                padding: "1.5rem 1.5rem",
                background: "rgba(255,255,255,0.015)",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{
                  fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                  padding: "2px 6px", fontFamily: MONO,
                  color: item.label === "CLOUD" ? "#38bdf8" : item.label === "HYBRID" ? "#f59e0b" : GREEN,
                  border: `1px solid ${item.label === "CLOUD" ? "rgba(56,189,248,0.2)" : item.label === "HYBRID" ? "rgba(245,158,11,0.2)" : GREEN + "33"}`,
                }}>{item.label}</span>
                <h4 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0.6rem 0 0.3rem" }}>{item.title}</h4>
                <p style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "rgba(255,255,255,0.5)", margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "3rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)", marginBottom: "1.5rem" }}>
              Every lab comes with interactive shell access, packet capture on any link, and live deployment logs.
            </p>
            <Link href="/login" style={{
              background: GREEN, color: "#000", textDecoration: "none",
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              padding: "0.8rem 2rem", fontFamily: MONO, display: "inline-block",
            }}>START YOUR FIRST LAB &darr;</Link>
          </div>
        </div>
      </section>

      {/* ── Comparison ── */}
      <section style={{ background: "#000", padding: "6rem 3rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GREEN, marginBottom: "1rem" }}>
            Why Labbed?
          </div>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 200, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: "3.5rem" }}>
            Skip the setup. Start learning.
          </h2>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", fontFamily: MONO }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${GREEN}33` }}>
                  {["", "LABBED", "Hardware Lab", "GNS3 / EVE-NG", "Cisco CML", "Containerlab (DIY)"].map((h, i) => (
                    <th key={i} style={{
                      padding: "0.8rem 1rem", textAlign: i === 0 ? "left" : "center",
                      fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                      color: i === 1 ? GREEN : "rgba(255,255,255,0.5)",
                      background: i === 1 ? "rgba(121,246,115,0.05)" : "transparent",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Setup time", vals: ["< 1 min", "Days/weeks", "1\u20132 hours", "1\u20132 hours", "30\u201360 min"] },
                  { feature: "Local install required", vals: ["\u2714 None", "Physical gear", "Desktop app", "Server VM", "Docker + CLI"] },
                  { feature: "Browser-based UI", vals: ["\u2714 Yes", "\u2718 No", "Web UI (limited)", "Web UI", "\u2718 No"] },
                  { feature: "Cloud lab support", vals: ["\u2714 AWS (Moto)", "\u2718 No", "\u2718 No", "\u2718 No", "\u2718 No"] },
                  { feature: "Interactive shell", vals: ["\u2714 In-browser", "SSH only", "Telnet/SSH", "SSH", "Docker exec"] },
                  { feature: "Packet capture", vals: ["\u2714 Click any link", "Port mirror", "Wireshark setup", "Built-in", "tcpdump (manual)"] },
                  { feature: "Auto-cleanup", vals: ["\u2714 On logout", "Manual", "Manual", "Manual", "Manual"] },
                  { feature: "Multi-tenant / RBAC", vals: ["\u2714 Built-in", "\u2718 No", "\u2718 No", "Basic", "\u2718 No"] },
                  { feature: "Cost", vals: ["Free tier", "$$$$ hardware", "Free / paid", "$$ license", "Free (your infra)"] },
                  { feature: "Real NOS images", vals: ["\u2714 FRR, MikroTik+", "\u2714 Real gear", "Emulated", "\u2714 Cisco IOS", "\u2714 Any container"] },
                ].map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "0.6rem 1rem", color: "rgba(255,255,255,0.6)", fontFamily: FONT, fontWeight: 600, fontSize: "0.7rem" }}>{row.feature}</td>
                    {row.vals.map((v, vi) => (
                      <td key={vi} style={{
                        padding: "0.6rem 1rem", textAlign: "center",
                        color: vi === 0 ? GREEN : "rgba(255,255,255,0.45)",
                        background: vi === 0 ? "rgba(121,246,115,0.03)" : "transparent",
                        fontWeight: vi === 0 ? 700 : 400,
                      }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Supported platforms ── */}
      <section style={{ background: "#000", padding: "3rem 3rem 6rem", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap", opacity: 0.25 }}>
          {["FRRouting", "MikroTik", "OpenWrt", "FreeBSD", "GoBGP", "Kea DHCP", "CoreDNS", "Nginx", "AWS (Moto)", "Terraform"].map((name) => (
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
          fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          padding: "0.8rem 2rem", display: "inline-block", fontFamily: MONO,
        }}>GET STARTED &darr;</Link>
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
