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
    { method: "POST", path: "/api/v1/auth/login", description: "Authenticate with email and password. Returns access and refresh tokens (access: 30m, refresh: 30d).", auth: false },
    { method: "POST", path: "/api/v1/auth/signup", description: "Register a new account. Creates a personal organization automatically.", auth: false },
    { method: "POST", path: "/api/v1/auth/refresh", description: "Exchange a refresh token for a new access token.", auth: false },
    { method: "GET", path: "/api/v1/auth/config", description: "Returns authentication configuration including enabled providers (native, Google OAuth2).", auth: false },
    { method: "GET", path: "/api/v1/auth/google/authorize", description: "Initiate Google OAuth2 login flow. Redirects to Google consent screen.", auth: false },
    { method: "POST", path: "/api/v1/auth/google/callback", description: "Complete Google OAuth2 login. Exchanges authorization code for tokens.", auth: false },
  ],
  Users: [
    { method: "GET", path: "/api/v1/users/me", description: "Get the currently authenticated user profile including organization memberships.", auth: true },
    { method: "PUT", path: "/api/v1/users/:id", description: "Update user display name.", auth: true },
    { method: "PUT", path: "/api/v1/users/:id/password", description: "Change user password. Requires current password. Minimum 6 characters.", auth: true },
    { method: "GET", path: "/api/v1/users", description: "List all users. Platform admin only.", auth: true },
    { method: "POST", path: "/api/v1/users", description: "Create a new user account. Platform admin only.", auth: true },
    { method: "DELETE", path: "/api/v1/users/:id", description: "Delete a user. Platform admin only.", auth: true },
  ],
  Organizations: [
    { method: "GET", path: "/api/v1/organizations", description: "List organizations the user belongs to.", auth: true },
    { method: "POST", path: "/api/v1/organizations", description: "Create a new organization. Creator becomes owner.", auth: true },
    { method: "GET", path: "/api/v1/organizations/:id", description: "Get organization details including plan and limits.", auth: true },
    { method: "PUT", path: "/api/v1/organizations/:id", description: "Update organization name or settings. Owner/admin only.", auth: true },
    { method: "GET", path: "/api/v1/organizations/:id/members", description: "List all members and their roles (owner/admin/member).", auth: true },
    { method: "POST", path: "/api/v1/organizations/:id/members", description: "Invite a member by email with a role. Owner/admin only.", auth: true },
    { method: "DELETE", path: "/api/v1/organizations/:id/members/:userId", description: "Remove a member from the organization. Cannot remove the owner.", auth: true },
  ],
  Collections: [
    { method: "GET", path: "/api/v1/collections", description: "List all collections in the current organization. Requires X-Org-ID header.", auth: true },
    { method: "POST", path: "/api/v1/collections", description: "Create a new collection with name and visibility settings.", auth: true },
    { method: "GET", path: "/api/v1/collections/:id", description: "Get a specific collection by UUID.", auth: true },
    { method: "PUT", path: "/api/v1/collections/:id", description: "Update collection name or visibility.", auth: true },
    { method: "DELETE", path: "/api/v1/collections/:id", description: "Delete a collection. Org admin or higher required.", auth: true },
    { method: "POST", path: "/api/v1/collections/:id/members", description: "Add a member with a role (editor/deployer/viewer). Org admin only.", auth: true },
    { method: "DELETE", path: "/api/v1/collections/:id/members/:uid", description: "Remove a member from the collection. Org admin only.", auth: true },
  ],
  Topologies: [
    { method: "GET", path: "/api/v1/topologies", description: "List all topologies in the current organization. Supports pagination with limit/offset query params.", auth: true },
    { method: "POST", path: "/api/v1/topologies", description: "Create a topology with name, containerlab YAML definition, and collection. Body limit: 5MB.", auth: true },
    { method: "GET", path: "/api/v1/topologies/:id", description: "Get topology details including YAML definition and bind files.", auth: true },
    { method: "PUT", path: "/api/v1/topologies/:id", description: "Update topology name or YAML definition. Body limit: 5MB.", auth: true },
    { method: "DELETE", path: "/api/v1/topologies/:id", description: "Delete a topology. Org admin or higher required.", auth: true },
    { method: "POST", path: "/api/v1/topologies/validate", description: "Validate a containerlab YAML definition without saving it.", auth: true },
    { method: "POST", path: "/api/v1/topologies/:id/files", description: "Add a bind file (startup config, custom script, etc.).", auth: true },
    { method: "PATCH", path: "/api/v1/topologies/:id/files/:fid", description: "Update a bind file path or content.", auth: true },
    { method: "DELETE", path: "/api/v1/topologies/:id/files/:fid", description: "Delete a bind file. Org admin or higher required.", auth: true },
  ],
  Labs: [
    { method: "GET", path: "/api/v1/labs", description: "List all labs in the current organization. Supports pagination with limit/offset query params.", auth: true },
    { method: "POST", path: "/api/v1/labs", description: "Create a new lab from a topology. Checks org lab quota.", auth: true },
    { method: "GET", path: "/api/v1/labs/:id", description: "Get lab details including node list with container state, IPs, and images.", auth: true },
    { method: "PUT", path: "/api/v1/labs/:id", description: "Update lab name or schedule.", auth: true },
    { method: "DELETE", path: "/api/v1/labs/:id", description: "Delete a lab record. Org admin or higher required.", auth: true },
    { method: "POST", path: "/api/v1/labs/:id/deploy", description: "Deploy the lab to a worker. Runs async — use WebSocket for progress.", auth: true },
    { method: "POST", path: "/api/v1/labs/:id/destroy", description: "Stop and destroy all running containers for this lab.", auth: true },
    { method: "POST", path: "/api/v1/labs/:id/clone", description: "Clone an existing lab with all its configuration.", auth: true },
    { method: "GET", path: "/api/v1/labs/:id/nodes", description: "Get the current node list with container IDs, IPs, and state.", auth: true },
    { method: "GET", path: "/api/v1/labs/:id/events", description: "Get the audit trail of events for this lab (deploy, destroy, errors).", auth: true },
  ],
  Workers: [
    { method: "GET", path: "/api/v1/workers", description: "List all registered workers. Platform admin only.", auth: true },
    { method: "POST", path: "/api/v1/workers", description: "Register a new worker. Platform admin only.", auth: true },
    { method: "GET", path: "/api/v1/workers/:id", description: "Get worker details including capacity and status. Platform admin only.", auth: true },
    { method: "PUT", path: "/api/v1/workers/:id", description: "Update worker config or state. Platform admin only.", auth: true },
    { method: "DELETE", path: "/api/v1/workers/:id", description: "Delete a worker. Platform admin only.", auth: true },
  ],
  WebSocket: [
    { method: "WS", path: "/ws?token={jwt}", description: "Real-time updates via WebSocket. Subscribe to channels for live data.", auth: true },
    { method: "WS", path: "channel: lab:{uuid}", description: "Lab state changes (deploying, running, stopped, failed). Pushes full lab object on every state transition.", auth: true },
    { method: "WS", path: "channel: lab:{uuid}:nodes", description: "Node updates — container state, IPs, and health changes in real-time.", auth: true },
    { method: "WS", path: "channel: shell:{labUuid}:{nodeName}", description: "Interactive shell relay. Send commands and receive output from lab containers. Also used for ping, traceroute, bulk commands, config fetch, and packet capture (tcpdump).", auth: true },
    { method: "WS", path: "channel: lab:{uuid}:logs", description: "Deployment log streaming. Receives real-time log lines during lab deploy/destroy operations.", auth: true },
  ],
  "Internal API": [
    { method: "POST", path: "/api/internal/workers/register", description: "Worker self-registration on startup. Authenticated via shared secret.", auth: true },
    { method: "POST", path: "/api/internal/workers/heartbeat", description: "Worker heartbeat with capacity info. Sent every 30 seconds.", auth: true },
    { method: "POST", path: "/api/internal/labs/status", description: "Worker reports lab state changes (deploying → running, failed, stopped).", auth: true },
    { method: "POST", path: "/api/internal/labs/nodes", description: "Worker reports discovered container nodes with IPs and state.", auth: true },
    { method: "POST", path: "/api/internal/labs/logs", description: "Worker streams deployment logs to the platform for WebSocket broadcast.", auth: true },
  ],
};

