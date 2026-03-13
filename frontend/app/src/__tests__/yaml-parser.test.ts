import { describe, it, expect } from "vitest";
import { parseContainerlabYAML } from "@/lib/yaml-parser";

const SAMPLE_YAML = `name: test-lab
topology:
  nodes:
    r1:
      kind: linux
      image: frrouting/frr:latest
    r2:
      kind: linux
      image: frrouting/frr:latest
    pc1:
      kind: linux
      image: alpine:latest
  links:
    - endpoints: ["r1:eth1", "r2:eth1"]
    - endpoints: ["r1:eth2", "pc1:eth1"]`;

describe("parseContainerlabYAML", () => {
  it("extracts topology name", () => {
    const result = parseContainerlabYAML(SAMPLE_YAML);
    expect(result.name).toBe("test-lab");
  });

  it("extracts all nodes", () => {
    const result = parseContainerlabYAML(SAMPLE_YAML);
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.map((n) => n.name)).toEqual(["r1", "r2", "pc1"]);
  });

  it("extracts node kind", () => {
    const result = parseContainerlabYAML(SAMPLE_YAML);
    expect(result.nodes[0].kind).toBe("linux");
  });

  it("extracts node image", () => {
    const result = parseContainerlabYAML(SAMPLE_YAML);
    expect(result.nodes[0].image).toBe("frrouting/frr:latest");
  });

  it("extracts links", () => {
    const result = parseContainerlabYAML(SAMPLE_YAML);
    expect(result.links).toHaveLength(2);
  });

  it("parses link endpoints correctly", () => {
    const result = parseContainerlabYAML(SAMPLE_YAML);
    expect(result.links[0].a).toEqual({ node: "r1", iface: "eth1" });
    expect(result.links[0].b).toEqual({ node: "r2", iface: "eth1" });
  });

  it("populates node interfaces from links", () => {
    const result = parseContainerlabYAML(SAMPLE_YAML);
    const r1 = result.nodes.find((n) => n.name === "r1");
    expect(r1?.interfaces).toContain("eth1");
    expect(r1?.interfaces).toContain("eth2");
  });

  it("handles empty YAML", () => {
    const result = parseContainerlabYAML("");
    expect(result.name).toBe("");
    expect(result.nodes).toHaveLength(0);
    expect(result.links).toHaveLength(0);
  });

  it("handles YAML with only name", () => {
    const result = parseContainerlabYAML("name: simple");
    expect(result.name).toBe("simple");
    expect(result.nodes).toHaveLength(0);
  });

  it("handles nodes without images", () => {
    const yaml = `name: test
topology:
  nodes:
    n1:
      kind: linux`;
    const result = parseContainerlabYAML(yaml);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].image).toBe("");
  });
});
