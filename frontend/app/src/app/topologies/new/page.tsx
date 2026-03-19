"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type {
  NosImageResponse,
  CollectionResponse,
  TopologyResponse,
  CreateTopologyRequest,
  BindFileResponse,
} from "@/types/api";
import type { DefaultBindFile } from "@/lib/yaml-generator";
import TopologyBuilder from "@/components/topology/TopologyBuilder";

export default function NewTopologyPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [nosImages, setNosImages] = useState<NosImageResponse[]>([]);
  const [collections, setCollections] = useState<CollectionResponse[]>([]);
  const [loading, setLoading] = useState(true);

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
    const req: CreateTopologyRequest = {
      name,
      definition: yaml,
      collectionId,
    };
    const created = await api.post<TopologyResponse>("/api/v1/topologies", req);

    // Create default bind files for NOS-specific nodes
    for (const bf of bindFiles) {
      await api.post<BindFileResponse>(
        `/api/v1/topologies/${created.uuid}/files`,
        { filePath: bf.filePath, content: bf.content, nosKind: bf.nosKind },
      );
    }

    router.push(`/topologies/${created.uuid}`);
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
            <Link href="/topologies" style={navItemStyle}>Topologies</Link>
            <span style={{ ...navItemStyle, opacity: 0.5, cursor: "default" }}>New Topology</span>
          </div>
          <div style={{ display: "flex", height: "100%" }}>
            <span style={{ ...navItemStyle, borderLeft: "1px solid #000000" }}>{user?.displayName || user?.email || ""}</span>
            <button onClick={() => logout?.()} style={{ ...navItemStyle, background: "none", border: "none", borderLeft: "1px solid #000000" }}>Logout</button>
          </div>
        </nav>

        {/* Builder */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <span style={{ ...labelStyle, opacity: 0.4 }}>LOADING...</span>
            </div>
          ) : (
            <TopologyBuilder
              nosImages={nosImages}
              collections={collections}
              onSave={handleSave}
            />
          )}
        </div>
      </div>
    </div>
  );
}
