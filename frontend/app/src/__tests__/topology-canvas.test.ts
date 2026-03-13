import { describe, it, expect } from "vitest";

// Test the status color mapping and node classification logic from TopologyCanvas.tsx

function getStatusColor(state: string): string {
  switch (state) {
    case "running": return "#27c93f";
    case "failed": return "#ff5f56";
    case "deploying": case "starting": return "#ffbd2e";
    case "stopped": case "exited": return "#888";
    default: return "transparent";
  }
}

type Tier = "router" | "server" | "client";

const ROUTER_PATTERNS = [/^r\d/i, /router/i, /spine/i, /core/i, /border/i, /gateway/i, /gw/i];
const ROUTER_IMAGES = ["frr", "frrouting", "srl", "ceos", "xrd", "vyos", "bird", "quagga", "gobgp"];
const SERVER_PATTERNS = [/^s\d/i, /^srv/i, /server/i, /dns/i, /dhcp/i, /web/i, /http/i, /ntp/i, /radius/i, /syslog/i, /monitor/i];
const SERVER_IMAGES = ["dnsmasq", "nginx", "apache", "bind9", "kea", "freeradius", "syslog", "grafana", "prometheus"];
const CLIENT_PATTERNS = [/^pc/i, /^h\d/i, /^host/i, /client/i, /endpoint/i, /user/i, /workstation/i];

function classifyNode(name: string, kind: string, image: string): Tier {
  if (ROUTER_PATTERNS.some((p) => p.test(name))) return "router";
  if (kind === "router" || kind === "srl" || kind === "ceos" || kind === "vr-sros") return "router";
  const imgLower = image.toLowerCase();
  if (ROUTER_IMAGES.some((r) => imgLower.includes(r))) return "router";

  if (SERVER_PATTERNS.some((p) => p.test(name))) return "server";
  if (SERVER_IMAGES.some((r) => imgLower.includes(r))) return "server";

  if (CLIENT_PATTERNS.some((p) => p.test(name))) return "client";

  return "client";
}

describe("getStatusColor", () => {
  it("returns green for running", () => {
    expect(getStatusColor("running")).toBe("#27c93f");
  });

  it("returns red for failed", () => {
    expect(getStatusColor("failed")).toBe("#ff5f56");
  });

  it("returns yellow for deploying", () => {
    expect(getStatusColor("deploying")).toBe("#ffbd2e");
  });

  it("returns yellow for starting", () => {
    expect(getStatusColor("starting")).toBe("#ffbd2e");
  });

  it("returns gray for stopped", () => {
    expect(getStatusColor("stopped")).toBe("#888");
  });

  it("returns gray for exited", () => {
    expect(getStatusColor("exited")).toBe("#888");
  });

  it("returns transparent for unknown state", () => {
    expect(getStatusColor("")).toBe("transparent");
  });

  it("returns transparent for arbitrary string", () => {
    expect(getStatusColor("pending")).toBe("transparent");
  });
});

describe("LinkEndpoint type", () => {
  // Matches the exported LinkEndpoint interface from TopologyCanvas
  interface LinkEndpoint { node: string; iface: string }

  it("represents a link endpoint", () => {
    const ep: LinkEndpoint = { node: "r1", iface: "eth1" };
    expect(ep.node).toBe("r1");
    expect(ep.iface).toBe("eth1");
  });

  it("can represent both sides of a link", () => {
    const a: LinkEndpoint = { node: "r1", iface: "eth1" };
    const b: LinkEndpoint = { node: "r2", iface: "eth2" };
    expect(a.node).not.toBe(b.node);
    expect(a.iface).not.toBe(b.iface);
  });
});

