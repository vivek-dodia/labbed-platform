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
import type { CollectionResponse } from "@/types/api";

export default function CollectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [publicRead, setPublicRead] = useState(false);
  const [publicDeploy, setPublicDeploy] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    api
      .get<CollectionResponse[]>("/api/v1/collections")
      .then(setCollections)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await api.post<CollectionResponse>(
        "/api/v1/collections",
        { name: newName, publicRead, publicDeploy }
      );
      setCollections((prev) => [created, ...prev]);
      setShowCreate(false);
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", padding: 1 }}>
      <SchematicGrid>
        <Header
          navItems={[
            { label: "(Dashboard)", href: "/" },
            { label: "(Topologies)", href: "/topologies" },
          ]}
        />

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
            COLLECTIONS
          </h1>
          <div style={{ marginTop: "4vw", maxWidth: "40vw" }}>
            <p className="label">04 / ORGANIZATION</p>
            <p className="footnote" style={{ marginTop: "1vw" }}>
              Collections group topologies and define access boundaries.
              Control visibility and member roles per collection.
            </p>
          </div>
        </Cell>
        <Cell
          style={{
            background:
              "linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)",
          }}
        />

        {/* Action bar */}
        <div
          style={{
            gridColumn: "span 4",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "1px",
            backgroundColor: "#0A0A0A",
          }}
        >
          <Cell span={3} style={{ padding: "1rem 1.5rem", flexDirection: "row", alignItems: "center" }}>
            <span className="label" style={{ opacity: 0.5 }}>
              {collections.length} COLLECTION{collections.length !== 1 ? "S" : ""}
            </span>
          </Cell>
          <Cell style={{ padding: "1rem" }}>
            <ArrowButton
              label="+ New Collection"
              onClick={() => setShowCreate(true)}
            />
          </Cell>
        </div>

        {loading ? (
          <Cell span={4} style={{ padding: "3rem", alignItems: "center" }}>
            <span className="label" style={{ opacity: 0.4 }}>LOADING...</span>
          </Cell>
        ) : (
          <MatrixTable
            headers={["NAME", "VISIBILITY", "CREATED", "→"]}
            columnTemplate="2fr 1fr 1fr 0.3fr"
            rows={collections.map((c) => [
              <span key="n" style={{ fontWeight: 500 }}>{c.name}</span>,
              <span key="v" className="mono" style={{ fontSize: "0.75rem" }}>
                {c.publicRead ? "PUBLIC" : "PRIVATE"}
                {c.publicDeploy ? " / DEPLOY" : ""}
              </span>,
              <span key="d" className="mono" style={{ fontSize: "0.7rem", opacity: 0.5 }}>
                {new Date(c.createdAt).toLocaleDateString()}
              </span>,
              <span key="a" style={{ fontSize: "1.2rem" }}>→</span>,
            ])}
            onRowClick={(i) =>
              router.push(`/collections/${collections[i].uuid}`)
            }
          />
        )}

        <Footer />
      </SchematicGrid>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="NEW COLLECTION"
      >
        <SchematicInput
          label="COLLECTION_NAME"
          placeholder="my-network-labs"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <div style={{ display: "flex", gap: "2rem", marginBottom: "2rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={publicRead}
              onChange={(e) => setPublicRead(e.target.checked)}
            />
            <span className="label" style={{ fontSize: "0.7rem" }}>
              PUBLIC READ
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={publicDeploy}
              onChange={(e) => setPublicDeploy(e.target.checked)}
            />
            <span className="label" style={{ fontSize: "0.7rem" }}>
              PUBLIC DEPLOY
            </span>
          </label>
        </div>
        <ArrowButton
          label={creating ? "Creating..." : "Create Collection"}
          onClick={handleCreate}
          disabled={creating}
        />
      </Modal>
    </div>
  );
}
