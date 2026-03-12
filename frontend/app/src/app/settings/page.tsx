"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";
import type { UserResponse, OrgMemberResponse } from "@/types/api";

const BG = "#79f673";
const INK = "#000000";
const BORDER = "1px solid #000000";
const FONT = "'Manrope', -apple-system, sans-serif";
const MONO = "'Space Mono', monospace";

const LABEL: React.CSSProperties = {
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: BORDER,
  padding: "0.6rem 0",
  fontSize: "0.9rem",
  fontFamily: MONO,
  outline: "none",
  color: INK,
};

const btnFilled: React.CSSProperties = {
  padding: "0.5rem 1.5rem",
  background: INK,
  color: BG,
  border: "none",
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
  fontFamily: FONT,
};

const btnOutline: React.CSSProperties = {
  ...btnFilled,
  background: "transparent",
  color: INK,
  border: BORDER,
};

type Tab = "profile" | "organization" | "security";

export default function SettingsPage() {
  const { user, activeOrg, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push("/login");
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div style={{ backgroundColor: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <span style={{ ...LABEL, opacity: 0.4 }}>LOADING...</span>
      </div>
    );
  }

  return (
    <AppShell navItems={[{ label: "SETTINGS", href: "/settings" }]}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar tabs */}
        <nav style={{ width: 200, minWidth: 200, borderRight: BORDER, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "1.5rem 1.25rem 1rem" }}>
            <span style={{ ...LABEL, opacity: 0.4 }}>SETTINGS</span>
          </div>
          {(["profile", "organization", "security"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                display: "block",
                width: "100%",
                padding: "0.75rem 1.25rem",
                border: "none",
                borderBottom: BORDER,
                background: tab === t ? INK : "transparent",
                color: tab === t ? BG : INK,
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: FONT,
                transition: "all 0.1s",
              }}
            >
              {t}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "2.5rem 3rem" }}>
          {tab === "profile" && <ProfileSection user={user} />}
          {tab === "organization" && <OrgSection orgUUID={activeOrg?.uuid} orgName={activeOrg?.name} orgRole={activeOrg?.role} />}
          {tab === "security" && <SecuritySection userUUID={user.uuid} />}
        </div>
      </div>
    </AppShell>
  );
}

/* ── Profile Section ── */
function ProfileSection({ user }: { user: UserResponse }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await api.put(`/api/v1/users/${user.uuid}`, { displayName });
      setMsg("Profile updated.");
    } catch {
      setMsg("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontWeight: 200, fontSize: "2rem", letterSpacing: "-0.01em", marginBottom: "0.5rem" }}>Profile</h2>
      <p style={{ ...LABEL, opacity: 0.4, marginBottom: "2.5rem" }}>MANAGE YOUR ACCOUNT</p>

      <div style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: "2rem" }}>
          <label style={{ ...LABEL, display: "block", marginBottom: "0.4rem" }}>DISPLAY NAME</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <label style={{ ...LABEL, display: "block", marginBottom: "0.4rem" }}>EMAIL</label>
          <input value={user.email} disabled style={{ ...inputStyle, opacity: 0.4 }} />
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <label style={{ ...LABEL, display: "block", marginBottom: "0.4rem" }}>ROLE</label>
          <span style={{ fontFamily: MONO, fontSize: "0.85rem" }}>{user.isAdmin ? "Administrator" : "Member"}</span>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <label style={{ ...LABEL, display: "block", marginBottom: "0.4rem" }}>MEMBER SINCE</label>
          <span style={{ fontFamily: MONO, fontSize: "0.85rem" }}>{new Date(user.createdAt).toLocaleDateString()}</span>
        </div>

        {msg && <p style={{ fontSize: "0.8rem", opacity: 0.5, marginBottom: "1rem" }}>{msg}</p>}

        <button onClick={handleSave} disabled={saving} style={{ ...btnFilled, opacity: saving ? 0.5 : 1 }}>
          {saving ? "SAVING..." : "SAVE CHANGES"}
        </button>
      </div>
    </div>
  );
}