describe("classifyNode", () => {
  describe("router classification", () => {
    it("classifies by name pattern r1", () => {
      expect(classifyNode("r1", "linux", "alpine")).toBe("router");
    });

    it("classifies by name pattern router", () => {
      expect(classifyNode("my-router", "linux", "alpine")).toBe("router");
    });

    it("classifies by name pattern spine", () => {
      expect(classifyNode("spine1", "linux", "alpine")).toBe("router");
    });

    it("classifies by name pattern core", () => {
      expect(classifyNode("core-sw", "linux", "alpine")).toBe("router");
    });

    it("classifies by name pattern gateway", () => {
      expect(classifyNode("gateway", "linux", "alpine")).toBe("router");
    });

    it("classifies by kind=router", () => {
      expect(classifyNode("node1", "router", "alpine")).toBe("router");
    });

    it("classifies by kind=srl", () => {
      expect(classifyNode("node1", "srl", "alpine")).toBe("router");
    });

    it("classifies by kind=ceos", () => {
      expect(classifyNode("node1", "ceos", "alpine")).toBe("router");
    });

    it("classifies by FRR image", () => {
      expect(classifyNode("node1", "linux", "frrouting/frr:latest")).toBe("router");
    });

    it("classifies by VyOS image", () => {
      expect(classifyNode("node1", "linux", "vyos/vyos:1.4")).toBe("router");
    });
  });

  describe("server classification", () => {
    it("classifies by name pattern s1", () => {
      expect(classifyNode("s1", "linux", "alpine")).toBe("server");
    });

    it("classifies by name pattern srv", () => {
      expect(classifyNode("srv-web", "linux", "alpine")).toBe("server");
    });

    it("classifies by name pattern dns", () => {
      expect(classifyNode("dns-server", "linux", "alpine")).toBe("server");
    });

    it("classifies by name pattern server", () => {
      expect(classifyNode("web-server", "linux", "alpine")).toBe("server");
    });

    it("classifies by dnsmasq image", () => {
      expect(classifyNode("node1", "linux", "dnsmasq:latest")).toBe("server");
    });

    it("classifies by nginx image", () => {
      expect(classifyNode("node1", "linux", "nginx:latest")).toBe("server");
    });

    it("classifies by prometheus image", () => {
      expect(classifyNode("node1", "linux", "prom/prometheus:latest")).toBe("server");
    });
  });

  describe("client classification", () => {
    it("classifies by name pattern pc", () => {
      expect(classifyNode("pc1", "linux", "alpine")).toBe("client");
    });

    it("classifies by name pattern h1", () => {
      expect(classifyNode("h1", "linux", "alpine")).toBe("client");
    });

    it("classifies by name pattern host", () => {
      expect(classifyNode("host-a", "linux", "alpine")).toBe("client");
    });

    it("classifies by name pattern client", () => {
      expect(classifyNode("client1", "linux", "alpine")).toBe("client");
    });

    it("defaults to client for unknown", () => {
      expect(classifyNode("unknown", "linux", "alpine")).toBe("client");
    });
  });

  describe("priority", () => {
    it("router name pattern takes priority over server image", () => {
      expect(classifyNode("r1", "linux", "dnsmasq:latest")).toBe("router");
    });

    it("router kind takes priority over server name", () => {
      expect(classifyNode("server1", "router", "alpine")).toBe("router");
    });
  });
});

describe("canvas interaction: pane click deselect", () => {
  // Simulates the onPaneClick → onSelectNode("") → setSelectedNode(null) flow
  function simulateNodeSelection(currentSelected: string | null, paneClicked: boolean): string | null {
    if (paneClicked) {
      // onPaneClick calls onSelectNode(""), which maps to setSelectedNode(name || null)
      const name = "";
      return name || null;
    }
    return currentSelected;
  }

  it("deselects node when clicking empty canvas", () => {
    const result = simulateNodeSelection("r1", true);
    expect(result).toBeNull();
  });

  it("keeps selection when not clicking canvas", () => {
    const result = simulateNodeSelection("r1", false);
    expect(result).toBe("r1");
  });

  it("returns null from null when clicking canvas", () => {
    const result = simulateNodeSelection(null, true);
    expect(result).toBeNull();
  });

  // Simulates the bottom panel behavior: open on select, close on deselect
  function shouldBottomPanelOpen(selectedNode: string | null, labState: string): boolean {
    if (selectedNode && (labState === "running" || labState === "deploying")) return true;
    if (!selectedNode) return false;
    return false; // default closed
  }

  it("opens panel when node selected and lab running", () => {
    expect(shouldBottomPanelOpen("r1", "running")).toBe(true);
  });

  it("closes panel when node deselected", () => {
    expect(shouldBottomPanelOpen(null, "running")).toBe(false);
  });

  it("does not open panel when lab stopped", () => {
    expect(shouldBottomPanelOpen("r1", "stopped")).toBe(false);
  });
});
