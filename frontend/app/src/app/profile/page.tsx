"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SchematicGrid, { Cell } from "@/components/layout/SchematicGrid";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SchematicInput from "@/components/ui/SchematicInput";
import ArrowButton from "@/components/ui/ArrowButton";
import CircleVisual from "@/components/ui/CircleVisual";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { UserResponse } from "@/types/api";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
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

  return (
    <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", padding: 1 }}>
      <SchematicGrid>
        <Header navItems={[{ label: "(Dashboard)", href: "/" }, { label: "(Topologies)", href: "/topologies" }]} />

        <Cell span={3} style={{ padding: "3vw" }}>
          <h1 style={{ fontSize: "5vw", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1.1 }}>
            ACCOUNT
            <br />
            PARAMETERS
          </h1>
          <div style={{ marginTop: "4vw", maxWidth: "40vw" }}>
            <p className="label">USR / SETTINGS</p>
          </div>
        </Cell>
        <Cell style={{ background: "linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)" }} />

        {/* Profile */}
        <Cell span={2} style={{ padding: "3vw" }}>
          <CircleVisual size="6vw" />
          <span className="label" style={{ fontSize: "0.65rem", opacity: 0.5, marginBottom: "1.5rem" }}>
            PROFILE
          </span>
          <SchematicInput label="DISPLAY_NAME" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <SchematicInput label="EMAIL" value={user?.email || ""} disabled style={{ opacity: 0.4 }} />
          {profileMsg && <p className="footnote" style={{ marginBottom: "1rem", color: "var(--status-live)" }}>{profileMsg}</p>}
          <ArrowButton label={saving ? "Saving..." : "Update Profile"} onClick={handleUpdateProfile} disabled={saving} />
        </Cell>

        {/* Password */}
        <Cell span={2} style={{ padding: "3vw" }}>
          <span className="label" style={{ fontSize: "0.65rem", opacity: 0.5, marginBottom: "1.5rem" }}>
            SECURITY
          </span>
          <SchematicInput label="CURRENT_PASSWORD" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <SchematicInput label="NEW_PASSWORD" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          {passwordMsg && <p className="footnote" style={{ marginBottom: "1rem", color: "var(--status-live)" }}>{passwordMsg}</p>}
          <ArrowButton label="Change Password" onClick={handleChangePassword} />
        </Cell>

        <Footer />
      </SchematicGrid>
    </div>
  );
}
