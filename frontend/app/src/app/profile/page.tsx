"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { UserResponse } from "@/types/api";

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    setDisplayName(user.displayName);
  }, [user, authLoading, router]);

  async function handleUpdateProfile() {
    if (!user) return;
    setSaving(true);
    try {
      await api.put<UserResponse>(`/api/v1/users/${user.uuid}`, { displayName });
      setProfileMsg("Profile updated.");
    } catch {
      setProfileMsg("Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!user || !currentPassword || !newPassword) return;
    try {
      await api.put(`/api/v1/users/${user.uuid}/password`, { currentPassword, newPassword });
      setPasswordMsg("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setPasswordMsg("Failed to change password.");
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    fontWeight: 700,
    letterSpacing: "0.05em",
    fontFamily: "'Manrope', sans-serif",
  };

  const pillBtn = (filled?: boolean): React.CSSProperties => ({
    padding: "0.5rem 1.2rem",
    borderRadius: "99px",
    border: "1px solid #121212",
    background: filled ? "#121212" : "transparent",
    color: filled ? "#F3EFE7" : "#121212",
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    cursor: "pointer",
    fontFamily: "'Manrope', sans-serif",
    transition: "transform 0.15s, box-shadow 0.15s",
  });

  const navItemStyle: React.CSSProperties = {
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
    transition: "background 0.15s, color 0.15s",
    fontFamily: "'Manrope', sans-serif",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid #121212",
    padding: "0.5rem 0",
    fontSize: "1rem",
    fontFamily: "'Space Mono', monospace",
    outline: "none",
    color: "#121212",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F3EFE7", color: "#121212", fontFamily: "'Manrope', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: "48px",
        borderRight: "1px solid #121212",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1rem 0",
        flexShrink: 0,
        backgroundColor: "#F3EFE7",
        zIndex: 10,
      }}>
        <div style={{ width: "24px", height: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: "2rem", cursor: "pointer" }}>
          <span style={{ display: "block", height: "1px", backgroundColor: "#121212", width: "100%" }} />
          <span style={{ display: "block", height: "1px", backgroundColor: "#121212", width: "100%" }} />
          <span style={{ display: "block", height: "1px", backgroundColor: "#121212", width: "100%" }} />
        </div>
        <div style={{ writingMode: "vertical-rl", transform: "scale(-1)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", gap: "1rem", display: "flex", marginTop: "auto", marginBottom: "2rem" }}>
          <span style={{ opacity: 0.5 }}>USR</span>
          <span style={{ opacity: 0.5 }}>CFG</span>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Nav */}
        <nav style={{ height: "48px", borderBottom: "1px solid #121212", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", height: "100%" }}>
            <Link href="/" style={{ ...navItemStyle, fontWeight: 800, fontSize: "0.85rem" }}>LABBED</Link>
            <Link href="/" style={navItemStyle}>Dashboard</Link>
            <Link href="/topologies" style={navItemStyle}>Topologies</Link>
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            <span style={{ ...navItemStyle, borderLeft: "1px solid #121212" }}>{user?.displayName || ""}</span>
            <button onClick={() => logout?.()} style={{ ...navItemStyle, background: "none", border: "none", borderLeft: "1px solid #121212" }}>Logout</button>
          </div>
        </nav>

        {/* Content */}
        <div style={{ flexGrow: 1, padding: "3rem 3.5rem" }}>
          {/* Header */}
          <div style={{ marginBottom: "3rem" }}>
            <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              Profile
            </h1>
            <p style={{ ...labelStyle, marginTop: "0.75rem", opacity: 0.5 }}>ACCOUNT SETTINGS</p>
          </div>

          {/* 2-column form */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem" }}>
            {/* Profile section */}
            <div>
              <span style={{ ...labelStyle, opacity: 0.5, display: "block", marginBottom: "1.5rem" }}>PROFILE</span>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>DISPLAY NAME</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>EMAIL</label>
                <input value={user?.email || ""} disabled style={{ ...inputStyle, opacity: 0.4 }} />
              </div>
              {profileMsg && (
                <p style={{ fontSize: "0.8rem", color: "#A8EAB5", marginBottom: "1rem" }}>{profileMsg}</p>
              )}
              <button onClick={handleUpdateProfile} disabled={saving} style={{ ...pillBtn(true), opacity: saving ? 0.5 : 1 }}>
                {saving ? "Saving..." : "Update Profile"}
              </button>
            </div>

            {/* Security section */}
            <div>
              <span style={{ ...labelStyle, opacity: 0.5, display: "block", marginBottom: "1.5rem" }}>SECURITY</span>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>CURRENT PASSWORD</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>NEW PASSWORD</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} />
              </div>
              {passwordMsg && (
                <p style={{ fontSize: "0.8rem", color: "#A8EAB5", marginBottom: "1rem" }}>{passwordMsg}</p>
              )}
              <button onClick={handleChangePassword} style={pillBtn(true)}>Change Password</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
