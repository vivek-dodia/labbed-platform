// Generates working NOS configs based on template + routing scenario

import type { BuilderState, BuilderNode, BuilderLink, DefaultBindFile } from "./yaml-generator";
import { resolveNosKind } from "./yaml-generator";

export type Scenario = "ospf" | "ebgp" | "static";

export const SCENARIOS: { value: Scenario; label: string; description: string }[] = [
  { value: "ospf", label: "OSPF", description: "Area 0, all routers as neighbors" },
  { value: "ebgp", label: "eBGP", description: "Unique AS per router, eBGP peering" },
  { value: "static", label: "Static / P2P", description: "Point-to-point with static routes" },
];

// ── IP Address helpers ──

interface SubnetAllocation {
  network: string; // e.g. "10.1.1"
  srcIP: string;   // e.g. "10.1.1.1"
  tgtIP: string;   // e.g. "10.1.1.2"
  mask: string;     // "/24"
}

interface LoopbackAllocation {
  ip: string;       // e.g. "1.1.1.1"
  routerId: string;  // same as ip
}

function allocateSubnets(links: BuilderLink[]): Map<string, SubnetAllocation> {
  const allocations = new Map<string, SubnetAllocation>();
  // Use 10.{second}.{third}.0/24 — second octet from 1, third always 0
  // Each link gets a unique /24
  let subnetIdx = 0;
  for (const link of links) {
    subnetIdx++;
    const second = Math.floor(subnetIdx / 255) + 1;
    const third = (subnetIdx % 255);
    const network = `10.${second}.${third}`;
    allocations.set(link.id, {
      network,
      srcIP: `${network}.1`,
      tgtIP: `${network}.2`,
      mask: "/24",
    });
  }
  return allocations;
}

function allocateLoopbacks(routerNodes: BuilderNode[]): Map<string, LoopbackAllocation> {
  const allocs = new Map<string, LoopbackAllocation>();
  routerNodes.forEach((n, i) => {
    const id = `${i + 1}.${i + 1}.${i + 1}.${i + 1}`;
    allocs.set(n.id, { ip: id, routerId: id });
  });
  return allocs;
}

function allocateASNumbers(routerNodes: BuilderNode[]): Map<string, number> {
  const asMap = new Map<string, number>();
  routerNodes.forEach((n, i) => {
    asMap.set(n.id, 65001 + i);
  });
  return asMap;
}

// ── Per-link info for a node ──

interface NodeLinkInfo {
  iface: string;
  localIP: string;
  remoteIP: string;
  network: string;
  peerId: string;
}

function getNodeLinks(
  nodeId: string,
  links: BuilderLink[],
  subnets: Map<string, SubnetAllocation>,
): NodeLinkInfo[] {
  const result: NodeLinkInfo[] = [];
  for (const link of links) {
    const sub = subnets.get(link.id);
    if (!sub) continue;
    if (link.sourceNodeId === nodeId) {
      result.push({
        iface: link.sourceIface,
        localIP: sub.srcIP,
        remoteIP: sub.tgtIP,
        network: sub.network,
        peerId: link.targetNodeId,
      });
    } else if (link.targetNodeId === nodeId) {
      result.push({
        iface: link.targetIface,
        localIP: sub.tgtIP,
        remoteIP: sub.srcIP,
        network: sub.network,
        peerId: link.sourceNodeId,
      });
    }
  }
  return result;
}

function isRouterNode(node: BuilderNode): boolean {
  const nosKind = resolveNosKind(node.clabKind, node.dockerImage);
  return nosKind === "mikrotik_ros" || nosKind === "frr" || nosKind === "openwrt" || nosKind === "freebsd" || nosKind === "gobgp";
}

// ── Config generators per NOS ──

function generateMikrotikOSPF(
  node: BuilderNode,
  linkInfos: NodeLinkInfo[],
  loopback: LoopbackAllocation,
): string {
  const lines: string[] = [`# ${node.name} — OSPF Area 0`];
  // RouterOS uses ether2, ether3, etc. for containerlab interfaces (eth1=ether2, eth2=ether3)
  linkInfos.forEach((li) => {
    const etherN = parseInt(li.iface.replace("eth", ""), 10) + 1;
    lines.push(`/ip/address/add address=${li.localIP}/24 interface=ether${etherN}`);
  });
  lines.push(`/routing/id/add name=main id=${loopback.routerId}`);
  lines.push(`/routing/ospf/instance/add name=default version=2 router-id=main`);
  lines.push(`/routing/ospf/area/add name=backbone area-id=0.0.0.0 instance=default`);
  linkInfos.forEach((li) => {
    const etherN = parseInt(li.iface.replace("eth", ""), 10) + 1;
    lines.push(`/routing/ospf/interface-template/add area=backbone interfaces=ether${etherN} networks=${li.network}.0/24`);
  });
  return lines.join("\n") + "\n";
}

