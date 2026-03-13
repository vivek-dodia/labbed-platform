import { describe, it, expect } from "vitest";

// Re-implement the pure utility functions from labs/[id]/page.tsx for testing
// These are inline in the component file, so we test them via extraction here.

function shortName(name: string): string {
  const parts = name.split("-");
  if (parts.length > 2 && parts[0] === "clab") return parts.slice(2).join("-");
  return name;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ROUTER_IMAGES = ["frr", "frrouting", "srl", "ceos", "xrd", "vyos", "bird", "quagga", "gobgp"];
function isRouterNode(node: { image: string }): boolean {
  const img = node.image.toLowerCase();
  return ROUTER_IMAGES.some((r) => img.includes(r));
}

/* ── Config diff logic ── */
function computeLineDiff(a: string, b: string): { type: "same" | "added" | "removed"; line: string }[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const result: { type: "same" | "added" | "removed"; line: string }[] = [];

  const aSet = new Set(aLines);
  const bSet = new Set(bLines);

  for (const line of bLines) {
    if (aSet.has(line)) {
      result.push({ type: "same", line });
    } else {
      result.push({ type: "added", line });
    }
  }
  for (const line of aLines) {
    if (!bSet.has(line) && line.trim() !== "") {
      result.push({ type: "removed", line });
    }
  }

  return result;
}

/* ── Command history simulation ── */
function simulateHistory(commands: string[]): string[] {
  let history: string[] = [];
  for (const cmd of commands) {
    if (cmd.trim()) {
      history = [cmd, ...history.filter((c) => c !== cmd)].slice(0, 100);
    }
  }
  return history;
}

describe("shortName", () => {
  it("strips clab prefix from containerlab names", () => {
    expect(shortName("clab-mylab-router1")).toBe("router1");
  });

  it("handles multi-segment node names after clab prefix", () => {
    expect(shortName("clab-lab1-my-router")).toBe("my-router");
  });

  it("returns name unchanged if no clab prefix", () => {
    expect(shortName("router1")).toBe("router1");
  });

  it("returns name unchanged for two-segment names starting with clab", () => {
    expect(shortName("clab-only")).toBe("clab-only");
  });

  it("handles empty string", () => {
    expect(shortName("")).toBe("");
  });
});

describe("formatUptime", () => {
  it("formats zero seconds", () => {
    expect(formatUptime(0)).toBe("00:00:00");
  });

  it("formats seconds only", () => {
    expect(formatUptime(45)).toBe("00:00:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatUptime(125)).toBe("00:02:05");
  });

  it("formats hours, minutes, and seconds", () => {
    expect(formatUptime(3661)).toBe("01:01:01");
  });

  it("formats large values", () => {
    expect(formatUptime(86399)).toBe("23:59:59");
  });

  it("formats beyond 24 hours", () => {
    expect(formatUptime(90000)).toBe("25:00:00");
  });
});

describe("timeAgo", () => {
  it("shows seconds for recent times", () => {
    const now = new Date(Date.now() - 30000).toISOString();
    expect(timeAgo(now)).toBe("30s ago");
  });

  it("shows minutes", () => {
    const fiveMinAgo = new Date(Date.now() - 300000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("shows hours", () => {
    const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe("2h ago");
  });

  it("shows days", () => {
    const threeDaysAgo = new Date(Date.now() - 259200000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe("3d ago");
  });
});

describe("isRouterNode", () => {
  it("detects FRR image", () => {
    expect(isRouterNode({ image: "frrouting/frr:latest" })).toBe(true);
  });

  it("detects SRL image", () => {
    expect(isRouterNode({ image: "ghcr.io/nokia/srl:23.10" })).toBe(true);
  });

  it("detects cEOS image", () => {
    expect(isRouterNode({ image: "ceos:4.30" })).toBe(true);
  });

  it("rejects non-router images", () => {
    expect(isRouterNode({ image: "alpine:latest" })).toBe(false);
  });

  it("rejects dnsmasq", () => {
    expect(isRouterNode({ image: "dnsmasq:latest" })).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isRouterNode({ image: "FRRouting/FRR:v9" })).toBe(true);
  });
});

describe("getCommandsForImage", () => {
  interface QuickCmd { label: string; cmd: string; description: string }
  const FRR_COMMANDS: QuickCmd[] = [
    { label: "ROUTES", cmd: "vtysh -c 'show ip route'", description: "IP routing table" },
  ];
  const DNSMASQ_COMMANDS: QuickCmd[] = [
    { label: "LEASES", cmd: "cat /var/lib/misc/dnsmasq.leases 2>/dev/null || echo 'No leases'", description: "DHCP leases" },
  ];
  const LINUX_COMMANDS: QuickCmd[] = [
    { label: "IP ADDR", cmd: "ip addr show", description: "Interface addresses" },
  ];

  function getCommandsForImage(image: string): { category: string; commands: QuickCmd[] } {
    const img = image.toLowerCase();
    if (img.includes("frr") || img.includes("frrouting")) return { category: "FRR", commands: FRR_COMMANDS };
    if (img.includes("dnsmasq") || img.includes("kea")) return { category: "DHCP/DNS", commands: DNSMASQ_COMMANDS };
    return { category: "LINUX", commands: LINUX_COMMANDS };
  }

  it("returns FRR commands for FRR image", () => {
    expect(getCommandsForImage("frrouting/frr:latest").category).toBe("FRR");
  });

  it("returns DHCP/DNS commands for dnsmasq image", () => {
    expect(getCommandsForImage("dnsmasq:latest").category).toBe("DHCP/DNS");
  });

  it("returns DHCP/DNS commands for kea image", () => {
    expect(getCommandsForImage("isc/kea:2.4").category).toBe("DHCP/DNS");
  });

  it("returns LINUX commands for alpine image", () => {
    expect(getCommandsForImage("alpine:latest").category).toBe("LINUX");
  });

  it("returns LINUX commands for empty string", () => {
    expect(getCommandsForImage("").category).toBe("LINUX");
  });
});

describe("computeLineDiff", () => {
  it("marks identical lines as same", () => {
    const result = computeLineDiff("line1\nline2", "line1\nline2");
    expect(result.every((r) => r.type === "same")).toBe(true);
  });

  it("marks new lines in running config as added", () => {
    const result = computeLineDiff("line1", "line1\nline2");
    const added = result.filter((r) => r.type === "added");
    expect(added).toHaveLength(1);
    expect(added[0].line).toBe("line2");
  });

  it("marks removed lines from startup config", () => {
    const result = computeLineDiff("line1\nline2", "line1");
    const removed = result.filter((r) => r.type === "removed");
    expect(removed).toHaveLength(1);
    expect(removed[0].line).toBe("line2");
  });

  it("handles completely different configs", () => {
    const result = computeLineDiff("old1\nold2", "new1\nnew2");
    const added = result.filter((r) => r.type === "added");
    const removed = result.filter((r) => r.type === "removed");
    expect(added).toHaveLength(2);
    expect(removed).toHaveLength(2);
  });

  it("handles empty startup config", () => {
    const result = computeLineDiff("", "line1\nline2");
    const added = result.filter((r) => r.type === "added");
    expect(added).toHaveLength(2);
  });

  it("handles empty running config", () => {
    const result = computeLineDiff("line1\nline2", "");
    const removed = result.filter((r) => r.type === "removed");
    expect(removed).toHaveLength(2);
  });

  it("ignores blank removed lines", () => {
    const result = computeLineDiff("line1\n\nline2", "line1\nline2");
    const removed = result.filter((r) => r.type === "removed");
    expect(removed).toHaveLength(0); // blank line ignored
  });

  it("preserves order of running config lines", () => {
    const result = computeLineDiff("a\nb\nc", "c\nb\na");
    const sameLines = result.filter((r) => r.type === "same").map((r) => r.line);
    expect(sameLines).toEqual(["c", "b", "a"]);
  });
});

describe("capture API request construction", () => {
  function buildCaptureRequest(nodeName: string, iface: string, count: number, filter: string) {
    return {
      nodeName,
      interface: iface,
      count,
      filter: filter.trim(),
    };
  }

  it("builds basic capture request", () => {
    const req = buildCaptureRequest("clab-lab-r1", "eth1", 50, "");
    expect(req).toEqual({ nodeName: "clab-lab-r1", interface: "eth1", count: 50, filter: "" });
  });

  it("includes BPF filter", () => {
    const req = buildCaptureRequest("clab-lab-r1", "eth1", 50, "tcp port 179");
    expect(req.filter).toBe("tcp port 179");
  });

  it("trims whitespace from filter", () => {
    const req = buildCaptureRequest("clab-lab-r2", "eth2", 100, "  icmp  ");
    expect(req.filter).toBe("icmp");
  });

  it("respects packet count", () => {
    const req = buildCaptureRequest("clab-lab-r1", "eth1", 20, "");
    expect(req.count).toBe(20);
  });

  it("handles complex BPF filter", () => {
    const req = buildCaptureRequest("clab-lab-r1", "eth1", 100, "host 10.0.0.1 and tcp port 80");
    expect(req.filter).toBe("host 10.0.0.1 and tcp port 80");
  });

  it("parses capture output into lines", () => {
    const output = "14:30:01.123 IP 10.0.0.1 > 10.0.0.2: ICMP echo request\n14:30:01.124 IP 10.0.0.2 > 10.0.0.1: ICMP echo reply\n\n2 packets captured\n";
    const lines = output.split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("ICMP echo request");
    expect(lines[2]).toBe("2 packets captured");
  });
});

describe("capture side selection", () => {
  interface LinkEndpoint { node: string; iface: string }

  function getCaptureTarget(link: { a: LinkEndpoint; b: LinkEndpoint }, side: "a" | "b") {
    const ep = side === "a" ? link.a : link.b;
    return { node: ep.node, iface: ep.iface };
  }

  it("selects side A", () => {
    const link = { a: { node: "r1", iface: "eth1" }, b: { node: "r2", iface: "eth2" } };
    expect(getCaptureTarget(link, "a")).toEqual({ node: "r1", iface: "eth1" });
  });

  it("selects side B", () => {
    const link = { a: { node: "r1", iface: "eth1" }, b: { node: "r2", iface: "eth2" } };
    expect(getCaptureTarget(link, "b")).toEqual({ node: "r2", iface: "eth2" });
  });
});

describe("command history", () => {
  it("stores commands in reverse order", () => {
    const history = simulateHistory(["cmd1", "cmd2", "cmd3"]);
    expect(history[0]).toBe("cmd3");
    expect(history[1]).toBe("cmd2");
    expect(history[2]).toBe("cmd1");
  });

  it("deduplicates commands, keeping most recent", () => {
    const history = simulateHistory(["cmd1", "cmd2", "cmd1"]);
    expect(history).toEqual(["cmd1", "cmd2"]);
  });

  it("limits to 100 entries", () => {
    const commands = Array.from({ length: 150 }, (_, i) => `cmd${i}`);
    const history = simulateHistory(commands);
    expect(history).toHaveLength(100);
    expect(history[0]).toBe("cmd149");
  });

  it("ignores empty commands", () => {
    const history = simulateHistory(["cmd1", "", "  ", "cmd2"]);
    expect(history).toEqual(["cmd2", "cmd1"]);
  });

  it("handles single command", () => {
    const history = simulateHistory(["only"]);
    expect(history).toEqual(["only"]);
  });

  it("returns empty for no commands", () => {
    const history = simulateHistory([]);
    expect(history).toEqual([]);
  });
});
