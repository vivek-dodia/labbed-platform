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

export type Scenario = "ospf" | "ebgp" | "static";

export interface BuilderState {
  name: string;
  collectionId: string;
  scenario: Scenario;
  nodes: BuilderNode[];
  links: BuilderLink[];
  nextNodeCounters: Record<string, number>;
  nextIfaceCounters: Record<string, number>;
}

// Maps clab kind + docker image to NOS config profile (matches server-side resolveNosKind)
export function resolveNosKind(clabKind: string, dockerImage: string): string {
  switch (clabKind) {
    case "mikrotik_ros": return "mikrotik_ros";
    case "openwrt": return "openwrt";
    case "freebsd": return "freebsd";
    case "linux":
      if (dockerImage.includes("frrouting/frr")) return "frr";
      if (dockerImage.includes("gobgp")) return "gobgp";
      break;
  }
  return "";
}

export function generateContainerlabYAML(state: BuilderState): string {
  const lines: string[] = [];
  lines.push(`name: ${state.name || "untitled"}`);
  lines.push("topology:");
  lines.push("  nodes:");

  for (const node of state.nodes) {
    const nosKind = resolveNosKind(node.clabKind, node.dockerImage);
    lines.push(`    ${node.name}:`);
    lines.push(`      kind: ${node.clabKind}`);
    lines.push(`      image: ${node.dockerImage}`);
    // Add NOS-specific config delivery
    if (nosKind === "mikrotik_ros") {
      lines.push(`      startup-config: ${node.name}.rsc`);
    } else if (nosKind === "openwrt" || nosKind === "freebsd") {
      lines.push(`      startup-config: ${node.name}-config.sh`);
    } else if (nosKind === "frr") {
      lines.push("      binds:");
      lines.push(`        - ${node.name}-daemons:/etc/frr/daemons`);
      lines.push(`        - ${node.name}.conf:/etc/frr/frr.conf`);
    }
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

// Generate default bind files for NOS-specific nodes
export interface DefaultBindFile {
  filePath: string;
  content: string;
  nosKind: string;
}

export function generateDefaultBindFiles(state: BuilderState): DefaultBindFile[] {
  const files: DefaultBindFile[] = [];

  for (const node of state.nodes) {
    const nosKind = resolveNosKind(node.clabKind, node.dockerImage);

    switch (nosKind) {
      case "mikrotik_ros":
        files.push({
          filePath: `${node.name}.rsc`,
          nosKind: "mikrotik_ros",
          content: `# ${node.name} — RouterOS startup config\n# Add your RouterOS commands here\n`,
        });
        break;
      case "frr":
        files.push({
          filePath: `${node.name}-daemons`,
          nosKind: "frr",
          content: "zebra=yes\nbgpd=yes\nstaticd=yes\n",
        });
        files.push({
          filePath: `${node.name}.conf`,
          nosKind: "frr",
          content: `hostname ${node.name}\n!\n`,
        });
        break;
      case "openwrt":
        files.push({
          filePath: `${node.name}-config.sh`,
          nosKind: "openwrt",
          content: `#!/bin/sh\n# ${node.name} — OpenWrt startup config\n`,
        });
        break;
      case "freebsd":
        files.push({
          filePath: `${node.name}-config.sh`,
          nosKind: "freebsd",
          content: `#!/bin/sh\n# ${node.name} — FreeBSD startup config\n`,
        });
        break;
    }
  }

  return files;
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
    scenario: "static",
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