function generateMikrotikBGP(
  node: BuilderNode,
  linkInfos: NodeLinkInfo[],
  loopback: LoopbackAllocation,
  localAS: number,
  asMap: Map<string, number>,
): string {
  const lines: string[] = [`# ${node.name} — AS ${localAS}`];
  linkInfos.forEach((li) => {
    const etherN = parseInt(li.iface.replace("eth", ""), 10) + 1;
    lines.push(`/ip/address/add address=${li.localIP}/24 interface=ether${etherN}`);
  });
  lines.push(`/routing/bgp/instance/add name=default as=${localAS} router-id=${loopback.routerId}`);
  linkInfos.forEach((li) => {
    const peerAS = asMap.get(li.peerId);
    if (!peerAS || peerAS === localAS) return;
    const peerName = `to-${li.peerId.slice(-4)}`;
    lines.push(`/routing/bgp/connection/add name=${peerName} remote.address=${li.remoteIP} remote.as=${peerAS} template=default instance=default local.role=ebgp connect=yes listen=yes output.redistribute=connected`);
  });
  return lines.join("\n") + "\n";
}

function generateMikrotikStatic(
  node: BuilderNode,
  linkInfos: NodeLinkInfo[],
  allRouterLinks: Map<string, NodeLinkInfo[]>,
): string {
  const lines: string[] = [`# ${node.name} — Static routes`];
  linkInfos.forEach((li) => {
    const etherN = parseInt(li.iface.replace("eth", ""), 10) + 1;
    lines.push(`/ip/address/add address=${li.localIP}/24 interface=ether${etherN}`);
  });
  // Add static routes to remote networks via each peer
  linkInfos.forEach((li) => {
    const peerLinks = allRouterLinks.get(li.peerId) || [];
    for (const pl of peerLinks) {
      if (pl.network !== li.network) {
        lines.push(`/ip/route/add dst-address=${pl.network}.0/24 gateway=${li.remoteIP}`);
      }
    }
  });
  return lines.join("\n") + "\n";
}

function generateFRROSPF(
  node: BuilderNode,
  linkInfos: NodeLinkInfo[],
  loopback: LoopbackAllocation,
): string {
  const lines: string[] = [`hostname ${node.name}`, "!"];
  linkInfos.forEach((li) => {
    lines.push(`interface ${li.iface}`);
    lines.push(` ip address ${li.localIP}/24`);
    lines.push("!");
  });
  lines.push(`router ospf`);
  lines.push(` ospf router-id ${loopback.routerId}`);
  linkInfos.forEach((li) => {
    lines.push(` network ${li.network}.0/24 area 0`);
  });
  lines.push("!");
  return lines.join("\n") + "\n";
}

function generateFRRBGP(
  node: BuilderNode,
  linkInfos: NodeLinkInfo[],
  loopback: LoopbackAllocation,
  localAS: number,
  asMap: Map<string, number>,
): string {
  const lines: string[] = [`hostname ${node.name}`, "!"];
  linkInfos.forEach((li) => {
    lines.push(`interface ${li.iface}`);
    lines.push(` ip address ${li.localIP}/24`);
    lines.push("!");
  });
  lines.push(`router bgp ${localAS}`);
  lines.push(` bgp router-id ${loopback.routerId}`);
  lines.push(` no bgp ebgp-requires-policy`);
  linkInfos.forEach((li) => {
    const peerAS = asMap.get(li.peerId);
    if (!peerAS || peerAS === localAS) return;
    lines.push(` neighbor ${li.remoteIP} remote-as ${peerAS}`);
  });
  lines.push(` address-family ipv4 unicast`);
  lines.push(`  redistribute connected`);
  lines.push(` exit-address-family`);
  lines.push("!");
  return lines.join("\n") + "\n";
}

