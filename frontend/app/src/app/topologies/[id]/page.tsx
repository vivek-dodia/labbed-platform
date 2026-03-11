"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import SchematicGrid, { Cell } from "@/components/layout/SchematicGrid";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import TopologyCanvas from "@/components/topology/TopologyCanvas";
import PropertiesPanel from "@/components/topology/PropertiesPanel";
import ArrowButton from "@/components/ui/ArrowButton";
import Modal from "@/components/ui/Modal";
import SchematicInput from "@/components/ui/SchematicInput";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { parseContainerlabYAML } from "@/lib/yaml-parser";
import type {
  TopologyResponse,
  BindFileResponse,
  LabResponse,
} from "@/types/api";

export default function TopologyEditorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [topology, setTopology] = useState<TopologyResponse | null>(null);
  const [definition, setDefinition] = useState("");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [showFileEdit, setShowFileEdit] = useState<BindFileResponse | null>(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    api.get<TopologyResponse>(`/api/v1/topologies/${id}`).then((t) => {
      setTopology(t);
      setDefinition(t.definition);
    });
  }, [id, user, authLoading, router]);

  const parsedTopo = definition
    ? parseContainerlabYAML(definition)
    : null;
  const selectedParsed =
    parsedTopo?.nodes.find((n) => n.name === selectedNode) || null;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await api.put<TopologyResponse>(
        `/api/v1/topologies/${id}`,
        { definition }
      );
      setTopology(updated);
    } finally {
      setSaving(false);
    }
  }, [id, definition]);

  const handleDeploy = useCallback(async () => {
    if (!topology) return;
    setDeploying(true);
    try {
      const lab = await api.post<LabResponse>("/api/v1/labs", {
        name: `${topology.name} — deploy`,
        topologyId: topology.uuid,
      });
      router.push(`/labs/${lab.uuid}`);
    } finally {
      setDeploying(false);
    }
  }, [topology, router]);

  const handleAddFile = useCallback(async () => {
    if (!newFilePath.trim()) return;
    const file = await api.post<BindFileResponse>(
      `/api/v1/topologies/${id}/files`,
      { filePath: newFilePath, content: newFileContent }
    );
    setTopology((prev) =>
      prev ? { ...prev, bindFiles: [...prev.bindFiles, file] } : prev
    );
    setShowAddFile(false);
    setNewFilePath("");
    setNewFileContent("");
  }, [id, newFilePath, newFileContent]);

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      await api.del(`/api/v1/topologies/${id}/files/${fileId}`);
      setTopology((prev) =>
        prev
          ? {
              ...prev,
              bindFiles: prev.bindFiles.filter((f) => f.uuid !== fileId),
            }
          : prev
      );
    },
    [id]
  );

  if (!topology) {
    return (
      <div style={{ backgroundColor: "#0A0A0A", minHeight: "100vh", padding: 1 }}>
        <SchematicGrid>
          <Cell span={4} style={{ padding: "3vw", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
            <span className="label" style={{ opacity: 0.4 }}>LOADING TOPOLOGY...</span>
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
            { label: "← Topologies", href: "/topologies" },
            { label: topology.name, href: "#" },
          ]}
        />

        {/* Canvas + Properties */}
        <Cell span={3} style={{ minHeight: 400 }}>
          <TopologyCanvas
            definition={definition}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
          />
        </Cell>
        <Cell style={{ borderLeft: "1px solid #0A0A0A" }}>
          <PropertiesPanel node={selectedParsed} />
        </Cell>

        {/* YAML editor */}
        <Cell span={2} style={{ padding: "1.5rem" }}>
          <span className="label" style={{ fontSize: "0.65rem", marginBottom: "0.5rem", opacity: 0.5 }}>
            DEFINITION (YAML)
          </span>
          <textarea
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            style={{
              width: "100%",
              minHeight: 300,
              background: "transparent",
              border: "1px solid #0A0A0A",
              padding: "1rem",
              fontFamily: "'Courier New', monospace",
              fontSize: "0.8rem",
              lineHeight: 1.5,
              outline: "none",
              resize: "vertical",
              color: "#0A0A0A",
            }}
            spellCheck={false}
          />
        </Cell>

        {/* Bind files */}
        <Cell span={2} style={{ padding: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <span className="label" style={{ fontSize: "0.65rem", opacity: 0.5 }}>
              BIND FILES ({topology.bindFiles.length})
            </span>
            <button
              onClick={() => setShowAddFile(true)}
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
              + ADD FILE
            </button>
          </div>
          {topology.bindFiles.map((f) => (
            <div
              key={f.uuid}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.6rem 0",
                borderBottom: "1px solid rgba(10,10,10,0.1)",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: "0.8rem", cursor: "pointer" }}
                onClick={() => {
                  setShowFileEdit(f);
                  setEditContent("");
                }}
              >
                {f.filePath}
              </span>
              <button
                onClick={() => handleDeleteFile(f.uuid)}
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
              </button>
            </div>
          ))}
          {topology.bindFiles.length === 0 && (
            <p className="footnote" style={{ opacity: 0.3 }}>
              No bind files. Add configuration files for nodes.
            </p>
          )}
        </Cell>

        {/* Actions */}
        <div
          style={{
            gridColumn: "span 4",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1px",
            backgroundColor: "#0A0A0A",
          }}
        >
          <Cell style={{ padding: "1rem" }}>
            <ArrowButton
              label={saving ? "Saving..." : "Save Changes"}
              onClick={handleSave}
              disabled={saving}
            />
          </Cell>
          <Cell style={{ padding: "1rem" }}>
            <ArrowButton
              label={deploying ? "Deploying..." : "Deploy as Lab"}
              onClick={handleDeploy}
              disabled={deploying}
            />
          </Cell>
          <Cell style={{ padding: "1rem" }}>
            <ArrowButton
              label="Export YAML"
              onClick={() => {
                const blob = new Blob([definition], { type: "text/yaml" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${topology.name}.yaml`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            />
          </Cell>
          <Cell style={{ padding: "1rem" }}>
            <ArrowButton
              label="Delete Topology"
              inverted
              onClick={async () => {
                await api.del(`/api/v1/topologies/${id}`);
                router.push("/topologies");
              }}
            />
          </Cell>
        </div>

        <Footer />
      </SchematicGrid>

      {/* Add file modal */}
      <Modal
        open={showAddFile}
        onClose={() => setShowAddFile(false)}
        title="ADD BIND FILE"
      >
        <SchematicInput
          label="FILE_PATH"
          placeholder="/etc/frr/frr.conf"
          value={newFilePath}
          onChange={(e) => setNewFilePath(e.target.value)}
        />
        <div style={{ marginBottom: "2rem" }}>
          <span className="label" style={{ fontSize: "0.7rem", display: "block", marginBottom: "0.3rem" }}>
            CONTENT
          </span>
          <textarea
            value={newFileContent}
            onChange={(e) => setNewFileContent(e.target.value)}
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
        <ArrowButton label="Add File" onClick={handleAddFile} />
      </Modal>

      {/* Edit file modal */}
      <Modal
        open={!!showFileEdit}
        onClose={() => setShowFileEdit(null)}
        title={`EDIT — ${showFileEdit?.filePath || ""}`}
      >
        <div style={{ marginBottom: "2rem" }}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={15}
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
          label="Update File"
          onClick={async () => {
            if (!showFileEdit) return;
            await api.patch(
              `/api/v1/topologies/${id}/files/${showFileEdit.uuid}`,
              { content: editContent }
            );
            setShowFileEdit(null);
          }}
        />
      </Modal>
    </div>
  );
}
