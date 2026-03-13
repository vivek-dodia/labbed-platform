import { describe, it, expect } from "vitest";
import type {
  LabEventResponse,
  LabResponse,
  NodeResponse,
  LabState,
  PaginatedResponse,
  WSMessageType,
  BindFileResponse,
} from "@/types/api";

describe("LabEventResponse type", () => {
  it("matches expected shape", () => {
    const event: LabEventResponse = {
      event: "deploy_started",
      details: "Lab deployment initiated by user",
      createdAt: "2026-03-12T10:00:00Z",
    };
    expect(event.event).toBe("deploy_started");
    expect(event.details).toBe("Lab deployment initiated by user");
    expect(event.createdAt).toBe("2026-03-12T10:00:00Z");
  });
});

describe("LabResponse type", () => {
  it("includes deployedAt for uptime calculation", () => {
    const lab: LabResponse = {
      uuid: "abc-123",
      name: "test-lab",
      state: "running",
      topologyId: "topo-1",
      creatorId: 1,
      nodes: [],
      scheduledStart: null,
      scheduledEnd: null,
      deployedAt: "2026-03-12T10:00:00Z",
      stoppedAt: null,
      errorMessage: null,
      createdAt: "2026-03-12T09:00:00Z",
    };
    expect(lab.deployedAt).toBe("2026-03-12T10:00:00Z");
    expect(lab.state).toBe("running");
  });

  it("supports all lab states", () => {
    const states: LabState[] = ["scheduled", "deploying", "running", "stopping", "failed", "stopped"];
    states.forEach((s) => {
      const lab: LabResponse = {
        uuid: "x", name: "x", state: s, topologyId: "x", creatorId: 1,
        nodes: [], scheduledStart: null, scheduledEnd: null,
        deployedAt: null, stoppedAt: null, errorMessage: null, createdAt: "x",
      };
      expect(lab.state).toBe(s);
    });
  });
});

describe("NodeResponse type", () => {
  it("has all fields needed for status dots and copy", () => {
    const node: NodeResponse = {
      name: "clab-lab1-r1",
      kind: "linux",
      image: "frrouting/frr:latest",
      containerId: "abc123def456",
      ipv4: "172.20.0.2",
      ipv6: "fd00::2",
      state: "running",
    };
    expect(node.state).toBe("running");
    expect(node.ipv4).toBe("172.20.0.2");
    expect(node.containerId).toBe("abc123def456");
  });
});

describe("PaginatedResponse type", () => {
  it("wraps LabEventResponse correctly", () => {
    const paginated: PaginatedResponse<LabEventResponse> = {
      data: [
        { event: "deploy_started", details: "started", createdAt: "2026-03-12T10:00:00Z" },
        { event: "deploy_completed", details: "completed", createdAt: "2026-03-12T10:01:00Z" },
      ],
      total: 2,
      limit: 100,
      offset: 0,
    };
    expect(paginated.data).toHaveLength(2);
    expect(paginated.total).toBe(2);
    expect(paginated.data[0].event).toBe("deploy_started");
  });
});

describe("BindFileResponse type", () => {
  it("supports optional content field for config diff", () => {
    const withContent: BindFileResponse = {
      uuid: "bf-1",
      filePath: "/etc/frr/frr.conf",
      content: "router bgp 65000\n neighbor 10.0.0.1 remote-as 65001",
      createdAt: "2026-03-12T10:00:00Z",
    };
    expect(withContent.content).toBeDefined();
    expect(withContent.content).toContain("router bgp");
  });

  it("works without content field", () => {
    const withoutContent: BindFileResponse = {
      uuid: "bf-2",
      filePath: "/etc/frr/frr.conf",
      createdAt: "2026-03-12T10:00:00Z",
    };
    expect(withoutContent.content).toBeUndefined();
  });
});

describe("WSMessageType", () => {
  it("includes lab:log for deployment logs", () => {
    const msgType: WSMessageType = "lab:log";
    expect(msgType).toBe("lab:log");
  });

  it("includes shell:data for exec commands", () => {
    const msgType: WSMessageType = "shell:data";
    expect(msgType).toBe("shell:data");
  });
});
