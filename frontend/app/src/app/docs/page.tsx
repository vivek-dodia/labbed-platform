"use client";

import { useState, useEffect } from "react";
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
  GET: "#A2C2ED",
  POST: "#ED6A4A",
  PUT: "#D0C3DF",
  PATCH: "#D0C3DF",
  DELETE: "#EAA8C6",
  WS: "#121212",
};

const sidebarNavGroups: Record<string, string[]> = {
  Introduction: ["Authentication", "Users"],
  Resources: ["Collections", "Topologies", "Labs", "Workers"],
  Webhooks: ["WebSocket"],
};

function NavHoverItem({
  children,
  style,
  href,
}: {
  children: React.ReactNode;
  style: React.CSSProperties;
  href?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const Tag = href ? Link : "a";
  return (
    <Tag
      href={href || "#"}
      style={{
        ...style,
        backgroundColor: hovered ? "#121212" : "transparent",
        color: hovered ? "#F3EFE7" : "#121212",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={href ? undefined : (e: React.MouseEvent) => e.preventDefault()}
    >
      {children}
    </Tag>
  );
}

function NavLinkItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href="#"
      style={{
        display: "block",
        padding: "0.5rem 0",
        fontSize: "0.85rem",
        color: "#121212",
        textDecoration: active ? "underline" : "none",
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        transform: !active && hovered ? "translateX(5px)" : "none",
        transition: "transform 0.2s",
        fontFamily: "'Manrope', -apple-system, sans-serif",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {children}
    </a>
  );
}

function PillTry({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.2rem 0.8rem",
        borderRadius: "99px",
        border: "1px solid #121212",
        fontSize: "0.7rem",
        fontWeight: 700,
        cursor: "pointer",
        gap: "0.4rem",
        backgroundColor: "#E4CB6A",
        transition: "all 0.2s",
        textTransform: "uppercase",
        fontFamily: "'Manrope', -apple-system, sans-serif",
        transform: hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "2px 2px 0 #121212" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      Try it
    </div>
  );
}

function TerminalWindow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #121212",
        backgroundColor: "#121212",
        color: "#F3EFE7",
        display: "flex",
        flexDirection: "column",
        marginBottom: "2rem",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.2)",
          padding: "0.4rem 0.8rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.6rem",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "'Space Mono', monospace",
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.2)",
            }}
          />
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.2)",
            }}
          />
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.2)",
            }}
          />
        </div>
        <span>{title}</span>
      </div>
      <div
        style={{
          padding: "1.5rem",
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.75rem",
          lineHeight: 1.6,
          overflowX: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TryItModal({
  isOpen,
  onClose,
  endpoint,
}: {
  isOpen: boolean;
  onClose: () => void;
  endpoint: Endpoint | null;
}) {
  const [response, setResponse] = useState<object | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  const handleSend = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setResponse({
        status: "success",
        data: [
          {
            id: "top_99821",
            name: "BGP-Core-Mesh",
            nodes: 12,
            status: "active",
          },
        ],
        total: 42,
      });
    }, 1000);
  };

  if (!isOpen || !endpoint) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(18,18,18,0.5)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#F3EFE7",
          border: "1px solid #121212",
          padding: "2rem",
          maxWidth: "560px",
          width: "90%",
          position: "relative",
          fontFamily: "'Manrope', -apple-system, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ fontWeight: 500, fontSize: "1.25rem" }}>
            Try it — {endpoint.method} {endpoint.path}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.2rem",
              color: "#121212",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 700,
              marginBottom: "0.4rem",
            }}
          >
            Authorization Token
          </div>
          <input
            type="text"
            placeholder="Bearer YOUR_TOKEN"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #121212",
              backgroundColor: "#fff",
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.75rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <button
          onClick={handleSend}
          style={{
            backgroundColor: "#E4CB6A",
            border: "1px solid #121212",
            padding: "0.5rem 1.5rem",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "1rem",
            fontFamily: "'Manrope', -apple-system, sans-serif",
          }}
        >
          {loading ? "Sending..." : "Send Request"}
        </button>
        {response && (
          <TerminalWindow title="RESPONSE (JSON)">
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {JSON.stringify(response, null, 2)}
            </pre>
          </TerminalWindow>
        )}
      </div>
    </div>
  );
}

