"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import type { NosImageResponse, CollectionResponse } from "@/types/api";
import type { DefaultBindFile, BuilderNode, BuilderLink, BuilderState, Scenario } from "@/lib/yaml-generator";
import { generateContainerlabYAML, resolveNosKind, parseToBuilderState } from "@/lib/yaml-generator";
import { generateScenarioConfigs, SCENARIOS } from "@/lib/config-generator";
import { parseContainerlabYAML } from "@/lib/yaml-parser";
import TopologyCanvas from "@/components/template/TopologyCanvas";

// ── Styles ──

const labelStyle: React.CSSProperties = {
  fontSize: "0.65rem",
  textTransform: "uppercase",
  fontWeight: 700,
  letterSpacing: "0.05em",
  fontFamily: "'Manrope', sans-serif",
};

const pillBtn = (active?: boolean): React.CSSProperties => ({
  padding: "0.5rem 1.2rem",
  borderRadius: "99px",
  border: "1px solid #000000",
  background: active ? "#000000" : "transparent",
  color: active ? "#79f673" : "#000000",
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
  fontFamily: "'Manrope', sans-serif",
  transition: "all 0.15s",
});

// ── NOS Image grouping ──

interface ImageGroup {
  label: string;
  images: NosImageResponse[];
}

function groupNosImages(images: NosImageResponse[]): ImageGroup[] {
  const routers: NosImageResponse[] = [];
  const hosts: NosImageResponse[] = [];
  const services: NosImageResponse[] = [];

  const routerKinds = new Set(["mikrotik_ros", "openwrt", "freebsd"]);
  const routerImages = ["frr", "frrouting", "gobgp", "bird", "vyos"];
  const hostImages = ["labbed-host"];
  const serviceImages = ["kea", "coredns", "nginx"];

  for (const img of images) {
    const imgLower = img.dockerImage.toLowerCase();
    if (routerKinds.has(img.clabKind) || routerImages.some((r) => imgLower.includes(r))) {
      routers.push(img);
    } else if (img.clabKind !== "linux") {
      routers.push(img);
    } else if (hostImages.some((h) => imgLower.includes(h))) {
      hosts.push(img);
    } else if (serviceImages.some((s) => imgLower.includes(s))) {
      services.push(img);
    } else {
      services.push(img);
    }
  }

  const groups: ImageGroup[] = [];
  if (routers.length) groups.push({ label: "Routers", images: routers });
  if (hosts.length) groups.push({ label: "Hosts", images: hosts });
  if (services.length) groups.push({ label: "Services", images: services });
  return groups;
}

// ── YAML validation ──

function validateYAML(yaml: string): string | null {
  if (!yaml.trim()) return "YAML is empty";
  const parsed = parseContainerlabYAML(yaml);
  if (!parsed.name) return "Missing top-level 'name:' field";
  if (parsed.nodes.length === 0) return "No nodes found under template.nodes";
  return null;
}

// ── Random template generator ──