const methodColors: Record<string, string> = {
  GET: "rgba(0,0,0,0.15)",
  POST: "#000000",
  PUT: "rgba(0,0,0,0.1)",
  PATCH: "rgba(0,0,0,0.1)",
  DELETE: "rgba(0,0,0,0.15)",
  WS: "#000000",
};

const sidebarNavGroups: Record<string, string[]> = {
  "Getting Started": ["Authentication", "Users", "Organizations"],
  Resources: ["Collections", "Topologies", "Labs", "Workers"],
  "Real-time": ["WebSocket"],
  Platform: ["Internal API"],
};

const sectionDescriptions: Record<string, string> = {
  Authentication: "JWT-based auth with native email/password and Google OAuth2. Access tokens expire in 30 minutes, refresh tokens in 30 days. Rate limited to 20 requests per minute per IP.",
  Users: "Manage user accounts and profiles. Regular users can update their own profile and password. Platform admins can create, list, and delete users.",
  Organizations: "Multi-tenant organization management. Each org has its own collections, topologies, labs, and workers. Members have roles: owner, admin, or member. All org-scoped API calls require the X-Org-ID header.",
  Collections: "Group topologies into collections for organization. Collections are org-scoped and support member-level access control with editor, deployer, and viewer roles.",
  Topologies: "Containerlab YAML topology definitions. Create, validate, and manage network topologies with bind files for node startup configs. Body size limit of 5MB for write operations.",
  Labs: "Deploy and manage containerlab network labs. Labs are created from topologies and run on registered workers. Supports real-time state tracking, node inspection, cloning, audit trail, packet capture, config diff, bulk commands, and interactive terminal with per-node persistence.",
  Workers: "Platform-managed worker agents that run on Docker hosts. Workers register with the platform, send heartbeats, and execute containerlab operations. Platform admin access required.",
  WebSocket: "Real-time communication via WebSocket. Subscribe to channels for live lab state changes, node updates, deployment log streaming, and interactive shell sessions. Shell relay also powers ping, traceroute, bulk commands, config diff, and packet capture.",
  "Internal API": "Worker-to-platform communication endpoints. Authenticated via shared secret. Used for worker registration, heartbeats, and reporting lab status, nodes, and deployment logs.",
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
        backgroundColor: hovered ? "#000000" : "transparent",
        color: hovered ? "#79f673" : "#000000",
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
        color: "#000000",
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
        border: "1px solid #000000",
        fontSize: "0.7rem",
        fontWeight: 700,
        cursor: "pointer",
        gap: "0.4rem",
        backgroundColor: "rgba(0,0,0,0.1)",
        transition: "all 0.2s",
        textTransform: "uppercase",
        fontFamily: "'Manrope', -apple-system, sans-serif",
        transform: hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "2px 2px 0 #000000" : "none",
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
        border: "1px solid #000000",
        backgroundColor: "#000000",
        color: "#79f673",
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
        backgroundColor: "rgba(0,0,0,0.5)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#79f673",
          border: "1px solid #000000",
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
              color: "#000000",
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
              border: "1px solid #000000",
              backgroundColor: "rgba(0,0,0,0.05)",
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
            backgroundColor: "rgba(0,0,0,0.1)",
            border: "1px solid #000000",
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
    border: "1px solid #000000",
    borderRadius: "4px",
    verticalAlign: "middle",
    marginRight: "0.5rem",
    backgroundColor: methodColors[method] || "#79f673",
    color: (method === "WS" || method === "POST") ? "#79f673" : "#000000",
    fontWeight: 700,
    display: "inline-block",
  };
}

