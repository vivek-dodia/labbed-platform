// Generates containerlab YAML from builder state

export interface BuilderNode {
  id: string;
  name: string;
  nosImageId: string;
  clabKind: string;
  dockerImage: string;
  interfaces: string[];
  exec: string[];
  position: { x: number; y: number };
}

export interface BuilderLink {
  id: string;
  sourceNodeId: string;
  sourceIface: string;
  targetNodeId: string;
  targetIface: string;
}

export interface BuilderState {
  name: string;
  collectionId: string;
  nodes: BuilderNode[];
  links: BuilderLink[];
  nextNodeCounters: Record<string, number>;
  nextIfaceCounters: Record<string, number>;
}

export function generateContainerlabYAML(state: BuilderState): string {
  const lines: string[] = [];
  lines.push(`name: ${state.name || "untitled"}`);
  lines.push("topology:");
  lines.push("  nodes:");

  for (const node of state.nodes) {
    lines.push(`    ${node.name}:`);
    lines.push(`      kind: ${node.clabKind}`);
    lines.push(`      image: ${node.dockerImage}`);
    if (node.exec.length > 0) {
      lines.push("      exec:");
      for (const cmd of node.exec) {
        lines.push(`        - ${cmd}`);
      }
    }
  }

  if (state.links.length > 0) {
    lines.push("  links:");
    for (const link of state.links) {
      const srcNode = state.nodes.find((n) => n.id === link.sourceNodeId);
      const tgtNode = state.nodes.find((n) => n.id === link.targetNodeId);
      if (!srcNode || !tgtNode) continue;
      lines.push(`    - endpoints: ["${srcNode.name}:${link.sourceIface}", "${tgtNode.name}:${link.targetIface}"]`);
    }
  }

  return lines.join("\n") + "\n";
}

import { parseContainerlabYAML } from "./yaml-parser";
import type { NosImageResponse } from "@/types/api";

export function parseToBuilderState(
  yaml: string,
  nosImages: NosImageResponse[],
): BuilderState {
  const parsed = parseContainerlabYAML(yaml);

  const nextNodeCounters: Record<string, number> = {};
  const nextIfaceCounters: Record<string, number> = {};

  const nodes: BuilderNode[] = parsed.nodes.map((n, i) => {
    const matched = nosImages.find(
      (img) => img.dockerImage === n.image || img.clabKind === n.kind,
    );

    // Track counters for auto-naming
    const prefix = getNamePrefix(n.name);
    const num = extractNumber(n.name);
    if (num > 0) {
      nextNodeCounters[prefix] = Math.max(nextNodeCounters[prefix] || 0, num + 1);
    }

    // Track interface counters
    const maxIface = n.interfaces.reduce((max, iface) => {
      const ifaceNum = parseInt(iface.replace(/^eth/, ""), 10);
      return isNaN(ifaceNum) ? max : Math.max(max, ifaceNum);
    }, 0);
    nextIfaceCounters[n.name] = maxIface + 1;

    return {
      id: `node-${i}`,
      name: n.name,
      nosImageId: matched?.uuid || "",
      clabKind: matched?.clabKind || n.kind,
      dockerImage: matched?.dockerImage || n.image,
      interfaces: [...n.interfaces],
      exec: [],
      position: { x: 0, y: 0 },
    };
  });

  const links: BuilderLink[] = parsed.links.map((l, i) => {
    const srcNode = nodes.find((n) => n.name === l.a.node);
    const tgtNode = nodes.find((n) => n.name === l.b.node);
    return {
      id: `link-${i}`,
      sourceNodeId: srcNode?.id || "",
      sourceIface: l.a.iface,
      targetNodeId: tgtNode?.id || "",
      targetIface: l.b.iface,
    };
  });

  // Remap iface counters to use node IDs
  const ifaceCountersByNodeId: Record<string, number> = {};
  for (const node of nodes) {
    ifaceCountersByNodeId[node.id] = nextIfaceCounters[node.name] || 1;
  }

  return {
    name: parsed.name,
    collectionId: "",
    nodes,
    links,
    nextNodeCounters,
    nextIfaceCounters: ifaceCountersByNodeId,
  };
}

function getNamePrefix(name: string): string {
  const m = name.match(/^([a-zA-Z-]+)\d*$/);
  return m ? m[1] : name;
}

function extractNumber(name: string): number {
  const m = name.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}