function generateFRRStatic(
  node: BuilderNode,
  linkInfos: NodeLinkInfo[],
  allRouterLinks: Map<string, NodeLinkInfo[]>,
): string {
  const lines: string[] = [`hostname ${node.name}`, "!"];
  linkInfos.forEach((li) => {
    lines.push(`interface ${li.iface}`);
    lines.push(` ip address ${li.localIP}/24`);
    lines.push("!");
  });
  // Static routes to remote networks
  linkInfos.forEach((li) => {
    const peerLinks = allRouterLinks.get(li.peerId) || [];
    for (const pl of peerLinks) {
      if (pl.network !== li.network) {
        lines.push(`ip route ${pl.network}.0/24 ${li.remoteIP}`);
      }
    }
  });
  lines.push("!");
  return lines.join("\n") + "\n";
}

function generateFRRDaemons(scenario: Scenario): string {
  const lines = ["zebra=yes"];
  if (scenario === "ospf") lines.push("ospfd=yes");
  if (scenario === "ebgp") lines.push("bgpd=yes");
  lines.push("staticd=yes");
  return lines.join("\n") + "\n";
}

function generateShellConfig(
  node: BuilderNode,
  linkInfos: NodeLinkInfo[],
  allRouterLinks: Map<string, NodeLinkInfo[]>,
  scenario: Scenario,
): string {
  const lines: string[] = [`#!/bin/sh`, `# ${node.name} — ${scenario} config`];
  linkInfos.forEach((li) => {
    lines.push(`ip addr add ${li.localIP}/24 dev ${li.iface}`);
  });
  // Enable IP forwarding
  lines.push("sysctl -w net.ipv4.ip_forward=1");
  // Static routes to remote networks (needed for all scenarios since
  // OpenWrt/FreeBSD in containerlab can't run native OSPF/BGP)
  linkInfos.forEach((li) => {
    const peerLinks = allRouterLinks.get(li.peerId) || [];
    for (const pl of peerLinks) {
      if (pl.network !== li.network) {
        lines.push(`ip route add ${pl.network}.0/24 via ${li.remoteIP}`);
      }
    }
  });
  return lines.join("\n") + "\n";
}

// ── GoBGP config (TOML) — only meaningful for eBGP ──

function generateGoBGPExec(
  node: BuilderNode,
  linkInfos: NodeLinkInfo[],
  loopback: LoopbackAllocation,
  localAS: number,
  asMap: Map<string, number>,
  allRouterLinks: Map<string, NodeLinkInfo[]>,
  scenario: Scenario,
): string[] {
  const cmds: string[] = [];
  // IP addressing + forwarding
  linkInfos.forEach((li) => {
    cmds.push(`ip addr add ${li.localIP}/24 dev ${li.iface}`);
  });
  cmds.push(`sysctl -w net.ipv4.ip_forward=1`);

  if (scenario === "ebgp") {
    // Write GoBGP TOML config and start daemon
    const tomlLines: string[] = [];
    tomlLines.push(`[global.config]`);
    tomlLines.push(`  as = ${localAS}`);
    tomlLines.push(`  router-id = "${loopback.routerId}"`);
    tomlLines.push(``);
    linkInfos.forEach((li) => {
      const peerAS = asMap.get(li.peerId);
      if (!peerAS || peerAS === localAS) return;
      tomlLines.push(`[[neighbors]]`);
      tomlLines.push(`  [neighbors.config]`);
      tomlLines.push(`    neighbor-address = "${li.remoteIP}"`);
      tomlLines.push(`    peer-as = ${peerAS}`);
      tomlLines.push(``);
    });
    const toml = tomlLines.join("\\n");
    cmds.push(`sh -c 'printf "${toml}" > /etc/gobgp.toml'`);
    cmds.push(`gobgpd -f /etc/gobgp.toml &`);
  } else {
    // Static or OSPF: GoBGP can only do BGP, so add static routes
    linkInfos.forEach((li) => {
      const peerLinks = allRouterLinks.get(li.peerId) || [];
      for (const pl of peerLinks) {
        if (pl.network !== li.network) {
          cmds.push(`ip route add ${pl.network}.0/24 via ${li.remoteIP}`);
        }
      }
    });
  }

  return cmds;
}

// ── Host exec commands ──