const ORG_SCOPED_PATHS = ["/api/v1/collections", "/api/v1/topologies", "/api/v1/labs", "/api/v1/workers"];

function getCurlExample(ep: Endpoint): React.ReactNode {
  const needsOrgHeader = ORG_SCOPED_PATHS.some((p) => ep.path.startsWith(p));
  const c = "rgba(121,246,115,0.4)";
  return (
    <>
      <span style={{ color: "rgba(121,246,115,0.5)" }}>curl</span> -X {ep.method}{" "}
      <span style={{ color: c }}>
        &quot;http://localhost:8080{ep.path}&quot;
      </span>{" "}
      \<br />
      {ep.auth && (
        <>
          &nbsp;&nbsp;-H{" "}
          <span style={{ color: c }}>
            &quot;Authorization: Bearer YOUR_TOKEN&quot;
          </span>{" "}
          \<br />
        </>
      )}
      {needsOrgHeader && (
        <>
          &nbsp;&nbsp;-H{" "}
          <span style={{ color: c }}>
            &quot;X-Org-ID: YOUR_ORG_UUID&quot;
          </span>{" "}
          \<br />
        </>
      )}
      &nbsp;&nbsp;-H{" "}
      <span style={{ color: c }}>
        &quot;Content-Type: application/json&quot;
      </span>
    </>
  );
}

