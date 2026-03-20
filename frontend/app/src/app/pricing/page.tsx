"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const FONT = "'Manrope', -apple-system, sans-serif";
const MONO = "'Space Mono', monospace";
const GREEN = "#79f673";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Learn the fundamentals",
    color: GREEN,
    features: [
      "1 concurrent lab",
      "Lightweight NOS (FRR, Host)",
      "10 cloud resources per lab",
      "In-browser shell access",
      "Packet capture",
      "5 min inactivity timeout",
      "Community support",
    ],
    cta: "GET STARTED",
    href: "/login",
    highlight: false,
  },
  {
    name: "Light",
    price: "$19",
    period: "/month",
    description: "Production NOS for cert prep",
    color: "#38bdf8",
    features: [
      "3 concurrent labs",
      "All Free NOS +",
      "MikroTik RouterOS",
      "OpenWrt, FreeBSD",
      "30 cloud resources per lab",
      "15 min inactivity timeout",
      "Priority support",
      "Custom templates",
    ],
    cta: "COMING SOON",
    href: "#",
    highlight: true,
  },
  {
    name: "Heavy",
    price: "$49",
    period: "/month",
    description: "Enterprise vendor images",
    color: "#f59e0b",
    features: [
      "10 concurrent labs",
      "All Light NOS +",
      "Nokia SRL",
      "Cumulus, Juniper (future)",
      "Unlimited cloud resources",
      "30 min inactivity timeout",
      "Dedicated support",
      "API access",
    ],
    cta: "COMING SOON",
    href: "#",
    highlight: false,
  },
];

export default function PricingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <div style={{ fontFamily: FONT, color: "#fff", background: "#000", minHeight: "100vh" }}>

      {/* Grain */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, opacity: 0.12,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat", backgroundSize: "256px 256px", mixBlendMode: "screen",
      }} />

      {/* Nav */}
      <nav style={{
        height: 48, display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 2rem", borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Link href="/landing" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", color: "#fff" }}>
            <img src="/logo.png" alt="" style={{ width: 20, height: 20, borderRadius: 3 }} />
            <span style={{ fontSize: "0.85rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>LABBED</span>
          </Link>
          <span style={{ padding: "0 1rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.4 }}>Pricing</span>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {user ? (
            <Link href="/" style={{ color: GREEN, textDecoration: "none", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: MONO }}>Dashboard</Link>
          ) : (
            <>
              <Link href="/login" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: MONO }}>Log In</Link>
              <Link href="/login" style={{ background: GREEN, color: "#000", textDecoration: "none", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.5rem 1.2rem", fontFamily: MONO }}>GET STARTED</Link>
            </>
          )}
        </div>
      </nav>

      {/* Header */}
      <div style={{
        padding: "5rem 3rem 2rem", textAlign: "center", maxWidth: 700, margin: "0 auto",
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}>
        <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: GREEN, marginBottom: "1rem", fontFamily: MONO }}>
          Pricing
        </div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 200, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
          Start free. Scale when ready.
        </h1>
        <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
          Every plan includes full access to the lab platform, in-browser terminals, packet capture, and AWS cloud networking.
        </p>
      </div>

      {/* Plans grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1,
        maxWidth: 1000, margin: "3rem auto", padding: "0 2rem",
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s",
      }}>
        {plans.map((p) => (
          <div key={p.name} style={{
            background: p.highlight ? "rgba(255,255,255,0.03)" : "transparent",
            border: `1px solid ${p.highlight ? p.color + "44" : "rgba(255,255,255,0.06)"}`,
            padding: "2.5rem 2rem",
            position: "relative",
          }}>
            {p.highlight && (
              <div style={{
                position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
                background: p.color, color: "#000", fontSize: "0.5rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 12px",
                fontFamily: MONO,
              }}>POPULAR</div>
            )}

            <span style={{
              fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              color: p.color, fontFamily: MONO,
            }}>{p.name}</span>

            <div style={{ margin: "1rem 0 0.5rem", display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
              <span style={{ fontSize: "2.5rem", fontWeight: 200, letterSpacing: "-0.02em" }}>{p.price}</span>
              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{p.period}</span>
            </div>

            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginBottom: "1.5rem" }}>{p.description}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "2rem" }}>
              {p.features.map((f) => (
                <div key={f} style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: p.color, fontSize: "0.55rem", fontFamily: MONO }}>+</span>
                  {f}
                </div>
              ))}
            </div>

            <Link href={p.href} style={{
              display: "block", textAlign: "center", padding: "0.75rem",
              background: p.name === "Free" ? GREEN : "transparent",
              color: p.name === "Free" ? "#000" : p.color,
              border: p.name === "Free" ? "none" : `1px solid ${p.color}44`,
              textDecoration: "none",
              fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              fontFamily: MONO,
              opacity: p.href === "#" ? 0.5 : 1,
              cursor: p.href === "#" ? "default" : "pointer",
            }}>{p.cta}</Link>
          </div>
        ))}
      </div>

      {/* FAQ-ish notes */}
      <div style={{ maxWidth: 700, margin: "4rem auto", padding: "0 2rem 6rem" }}>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "2rem" }}>
          {[
            { q: "What NOS images are included?", a: "Free includes FRRouting and the Labbed Host (Alpine nettools). Light adds MikroTik RouterOS, OpenWrt, and FreeBSD. Heavy adds enterprise vendor images as they become available." },
            { q: "What counts as a cloud resource?", a: "Each Terraform resource (VPC, subnet, IGW, route table, security group, etc.) counts as one cloud resource. These run inside Moto and use minimal compute." },
            { q: "What happens when I hit the lab limit?", a: "You'll need to stop a running lab before deploying a new one. Or upgrade your plan for more concurrent labs." },
            { q: "Do labs auto-pause?", a: "Yes. Labs automatically stop after a period of inactivity (5/15/30 min depending on plan). They also pause when you log out or close the browser tab." },
          ].map((item) => (
            <div key={item.q} style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>{item.q}</div>
              <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "2rem", textAlign: "center" }}>
        <span style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: MONO }}>LABBED</span>
      </div>
    </div>
  );
}