/* ── Organization Section ── */
function OrgSection({ orgUUID, orgName, orgRole }: { orgUUID?: string; orgName?: string; orgRole?: string }) {
  const [members, setMembers] = useState<OrgMemberResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "member">("member");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!orgUUID) return;
    api
      .get<OrgMemberResponse[]>(`/api/v1/organizations/${orgUUID}/members`)
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [orgUUID]);

  async function handleAddMember() {
    if (!orgUUID || !newEmail.trim()) return;
    setMsg("");
    try {
      await api.post(`/api/v1/organizations/${orgUUID}/members`, { email: newEmail, role: newRole });
      setMsg("Member invited.");
      setNewEmail("");
      // Reload members
      const updated = await api.get<OrgMemberResponse[]>(`/api/v1/organizations/${orgUUID}/members`);
      setMembers(updated);
    } catch {
      setMsg("Failed to add member.");
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!orgUUID) return;
    try {
      await api.del(`/api/v1/organizations/${orgUUID}/members/${userId}`);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch {
      setMsg("Failed to remove member.");
    }
  }

  if (!orgUUID) {
    return (
      <div>
        <h2 style={{ fontWeight: 200, fontSize: "2rem", marginBottom: "1rem" }}>Organization</h2>
        <p style={{ opacity: 0.5 }}>No organization selected.</p>
      </div>
    );
  }

  const isOwnerOrAdmin = orgRole === "owner" || orgRole === "admin";

  return (
    <div>
      <h2 style={{ fontWeight: 200, fontSize: "2rem", letterSpacing: "-0.01em", marginBottom: "0.5rem" }}>Organization</h2>
      <p style={{ ...LABEL, opacity: 0.4, marginBottom: "2.5rem" }}>{orgName?.toUpperCase()}</p>

      {/* Members table */}
      <div style={{ marginBottom: "2.5rem" }}>
        <span style={{ ...LABEL, opacity: 0.5, display: "block", marginBottom: "1rem" }}>MEMBERS</span>

        {loading ? (
          <span style={{ ...LABEL, opacity: 0.3 }}>LOADING...</span>
        ) : members.length === 0 ? (
          <span style={{ opacity: 0.4, fontSize: "0.85rem" }}>No members found.</span>
        ) : (
          <div>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 80px", padding: "0.5rem 0", borderBottom: BORDER, gap: "1rem" }}>
              <span style={LABEL}>NAME</span>
              <span style={LABEL}>EMAIL</span>
              <span style={LABEL}>ROLE</span>
              <span style={{ ...LABEL, textAlign: "right" }}></span>
            </div>
            {members.map((m) => (
              <div key={m.userId} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 80px", padding: "0.6rem 0", borderBottom: BORDER, gap: "1rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{m.name || "\u2014"}</span>
                <span style={{ fontSize: "0.8rem", fontFamily: MONO, opacity: 0.6 }}>{m.email}</span>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.role}</span>
                <div style={{ textAlign: "right" }}>
                  {isOwnerOrAdmin && m.role !== "owner" && (
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      style={{ ...btnOutline, padding: "0.25rem 0.5rem", fontSize: "0.6rem", opacity: 0.5 }}
                    >
                      REMOVE
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add member */}
      {isOwnerOrAdmin && (
        <div style={{ maxWidth: 480 }}>
          <span style={{ ...LABEL, opacity: 0.5, display: "block", marginBottom: "1rem" }}>ADD MEMBER</span>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", marginBottom: "1rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...LABEL, display: "block", marginBottom: "0.4rem" }}>EMAIL</label>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" style={inputStyle} />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ ...LABEL, display: "block", marginBottom: "0.4rem" }}>ROLE</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "admin" | "member")}
                style={{ ...inputStyle, background: BG, cursor: "pointer" }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {msg && <p style={{ fontSize: "0.8rem", opacity: 0.5, marginBottom: "1rem" }}>{msg}</p>}
          <button onClick={handleAddMember} style={btnFilled}>ADD MEMBER</button>
        </div>
      )}
    </div>
  );
}

/* ── Security Section ── */
function SecuritySection({ userUUID }: { userUUID: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleChangePassword() {
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await api.put(`/api/v1/users/${userUUID}/password`, { currentPassword, newPassword });
      setMsg("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setMsg("Failed to change password. Check your current password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontWeight: 200, fontSize: "2rem", letterSpacing: "-0.01em", marginBottom: "0.5rem" }}>Security</h2>
      <p style={{ ...LABEL, opacity: 0.4, marginBottom: "2.5rem" }}>CHANGE YOUR PASSWORD</p>

      <div style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: "2rem" }}>
          <label style={{ ...LABEL, display: "block", marginBottom: "0.4rem" }}>CURRENT PASSWORD</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <label style={{ ...LABEL, display: "block", marginBottom: "0.4rem" }}>NEW PASSWORD</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <label style={{ ...LABEL, display: "block", marginBottom: "0.4rem" }}>CONFIRM NEW PASSWORD</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
        </div>

        {msg && <p style={{ fontSize: "0.8rem", opacity: 0.5, marginBottom: "1rem" }}>{msg}</p>}

        <button onClick={handleChangePassword} disabled={saving} style={{ ...btnFilled, opacity: saving ? 0.5 : 1 }}>
          {saving ? "CHANGING..." : "CHANGE PASSWORD"}
        </button>
      </div>
    </div>
  );
}
