"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import type { CollectionResponse } from "@/types/api";

const FONT = "'Manrope', sans-serif";
const MONO = "'Space Mono', monospace";
const LABEL: React.CSSProperties = { fontSize: "0.65rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", fontFamily: FONT };

/* ── AWS Resource palette ── */
interface ResourceTemplate {
  type: string;
  label: string;
  category: string;
  snippet: (name: string) => string;
  color: string;
}

const RESOURCES: ResourceTemplate[] = [
  {
    type: "aws_vpc", label: "VPC", category: "Core", color: "#0ea5e9",
    snippet: (n) => `resource "aws_vpc" "${n}" {\n  cidr_block           = "10.0.0.0/16"\n  enable_dns_support   = true\n  enable_dns_hostnames = true\n\n  tags = {\n    Name = "${n}"\n  }\n}\n`,
  },
  {
    type: "aws_subnet", label: "Subnet", category: "Core", color: "#22c55e",
    snippet: (n) => `resource "aws_subnet" "${n}" {\n  vpc_id            = aws_vpc.main.id\n  cidr_block        = "10.0.1.0/24"\n  availability_zone = "us-east-1a"\n\n  tags = {\n    Name = "${n}"\n  }\n}\n`,
  },
  {
    type: "aws_internet_gateway", label: "Internet GW", category: "Gateways", color: "#eab308",
    snippet: (n) => `resource "aws_internet_gateway" "${n}" {\n  vpc_id = aws_vpc.main.id\n\n  tags = {\n    Name = "${n}"\n  }\n}\n`,
  },
  {
    type: "aws_nat_gateway", label: "NAT GW", category: "Gateways", color: "#f97316",
    snippet: (n) => `resource "aws_nat_gateway" "${n}" {\n  allocation_id = aws_eip.${n}_eip.id\n  subnet_id     = aws_subnet.public.id\n\n  tags = {\n    Name = "${n}"\n  }\n}\n`,
  },
  {
    type: "aws_eip", label: "Elastic IP", category: "Gateways", color: "#f97316",
    snippet: (n) => `resource "aws_eip" "${n}" {\n  domain = "vpc"\n\n  tags = {\n    Name = "${n}"\n  }\n}\n`,
  },
  {
    type: "aws_route_table", label: "Route Table", category: "Routing", color: "#a855f7",
    snippet: (n) => `resource "aws_route_table" "${n}" {\n  vpc_id = aws_vpc.main.id\n\n  route {\n    cidr_block = "0.0.0.0/0"\n    gateway_id = aws_internet_gateway.gw.id\n  }\n\n  tags = {\n    Name = "${n}"\n  }\n}\n`,
  },
  {
    type: "aws_route_table_association", label: "RT Association", category: "Routing", color: "#8b5cf6",
    snippet: (n) => `resource "aws_route_table_association" "${n}" {\n  subnet_id      = aws_subnet.public.id\n  route_table_id = aws_route_table.public.id\n}\n`,
  },
  {
    type: "aws_security_group", label: "Security Group", category: "Security", color: "#ec4899",
    snippet: (n) => `resource "aws_security_group" "${n}" {\n  name        = "${n}-sg"\n  description = "${n} security group"\n  vpc_id      = aws_vpc.main.id\n\n  ingress {\n    from_port   = 80\n    to_port     = 80\n    protocol    = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n\n  egress {\n    from_port   = 0\n    to_port     = 0\n    protocol    = "-1"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n\n  tags = {\n    Name = "${n}-sg"\n  }\n}\n`,
  },
  {
    type: "aws_vpc_peering_connection", label: "VPC Peering", category: "Connectivity", color: "#38bdf8",
    snippet: (n) => `resource "aws_vpc_peering_connection" "${n}" {\n  vpc_id      = aws_vpc.vpc_a.id\n  peer_vpc_id = aws_vpc.vpc_b.id\n  auto_accept = true\n\n  tags = {\n    Name = "${n}"\n  }\n}\n`,
  },
];

const CATEGORIES = [...new Set(RESOURCES.map((r) => r.category))];

/* ── Parse HCL for resource names ── */
function parseHclResources(hcl: string): { type: string; name: string }[] {
  const regex = /resource\s+"(\w+)"\s+"(\w+)"/g;
  const results: { type: string; name: string }[] = [];
  let m;
  while ((m = regex.exec(hcl)) !== null) {
    results.push({ type: m[1], name: m[2] });
  }
  return results;
}

/* ── Props ── */
interface Props {
  collections: CollectionResponse[];
  onSave: (name: string, hcl: string, collectionId: string) => Promise<void>;
}

