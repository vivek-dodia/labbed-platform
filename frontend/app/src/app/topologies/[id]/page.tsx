"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import TopologyCanvas from "@/components/topology/TopologyCanvas";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { parseContainerlabYAML } from "@/lib/yaml-parser";
import type {
  TopologyResponse,
  BindFileResponse,
  LabResponse,
} from "@/types/api";

export default function TopologyEditorPage() {
  const { user, loading: authLoading, logout } = useAuth();
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

  const parsedTopo = definition ? parseContainerlabYAML(definition) : null;
  const selectedParsed = parsedTopo?.nodes.find((n) => n.name === selectedNode) || null;

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
        name: `${topology.name} -- deploy`,
        topologyId: topology.uuid,
      });
      // Trigger actual deployment to a worker
      await api.post(`/api/v1/labs/${lab.uuid}/deploy`, {});
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
          ? { ...prev, bindFiles: prev.bindFiles.filter((f) => f.uuid !== fileId) }
          : prev
      );
    },
    [id]
  );

  const labelStyle: React.CSSProperties = {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    fontWeight: 700,
    letterSpacing: "0.05em",
    fontFamily: "'Manrope', sans-serif",
  };

  const pillBtn = (variant?: "default" | "orange" | "danger"): React.CSSProperties => ({
    padding: "0.5rem 1.2rem",
    borderRadius: "99px",
    border: "1px solid #121212",
    background: variant === "orange" ? "#ED6A4A" : variant === "danger" ? "#121212" : "transparent",
    color: variant === "danger" ? "#F3EFE7" : "#121212",
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

  if (!topology) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F3EFE7", color: "#121212", fontFamily: "'Manrope', sans-serif", alignItems: "center", justifyContent: "center" }}>
        <span style={{ ...labelStyle, opacity: 0.4 }}>LOADING TOPOLOGY...</span>
      </div>
    );
  }

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
          <span style={{ opacity: 0.5 }}>EDITOR</span>
          <span style={{ opacity: 0.5 }}>YAML</span>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Nav */}
        <nav style={{ height: "48px", borderBottom: "1px solid #121212", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", height: "100%" }}>
            <Link href="/" style={{ ...navItemStyle, fontWeight: 800, fontSize: "0.85rem" }}>LABBED</Link>
            <Link href="/topologies" style={navItemStyle}>Topologies</Link>
            <span style={{ ...navItemStyle, opacity: 0.5, cursor: "default" }}>{topology.name}</span>
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            <span style={{ ...navItemStyle, borderLeft: "1px solid #121212" }}>{user?.displayName || ""}</span>
            <button onClick={() => logout?.()} style={{ ...navItemStyle, background: "none", border: "none", borderLeft: "1px solid #121212" }}>Logout</button>
          </div>
        </nav>

        {/* Content area */}
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
          {/* Header + action pills */}
          <div style={{ padding: "2.5rem 3rem", borderBottom: "1px solid #121212" }}>
            <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "clamp(1.8rem, 4vw, 3.2rem)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              {topology.name}
            </h1>
            <p style={{ ...labelStyle, marginTop: "0.5rem", opacity: 0.5 }}>
              TOPOLOGY EDITOR
            </p>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
              <button onClick={handleSave} disabled={saving} style={pillBtn()}>
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={handleDeploy} disabled={deploying} style={pillBtn("orange")}>
                {deploying ? "Deploying..." : "Deploy as Lab"}
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([definition], { type: "text/yaml" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${topology.name}.yaml`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={pillBtn()}
              >
                Export YAML
              </button>
              <button
                onClick={async () => {
                  await api.del(`/api/v1/topologies/${id}`);
                  router.push("/topologies");
                }}
                style={pillBtn("danger")}
              >
                Delete
              </button>
            </div>
          </div>

          {/* 2-column: canvas+editor | properties */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", flexGrow: 1 }}>
            {/* Left: Canvas + YAML + Bind files */}
            <div style={{ borderRight: "1px solid #121212", display: "flex", flexDirection: "column" }}>
              {/* Canvas */}
              <div style={{ minHeight: 320, borderBottom: "1px solid #121212", position: "relative", overflow: "hidden" }}>
                <TopologyCanvas
                  definition={definition}
                  selectedNode={selectedNode}
                  onSelectNode={setSelectedNode}
                />
              </div>

              {/* YAML editor */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid #121212" }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: "0.5rem", opacity: 0.5 }}>DEFINITION (YAML)</label>
                <textarea
                  value={definition}
                  onChange={(e) => setDefinition(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 280,
                    background: "transparent",
                    border: "1px solid #121212",
                    padding: "1rem",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.8rem",
                    lineHeight: 1.5,
                    outline: "none",
                    resize: "vertical",
                    color: "#121212",
                  }}
                  spellCheck={false}
                />
              </div>

              {/* Bind files */}
              <div style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <span style={{ ...labelStyle, opacity: 0.5 }}>BIND FILES ({topology.bindFiles.length})</span>
                  <button onClick={() => setShowAddFile(true)} style={pillBtn()}>+ Add File</button>
                </div>
                {topology.bindFiles.map((f) => (
                  <div
                    key={f.uuid}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.6rem 0",
                      borderBottom: "1px solid rgba(18,18,18,0.1)",
                    }}
                  >
                    <span
                      style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.8rem", cursor: "pointer" }}
                      onClick={() => { setShowFileEdit(f); setEditContent(""); }}
                    >
                      {f.filePath}
                    </span>
                    <button
                      onClick={() => handleDeleteFile(f.uuid)}
                      style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.3, fontSize: "0.9rem", fontFamily: "inherit" }}
                    >
                      x
                    </button>
                  </div>
                ))}
                {topology.bindFiles.length === 0 && (
                  <p style={{ fontSize: "0.8rem", opacity: 0.3 }}>No bind files. Add configuration files for nodes.</p>
                )}
              </div>
            </div>

            {/* Right: Properties panel */}
            <div style={{ padding: "1.5rem" }}>
              <span style={{ ...labelStyle, opacity: 0.5 }}>PROPERTIES</span>
              {selectedParsed ? (
                <div style={{ marginTop: "1rem" }}>
                  <div style={{ marginBottom: "1.2rem" }}>
                    <span style={{ ...labelStyle, fontSize: "0.6rem", opacity: 0.4 }}>NODE NAME</span>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.9rem", marginTop: "0.25rem" }}>{selectedParsed.name}</p>
                  </div>
                  <div style={{ marginBottom: "1.2rem" }}>
                    <span style={{ ...labelStyle, fontSize: "0.6rem", opacity: 0.4 }}>KIND</span>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.9rem", marginTop: "0.25rem" }}>{selectedParsed.kind || "linux"}</p>
                  </div>
                  <div style={{ marginBottom: "1.2rem" }}>
                    <span style={{ ...labelStyle, fontSize: "0.6rem", opacity: 0.4 }}>IMAGE</span>
                    <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.85rem", marginTop: "0.25rem", wordBreak: "break-all" }}>{selectedParsed.image || "--"}</p>
                  </div>
                  {selectedParsed.interfaces && selectedParsed.interfaces.length > 0 && (
                    <div>
                      <span style={{ ...labelStyle, fontSize: "0.6rem", opacity: 0.4 }}>INTERFACES</span>
                      {selectedParsed.interfaces.map((iface: string, i: number) => (
                        <p key={i} style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.8rem", marginTop: "0.25rem" }}>{iface}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "0.8rem", opacity: 0.3, marginTop: "1rem" }}>Select a node on the canvas to view properties.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add file modal */}
      {showAddFile && (
        <div onClick={() => setShowAddFile(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(18,18,18,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#F3EFE7", border: "1px solid #121212", padding: "2.5rem", maxWidth: "520px", width: "90%" }}>
            <span style={{ ...labelStyle, opacity: 0.5 }}>LABBED -- ADD FILE</span>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "1.8rem", margin: "1rem 0 1.5rem" }}>Add Bind File</h2>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>FILE PATH</label>
              <input
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                placeholder="/etc/frr/frr.conf"
                style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #121212", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Space Mono', monospace", outline: "none", color: "#121212" }}
              />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>CONTENT</label>
              <textarea
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                rows={10}
                style={{ width: "100%", background: "transparent", border: "1px solid #121212", padding: "0.8rem", fontFamily: "'Space Mono', monospace", fontSize: "0.8rem", outline: "none", resize: "vertical", color: "#121212" }}
              />
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={handleAddFile} style={{ ...pillBtn(), backgroundColor: "#121212", color: "#F3EFE7" }}>Add File</button>
              <button onClick={() => setShowAddFile(false)} style={pillBtn()}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit file modal */}
      {showFileEdit && (
        <div onClick={() => setShowFileEdit(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(18,18,18,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#F3EFE7", border: "1px solid #121212", padding: "2.5rem", maxWidth: "520px", width: "90%" }}>
            <span style={{ ...labelStyle, opacity: 0.5 }}>EDIT FILE</span>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "1.5rem", margin: "1rem 0 1.5rem", wordBreak: "break-all" }}>{showFileEdit.filePath}</h2>
            <div style={{ marginBottom: "1.5rem" }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={15}
                style={{ width: "100%", background: "transparent", border: "1px solid #121212", padding: "0.8rem", fontFamily: "'Space Mono', monospace", fontSize: "0.8rem", outline: "none", resize: "vertical", color: "#121212" }}
              />
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                onClick={async () => {
                  if (!showFileEdit) return;
                  await api.patch(`/api/v1/topologies/${id}/files/${showFileEdit.uuid}`, { content: editContent });
                  setShowFileEdit(null);
                }}
                style={{ ...pillBtn(), backgroundColor: "#121212", color: "#F3EFE7" }}
              >
                Update File
              </button>
              <button onClick={() => setShowFileEdit(null)} style={pillBtn()}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
