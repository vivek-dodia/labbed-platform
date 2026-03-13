"use client";

import { useEffect, useState, useCallback } from "react";
import EditorialModal from "@/components/ui/EditorialModal";
import { api } from "@/lib/api";
import { parseContainerlabYAML } from "@/lib/yaml-parser";
import type { NosImageResponse } from "@/types/api";

interface DeployConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (nodeImages: Record<string, string>) => void;
  definition: string;
  deploying: boolean;
}

const LABEL: React.CSSProperties = {
  fontSize: "0.65rem",
  textTransform: "uppercase",
  fontWeight: 700,
  letterSpacing: "0.05em",
  fontFamily: "'Manrope', sans-serif",
};

const MONO: React.CSSProperties = {
  fontFamily: "'Space Mono', monospace",
  fontSize: "0.8rem",
};

export default function DeployConfigModal({
  isOpen,
  onClose,
  onDeploy,
  definition,
  deploying,
}: DeployConfigModalProps) {
  const [nosImages, setNosImages] = useState<NosImageResponse[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState(false);

  const parsed = definition ? parseContainerlabYAML(definition) : null;
  const nodes = parsed?.nodes || [];

  useEffect(() => {
    if (!isOpen) return;
    setLoadingImages(true);
    api
      .get<NosImageResponse[]>("/api/v1/nos-images")
      .then(setNosImages)
      .catch(() => setNosImages([]))
      .finally(() => setLoadingImages(false));
    // Reset selections when opening
    setSelections({});
  }, [isOpen]);

  const handleDeploy = useCallback(() => {
    // Only include nodes where user actually selected an override
    const overrides: Record<string, string> = {};
    for (const [nodeName, imageUUID] of Object.entries(selections)) {
      if (imageUUID) {
        overrides[nodeName] = imageUUID;
      }
    }
    onDeploy(overrides);
  }, [selections, onDeploy]);

  return (
    <EditorialModal isOpen={isOpen} onClose={onClose} title="DEPLOY CONFIGURATION">
      <p style={{ ...LABEL, opacity: 0.5, marginBottom: "1.5rem" }}>
        SELECT NOS IMAGE FOR EACH NODE (OPTIONAL)
      </p>

      {loadingImages ? (
        <p style={{ ...LABEL, opacity: 0.4 }}>LOADING IMAGES...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {nodes.map((node) => (
            <div
              key={node.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "0.75rem",
                border: "1px solid rgba(0,0,0,0.15)",
              }}
            >
              <div style={{ flex: "0 0 120px" }}>
                <span style={{ ...MONO, fontWeight: 700 }}>{node.name}</span>
                <div style={{ ...LABEL, fontSize: "0.55rem", opacity: 0.4, marginTop: "0.2rem" }}>
                  {node.image || "no image"}
                </div>
              </div>
              <select
                value={selections[node.name] || ""}
                onChange={(e) =>
                  setSelections((prev) => ({ ...prev, [node.name]: e.target.value }))
                }
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "1px solid #000000",
                  padding: "0.4rem 0.5rem",
                  fontSize: "0.75rem",
                  fontFamily: "'Manrope', sans-serif",
                  cursor: "pointer",
                  outline: "none",
                  color: "#000000",
                }}
              >
                <option value="">Use YAML default</option>
                {nosImages.map((img) => (
                  <option key={img.uuid} value={img.uuid}>
                    {img.name} ({img.dockerImage})
                  </option>
                ))}
              </select>
            </div>
          ))}

          {nodes.length === 0 && (
            <p style={{ ...LABEL, opacity: 0.4 }}>NO NODES FOUND IN TOPOLOGY</p>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
        <button
          onClick={handleDeploy}
          disabled={deploying}
          style={{
            padding: "0.5rem 1.5rem",
            borderRadius: "99px",
            border: "1px solid #000000",
            background: "#000000",
            color: "#79f673",
            fontSize: "0.7rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: deploying ? "wait" : "pointer",
            fontFamily: "'Manrope', sans-serif",
            opacity: deploying ? 0.5 : 1,
          }}
        >
          {deploying ? "DEPLOYING..." : "DEPLOY"}
        </button>
        <button
          onClick={onClose}
          disabled={deploying}
          style={{
            padding: "0.5rem 1.5rem",
            borderRadius: "99px",
            border: "1px solid #000000",
            background: "transparent",
            color: "#000000",
            fontSize: "0.7rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            cursor: "pointer",
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          CANCEL
        </button>
      </div>
    </EditorialModal>
  );
}