export default function CloudTemplateBuilder({ collections, onSave }: Props) {
  const [hcl, setHcl] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [collectionId, setCollectionId] = useState(collections[0]?.uuid || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inserted, setInserted] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameCounters = useRef<Record<string, number>>({});

  const parsedResources = useMemo(() => parseHclResources(hcl), [hcl]);
  const lineCount = hcl.split("\n").length;

  const handleInsertResource = useCallback((res: ResourceTemplate) => {
    const count = (nameCounters.current[res.type] || 0) + 1;
    nameCounters.current[res.type] = count;
    // Auto-name: first one gets a clean name, subsequent ones get numbered
    const baseName = res.type.replace("aws_", "").replace(/_/g, "_");
    const name = count === 1
      ? (res.type === "aws_vpc" ? "main" : res.type === "aws_internet_gateway" ? "gw" : baseName)
      : `${baseName}_${count}`;

    const snippet = "\n" + res.snippet(name);
    const ta = textareaRef.current;
    if (ta) {
      const pos = ta.selectionStart;
      const before = hcl.slice(0, pos);
      const after = hcl.slice(pos);
      setHcl(before + snippet + after);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + snippet.length; ta.focus(); });
    } else {
      setHcl((prev) => prev + snippet);
    }
    setInserted(res.type);
    setTimeout(() => setInserted(null), 800);
    setError(null);
  }, [hcl]);

  // Reference inserter: adds a reference line at cursor
  const [refSource, setRefSource] = useState("");
  const [refAttr, setRefAttr] = useState("vpc_id");

  const handleInsertRef = useCallback(() => {
    if (!refSource) return;
    const snippet = `  ${refAttr} = ${refSource}.id\n`;
    const ta = textareaRef.current;
    if (ta) {
      const pos = ta.selectionStart;
      setHcl(hcl.slice(0, pos) + snippet + hcl.slice(pos));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + snippet.length; ta.focus(); });
    } else {
      setHcl((prev) => prev + snippet);
    }
    setError(null);
  }, [refSource, refAttr, hcl]);

  const handleSave = useCallback(async () => {
    if (!templateName.trim()) { setError("Template name required"); return; }
    if (!collectionId) { setError("Select a collection"); return; }
    if (!hcl.trim()) { setError("HCL is empty"); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(templateName, hcl, collectionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }, [templateName, collectionId, hcl, onSave]);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      {/* Left — Resource Palette */}
      <div style={{ width: 220, borderRight: "1px solid #000", overflow: "auto", padding: "1rem", flexShrink: 0 }}>
        <span style={{ ...LABEL, opacity: 0.5, display: "block", marginBottom: "0.5rem" }}>AWS RESOURCES</span>
        <span style={{ fontSize: "0.6rem", opacity: 0.35, fontFamily: MONO, display: "block", marginBottom: "1rem" }}>
          click to insert block
        </span>

        {CATEGORIES.map((cat) => (
          <div key={cat} style={{ marginBottom: "1.25rem" }}>
            <span style={{ ...LABEL, fontSize: "0.6rem", opacity: 0.4, display: "block", marginBottom: "0.4rem" }}>{cat.toUpperCase()}</span>
            {RESOURCES.filter((r) => r.category === cat).map((res) => (
              <div key={res.type} onClick={() => handleInsertResource(res)}
                style={{
                  padding: "0.4rem 0.6rem", border: "1px solid rgba(0,0,0,0.15)", marginBottom: "0.3rem",
                  cursor: "pointer", transition: "background 0.1s",
                  background: inserted === res.type ? "rgba(0,0,0,0.1)" : "transparent",
                }}
                onMouseEnter={(e) => { if (inserted !== res.type) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={(e) => { if (inserted !== res.type) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.5rem", fontWeight: 800, color: "#000", background: res.color, padding: "1px 4px", fontFamily: MONO, lineHeight: 1.3 }}>
                    {res.type.replace("aws_", "").slice(0, 3).toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase" }}>
                    {inserted === res.type ? "INSERTED!" : res.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Reference inserter */}
        {parsedResources.length >= 2 && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.15)", paddingTop: "1rem" }}>
            <span style={{ ...LABEL, opacity: 0.5, display: "block", marginBottom: "0.4rem" }}>ADD REFERENCE</span>
            <select value={refAttr} onChange={(e) => setRefAttr(e.target.value)}
              style={{ width: "100%", fontSize: "0.6rem", fontFamily: MONO, padding: "0.25rem", border: "1px solid rgba(0,0,0,0.2)", background: "transparent", marginBottom: "0.3rem" }}>
              <option value="vpc_id">vpc_id</option>
              <option value="subnet_id">subnet_id</option>
              <option value="gateway_id">gateway_id</option>
              <option value="route_table_id">route_table_id</option>
              <option value="allocation_id">allocation_id</option>
              <option value="security_groups">security_groups</option>
              <option value="peer_vpc_id">peer_vpc_id</option>
            </select>
            <select value={refSource} onChange={(e) => setRefSource(e.target.value)}
              style={{ width: "100%", fontSize: "0.6rem", fontFamily: MONO, padding: "0.25rem", border: "1px solid rgba(0,0,0,0.2)", background: "transparent", marginBottom: "0.3rem" }}>
              <option value="">select resource...</option>
              {parsedResources.map((r) => (
                <option key={`${r.type}.${r.name}`} value={`${r.type}.${r.name}`}>{r.type.replace("aws_", "")}.{r.name}</option>
              ))}
            </select>
            <button onClick={handleInsertRef} disabled={!refSource}
              style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.3rem 0.5rem", border: "1px solid #000", background: "transparent", cursor: "pointer", width: "100%", opacity: refSource ? 1 : 0.3, fontFamily: FONT }}>
              + Insert Reference
            </button>
          </div>
        )}
      </div>

      {/* Center — HCL Editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{
          padding: "0.5rem 1rem", borderBottom: "1px solid rgba(0,0,0,0.15)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ ...LABEL, opacity: 0.5 }}>MAIN.TF</span>
            {parsedResources.length > 0 && (
              <span style={{ fontSize: "0.55rem", fontFamily: MONO, color: "#27c93f" }}>{parsedResources.length} resources</span>
            )}
          </div>
          <span style={{ fontSize: "0.6rem", fontFamily: MONO, opacity: 0.4 }}>{lineCount} lines</span>
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "auto", minHeight: 0 }}>
          <div style={{
            padding: "0.8rem 0.5rem", textAlign: "right", userSelect: "none",
            fontFamily: MONO, fontSize: "0.75rem", lineHeight: "1.5", color: "rgba(0,0,0,0.25)",
            borderRight: "1px solid rgba(0,0,0,0.1)", minWidth: "2.5rem", flexShrink: 0,
          }}>
            {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
          </div>
          <textarea
            ref={textareaRef}
            value={hcl}
            onChange={(e) => { setHcl(e.target.value); setError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const ta = e.currentTarget;
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                setHcl(hcl.slice(0, start) + "  " + hcl.slice(end));
                requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
              }
            }}
            placeholder={`# Click resources on the left to build your template\n# or type HCL directly\n\nresource "aws_vpc" "main" {\n  cidr_block = "10.0.0.0/16"\n}`}
            spellCheck={false}
            style={{
              flex: 1, padding: "0.8rem", fontFamily: MONO, fontSize: "0.75rem", lineHeight: "1.5",
              background: "transparent", border: "none", outline: "none", resize: "none", color: "#000", tabSize: 2,
            }}
          />
        </div>
      </div>

      {/* Right — Controls */}
      <div style={{ width: 260, borderLeft: "1px solid #000", overflow: "auto", padding: "1rem", flexShrink: 0, display: "flex", flexDirection: "column", gap: "1.2rem" }}>
        <span style={{ ...LABEL, opacity: 0.5 }}>NEW CLOUD TEMPLATE</span>

        <div>
          <label style={{ ...LABEL, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>NAME</label>
          <input value={templateName} onChange={(e) => { setTemplateName(e.target.value); setError(null); }}
            placeholder="VPC Basics"
            style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #000", padding: "0.4rem 0", fontSize: "0.9rem", fontFamily: MONO, outline: "none" }} />
        </div>

        <div>
          <label style={{ ...LABEL, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>COLLECTION</label>
          <select value={collectionId} onChange={(e) => { setCollectionId(e.target.value); setError(null); }}
            style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #000", padding: "0.4rem 0", fontSize: "0.8rem", fontFamily: FONT, outline: "none" }}>
            <option value="">Select collection...</option>
            {collections.map((c) => <option key={c.uuid} value={c.uuid}>{c.name}</option>)}
          </select>
        </div>

        {/* Parsed resources summary */}
        {parsedResources.length > 0 && (
          <div>
            <label style={{ ...LABEL, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>RESOURCES IN TEMPLATE</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              {parsedResources.map((r, i) => {
                const res = RESOURCES.find((t) => t.type === r.type);
                return (
                  <div key={i} style={{ fontSize: "0.65rem", fontFamily: MONO, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontSize: "0.5rem", fontWeight: 800, color: "#000", background: res?.color || "#94a3b8", padding: "1px 3px", lineHeight: 1.2 }}>
                      {r.type.replace("aws_", "").slice(0, 3).toUpperCase()}
                    </span>
                    <span style={{ opacity: 0.6 }}>{r.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: "0.5rem 0.75rem", border: "1px solid #ff5f56", color: "#ff5f56", fontSize: "0.7rem", fontFamily: MONO }}>
            {error}
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{
            padding: "0.5rem 1.2rem", border: "1px solid #000000", background: "#000000", color: "#79f673",
            fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
            cursor: saving ? "wait" : "pointer", fontFamily: FONT, opacity: saving ? 0.4 : 1,
            width: "100%", marginTop: "auto",
          }}>
          {saving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </div>
  );
}
