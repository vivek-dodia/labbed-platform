"use client";

import { useState } from "react";
import SchematicGrid, { Cell } from "@/components/layout/SchematicGrid";
import Footer from "@/components/layout/Footer";
import ArrowButton from "@/components/ui/ArrowButton";
import Modal from "@/components/ui/Modal";
import SchematicInput from "@/components/ui/SchematicInput";
import Link from "next/link";

interface Endpoint {
  method: string;
  path: string;
  description: string;
  auth: boolean;
}

const sections: Record<string, Endpoint[]> = {
  Authentication: [
    { method: "POST", path: "/api/v1/auth/login", description: "Authenticate with email and password. Returns access and refresh tokens.", auth: false },
    { method: "POST", path: "/api/v1/auth/refresh", description: "Exchange a refresh token for a new access token.", auth: false },
    { method: "GET", path: "/api/v1/auth/config", description: "Returns authentication configuration (native/OIDC).", auth: false },
  ],
  Users: [
    { method: "GET", path: "/api/v1/users/me", description: "Get the currently authenticated user profile.", auth: true },
    { method: "PUT", path: "/api/v1/users/:id", description: "Update user display name or admin status.", auth: true },
    { method: "PUT", path: "/api/v1/users/:id/password", description: "Change user password. Requires current password.", auth: true },
  ],
  Collections: [
    { method: "GET", path: "/api/v1/collections", description: "List all collections accessible to the user.", auth: true },
    { method: "POST", path: "/api/v1/collections", description: "Create a new collection with name and visibility settings.", auth: true },
    { method: "GET", path: "/api/v1/collections/:id", description: "Get a specific collection by UUID.", auth: true },
    { method: "PUT", path: "/api/v1/collections/:id", description: "Update collection name or visibility.", auth: true },
    { method: "DELETE", path: "/api/v1/collections/:id", description: "Delete a collection. Creator or admin only.", auth: true },
    { method: "POST", path: "/api/v1/collections/:id/members", description: "Add a member with a role (editor/deployer/viewer).", auth: true },
    { method: "DELETE", path: "/api/v1/collections/:id/members/:uid", description: "Remove a member from the collection.", auth: true },
  ],
  Topologies: [
    { method: "GET", path: "/api/v1/topologies", description: "List all topologies the user can access.", auth: true },
    { method: "POST", path: "/api/v1/topologies", description: "Create a topology with name, YAML definition, and collection.", auth: true },
    { method: "GET", path: "/api/v1/topologies/:id", description: "Get topology details including definition and bind files.", auth: true },
    { method: "PUT", path: "/api/v1/topologies/:id", description: "Update topology name or definition.", auth: true },
    { method: "DELETE", path: "/api/v1/topologies/:id", description: "Delete a topology.", auth: true },
    { method: "POST", path: "/api/v1/topologies/:id/files", description: "Add a bind file (config file for nodes).", auth: true },
    { method: "PATCH", path: "/api/v1/topologies/:id/files/:fid", description: "Update a bind file path or content.", auth: true },
    { method: "DELETE", path: "/api/v1/topologies/:id/files/:fid", description: "Delete a bind file.", auth: true },
  ],
  Labs: [
    { method: "GET", path: "/api/v1/labs", description: "List all labs the user can access.", auth: true },
    { method: "POST", path: "/api/v1/labs", description: "Create a new lab from a topology.", auth: true },
    { method: "GET", path: "/api/v1/labs/:id", description: "Get lab details including node status.", auth: true },
    { method: "PUT", path: "/api/v1/labs/:id", description: "Update lab name or schedule.", auth: true },
    { method: "DELETE", path: "/api/v1/labs/:id", description: "Delete a lab record.", auth: true },
    { method: "POST", path: "/api/v1/labs/:id/deploy", description: "Deploy the lab to a worker.", auth: true },
    { method: "POST", path: "/api/v1/labs/:id/destroy", description: "Stop and destroy the running lab.", auth: true },
    { method: "GET", path: "/api/v1/labs/:id/nodes", description: "Get the current node list for a lab.", auth: true },
  ],
  Workers: [
    { method: "GET", path: "/api/v1/workers", description: "List all workers. Admin only.", auth: true },
    { method: "POST", path: "/api/v1/workers", description: "Register a new worker. Admin only.", auth: true },
    { method: "GET", path: "/api/v1/workers/:id", description: "Get worker details. Admin only.", auth: true },
    { method: "PUT", path: "/api/v1/workers/:id", description: "Update worker config or state. Admin only.", auth: true },
    { method: "DELETE", path: "/api/v1/workers/:id", description: "Delete a worker. Admin only.", auth: true },
  ],
  WebSocket: [
    { method: "WS", path: "/ws?token={jwt}", description: "WebSocket endpoint for real-time lab state, node updates, and shell relay. Subscribe to channels: lab:{uuid}, lab:{uuid}:nodes, shell:{labUuid}:{nodeName}.", auth: true },
  ],
};

const methodColors: Record<string, string> = {
  GET: "#2b9d88",
  POST: "#c1755f",
  PUT: "#d3cadd",
  PATCH: "#d3cadd",
  DELETE: "#f6539f",
  WS: "#0A0A0A",
};

