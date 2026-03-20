"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const FONT = "'Manrope', -apple-system, sans-serif";
const MONO = "'Space Mono', monospace";

/* Feature cards */
const features = [
  { tag: "01", title: "Network Labs", desc: "Deploy containerlab topologies with FRR, MikroTik, OpenWrt, FreeBSD. Shell access, packet capture, config diff." },
  { tag: "02", title: "Cloud Labs", desc: "Emulate AWS networking with Terraform + Moto. VPCs, subnets, security groups, peering. Full AWS CLI." },
  { tag: "03", title: "Real-Time", desc: "Live topology visualization, WebSocket deployment logs, interactive terminal, bulk commands across all nodes." },
  { tag: "04", title: "Multi-Tenant", desc: "Organizations, RBAC, collections. Auto-pause on inactivity. Zero wasted compute." },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
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

  if (loading) return null;
  if (user) return null;

  return (
    <div style={{ fontFamily: FONT, color: "#fff", background: "#000" }}>
      {/* ── Hero section ── */}
      <section style={{
        position: "relative",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {/* Video background */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.6,
            transform: `scale(${1 + scrollY * 0.0003})`,
            transition: "transform 0.1s linear",
          }}
        >
          <source src="/landing-bg.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.5) 80%, rgba(0,0,0,0.95) 100%)",
          pointerEvents: "none",
        }} />

        {/* Nav bar */}
        <nav style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1.5rem 3rem",
          zIndex: 10,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-20px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}>
          <span style={{
            fontSize: "1.1rem",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>
            LABBED
          </span>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <Link href="/login" style={{
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.03em",
              transition: "color 0.2s",
            }}>
              Log In
            </Link>
            <Link href="/login" style={{
              background: "#79f673",
              color: "#000",
              textDecoration: "none",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              padding: "0.6rem 1.5rem",
              borderRadius: "99px",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}>
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div style={{
          position: "relative",
          zIndex: 5,
          textAlign: "center",
          maxWidth: 800,
          padding: "0 2rem",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(40px)",
          transition: "opacity 1s ease 0.3s, transform 1s ease 0.3s",
        }}>
          <div style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#79f673",
            marginBottom: "1.5rem",
          }}>
            Network & Cloud Lab Platform
          </div>

          <h1 style={{
            fontSize: "clamp(2.5rem, 7vw, 5rem)",
            fontWeight: 200,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            margin: "0 0 1.5rem",
          }}>
            Build labs.
            <br />
            <span style={{ fontWeight: 600 }}>Break things.</span>
          </h1>

          <p style={{
            fontSize: "clamp(1rem, 2vw, 1.2rem)",
            fontWeight: 400,
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.6)",
            maxWidth: 550,
            margin: "0 auto 2.5rem",
          }}>
            Deploy containerlab network topologies and emulated AWS cloud environments.
            Interactive terminals, live visualization, zero config.
          </p>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/login" style={{
              background: "#79f673",
              color: "#000",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              padding: "0.85rem 2.5rem",
              borderRadius: "99px",
              transition: "transform 0.2s",
            }}>
              Start Building
            </Link>
            <a href="#features" style={{
              background: "transparent",
              color: "#fff",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              padding: "0.85rem 2.5rem",
              borderRadius: "99px",
              border: "1px solid rgba(255,255,255,0.25)",
              transition: "border-color 0.2s",
            }}>
              Learn More
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: "absolute",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 5,
          opacity: visible ? 0.4 : 0,
          transition: "opacity 1.5s ease 1s",
          animation: "bounce 2s infinite",
        }}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5}>
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      {/* ── Features section ── */}
      <section id="features" style={{
        background: "#000",
        padding: "8rem 3rem",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        <div style={{
          fontSize: "0.6rem",
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#79f673",
          marginBottom: "1rem",
        }}>
          Capabilities
        </div>
        <h2 style={{
          fontSize: "clamp(1.8rem, 4vw, 3rem)",
          fontWeight: 200,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          marginBottom: "4rem",
          maxWidth: 500,
        }}>
          Everything you need to lab.
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "2px",
        }}>
          {features.map((f) => (
            <div key={f.tag} style={{
              background: "rgba(255,255,255,0.03)",
              padding: "2.5rem 2rem",
              borderRadius: 2,
              transition: "background 0.3s",
            }}>
              <span style={{
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "#79f673",
                fontFamily: MONO,
              }}>
                {f.tag}
              </span>
              <h3 style={{
                fontSize: "1.2rem",
                fontWeight: 600,
                margin: "0.75rem 0 0.5rem",
                letterSpacing: "-0.01em",
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize: "0.85rem",
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.45)",
                margin: 0,
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Supported platforms ── */}
      <section style={{
        background: "#000",
        padding: "4rem 3rem 8rem",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "3rem",
          flexWrap: "wrap",
          opacity: 0.3,
        }}>
          {["FRRouting", "MikroTik", "OpenWrt", "FreeBSD", "AWS (Moto)", "Terraform"].map((name) => (
            <span key={name} style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: MONO,
            }}>
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ── CTA footer ── */}
      <section style={{
        background: "#79f673",
        color: "#000",
        padding: "6rem 3rem",
        textAlign: "center",
      }}>
        <h2 style={{
          fontSize: "clamp(1.8rem, 4vw, 3rem)",
          fontWeight: 200,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          marginBottom: "1.5rem",
        }}>
          Ready to lab?
        </h2>
        <p style={{
          fontSize: "1rem",
          color: "rgba(0,0,0,0.5)",
          marginBottom: "2rem",
          maxWidth: 400,
          margin: "0 auto 2rem",
        }}>
          Deploy your first network or cloud lab in under a minute.
        </p>
        <Link href="/login" style={{
          background: "#000",
          color: "#79f673",
          textDecoration: "none",
          fontSize: "0.8rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          padding: "0.85rem 2.5rem",
          borderRadius: "99px",
          display: "inline-block",
        }}>
          Get Started
        </Link>

        <div style={{
          marginTop: "4rem",
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          opacity: 0.3,
        }}>
          LABBED
        </div>
      </section>

      {/* Bounce animation */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
      `}</style>
    </div>
  );
}