function generateRandomTopology(nosImages: NosImageResponse[]): { yaml: string; scenario: Scenario; state: BuilderState } {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const uid = () => `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const groups = groupNosImages(nosImages);
  const supportedKinds = new Set(["mikrotik_ros", "openwrt", "freebsd"]);
  const supportedImages = ["frrouting/frr", "gobgp"];
  const routerImgs = (groups.find((g) => g.label === "Routers")?.images || []).filter((img) =>
    supportedKinds.has(img.clabKind) || supportedImages.some((s) => img.dockerImage.includes(s)),
  );
  const hostImgs = (groups.find((g) => g.label === "Hosts")?.images || []).filter((img) => img.clabKind === "linux");

  if (routerImgs.length === 0) {
    return { yaml: "", scenario: "static", state: { name: "", collectionId: "", scenario: "static", nodes: [], links: [], nextNodeCounters: {}, nextIfaceCounters: {} } };
  }

  const routerCount = randInt(2, 4);
  const hostCount = hostImgs.length > 0 ? randInt(1, 3) : 0;

  const routerImg = pick(routerImgs);
  const hostImg = hostImgs.length > 0 ? pick(hostImgs) : null;

  type TmpNode = { id: string; img: NosImageResponse; prefix: string; num: number };
  const tmpNodes: TmpNode[] = [];
  for (let i = 0; i < routerCount; i++) tmpNodes.push({ id: uid(), img: routerImg, prefix: "router", num: i + 1 });
  for (let i = 0; i < hostCount; i++) tmpNodes.push({ id: uid(), img: hostImg!, prefix: "host", num: i + 1 });

  const routers = tmpNodes.filter((n) => n.prefix === "router");
  const hosts = tmpNodes.filter((n) => n.prefix === "host");

  // Build links
  const ifaceCounters: Record<string, number> = {};
  const nextIface = (id: string) => { const n = ifaceCounters[id] || 1; ifaceCounters[id] = n + 1; return `eth${n}`; };
  const links: BuilderLink[] = [];
  const mkLink = (a: string, b: string) => {
    links.push({
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceNodeId: a, sourceIface: nextIface(a),
      targetNodeId: b, targetIface: nextIface(b),
    });
  };

  for (let i = 0; i < routers.length - 1; i++) mkLink(routers[i].id, routers[i + 1].id);
  if (routers.length >= 3 && Math.random() > 0.4) mkLink(routers[routers.length - 1].id, routers[0].id);
  for (const n of hosts) mkLink(n.id, pick(routers).id);

  const nodeIfaces: Record<string, string[]> = {};
  for (const l of links) {
    (nodeIfaces[l.sourceNodeId] ??= []).push(l.sourceIface);
    (nodeIfaces[l.targetNodeId] ??= []).push(l.targetIface);
  }

  const adjectives = [
    "chaotic", "sleepy", "cursed", "mega", "turbo", "quantum", "spicy",
    "crunchy", "wobbly", "haunted", "chunky", "crispy", "funky", "blazing",
    "twisted", "radical", "cosmic", "janky", "zesty", "gnarly",
  ];
  const nouns = [
    "spaghetti", "noodle", "pretzel", "burrito", "waffle", "pancake",
    "tornado", "volcano", "octopus", "penguin", "raccoon", "platypus",
    "toaster", "blender", "dumpster", "hamster", "goblin", "yeti",
  ];

  const scenarios: Scenario[] = ["ospf", "ebgp", "static"];
  const scenario = pick(scenarios);
  const name = `${pick(adjectives)}-${pick(nouns)}-net`;

  const counters: Record<string, number> = {};
  for (const n of tmpNodes) counters[n.prefix] = Math.max(counters[n.prefix] || 0, n.num + 1);

  const nodes: BuilderNode[] = tmpNodes.map((n) => ({
    id: n.id,
    name: `${n.prefix}${n.num}`,
    nosImageId: n.img.uuid,
    clabKind: n.img.clabKind,
    dockerImage: n.img.dockerImage,
    interfaces: nodeIfaces[n.id] || [],
    exec: [],
    position: { x: 0, y: 0 },
  }));

  const state: BuilderState = {
    name,
    collectionId: "",
    scenario,
    nodes,
    links,
    nextNodeCounters: counters,
    nextIfaceCounters: ifaceCounters,
  };

  // Generate configs and apply host execs
  const { hostExecs } = generateScenarioConfigs(state, scenario);
  const stateWithExecs: BuilderState = {
    ...state,
    nodes: state.nodes.map((n) => {
      const execs = hostExecs.get(n.id);
      return execs ? { ...n, exec: execs } : n;
    }),
  };

  const yaml = generateContainerlabYAML(stateWithExecs);
  return { yaml, scenario, state: stateWithExecs };
}

// ── Props ──

interface TopologyBuilderProps {
  nosImages: NosImageResponse[];
  collections: CollectionResponse[];
  onSave: (name: string, yaml: string, collectionId: string, bindFiles: DefaultBindFile[]) => Promise<void>;
}

// ── Main Component ──

export default function TopologyBuilder({ nosImages, collections, onSave }: TopologyBuilderProps) {
  const [yaml, setYaml] = useState(
    "name: my-template\ntopology:\n  nodes:\n    router1:\n      kind: linux\n      image: quay.io/frrouting/frr:10.3.1\n  links:\n",
  );
  const [topoName, setTopoName] = useState("");
  const [collectionId, setCollectionId] = useState(collections[0]?.uuid || "");
  const [scenario, setScenario] = useState<Scenario>("static");
  const [addConfigs, setAddConfigs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [linkNodeA, setLinkNodeA] = useState("");
  const [linkIfaceA, setLinkIfaceA] = useState("");
  const [linkNodeB, setLinkNodeB] = useState("");
  const [linkIfaceB, setLinkIfaceB] = useState("");

  const imageGroups = useMemo(() => groupNosImages(nosImages), [nosImages]);

  // Parse current YAML for node names (used by link builder)
  const parsedNodes = useMemo(() => {
    try { return parseContainerlabYAML(yaml).nodes; } catch { return []; }
  }, [yaml]);

  // Live validation
  const validationMsg = useMemo(() => {
    if (!yaml.trim()) return null;
    return validateYAML(yaml);
  }, [yaml]);

  // Line-numbered display
  const lineCount = yaml.split("\n").length;

  // Track node name counters for auto-naming
  const nodeCounters = useRef<Record<string, number>>({});

  const handleInsertNode = useCallback((img: NosImageResponse) => {
    const ta = textareaRef.current;
    // Auto-name: r1, r2, r3 for routers; h1, h2 for hosts; svc1, svc2 for services
    const prefix = img.clabKind === "linux" && img.dockerImage.includes("labbed-host") ? "h"
      : img.clabKind === "linux" && (img.dockerImage.includes("kea") || img.dockerImage.includes("coredns") || img.dockerImage.includes("nginx")) ? "svc"
      : "r";
    const count = (nodeCounters.current[prefix] || 0) + 1;
    nodeCounters.current[prefix] = count;
    const nodeName = `${prefix}${count}`;

    let snippet = `    ${nodeName}:\n      kind: ${img.clabKind}\n      image: ${img.dockerImage}\n`;

    if (ta) {
      // Insert at cursor position
      const pos = ta.selectionStart;
      const before = yaml.slice(0, pos);
      const after = yaml.slice(pos);
      const newYaml = before + snippet + after;
      setYaml(newYaml);
      // Restore cursor after the inserted text
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = pos + snippet.length;
        ta.focus();
      });
    } else {
      // Fallback: append
      setYaml((prev) => prev + snippet);
    }

    setCopied(img.uuid);
    setTimeout(() => setCopied(null), 1000);
    setError(null);
  }, [yaml]);

  // Suggest next available interface for a node
  const suggestIface = useCallback((nodeName: string) => {
    const parsed = parseContainerlabYAML(yaml);
    const used = new Set<string>();
    for (const l of parsed.links) {
      if (l.a.node === nodeName) used.add(l.a.iface);
      if (l.b.node === nodeName) used.add(l.b.iface);
    }
    // Check if node is SRL (uses e1-X interfaces)
    const node = parsed.nodes.find((n) => n.name === nodeName);
    const isSrl = node?.kind === "srl" || node?.image?.includes("srlinux");
    const isSonic = node?.kind === "sonic-vs" || node?.image?.includes("sonic");
    for (let i = 1; i < 50; i++) {
      const name = isSrl ? `e1-${i}` : isSonic ? `eth${i}` : `eth${i}`;
      if (!used.has(name)) return name;
    }
    return "eth1";
  }, [yaml]);

  const handleInsertLink = useCallback(() => {
    if (!linkNodeA || !linkNodeB) return;
    const ifA = linkIfaceA || suggestIface(linkNodeA);
    const ifB = linkIfaceB || suggestIface(linkNodeB);
    const snippet = `    - endpoints: ["${linkNodeA}:${ifA}", "${linkNodeB}:${ifB}"]\n`;

    // Check if links: section exists
    if (!yaml.includes("links:")) {
      // Append links section
      setYaml((prev) => prev.trimEnd() + "\n  links:\n" + snippet);
    } else {
      // Find the end of links section and insert there
      const lines = yaml.split("\n");
      let lastLinkIdx = -1;
      let inLinks = false;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*links:\s*$/.test(lines[i])) { inLinks = true; continue; }
        if (inLinks) {
          if (/^\s*-\s+endpoints:/.test(lines[i])) { lastLinkIdx = i; }
          else if (/^\S/.test(lines[i]) && lines[i].trim()) { break; }
        }
      }
      const insertAt = lastLinkIdx >= 0 ? lastLinkIdx + 1 : lines.findIndex((l) => /^\s*links:\s*$/.test(l)) + 1;
      lines.splice(insertAt, 0, snippet.trimEnd());
      setYaml(lines.join("\n"));
    }

    // Reset & auto-suggest next
    setLinkIfaceA("");
    setLinkIfaceB("");
    setError(null);
  }, [linkNodeA, linkNodeB, linkIfaceA, linkIfaceB, yaml, suggestIface]);

  const handleRandomTopology = useCallback(() => {
    const result = generateRandomTopology(nosImages);
    if (!result.yaml) return;
    setYaml(result.yaml);
    setTopoName(result.state.name);
    setScenario(result.scenario);
    setAddConfigs(true);
    setError(null);
  }, [nosImages]);

  const handleSave = useCallback(async () => {
    const name = topoName.trim();
    if (!name) { setError("Template name is required"); return; }
    if (!collectionId) { setError("Select a collection"); return; }

    const validationErr = validateYAML(yaml);
    if (validationErr) { setError(validationErr); return; }

    setError(null);
    setSaving(true);
    try {
      let bindFiles: DefaultBindFile[] = [];
      if (addConfigs) {
        // Parse YAML into builder state to generate configs
        const state = parseToBuilderState(yaml, nosImages);
        state.scenario = scenario;
        const result = generateScenarioConfigs(state, scenario);
        bindFiles = result.bindFiles;
      }
      await onSave(name, yaml, collectionId, bindFiles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }, [topoName, collectionId, yaml, addConfigs, scenario, nosImages, onSave]);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      {/* Left — NOS Image Reference */}
      <div style={{
        width: 220,
        borderRight: "1px solid #000",
        overflow: "auto",
        padding: "1rem",
        flexShrink: 0,
      }}>
        <span style={{ ...labelStyle, opacity: 0.5, display: "block", marginBottom: "0.5rem" }}>NOS IMAGES</span>
        <span style={{ fontSize: "0.6rem", opacity: 0.35, fontFamily: "'Space Mono', monospace", display: "block", marginBottom: "1rem" }}>
          click to insert node
        </span>

        {imageGroups.map((group) => (
          <div key={group.label} style={{ marginBottom: "1.5rem" }}>
            <span style={{ ...labelStyle, fontSize: "0.6rem", opacity: 0.4, display: "block", marginBottom: "0.5rem" }}>
              {group.label.toUpperCase()}
            </span>
            {group.images.map((img) => (
              <div
                key={img.uuid}
                onClick={() => handleInsertNode(img)}
                style={{
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #000",
                  marginBottom: "0.4rem",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  transition: "background 0.1s",
                  background: copied === img.uuid ? "rgba(0,0,0,0.1)" : "transparent",
                }}
                onMouseEnter={(e) => { if (copied !== img.uuid) e.currentTarget.style.background = "rgba(0,0,0,0.05)"; }}
                onMouseLeave={(e) => { if (copied !== img.uuid) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontWeight: 700, fontFamily: "'Manrope', sans-serif", fontSize: "0.7rem", textTransform: "uppercase" }}>
                  {copied === img.uuid ? "INSERTED!" : img.name}
                </div>
                <div style={{ fontSize: "0.55rem", opacity: 0.5, fontFamily: "'Space Mono', monospace", marginTop: 2 }}>
                  {img.clabKind} &middot; {img.dockerImage.split("/").pop()}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Link builder */}
        {parsedNodes.length >= 2 && (
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.15)", paddingTop: "1rem" }}>
            <span style={{ ...labelStyle, opacity: 0.5, display: "block", marginBottom: "0.5rem" }}>ADD LINK</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                <select value={linkNodeA} onChange={(e) => { setLinkNodeA(e.target.value); setLinkIfaceA(""); }}
                  style={{ flex: 1, fontSize: "0.65rem", fontFamily: "'Space Mono', monospace", padding: "0.3rem", border: "1px solid rgba(0,0,0,0.2)", background: "transparent", outline: "none" }}>
                  <option value="">node A</option>
                  {parsedNodes.map((n) => <option key={n.name} value={n.name}>{n.name}</option>)}
                </select>
                <input value={linkIfaceA} onChange={(e) => setLinkIfaceA(e.target.value)}
                  placeholder={linkNodeA ? suggestIface(linkNodeA) : "eth1"}
                  style={{ width: 55, fontSize: "0.65rem", fontFamily: "'Space Mono', monospace", padding: "0.3rem", border: "1px solid rgba(0,0,0,0.2)", background: "transparent", outline: "none" }} />
              </div>
              <div style={{ textAlign: "center", fontSize: "0.5rem", opacity: 0.3, fontFamily: "'Space Mono', monospace" }}>&#x2194;</div>
              <div style={{ display: "flex", gap: "0.3rem" }}>
                <select value={linkNodeB} onChange={(e) => { setLinkNodeB(e.target.value); setLinkIfaceB(""); }}
                  style={{ flex: 1, fontSize: "0.65rem", fontFamily: "'Space Mono', monospace", padding: "0.3rem", border: "1px solid rgba(0,0,0,0.2)", background: "transparent", outline: "none" }}>
                  <option value="">node B</option>
                  {parsedNodes.map((n) => <option key={n.name} value={n.name}>{n.name}</option>)}
                </select>
                <input value={linkIfaceB} onChange={(e) => setLinkIfaceB(e.target.value)}
                  placeholder={linkNodeB ? suggestIface(linkNodeB) : "eth1"}
                  style={{ width: 55, fontSize: "0.65rem", fontFamily: "'Space Mono', monospace", padding: "0.3rem", border: "1px solid rgba(0,0,0,0.2)", background: "transparent", outline: "none" }} />
              </div>
              <button onClick={handleInsertLink} disabled={!linkNodeA || !linkNodeB || linkNodeA === linkNodeB}
                style={{ ...pillBtn(), fontSize: "0.6rem", padding: "0.35rem 0.5rem", opacity: (!linkNodeA || !linkNodeB || linkNodeA === linkNodeB) ? 0.3 : 1 }}>
                + Insert Link
              </button>
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid rgba(0,0,0,0.15)", paddingTop: "1rem" }}>
          <button onClick={handleRandomTopology} style={{ ...pillBtn(), backgroundColor: "#000", color: "#79f673", width: "100%" }}>
            Surprise Me, Nerd
          </button>
        </div>
      </div>

      {/* Center — YAML Editor + Preview */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{
          padding: "0.5rem 1rem",
          borderBottom: "1px solid rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ ...labelStyle, opacity: 0.5 }}>TOPOLOGY.YAML</span>
            {validationMsg ? (
              <span style={{ fontSize: "0.55rem", fontFamily: "'Space Mono', monospace", color: "#ff5f56" }}>{validationMsg}</span>
            ) : yaml.trim() ? (
              <span style={{ fontSize: "0.55rem", fontFamily: "'Space Mono', monospace", color: "#27c93f" }}>VALID</span>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.6rem", fontFamily: "'Space Mono', monospace", opacity: 0.4 }}>
              {lineCount} lines
            </span>
            <button
              onClick={() => setShowPreview(!showPreview)}
              style={{ ...labelStyle, fontSize: "0.55rem", opacity: 0.4, background: "none", border: "none", cursor: "pointer", color: "#000" }}
            >
              {showPreview ? "HIDE PREVIEW" : "SHOW PREVIEW"}
            </button>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "auto", minHeight: 0 }}>
          {/* Line numbers */}
          <div style={{
            padding: "0.8rem 0.5rem",
            textAlign: "right",
            userSelect: "none",
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.75rem",
            lineHeight: "1.5",
            color: "rgba(0,0,0,0.25)",
            borderRight: "1px solid rgba(0,0,0,0.1)",
            minWidth: "2.5rem",
            flexShrink: 0,
          }}>
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={yaml}
            onChange={(e) => { setYaml(e.target.value); setError(null); }}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const ta = e.currentTarget;
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                const newVal = yaml.slice(0, start) + "  " + yaml.slice(end);
                setYaml(newVal);
                requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
              }
            }}
            spellCheck={false}
            style={{
              flex: 1,
              padding: "0.8rem",
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.75rem",
              lineHeight: "1.5",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              color: "#000",
              tabSize: 2,
            }}
          />
        </div>

        {/* Live preview */}
        {showPreview && !validationMsg && yaml.trim() && (
          <div style={{ height: 220, borderTop: "1px solid rgba(0,0,0,0.15)", position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 6, left: 10, zIndex: 2 }}>
              <span style={{ ...labelStyle, fontSize: "0.5rem", opacity: 0.3 }}>LIVE PREVIEW</span>
            </div>
            <TopologyCanvas definition={yaml} />
          </div>
        )}
      </div>

      {/* Right — Controls */}
      <div style={{
        width: 280,
        borderLeft: "1px solid #000",
        overflow: "auto",
        padding: "1rem",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: "1.2rem",
      }}>
        <span style={{ ...labelStyle, opacity: 0.5 }}>NEW TOPOLOGY</span>

        {/* Name */}
        <div>
          <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>NAME</label>
          <input
            value={topoName}
            onChange={(e) => { setTopoName(e.target.value); setError(null); }}
            placeholder="my-template"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #000",
              padding: "0.4rem 0",
              fontSize: "0.9rem",
              fontFamily: "'Space Mono', monospace",
              outline: "none",
            }}
          />
        </div>

        {/* Collection */}
        <div>
          <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>COLLECTION</label>
          <select
            value={collectionId}
            onChange={(e) => { setCollectionId(e.target.value); setError(null); }}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #000",
              padding: "0.4rem 0",
              fontSize: "0.8rem",
              fontFamily: "'Manrope', sans-serif",
              outline: "none",
            }}
          >
            <option value="">Select collection...</option>
            {collections.map((c) => (
              <option key={c.uuid} value={c.uuid}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Add startup configs toggle */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
              padding: "0.5rem 0.6rem",
              border: addConfigs ? "1.5px solid #000" : "1px solid rgba(0,0,0,0.2)",
              background: addConfigs ? "rgba(0,0,0,0.06)" : "transparent",
              transition: "all 0.1s",
            }}
          >
            <input
              type="checkbox"
              checked={addConfigs}
              onChange={(e) => setAddConfigs(e.target.checked)}
              style={{ accentColor: "#000" }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.7rem", fontFamily: "'Manrope', sans-serif" }}>GENERATE STARTUP CONFIGS</div>
              <div style={{ fontSize: "0.55rem", opacity: 0.5, fontFamily: "'Space Mono', monospace" }}>auto-create bind files per node</div>
            </div>
          </label>
        </div>

        {/* Scenario (only when addConfigs is on) */}
        {addConfigs && (
          <div>
            <label style={{ ...labelStyle, display: "block", marginBottom: "0.3rem", fontSize: "0.6rem" }}>ROUTING SCENARIO</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {SCENARIOS.map((s) => (
                <label
                  key={s.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.4rem 0.6rem",
                    border: scenario === s.value ? "1.5px solid #000" : "1px solid rgba(0,0,0,0.2)",
                    cursor: "pointer",
                    background: scenario === s.value ? "rgba(0,0,0,0.06)" : "transparent",
                    transition: "all 0.1s",
                  }}
                >
                  <input
                    type="radio"
                    name="scenario"
                    value={s.value}
                    checked={scenario === s.value}
                    onChange={() => setScenario(s.value)}
                    style={{ accentColor: "#000" }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.7rem", fontFamily: "'Manrope', sans-serif" }}>{s.label}</div>
                    <div style={{ fontSize: "0.55rem", opacity: 0.5, fontFamily: "'Space Mono', monospace" }}>{s.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: "0.5rem 0.75rem",
            border: "1px solid #ff5f56",
            color: "#ff5f56",
            fontSize: "0.7rem",
            fontFamily: "'Space Mono', monospace",
          }}>
            {error}
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...pillBtn(),
            backgroundColor: "#000",
            color: "#79f673",
            opacity: saving ? 0.4 : 1,
            width: "100%",
            marginTop: "auto",
          }}
        >
          {saving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </div>
  );
}