function getMethodTagStyle(method: string): React.CSSProperties {
  return {
    fontFamily: "'Space Mono', monospace",
    fontSize: "0.7rem",
    padding: "0.2rem 0.5rem",
    border: "1px solid #121212",
    borderRadius: "4px",
    verticalAlign: "middle",
    marginRight: "0.5rem",
    backgroundColor: methodColors[method] || "#F3EFE7",
    color: method === "WS" ? "#F3EFE7" : "#121212",
    fontWeight: 700,
    display: "inline-block",
  };
}

function getCurlExample(ep: Endpoint): React.ReactNode {
  return (
    <>
      <span style={{ color: "#EAA8C6" }}>curl</span> -X {ep.method}{" "}
      <span style={{ color: "#E4CB6A" }}>
        &quot;http://localhost:8080{ep.path}&quot;
      </span>{" "}
      \<br />
      &nbsp;&nbsp;-H{" "}
      <span style={{ color: "#E4CB6A" }}>
        &quot;Authorization: Bearer YOUR_TOKEN&quot;
      </span>{" "}
      \<br />
      &nbsp;&nbsp;-H{" "}
      <span style={{ color: "#E4CB6A" }}>
        &quot;Content-Type: application/json&quot;
      </span>
    </>
  );
}

function getResponseExample(section: string): React.ReactNode {
  if (section === "Authentication") {
    return (
      <>
        {"{"}<br />
        &nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;access_token&quot;</span>:{" "}
        <span style={{ color: "#E4CB6A" }}>&quot;eyJhbGciOi...&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;refresh_token&quot;</span>:{" "}
        <span style={{ color: "#E4CB6A" }}>&quot;dGhpcyBpcy...&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;token_type&quot;</span>:{" "}
        <span style={{ color: "#E4CB6A" }}>&quot;Bearer&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;expires_in&quot;</span>:{" "}
        <span style={{ color: "#E4CB6A" }}>3600</span><br />
        {"}"}
      </>
    );
  }
  if (section === "Labs") {
    return (
      <>
        {"{"}<br />
        &nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;status&quot;</span>:{" "}
        <span style={{ color: "#E4CB6A" }}>&quot;success&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;data&quot;</span>: [<br />
        &nbsp;&nbsp;&nbsp;&nbsp;{"{"}<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;id&quot;</span>:{" "}
        <span style={{ color: "#E4CB6A" }}>&quot;lab_44210&quot;</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;name&quot;</span>:{" "}
        <span style={{ color: "#E4CB6A" }}>&quot;OSPF-Lab-01&quot;</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;state&quot;</span>:{" "}
        <span style={{ color: "#E4CB6A" }}>&quot;running&quot;</span><br />
        &nbsp;&nbsp;&nbsp;&nbsp;{"}"}<br />
        &nbsp;&nbsp;],<br />
        &nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>{"// Total count for pagination"}</span><br />
        &nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;total&quot;</span>:{" "}
        <span style={{ color: "#E4CB6A" }}>8</span><br />
        {"}"}
      </>
    );
  }
  // Default response for Topologies, Collections, Users, Workers
  return (
    <>
      {"{"}<br />
      &nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;status&quot;</span>:{" "}
      <span style={{ color: "#E4CB6A" }}>&quot;success&quot;</span>,<br />
      &nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;data&quot;</span>: [<br />
      &nbsp;&nbsp;&nbsp;&nbsp;{"{"}<br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;id&quot;</span>:{" "}
      <span style={{ color: "#E4CB6A" }}>&quot;top_99821&quot;</span>,<br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;name&quot;</span>:{" "}
      <span style={{ color: "#E4CB6A" }}>&quot;BGP-Core-Mesh&quot;</span>,<br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;nodes&quot;</span>:{" "}
      <span style={{ color: "#E4CB6A" }}>12</span>,<br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;status&quot;</span>:{" "}
      <span style={{ color: "#E4CB6A" }}>&quot;active&quot;</span><br />
      &nbsp;&nbsp;&nbsp;&nbsp;{"}"}<br />
      &nbsp;&nbsp;],<br />
      &nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>{"// Total count for pagination"}</span><br />
      &nbsp;&nbsp;<span style={{ color: "#A2C2ED" }}>&quot;total&quot;</span>:{" "}
      <span style={{ color: "#E4CB6A" }}>42</span><br />
      {"}"}
    </>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("Authentication");
  const [tryModal, setTryModal] = useState<Endpoint | null>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = "https://fonts.googleapis.com";
    document.head.appendChild(link);

    const link2 = document.createElement("link");
    link2.rel = "preconnect";
    link2.href = "https://fonts.gstatic.com";
    link2.crossOrigin = "";
    document.head.appendChild(link2);

    const link3 = document.createElement("link");
    link3.href =
      "https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;500;700;800&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap";
    link3.rel = "stylesheet";
    document.head.appendChild(link3);

    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { overflow-x: hidden; }
      @media (max-width: 1100px) {
        .labbed-code-view { display: none !important; }
        .labbed-api-grid { grid-template-columns: 240px 1fr !important; }
      }
      @media (max-width: 768px) {
        .labbed-api-grid { grid-template-columns: 1fr !important; }
        .labbed-docs-sidebar { display: none !important; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(link2);
      document.head.removeChild(link3);
      document.head.removeChild(style);
    };
  }, []);

  const firstEndpoint = sections[activeSection]?.[0];

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#F3EFE7",
        color: "#121212",
        fontFamily: "'Manrope', -apple-system, sans-serif",
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden",
      }}
    >
      {/* Left sidebar - 48px */}
      <aside
        style={{
          width: "48px",
          borderRight: "1px solid #121212",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "1rem 0",
          flexShrink: 0,
          backgroundColor: "#F3EFE7",
          zIndex: 10,
        }}
      >
        {/* Hamburger */}
        <div
          style={{
            width: "24px",
            height: "20px",
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
              height: "1px",
              backgroundColor: "#121212",
              width: "100%",
            }}
          />
          <span
            style={{
              display: "block",
              height: "1px",
              backgroundColor: "#121212",
              width: "100%",
            }}
          />
          <span
            style={{
              display: "block",
              height: "1px",
              backgroundColor: "#121212",
              width: "100%",
            }}
          />
        </div>
        {/* Vertical text */}
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
          {["CLI", "GUI", "API"].map((item) => (
            <span
              key={item}
              style={{
                cursor: "pointer",
                opacity: item === "API" ? 1 : 0.5,
                fontWeight: item === "API" ? 800 : 400,
                transition: "opacity 0.2s",
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </aside>

      {/* Main content area */}
      <main
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Top nav - 48px */}
        <nav
          style={{
            height: "48px",
            borderBottom: "1px solid #121212",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", height: "100%" }}>
            <NavHoverItem
              href="/"
              style={{
                padding: "0 1.5rem",
                display: "flex",
                alignItems: "center",
                borderRight: "1px solid #121212",
                fontSize: "0.85rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 800,
                cursor: "pointer",
                textDecoration: "none",
                color: "#121212",
                height: "100%",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              LABBED
            </NavHoverItem>
            <NavHoverItem
              href="/topologies"
              style={{
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
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              TOPOLOGIES
            </NavHoverItem>
            <NavHoverItem
              href="/docs"
              style={{
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
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              DOCS
            </NavHoverItem>
          </div>
          <div
            style={{
              flexGrow: 1,
              display: "flex",
              alignItems: "center",
              padding: "0 1rem",
              justifyContent: "flex-end",
              color: "#121212",
              opacity: 0.5,
            }}
          >
            <span
              style={{
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 700,
                opacity: 0.4,
                marginRight: "12px",
              }}
            >
              Search docs...
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            <NavHoverItem
              style={{
                padding: "0 1.5rem",
                display: "flex",
                alignItems: "center",
                borderRight: "none",
                borderLeft: "1px solid #121212",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "none",
                color: "#121212",
                height: "100%",
                transition: "background-color 0.15s, color 0.15s",
              }}
            >
              AUTH TOKEN ↘
            </NavHoverItem>
          </div>
        </nav>

        {/* 3-column grid: docs sidebar | docs body | code view */}
        <div
          className="labbed-api-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr 1fr",
            minHeight: "calc(100vh - 48px)",
          }}
        >
          {/* Docs Sidebar */}
          <nav
            className="labbed-docs-sidebar"
            style={{
              borderRight: "1px solid #121212",
              padding: "2rem",
              overflowY: "auto",
            }}
          >
            {Object.entries(sidebarNavGroups).map(([group, links]) => (
              <div key={group} style={{ marginBottom: "2.5rem" }}>
                <div
                  style={{
                    marginBottom: "1rem",
                    color: "#121212",
                    opacity: 0.6,
                    fontSize: "0.65rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 700,
                  }}
                >
                  {group}
                </div>
                {links.map((link) => (
                  <NavLinkItem
                    key={link}
                    active={activeSection === link}
                    onClick={() => setActiveSection(link)}
                  >
                    {link}
                  </NavLinkItem>
                ))}
              </div>
            ))}
          </nav>

          {/* Docs Body */}
          <section
            style={{
              padding: "3rem",
              borderRight: "1px solid #121212",
              overflowY: "auto",
            }}
          >
            {/* Header */}
            <header style={{ marginBottom: "4rem" }}>
              <span
                style={{
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontWeight: 700,
                  color: "#ED6A4A",
                }}
              >
                v1.0 API
              </span>
              <h1
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 200,
                  fontSize: "3.5rem",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  marginTop: "1rem",
                }}
              >
                {activeSection}
              </h1>
              <p
                style={{
                  marginTop: "1.5rem",
                  maxWidth: "480px",
                  opacity: 0.7,
                  fontSize: "0.95rem",
                  lineHeight: 1.4,
                }}
              >
                Manage your network lab environments programmatically. Create
                topologies, deploy labs, and stream real-time data through
                WebSocket channels.
              </p>
            </header>

            {/* Endpoint blocks */}
            {sections[activeSection].map((ep, i) => (
              <div key={i} style={{ marginBottom: "4rem" }}>
                <div
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <span style={getMethodTagStyle(ep.method)}>{ep.method}</span>
                  {ep.path}
                  {ep.method !== "WS" && (
                    <PillTry onClick={() => setTryModal(ep)} />
                  )}
                </div>
                <p
                  style={{
                    marginTop: "0.5rem",
                    opacity: 0.8,
                    fontSize: "0.95rem",
                    lineHeight: 1.4,
                  }}
                >
                  {ep.description}
                </p>
                {ep.auth && (
                  <span
                    style={{
                      fontSize: "0.55rem",
                      opacity: 0.4,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 700,
                      marginTop: "0.4rem",
                      display: "inline-block",
                    }}
                  >
                    Requires authentication
                  </span>
                )}
              </div>
            ))}
          </section>

          {/* Code View */}
          <section
            className="labbed-code-view"
            style={{
              padding: "3rem",
              backgroundColor: "#fff",
              overflowY: "auto",
            }}
          >
            <TerminalWindow title="REQUEST (CURL)">
              {firstEndpoint ? (
                getCurlExample(firstEndpoint)
              ) : (
                <span style={{ color: "rgba(255,255,255,0.4)" }}>
                  Select an endpoint to see the request
                </span>
              )}
            </TerminalWindow>

            <TerminalWindow title="RESPONSE (JSON)">
              {getResponseExample(activeSection)}
            </TerminalWindow>

            {/* Pro tip card */}
            <div
              style={{
                border: "1px solid #121212",
                padding: "1.5rem",
                backgroundColor: "#F3EFE7",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontWeight: 700,
                }}
              >
                Pro Tip
              </span>
              <h3
                style={{ fontWeight: 500, fontSize: "1.25rem", lineHeight: 1.2 }}
              >
                Batch Operations
              </h3>
              <p
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  opacity: 0.8,
                  fontSize: "0.75rem",
                  lineHeight: 1.4,
                }}
              >
                Use the{" "}
                <code style={{ fontFamily: "'Space Mono', monospace" }}>
                  /api/v1/labs/:id/deploy
                </code>{" "}
                endpoint to deploy pre-configured environments from your
                topologies in a single API call.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Try It Modal */}
      <TryItModal
        isOpen={!!tryModal}
        onClose={() => setTryModal(null)}
        endpoint={tryModal}
      />
    </div>
  );
}
