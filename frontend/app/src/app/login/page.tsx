"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import SchematicGrid, { Cell } from "@/components/layout/SchematicGrid";
import SchematicInput from "@/components/ui/SchematicInput";
import ArrowButton from "@/components/ui/ArrowButton";
import CircleVisual from "@/components/ui/CircleVisual";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Authentication failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", padding: 1 }}>
      <SchematicGrid>
        {/* Header */}
        <div
          style={{
            gridColumn: "span 4",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "1px",
            background: "#0A0A0A",
          }}
        >
          <Cell style={{ padding: "1vw 1.5vw", flexDirection: "row", alignItems: "center" }}>
            <span className="label" style={{ fontWeight: 700 }}>LABBED</span>
          </Cell>
          <Cell style={{ padding: "1vw 1.5vw", flexDirection: "row", alignItems: "center" }}>
            <span className="label">(Overview)</span>
          </Cell>
          <Cell style={{ padding: "1vw 1.5vw", flexDirection: "row", alignItems: "center" }}>
            <span className="label">(Architecture)</span>
          </Cell>
          <Cell dark style={{ padding: "1vw 1.5vw", flexDirection: "row", alignItems: "center" }}>
            <span className="label">SYSTEM ACCESS</span>
          </Cell>
        </div>

        {/* Hero */}
        <Cell span={3} style={{ padding: "3vw" }}>
          <h1
            style={{
              fontSize: "5vw",
              fontWeight: 400,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              lineHeight: 1.1,
            }}
          >
            NETWORK
            <br />
            SIMULATION
            <br />
            PLATFORM
          </h1>
          <div style={{ marginTop: "4vw", maxWidth: "40vw" }}>
            <p className="label">01 / AUTHENTICATION</p>
            <p className="footnote" style={{ marginTop: "1vw" }}>
              Secure access to your lab environments. Authenticate with your
              organization credentials to begin network simulation provisioning.
            </p>
          </div>
        </Cell>

        {/* Gradient accent */}
        <Cell
          style={{
            background:
              "linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)",
          }}
        />

        {/* Login form */}
        <Cell span={2} style={{ padding: "3vw", justifyContent: "center" }}>
          <CircleVisual />
          <h2
            style={{
              fontSize: "2vw",
              fontWeight: 400,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "2vw",
            }}
          >
            Authenticate
            <br />
            Session
          </h2>

          <form onSubmit={handleSubmit}>
            <SchematicInput
              label="EMAIL_ADDRESS"
              type="email"
              placeholder="admin@labbed.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <SchematicInput
              label="PASSWORD"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <p
                className="footnote"
                style={{ color: "#f6539f", marginBottom: "1rem" }}
              >
                {error}
              </p>
            )}

            <ArrowButton
              type="submit"
              label={loading ? "Authenticating..." : "Initialize Session"}
              disabled={loading}
            />
          </form>
        </Cell>

        {/* Right info cell */}
        <Cell span={2} style={{ padding: "3vw", justifyContent: "flex-end" }}>
          <div className="footnote" style={{ opacity: 0.6 }}>
            <p style={{ marginBottom: "1rem" }}>
              Labbed provides cloud-native containerlab management with
              hardware-level isolation and cryptographic session binding.
            </p>
            <p>
              Sessions are secured via JWT with RSA-256 signing. Access tokens
              expire after 30 minutes with automatic refresh.
            </p>
          </div>
        </Cell>

        <Footer />
      </SchematicGrid>
    </div>
  );
}