function getResponseExample(section: string): React.ReactNode {
  const k = "rgba(121,246,115,0.5)";
  const v = "rgba(121,246,115,0.35)";
  const comment = "rgba(255,255,255,0.4)";

  if (section === "Authentication") {
    return (
      <>
        {"{"}<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;access_token&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;eyJhbGciOi...&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;refresh_token&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;dGhpcyBpcy...&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;token_type&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;Bearer&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;expires_in&quot;</span>:{" "}
        <span style={{ color: v }}>1800</span><br />
        {"}"}
      </>
    );
  }
  if (section === "Organizations") {
    return (
      <>
        {"{"}<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;uuid&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;org_a1b2c3d4...&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;name&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;Acme Networks&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;slug&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;acme-networks&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;plan&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;free&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;maxLabs&quot;</span>:{" "}
        <span style={{ color: v }}>10</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;maxWorkers&quot;</span>:{" "}
        <span style={{ color: v }}>5</span><br />
        {"}"}
      </>
    );
  }
  if (section === "Labs") {
    return (
      <>
        {"{"}<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;data&quot;</span>: [{"{"}<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;uuid&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;lab_44210...&quot;</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;name&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;OSPF-Lab-01&quot;</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;state&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;running&quot;</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;nodes&quot;</span>: [{"{"}<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;name&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;clab-ospf-r1&quot;</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;state&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;running&quot;</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;ipv4&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;172.20.20.2&quot;</span><br />
        &nbsp;&nbsp;&nbsp;&nbsp;{"}"}]<br />
        &nbsp;&nbsp;{"}"}],<br />
        &nbsp;&nbsp;<span style={{ color: comment, fontStyle: "italic" }}>{"// Pagination"}</span><br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;total&quot;</span>:{" "}
        <span style={{ color: v }}>8</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;limit&quot;</span>:{" "}
        <span style={{ color: v }}>20</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;offset&quot;</span>:{" "}
        <span style={{ color: v }}>0</span><br />
        {"}"}
      </>
    );
  }
  if (section === "WebSocket") {
    return (
      <>
        <span style={{ color: comment, fontStyle: "italic" }}>{"// Subscribe to a channel"}</span><br />
        {"{"}<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;type&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;subscribe&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;channel&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;lab:abc-123:nodes&quot;</span><br />
        {"}"}<br /><br />
        <span style={{ color: comment, fontStyle: "italic" }}>{"// Incoming message"}</span><br />
        {"{"}<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;channel&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;lab:abc-123:nodes&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;data&quot;</span>: [{"{"}<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;name&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;clab-ospf-r1&quot;</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;state&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;running&quot;</span><br />
        &nbsp;&nbsp;{"}"}]<br />
        {"}"}
      </>
    );
  }
  if (section === "Internal API") {
    return (
      <>
        <span style={{ color: comment, fontStyle: "italic" }}>{"// Worker → Platform heartbeat"}</span><br />
        {"{"}<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;workerUuid&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;wrk_55f1...&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;activeLabs&quot;</span>:{" "}
        <span style={{ color: v }}>3</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;capacity&quot;</span>:{" "}
        <span style={{ color: v }}>10</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;uptime&quot;</span>:{" "}
        <span style={{ color: v }}>86400</span><br />
        {"}"}
      </>
    );
  }
  if (section === "Users") {
    return (
      <>
        {"{"}<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;uuid&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;usr_e4f5a6...&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;email&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;admin@labbed.local&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;displayName&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;Admin&quot;</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;isAdmin&quot;</span>:{" "}
        <span style={{ color: v }}>true</span>,<br />
        &nbsp;&nbsp;<span style={{ color: k }}>&quot;organizations&quot;</span>: [{"{"}<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;uuid&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;org_a1b2...&quot;</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;name&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;Default&quot;</span>,<br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;role&quot;</span>:{" "}
        <span style={{ color: v }}>&quot;owner&quot;</span><br />
        &nbsp;&nbsp;{"}"}]<br />
        {"}"}
      </>
    );
  }
  // Default response for Topologies, Collections, Workers
  return (
    <>
      {"{"}<br />
      &nbsp;&nbsp;<span style={{ color: k }}>&quot;data&quot;</span>: [<br />
      &nbsp;&nbsp;&nbsp;&nbsp;{"{"}<br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;uuid&quot;</span>:{" "}
      <span style={{ color: v }}>&quot;top_99821...&quot;</span>,<br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;name&quot;</span>:{" "}
      <span style={{ color: v }}>&quot;BGP-Core-Mesh&quot;</span>,<br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: k }}>&quot;createdAt&quot;</span>:{" "}
      <span style={{ color: v }}>&quot;2026-03-12T...&quot;</span><br />
      &nbsp;&nbsp;&nbsp;&nbsp;{"}"}<br />
      &nbsp;&nbsp;],<br />
      &nbsp;&nbsp;<span style={{ color: comment, fontStyle: "italic" }}>{"// Pagination"}</span><br />
      &nbsp;&nbsp;<span style={{ color: k }}>&quot;total&quot;</span>:{" "}
      <span style={{ color: v }}>42</span>,<br />
      &nbsp;&nbsp;<span style={{ color: k }}>&quot;limit&quot;</span>:{" "}
      <span style={{ color: v }}>20</span>,<br />
      &nbsp;&nbsp;<span style={{ color: k }}>&quot;offset&quot;</span>:{" "}
      <span style={{ color: v }}>0</span><br />
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
        backgroundColor: "#79f673",
        color: "#000000",
        fontFamily: "'Manrope', -apple-system, sans-serif",
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden",
      }}
    >
      {/* Left sidebar - 48px */}
      <aside
        style={{
          width: "48px",
          borderRight: "1px solid #000000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "1rem 0",
          flexShrink: 0,
          backgroundColor: "#79f673",
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
              backgroundColor: "#000000",
              width: "100%",
            }}
          />
          <span
            style={{
              display: "block",
              height: "1px",
              backgroundColor: "#000000",
              width: "100%",
            }}
          />
          <span
            style={{
              display: "block",
              height: "1px",
              backgroundColor: "#000000",
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
            borderBottom: "1px solid #000000",
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
                borderRight: "1px solid #000000",
                fontSize: "0.85rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 800,
                cursor: "pointer",
                textDecoration: "none",
                color: "#000000",
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
                borderRight: "1px solid #000000",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "none",
                color: "#000000",
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
                borderRight: "1px solid #000000",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "none",
                color: "#000000",
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
              color: "#000000",
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
                borderLeft: "1px solid #000000",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "none",
                color: "#000000",
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
              borderRight: "1px solid #000000",
              padding: "2rem",
              overflowY: "auto",
            }}
          >
            {Object.entries(sidebarNavGroups).map(([group, links]) => (
              <div key={group} style={{ marginBottom: "2.5rem" }}>
                <div
                  style={{
                    marginBottom: "1rem",
                    color: "#000000",
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
              borderRight: "1px solid #000000",
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
                  color: "#000000",
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
                {sectionDescriptions[activeSection] || "Manage your network lab environments programmatically."}
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
              backgroundColor: "rgba(0,0,0,0.05)",
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
                border: "1px solid #000000",
                padding: "1.5rem",
                backgroundColor: "#79f673",
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
