"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type {
  NosImageResponse,
  CollectionResponse,
  TemplateResponse,
  CreateTemplateRequest,
  BindFileResponse,
} from "@/types/api";
import type { DefaultBindFile } from "@/lib/yaml-generator";
import TopologyBuilder from "@/components/template/TopologyBuilder";

export default function NewTopologyPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [nosImages, setNosImages] = useState<NosImageResponse[]>([]);
  const [collections, setCollections] = useState<CollectionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateType, setTemplateType] = useState<"network" | "cloud">("network");
  const [cloudName, setCloudName] = useState("");
  const [cloudCollectionId, setCloudCollectionId] = useState("");
  const [cloudHcl, setCloudHcl] = useState("");
  const [cloudSaving, setCloudSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    Promise.all([
      api.get<NosImageResponse[]>("/api/v1/nos-images").catch(() => []),
      api.get<CollectionResponse[]>("/api/v1/collections").catch(() => []),
    ]).then(([images, cols]) => {
      setNosImages(images);
      setCollections(cols);
      setLoading(false);
    });
  }, [user, authLoading, router]);

  const handleSave = async (name: string, yaml: string, collectionId: string, bindFiles: DefaultBindFile[]) => {
    const req: CreateTemplateRequest = { name, type: "network", definition: yaml, collectionId };
    const created = await api.post<TemplateResponse>("/api/v1/templates", req);

    for (const bf of bindFiles) {
      await api.post<BindFileResponse>(
        `/api/v1/templates/${created.uuid}/files`,
        { filePath: bf.filePath, content: bf.content, nosKind: bf.nosKind },
      );
    }

    router.push(`/templates/${created.uuid}`);
  };

  const handleCloudSave = async () => {
    if (!cloudName.trim() || !cloudCollectionId || !cloudHcl.trim()) return;
    setCloudSaving(true);
    try {
      const req: CreateTemplateRequest = { name: cloudName, type: "cloud", definition: cloudHcl, collectionId: cloudCollectionId };
      const created = await api.post<TemplateResponse>("/api/v1/templates", req);
      router.push(`/templates/${created.uuid}`);
    } finally {
      setCloudSaving(false);
    }
  };

  const navItemStyle: React.CSSProperties = {
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
    transition: "background 0.15s, color 0.15s",
    fontFamily: "'Manrope', sans-serif",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    fontWeight: 700,
    letterSpacing: "0.05em",
    fontFamily: "'Manrope', sans-serif",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#79f673", color: "#000000", fontFamily: "'Manrope', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: "48px",
        borderRight: "1px solid #000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1rem 0",
        flexShrink: 0,
        backgroundColor: "#79f673",
        zIndex: 10,
      }}>
        <div style={{ width: "24px", height: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: "2rem", cursor: "pointer" }}>
          <span style={{ display: "block", height: "1px", backgroundColor: "#000000", width: "100%" }} />
          <span style={{ display: "block", height: "1px", backgroundColor: "#000000", width: "100%" }} />
          <span style={{ display: "block", height: "1px", backgroundColor: "#000000", width: "100%" }} />
        </div>
        <div style={{ writingMode: "vertical-rl", transform: "scale(-1)", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", gap: "1rem", display: "flex", marginTop: "auto", marginBottom: "2rem" }}>
          <span style={{ opacity: 0.5 }}>CLI</span>
          <span style={{ opacity: 0.5 }}>GUI</span>
          <span style={{ opacity: 0.5 }}>API</span>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Nav */}
        <nav style={{ height: "48px", borderBottom: "1px solid #000000", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", height: "100%" }}>
            <Link href="/" style={{ ...navItemStyle, fontWeight: 800, fontSize: "0.85rem" }}>LABBED</Link>
            <Link href="/" style={navItemStyle}>Dashboard</Link>
            <Link href="/collections" style={navItemStyle}>Collections</Link>
            <Link href="/templates" style={navItemStyle}>Templates</Link>
            <span style={{ ...navItemStyle, opacity: 0.5, cursor: "default" }}>New Template</span>
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            <span style={{ ...navItemStyle, borderLeft: "1px solid #000000" }}>{user?.displayName || user?.email || ""}</span>
            <button onClick={() => logout?.()} style={{ ...navItemStyle, background: "none", border: "none", borderLeft: "1px solid #000000" }}>Logout</button>
          </div>
        </nav>

        {/* Type toggle */}
        <div style={{ borderBottom: "1px solid #000000", padding: "0.75rem 2rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ ...labelStyle, opacity: 0.5, marginRight: "0.5rem" }}>TYPE:</span>
          {(["network", "cloud"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTemplateType(t)}
              style={{
                padding: "0.4rem 1rem",
                borderRadius: "99px",
                border: "1px solid #000000",
                background: templateType === t ? "#000000" : "transparent",
                color: templateType === t ? "#79f673" : "#000000",
                fontSize: "0.7rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Builder */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <span style={{ ...labelStyle, opacity: 0.4 }}>LOADING...</span>
            </div>
          ) : templateType === "network" ? (
            <TopologyBuilder
              nosImages={nosImages}
              collections={collections}
              onSave={handleSave}
            />
          ) : (
            <div style={{ padding: "2.5rem 3rem", maxWidth: 900 }}>
              <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 200, fontSize: "2rem", marginBottom: "1.5rem" }}>
                New Cloud Template
              </h2>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>NAME</label>
                <input
                  value={cloudName}
                  onChange={(e) => setCloudName(e.target.value)}
                  placeholder="VPC Basics"
                  style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #000000", padding: "0.5rem 0", fontSize: "1rem", fontFamily: "'Manrope', sans-serif", outline: "none", color: "#000000" }}
                />
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>COLLECTION</label>
                <select
                  value={cloudCollectionId}
                  onChange={(e) => setCloudCollectionId(e.target.value)}
                  style={{ width: "100%", background: "transparent", border: "1px solid #000000", padding: "0.5rem", fontSize: "0.85rem", fontFamily: "'Manrope', sans-serif", outline: "none", color: "#000000" }}
                >
                  <option value="">Select collection...</option>
                  {collections.map((c) => (
                    <option key={c.uuid} value={c.uuid}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ ...labelStyle, display: "block", marginBottom: "0.4rem" }}>TERRAFORM HCL</label>
                <textarea
                  value={cloudHcl}
                  onChange={(e) => setCloudHcl(e.target.value)}
                  placeholder={`resource "aws_vpc" "main" {\n  cidr_block = "10.0.0.0/16"\n}`}
                  style={{
                    width: "100%",
                    minHeight: 400,
                    background: "transparent",
                    border: "1px solid #000000",
                    padding: "1rem",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.8rem",
                    lineHeight: 1.5,
                    outline: "none",
                    resize: "vertical",
                    color: "#000000",
                  }}
                  spellCheck={false}
                />
              </div>
              <button
                onClick={handleCloudSave}
                disabled={cloudSaving || !cloudName.trim() || !cloudCollectionId || !cloudHcl.trim()}
                style={{
                  padding: "0.6rem 1.5rem",
                  borderRadius: "99px",
                  border: "1px solid #000000",
                  background: "#000000",
                  color: "#79f673",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  fontFamily: "'Manrope', sans-serif",
                  opacity: (!cloudName.trim() || !cloudCollectionId || !cloudHcl.trim()) ? 0.4 : 1,
                }}
              >
                {cloudSaving ? "Saving..." : "Create Cloud Template"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