function generateHostExec(
  linkInfos: NodeLinkInfo[],
  allRouterLinks: Map<string, NodeLinkInfo[]>,
): string[] {
  const cmds: string[] = [];
  linkInfos.forEach((li) => {
    cmds.push(`ip addr add ${li.localIP}/24 dev ${li.iface}`);
    // Default route via the connected router
    cmds.push(`ip route add default via ${li.remoteIP}`);
  });
  // Add routes to other networks via the first connected router
  if (linkInfos.length > 0) {
    const firstLink = linkInfos[0];
    const peerLinks = allRouterLinks.get(firstLink.peerId) || [];
    for (const pl of peerLinks) {
      if (pl.network !== firstLink.network) {
        cmds.push(`ip route add ${pl.network}.0/24 via ${firstLink.remoteIP}`);
      }
    }
  }
  return cmds;
}

// ── Main generator ──

export function generateScenarioConfigs(
  state: BuilderState,
  scenario: Scenario,
): { bindFiles: DefaultBindFile[]; hostExecs: Map<string, string[]> } {
  const files: DefaultBindFile[] = [];
  const hostExecs = new Map<string, string[]>();

  const routerNodes = state.nodes.filter(isRouterNode);
  const hostNodes = state.nodes.filter((n) => !isRouterNode(n));

  const subnets = allocateSubnets(state.links);
  const loopbacks = allocateLoopbacks(routerNodes);
  const asNumbers = scenario === "ebgp" ? allocateASNumbers(routerNodes) : new Map<string, number>();

  // Precompute all router link infos
  const allRouterLinks = new Map<string, NodeLinkInfo[]>();
  for (const node of routerNodes) {
    allRouterLinks.set(node.id, getNodeLinks(node.id, state.links, subnets));
  }

  // Generate router configs
  for (const node of routerNodes) {
    const nosKind = resolveNosKind(node.clabKind, node.dockerImage);
    const linkInfos = allRouterLinks.get(node.id) || [];
    const loopback = loopbacks.get(node.id) || { ip: "0.0.0.0", routerId: "0.0.0.0" };
    const localAS = asNumbers.get(node.id) || 65001;

    switch (nosKind) {
      case "mikrotik_ros": {
        let content: string;
        if (scenario === "ospf") content = generateMikrotikOSPF(node, linkInfos, loopback);
        else if (scenario === "ebgp") content = generateMikrotikBGP(node, linkInfos, loopback, localAS, asNumbers);
        else content = generateMikrotikStatic(node, linkInfos, allRouterLinks);
        files.push({ filePath: `${node.name}.rsc`, nosKind: "mikrotik_ros", content });
        break;
      }
      case "frr": {
        let content: string;
        if (scenario === "ospf") content = generateFRROSPF(node, linkInfos, loopback);
        else if (scenario === "ebgp") content = generateFRRBGP(node, linkInfos, loopback, localAS, asNumbers);
        else content = generateFRRStatic(node, linkInfos, allRouterLinks);
        files.push({ filePath: `${node.name}-daemons`, nosKind: "frr", content: generateFRRDaemons(scenario) });
        files.push({ filePath: `${node.name}.conf`, nosKind: "frr", content });
        break;
      }
      case "openwrt": {
        const content = generateShellConfig(node, linkInfos, allRouterLinks, scenario);
        files.push({ filePath: `${node.name}-config.sh`, nosKind: "openwrt", content });
        break;
      }
      case "freebsd": {
        const content = generateShellConfig(node, linkInfos, allRouterLinks, scenario);
        files.push({ filePath: `${node.name}-config.sh`, nosKind: "freebsd", content });
        break;
      }
      case "gobgp": {
        // GoBGP is kind: linux — no startup-config, uses exec commands
        const cmds = generateGoBGPExec(node, linkInfos, loopback, localAS, asNumbers, allRouterLinks, scenario);
        if (cmds.length > 0) {
          hostExecs.set(node.id, cmds);
        }
        break;
      }
    }
  }

  // Generate host exec commands
  for (const node of hostNodes) {
    const linkInfos = getNodeLinks(node.id, state.links, subnets);
    if (linkInfos.length > 0) {
      hostExecs.set(node.id, generateHostExec(linkInfos, allRouterLinks));
    }
  }

  return { bindFiles: files, hostExecs };
}
