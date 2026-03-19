// Shared layout utilities for topology visualization

export const NODE_W = 140;
export const NODE_H = 48;

export type Tier = "router" | "server" | "client";

const ROUTER_PATTERNS = [/^r\d/i, /router/i, /spine/i, /core/i, /border/i, /gateway/i, /gw/i];
const ROUTER_IMAGES = ["frr", "frrouting", "srl", "ceos", "xrd", "vyos", "bird", "quagga", "gobgp"];
const SERVER_PATTERNS = [/^s\d/i, /^srv/i, /server/i, /dns/i, /dhcp/i, /web/i, /http/i, /ntp/i, /radius/i, /syslog/i, /monitor/i];
const SERVER_IMAGES = ["dnsmasq", "nginx", "apache", "bind9", "kea", "freeradius", "syslog", "grafana", "prometheus"];
const CLIENT_PATTERNS = [/^pc/i, /^h\d/i, /^host/i, /client/i, /endpoint/i, /user/i, /workstation/i];

export function classifyNode(name: string, kind: string, image: string): Tier {
  if (ROUTER_PATTERNS.some((p) => p.test(name))) return "router";
  if (kind === "router" || kind === "srl" || kind === "ceos" || kind === "vr-sros") return "router";
  const imgLower = image.toLowerCase();
  if (ROUTER_IMAGES.some((r) => imgLower.includes(r))) return "router";

  if (SERVER_PATTERNS.some((p) => p.test(name))) return "server";
  if (SERVER_IMAGES.some((r) => imgLower.includes(r))) return "server";

  if (CLIENT_PATTERNS.some((p) => p.test(name))) return "client";

  return "client";
}

const H_GAP = 60;
const V_GAP = 120;

export function getLayoutedPositions(
  nodes: { id: string; kind: string; image: string }[],
): Record<string, { x: number; y: number }> {
  const tiers: Record<Tier, typeof nodes> = { router: [], server: [], client: [] };

  nodes.forEach((n) => {
    tiers[classifyNode(n.id, n.kind, n.image)].push(n);
  });

  const positions: Record<string, { x: number; y: number }> = {};

  function layoutRow(row: typeof nodes, y: number) {
    const totalW = row.length * NODE_W + (row.length - 1) * H_GAP;
    const startX = -totalW / 2;
    row.forEach((n, i) => {
      positions[n.id] = { x: startX + i * (NODE_W + H_GAP), y };
    });
  }

  let y = 0;
  const order: Tier[] = ["router", "server", "client"];
  order.forEach((tier) => {
    if (tiers[tier].length > 0) {
      layoutRow(tiers[tier], y);
      y += NODE_H + V_GAP;
    }
  });

  return positions;
}
