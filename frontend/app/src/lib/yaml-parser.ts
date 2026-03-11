// Lightweight containerlab YAML parser — extracts nodes and links for visualization

export interface ParsedNode {
  name: string;
  kind: string;
  image: string;
  interfaces: string[];
}

export interface ParsedLink {
  a: { node: string; iface: string };
  b: { node: string; iface: string };
}

export interface ParsedTopology {
  name: string;
  nodes: ParsedNode[];
  links: ParsedLink[];
}

// Known containerlab node properties — these are NOT node names
const NODE_PROPERTIES = new Set([
  "kind", "image", "binds", "exec", "ports", "env", "labels",
  "network-mode", "cmd", "entrypoint", "user", "group",
  "startup-config", "startup-delay", "enforce-startup-config",
  "auto-remove", "publish", "memory", "cpu", "cpu-set",
  "runtime", "extras", "config", "type", "license",
  "mgmt-ipv4", "mgmt-ipv6", "dns",
]);

export function parseContainerlabYAML(yaml: string): ParsedTopology {
  const result: ParsedTopology = { name: "", nodes: [], links: [] };
  const lines = yaml.split("\n");

  // extract top-level name
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  if (nameMatch) result.name = nameMatch[1].trim();

  // Find the "nodes:" line and its indent level
  let nodesIndent = -1;
  let nodesStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)nodes:\s*$/);
    if (m) {
      nodesIndent = m[1].length;
      nodesStart = i + 1;
      break;
    }
  }

  if (nodesStart > 0) {
    // Determine node-name indent by looking at the first non-blank child
    let nodeNameIndent = -1;
    for (let i = nodesStart; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "" || line.trim().startsWith("#")) continue;
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      if (indent <= nodesIndent) break; // left the block
      nodeNameIndent = indent;
      break;
    }

    if (nodeNameIndent > nodesIndent) {
      let currentNode: ParsedNode | null = null;

      for (let i = nodesStart; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "" || line.trim().startsWith("#")) continue;

        const indent = line.match(/^(\s*)/)?.[1].length || 0;

        // Left the nodes block entirely
        if (indent <= nodesIndent) break;

        // Line at node-name indent level: "    somename:"
        if (indent === nodeNameIndent) {
          const m = line.match(/^\s+(\S+):\s*$/);
          if (m && !NODE_PROPERTIES.has(m[1])) {
            if (currentNode) result.nodes.push(currentNode);
            currentNode = { name: m[1], kind: "linux", image: "", interfaces: [] };
          }
          continue;
        }

        // Deeper lines are properties of the current node
        if (currentNode && indent > nodeNameIndent) {
          const kindMatch = line.match(/kind:\s*(\S+)/);
          if (kindMatch) currentNode.kind = kindMatch[1];
          const imageMatch = line.match(/image:\s*(\S+)/);
          if (imageMatch) currentNode.image = imageMatch[1];
        }
      }
      if (currentNode) result.nodes.push(currentNode);
    }
  }

  // Parse links: find all endpoints pairs
  const endpointPairs = yaml.match(
    /endpoints:\s*\["([^"]+)",\s*"([^"]+)"\]/g
  );
  if (endpointPairs) {
    for (const pair of endpointPairs) {
      const m = pair.match(/\["([^"]+)",\s*"([^"]+)"\]/);
      if (!m) continue;
      const [aStr, bStr] = [m[1], m[2]];
      const [aNode, aIface] = aStr.split(":");
      const [bNode, bIface] = bStr.split(":");
      if (aNode && aIface && bNode && bIface) {
        result.links.push({
          a: { node: aNode, iface: aIface },
          b: { node: bNode, iface: bIface },
        });
        const nodeA = result.nodes.find((n) => n.name === aNode);
        const nodeB = result.nodes.find((n) => n.name === bNode);
        if (nodeA && !nodeA.interfaces.includes(aIface))
          nodeA.interfaces.push(aIface);
        if (nodeB && !nodeB.interfaces.includes(bIface))
          nodeB.interfaces.push(bIface);
      }
    }
  }

  return result;
}
