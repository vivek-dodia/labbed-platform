"use client";

import { useState, useCallback, useMemo } from "react";
import type { NosImageResponse, CollectionResponse } from "@/types/api";
import type { DefaultBindFile, BuilderNode, BuilderLink, BuilderState, Scenario } from "@/lib/yaml-generator";
import { generateContainerlabYAML, resolveNosKind, parseToBuilderState } from "@/lib/yaml-generator";
import { generateScenarioConfigs, SCENARIOS } from "@/lib/config-generator";
import { parseContainerlabYAML } from "@/lib/yaml-parser";

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
  if (parsed.nodes.length === 0) return "No nodes found under topology.nodes";
  return null;
}

// ── Random topology generator ──

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
    "name: my-topology\ntopology:\n  nodes:\n    router1:\n      kind: linux\n      image: quay.io/frrouting/frr:10.3.1\n  links:\n",
  );
  const [topoName, setTopoName] = useState("");
  const [collectionId, setCollectionId] = useState(collections[0]?.uuid || "");
  const [scenario, setScenario] = useState<Scenario>("static");
  const [addConfigs, setAddConfigs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const imageGroups = useMemo(() => groupNosImages(nosImages), [nosImages]);

  // Line-numbered display
  const lineCount = yaml.split("\n").length;

  const handleCopySnippet = useCallback((img: NosImageResponse) => {
    const nosKind = resolveNosKind(img.clabKind, img.dockerImage);
    let snippet = `    node-name:\n      kind: ${img.clabKind}\n      image: ${img.dockerImage}`;
    if (nosKind === "mikrotik_ros") snippet += `\n      startup-config: node-name.rsc`;
    else if (nosKind === "openwrt" || nosKind === "freebsd") snippet += `\n      startup-config: node-name-config.sh`;
    else if (nosKind === "frr") snippet += `\n      binds:\n        - node-name-daemons:/etc/frr/daemons\n        - node-name.conf:/etc/frr/frr.conf`;
    navigator.clipboard.writeText(snippet);
    setCopied(img.uuid);
    setTimeout(() => setCopied(null), 1500);
  }, []);

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
    if (!name) { setError("Topology name is required"); return; }
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
          click to copy snippet
        </span>

        {imageGroups.map((group) => (
          <div key={group.label} style={{ marginBottom: "1.5rem" }}>
            <span style={{ ...labelStyle, fontSize: "0.6rem", opacity: 0.4, display: "block", marginBottom: "0.5rem" }}>
              {group.label.toUpperCase()}
            </span>
            {group.images.map((img) => (
              <div
                key={img.uuid}
                onClick={() => handleCopySnippet(img)}
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
                  {copied === img.uuid ? "COPIED!" : img.name}
                </div>
                <div style={{ fontSize: "0.55rem", opacity: 0.5, fontFamily: "'Space Mono', monospace", marginTop: 2 }}>
                  {img.clabKind} &middot; {img.dockerImage.split("/").pop()}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div style={{ borderTop: "1px solid rgba(0,0,0,0.15)", paddingTop: "1rem" }}>
          <button onClick={handleRandomTopology} style={{ ...pillBtn(), backgroundColor: "#000", color: "#79f673", width: "100%" }}>
            Surprise Me, Nerd
          </button>
        </div>
      </div>

      {/* Center — YAML Editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{
          padding: "0.5rem 1rem",
          borderBottom: "1px solid rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ ...labelStyle, opacity: 0.5 }}>TOPOLOGY.YAML</span>
          <span style={{ fontSize: "0.6rem", fontFamily: "'Space Mono', monospace", opacity: 0.4 }}>
            {lineCount} lines
          </span>
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
            value={yaml}
            onChange={(e) => { setYaml(e.target.value); setError(null); }}
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
            placeholder="my-topology"
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
          {saving ? "Saving..." : "Save Topology"}
        </button>
      </div>
    </div>
  );
}
