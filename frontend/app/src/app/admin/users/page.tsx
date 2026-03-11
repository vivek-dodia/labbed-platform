"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SchematicGrid, { Cell } from "@/components/layout/SchematicGrid";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MatrixTable from "@/components/ui/MatrixTable";
import ArrowButton from "@/components/ui/ArrowButton";
import Modal from "@/components/ui/Modal";
import SchematicInput from "@/components/ui/SchematicInput";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { UserResponse } from "@/types/api";

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.isAdmin) { router.push("/"); return; }
    api.get<UserResponse[]>("/api/v1/users")
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  async function handleCreate() {
    if (!email.trim() || !password.trim() || !displayName.trim()) return;
    setCreating(true);
    try {
      const u = await api.post<UserResponse>("/api/v1/users", {
        email, password, displayName, isAdmin,
      });
      setUsers((prev) => [u, ...prev]);
      setShowCreate(false);
      setEmail(""); setPassword(""); setDisplayName("");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(uuid: string) {
    await api.del(`/api/v1/users/${uuid}`);
    setUsers((prev) => prev.filter((u) => u.uuid !== uuid));
  }

  return (
    <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", padding: 1 }}>
      <SchematicGrid>
        <Header
          navItems={[
            { label: "(Dashboard)", href: "/" },
            { label: "(Workers)", href: "/admin/workers" },
          ]}
        />

        <Cell span={3} style={{ padding: "3vw" }}>
          <h1 style={{ fontSize: "5vw", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1.1 }}>
            USER
            <br />
            REGISTRY
          </h1>
          <div style={{ marginTop: "4vw", maxWidth: "40vw" }}>
            <p className="label">SYS / USER MANAGEMENT</p>
            <p className="footnote" style={{ marginTop: "1vw" }}>
              Create, view, and manage platform user accounts.
              Admin users have access to worker fleet and user management.
            </p>
          </div>
        </Cell>
        <Cell style={{ background: "linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)" }} />

        <div style={{ gridColumn: "span 4", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1px", backgroundColor: "#0A0A0A" }}>
          <Cell span={3} style={{ padding: "1rem 1.5rem", flexDirection: "row", alignItems: "center" }}>
            <span className="label" style={{ opacity: 0.5 }}>
              {users.length} USER{users.length !== 1 ? "S" : ""}
            </span>
          </Cell>
          <Cell style={{ padding: "1rem" }}>
            <ArrowButton label="+ Create User" onClick={() => setShowCreate(true)} />
          </Cell>
        </div>

        {loading ? (
          <Cell span={4} style={{ padding: "3rem", alignItems: "center" }}>
            <span className="label" style={{ opacity: 0.4 }}>LOADING...</span>
          </Cell>
        ) : (
          <MatrixTable
            headers={["EMAIL", "DISPLAY NAME", "ROLE", "CREATED", "—"]}
            columnTemplate="2fr 1.5fr 0.6fr 1fr 0.4fr"
            rows={users.map((u) => [
              <span key="e" style={{ fontWeight: 500 }}>{u.email}</span>,
              <span key="n">{u.displayName}</span>,
              <span key="r" className="label" style={{
                fontSize: "0.6rem",
                padding: "0.2rem 0.5rem",
                border: "1px solid #0A0A0A",
                backgroundColor: u.isAdmin ? "#0A0A0A" : "transparent",
                color: u.isAdmin ? "#F2F2F2" : "#0A0A0A",
              }}>
                {u.isAdmin ? "ADMIN" : "MEMBER"}
              </span>,
              <span key="d" className="mono" style={{ fontSize: "0.7rem", opacity: 0.5 }}>
                {new Date(u.createdAt).toLocaleDateString()}
              </span>,
              <button
                key="del"
                onClick={() => handleDelete(u.uuid)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  opacity: 0.3,
                  fontSize: "0.8rem",
                  fontFamily: "inherit",
                }}
              >
                ✕
              </button>,
            ])}
          />
        )}

        <Footer />
      </SchematicGrid>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="CREATE USER">
        <SchematicInput label="EMAIL" type="email" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <SchematicInput label="PASSWORD" type="password" placeholder="min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        <SchematicInput label="DISPLAY_NAME" placeholder="Jane Doe" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "2rem" }}>
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          <span className="label" style={{ fontSize: "0.7rem" }}>ADMIN PRIVILEGES</span>
        </label>
        <ArrowButton label={creating ? "Creating..." : "Create User"} onClick={handleCreate} disabled={creating} />
      </Modal>
    </div>
  );
}
