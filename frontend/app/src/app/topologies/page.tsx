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
import type {
  TopologyResponse,
  CollectionResponse,
  CreateTopologyRequest,
} from "@/types/api";

export default function TopologiesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [topologies, setTopologies] = useState<TopologyResponse[]>([]);
  const [collections, setCollections] = useState<CollectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("");

  // create form state
  const [newName, setNewName] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const [newDef, setNewDef] = useState(
    'name: my-lab\ntopology:\n  nodes:\n    router1:\n      kind: linux\n      image: quay.io/frrouting/frr:10.3.1\n  links:\n'
  );
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    Promise.all([
      api.get<TopologyResponse[]>("/api/v1/topologies").catch(() => []),
      api.get<CollectionResponse[]>("/api/v1/collections").catch(() => []),
    ]).then(([t, c]) => {
      setTopologies(t);
      setCollections(c);
      if (c.length > 0) setNewCollection(c[0].uuid);
      setLoading(false);
    });
  }, [user, authLoading, router]);

  const filtered = filter
    ? topologies.filter((t) => t.collectionId === filter)
    : topologies;

  const collectionName = (id: string) =>
    collections.find((c) => c.uuid === id)?.name || id.slice(0, 8);

  const nodeCount = (def: string) => {
    const m = def.match(/^\s{4}\S+:/gm);
    return m ? m.length : 0;
  };

  async function handleCreate() {
    if (!newName.trim() || !newCollection) return;
    setCreating(true);
    try {
      const req: CreateTopologyRequest = {
        name: newName,
        definition: newDef,
        collectionId: newCollection,
      };
      const created = await api.post<TopologyResponse>(
        "/api/v1/topologies",
        req
      );
      setTopologies((prev) => [created, ...prev]);
      setShowCreate(false);
      setNewName("");
    } catch {
      // handle error
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
            { label: "(Collections)", href: "/collections" },
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
            TOPOLOGY
            <br />
            LIBRARY
          </h1>
          <div style={{ marginTop: "4vw", maxWidth: "40vw" }}>
            <p className="label">02 / TEMPLATES</p>
            <p className="footnote" style={{ marginTop: "1vw" }}>
              Browse, create, and edit network topology definitions. Each
              topology is a containerlab YAML template with optional bind files.
            </p>
          </div>
        </Cell>
        <Cell
          style={{
            background:
              "linear-gradient(180deg, #2b9d88 0%, #c1755f 40%, #f6539f 75%, #ffffff 100%)",
          }}
        />

        {/* Filter bar */}
        <div
          style={{
            gridColumn: "span 4",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "1px",
            backgroundColor: "#0A0A0A",
          }}
        >
          <Cell span={2} style={{ padding: "1rem 1.5rem", flexDirection: "row", alignItems: "center", gap: "1rem" }}>
            <span className="label" style={{ fontSize: "0.65rem", whiteSpace: "nowrap" }}>
              COLLECTION:
            </span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                background: "transparent",
                border: "1px solid #0A0A0A",
                padding: "0.3rem 0.5rem",
                fontFamily: "inherit",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <option value="">ALL</option>
              {collections.map((c) => (
                <option key={c.uuid} value={c.uuid}>
                  {c.name}
                </option>
              ))}
            </select>
          </Cell>
          <Cell style={{ padding: "1rem 1.5rem" }} />
          <Cell style={{ padding: "1rem 1.5rem" }}>
            <ArrowButton
              label="+ New Topology"
              onClick={() => setShowCreate(true)}
            />
          </Cell>
        </div>

        {/* Table */}
        {loading ? (
          <Cell span={4} style={{ padding: "3rem", alignItems: "center" }}>
            <span className="label" style={{ opacity: 0.4 }}>
              LOADING...
            </span>
          </Cell>
        ) : (
          <MatrixTable
            headers={["NAME", "COLLECTION", "NODES", "UPDATED", "→"]}
            columnTemplate="2fr 1fr 0.5fr 1fr 0.3fr"
            rows={filtered.map((t) => [
              <span key="n" style={{ fontWeight: 500 }}>{t.name}</span>,
              <span key="c" className="mono" style={{ fontSize: "0.75rem" }}>
                {collectionName(t.collectionId)}
              </span>,
              <span key="nc">{nodeCount(t.definition)}</span>,
              <span key="u" className="mono" style={{ fontSize: "0.7rem", opacity: 0.5 }}>
                {new Date(t.updatedAt).toLocaleDateString()}
              </span>,
              <span key="a" style={{ fontSize: "1.2rem" }}>→</span>,
            ])}
            onRowClick={(i) => router.push(`/topologies/${filtered[i].uuid}`)}
          />
        )}

        <Footer />
      </SchematicGrid>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="NEW TOPOLOGY"
      >
        <SchematicInput
          label="TOPOLOGY_NAME"
          placeholder="BGP-TRIANGLE-LAB"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <div style={{ marginBottom: "2rem" }}>
          <span
            className="label"
            style={{ fontSize: "0.7rem", display: "block", marginBottom: "0.3rem" }}
          >
            COLLECTION
          </span>
          <select
            value={newCollection}
            onChange={(e) => setNewCollection(e.target.value)}
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
            {collections.map((c) => (
              <option key={c.uuid} value={c.uuid}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: "2rem" }}>
          <span
            className="label"
            style={{ fontSize: "0.7rem", display: "block", marginBottom: "0.3rem" }}
          >
            DEFINITION (YAML)
          </span>
          <textarea
            value={newDef}
            onChange={(e) => setNewDef(e.target.value)}
            rows={10}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid #0A0A0A",
              padding: "0.8rem",
              fontFamily: "'Courier New', monospace",
              fontSize: "0.8rem",
              outline: "none",
              resize: "vertical",
            }}
          />
        </div>
        <ArrowButton
          label={creating ? "Creating..." : "Create Topology"}
          onClick={handleCreate}
          disabled={creating}
        />
      </Modal>
    </div>
  );
}