function MethodTag({ method }: { method: string }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: "0.65rem",
        padding: "0.2rem 0.5rem",
        border: "1px solid #0A0A0A",
        backgroundColor: methodColors[method] || "#EBEBEB",
        color: method === "WS" || method === "DELETE" ? "#F2F2F2" : "#0A0A0A",
        fontWeight: 700,
        marginRight: "0.5rem",
      }}
    >
      {method}
    </span>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("Authentication");
  const [tryModal, setTryModal] = useState<Endpoint | null>(null);
  const [token, setToken] = useState("");

  const sectionNames = Object.keys(sections);

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
          <Link href="/" style={{ backgroundColor: "#F2F2F2", display: "flex", alignItems: "center", padding: "1vw 1.5vw", textDecoration: "none", color: "#0A0A0A" }}>
            <span className="label" style={{ fontWeight: 700 }}>LABBED</span>
          </Link>
          <div style={{ backgroundColor: "#F2F2F2", display: "flex", alignItems: "center", padding: "1vw 1.5vw" }}>
            <span className="label">(Dashboard)</span>
          </div>
          <div style={{ backgroundColor: "#F2F2F2", display: "flex", alignItems: "center", padding: "1vw 1.5vw" }}>
            <span className="label">(Topologies)</span>
          </div>
          <div style={{ backgroundColor: "#0A0A0A", color: "#F2F2F2", display: "flex", alignItems: "center", padding: "1vw 1.5vw" }}>
            <span className="label">API REFERENCE</span>
          </div>
        </div>

        {/* Hero */}
        <Cell span={4} style={{ padding: "3vw" }}>
          <p className="label" style={{ opacity: 0.5, marginBottom: "1rem" }}>
            05 / DEVELOPER ACCESS
          </p>
          <h1 style={{ fontSize: "4vw", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1.1 }}>
            API REFERENCE
          </h1>
          <p className="footnote" style={{ marginTop: "1.5rem", maxWidth: "50vw", opacity: 0.6 }}>
            Manage your network lab environments programmatically. Create topologies, deploy labs, and stream real-time data through WebSocket channels.
          </p>
        </Cell>

        {/* Docs layout: sidebar + content */}
        <div
          style={{
            gridColumn: "span 4",
            display: "grid",
            gridTemplateColumns: "250px 1fr",
            gap: "1px",
            backgroundColor: "#0A0A0A",
            minHeight: "60vh",
          }}
        >
          {/* Sidebar */}
          <Cell style={{ padding: "2rem" }}>
            {sectionNames.map((name) => (
              <div
                key={name}
                onClick={() => setActiveSection(name)}
                style={{
                  padding: "0.5rem 0",
                  cursor: "pointer",
                  fontWeight: activeSection === name ? 700 : 400,
                  textDecoration: activeSection === name ? "underline" : "none",
                  fontSize: "0.85rem",
                  transition: "transform 0.15s",
                }}
              >
                {name}
              </div>
            ))}
          </Cell>

          {/* Content */}
          <Cell style={{ padding: "2rem 3rem" }}>
            <h2
              style={{
                fontSize: "2.5rem",
                fontWeight: 200,
                letterSpacing: "-0.02em",
                marginBottom: "2rem",
                textTransform: "uppercase",
              }}
            >
              {activeSection}
            </h2>

            {sections[activeSection].map((ep, i) => (
              <div
                key={i}
                style={{
                  marginBottom: "2.5rem",
                  paddingBottom: "2.5rem",
                  borderBottom: "1px solid rgba(10,10,10,0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <MethodTag method={ep.method} />
                  <span className="mono" style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                    {ep.path}
                  </span>
                  {ep.auth && (
                    <span className="label" style={{ fontSize: "0.55rem", opacity: 0.4, marginLeft: "0.5rem" }}>
                      AUTH
                    </span>
                  )}
                </div>
                <p className="footnote" style={{ opacity: 0.7, marginBottom: "0.8rem" }}>
                  {ep.description}
                </p>
                {ep.method !== "WS" && (
                  <button
                    onClick={() => setTryModal(ep)}
                    className="label"
                    style={{
                      fontSize: "0.6rem",
                      padding: "0.25rem 0.6rem",
                      border: "1px solid #0A0A0A",
                      background: "#EBEBEB",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    TRY IT
                  </button>
                )}
              </div>
            ))}
          </Cell>
        </div>

        <Footer />
      </SchematicGrid>

      {/* Try It modal */}
      <Modal
        open={!!tryModal}
        onClose={() => setTryModal(null)}
        title={tryModal ? `${tryModal.method} ${tryModal.path}` : ""}
      >
        {tryModal && (
          <>
            <SchematicInput
              label="AUTHORIZATION_TOKEN"
              placeholder="Bearer YOUR_TOKEN"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />

            {/* curl example */}
            <div
              style={{
                backgroundColor: "#0A0A0A",
                color: "#F2F2F2",
                padding: "1.5rem",
                fontFamily: "'Courier New', monospace",
                fontSize: "0.75rem",
                lineHeight: 1.6,
                marginBottom: "1.5rem",
                overflowX: "auto",
              }}
            >
              <span style={{ color: "#f6539f" }}>curl</span> -X{" "}
              {tryModal.method}{" "}
              <span style={{ color: "#c1755f" }}>
                &quot;http://localhost:8080{tryModal.path}&quot;
              </span>{" "}
              \<br />
              &nbsp;&nbsp;-H{" "}
              <span style={{ color: "#c1755f" }}>
                &quot;Authorization: Bearer YOUR_TOKEN&quot;
              </span>{" "}
              \<br />
              &nbsp;&nbsp;-H{" "}
              <span style={{ color: "#c1755f" }}>
                &quot;Content-Type: application/json&quot;
              </span>
            </div>

            <ArrowButton label="Send Request" onClick={() => setTryModal(null)} />
          </>
        )}
      </Modal>
    </div>
  );
}
