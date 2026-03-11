"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import SchematicGrid, { Cell } from "@/components/layout/SchematicGrid";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MatrixTable from "@/components/ui/MatrixTable";
import ArrowButton from "@/components/ui/ArrowButton";
import Modal from "@/components/ui/Modal";
import SchematicInput from "@/components/ui/SchematicInput";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { CollectionResponse, TopologyResponse } from "@/types/api";

export default function CollectionDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [collection, setCollection] = useState<CollectionResponse | null>(null);
  const [topologies, setTopologies] = useState<TopologyResponse[]>([]);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"editor" | "deployer" | "viewer">("viewer");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    Promise.all([
      api.get<CollectionResponse>(`/api/v1/collections/${id}`),
      api.get<TopologyResponse[]>("/api/v1/topologies").catch(() => []),
    ]).then(([c, t]) => {
      setCollection(c);
      setEditName(c.name);
      setTopologies(t.filter((tp) => tp.collectionId === c.uuid));
    });
  }, [id, user, authLoading, router]);

  async function handleSave() {
    if (!collection) return;
    setSaving(true);
    try {
      const updated = await api.put<CollectionResponse>(
        `/api/v1/collections/${id}`,
        { name: editName }
      );
      setCollection(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(field: "publicRead" | "publicDeploy") {
    if (!collection) return;
    const updated = await api.put<CollectionResponse>(
      `/api/v1/collections/${id}`,
      { [field]: !collection[field] }
    );
    setCollection(updated);
  }

  async function handleAddMember() {
    if (!memberUserId.trim()) return;
    await api.post(`/api/v1/collections/${id}/members`, {
      userId: memberUserId,
      role: memberRole,
    });
    setShowAddMember(false);
    setMemberUserId("");
  }

  async function handleDelete() {
    await api.del(`/api/v1/collections/${id}`);
    router.push("/collections");
  }

  if (!collection) {
    return (
      <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", padding: 1 }}>
        <SchematicGrid>
          <Cell span={4} style={{ padding: "3vw", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
            <span className="label" style={{ opacity: 0.4 }}>LOADING...</span>
          </Cell>
        </SchematicGrid>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", padding: 1 }}>
      <SchematicGrid>
        <Header
          navItems={[
            { label: "← Collections", href: "/collections" },
            { label: collection.name, href: "#" },
          ]}
        />

        {/* Detail */}
        <Cell span={2} style={{ padding: "3vw" }}>
          <span className="label" style={{ fontSize: "0.65rem", opacity: 0.5, marginBottom: "1rem" }}>
            COLLECTION SETTINGS
          </span>
          <SchematicInput
            label="NAME"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <div style={{ display: "flex", gap: "2rem", marginBottom: "2rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={collection.publicRead}
                onChange={() => handleToggle("publicRead")}
              />
              <span className="label" style={{ fontSize: "0.7rem" }}>PUBLIC READ</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={collection.publicDeploy}
                onChange={() => handleToggle("publicDeploy")}
              />
              <span className="label" style={{ fontSize: "0.7rem" }}>PUBLIC DEPLOY</span>
            </label>
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <ArrowButton
              label={saving ? "Saving..." : "Save"}
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 1 }}
            />
            <ArrowButton
              label="Delete"
              inverted
              onClick={handleDelete}
              style={{ flex: 1 }}
            />
          </div>
        </Cell>

        <Cell span={2} style={{ padding: "3vw" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <span className="label" style={{ fontSize: "0.65rem", opacity: 0.5 }}>MEMBERS</span>
            <button
              onClick={() => setShowAddMember(true)}
              className="label"
              style={{
                background: "none",
                border: "1px solid #0A0A0A",
                padding: "0.3rem 0.8rem",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.65rem",
              }}
            >
              + ADD MEMBER
            </button>
          </div>
          <p className="footnote" style={{ opacity: 0.4 }}>
            Member management available via API. Use the Add Member button to
            invite users by UUID.
          </p>
          <div style={{ marginTop: "2rem" }}>
            <span className="mono footnote" style={{ opacity: 0.3 }}>
              UUID: {collection.uuid}
            </span>
          </div>
        </Cell>

        {/* Topologies in collection */}
        {topologies.length > 0 && (
          <MatrixTable
            headers={["TOPOLOGIES IN COLLECTION", "UPDATED", "→"]}
            columnTemplate="2fr 1fr 0.3fr"
            rows={topologies.map((t) => [
              <span key="n" style={{ fontWeight: 500 }}>{t.name}</span>,
              <span key="d" className="mono" style={{ fontSize: "0.7rem", opacity: 0.5 }}>
                {new Date(t.updatedAt).toLocaleDateString()}
              </span>,
              <span key="a" style={{ fontSize: "1.2rem" }}>→</span>,
            ])}
            onRowClick={(i) => router.push(`/topologies/${topologies[i].uuid}`)}
          />
        )}

        <Footer />
      </SchematicGrid>

      <Modal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        title="ADD MEMBER"
      >
        <SchematicInput
          label="USER_UUID"
          placeholder="user-uuid-here"
          value={memberUserId}
          onChange={(e) => setMemberUserId(e.target.value)}
        />
        <div style={{ marginBottom: "2rem" }}>
          <span className="label" style={{ fontSize: "0.7rem", display: "block", marginBottom: "0.3rem" }}>
            ROLE
          </span>
          <select
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value as typeof memberRole)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #0A0A0A",
              padding: "0.5rem 0",
              fontSize: "1.2rem",
              fontFamily: "inherit",
              outline: "none",
            }}
          >
            <option value="viewer">VIEWER</option>
            <option value="deployer">DEPLOYER</option>
            <option value="editor">EDITOR</option>
          </select>
        </div>
        <ArrowButton label="Add Member" onClick={handleAddMember} />
      </Modal>
    </div>
  );
}
