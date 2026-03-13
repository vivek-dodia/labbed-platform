import { describe, it, expect } from "vitest";

// Test the YAML highlighting classification logic (not JSX rendering, just pattern matching)

function classifyYamlLine(line: string): "comment" | "key-value" | "list-item" | "plain" {
  if (line.trimStart().startsWith("#")) return "comment";
  if (line.match(/^(\s*)([\w-]+)(\s*:\s*)(.*)/)) return "key-value";
  if (line.match(/^(\s*)(- )(.*)/)) return "list-item";
  return "plain";
}

function classifyValue(value: string): "boolean" | "number" | "string" | "empty" | "plain" {
  const trimVal = value.trim();
  if (trimVal === "true" || trimVal === "false") return "boolean";
  if (/^\d+$/.test(trimVal)) return "number";
  if (trimVal.startsWith('"') || trimVal.startsWith("'")) return "string";
  if (trimVal === "" || trimVal === "|" || trimVal === ">") return "empty";
  return "plain";
}

describe("classifyYamlLine", () => {
  it("detects comments", () => {
    expect(classifyYamlLine("# this is a comment")).toBe("comment");
  });

  it("detects indented comments", () => {
    expect(classifyYamlLine("    # indented comment")).toBe("comment");
  });

  it("detects key-value pairs", () => {
    expect(classifyYamlLine("name: test-lab")).toBe("key-value");
  });

  it("detects indented key-value pairs", () => {
    expect(classifyYamlLine("    kind: linux")).toBe("key-value");
  });

  it("detects key with no value", () => {
    expect(classifyYamlLine("topology:")).toBe("key-value");
  });

  it("detects list items", () => {
    expect(classifyYamlLine("  - item1")).toBe("list-item");
  });

  it("detects plain lines", () => {
    expect(classifyYamlLine("")).toBe("plain");
  });

  it("detects plain text without colon", () => {
    expect(classifyYamlLine("  just some text")).toBe("plain");
  });

  it("detects key-value with hyphenated key", () => {
    expect(classifyYamlLine("  startup-config: /path/to/config")).toBe("key-value");
  });
});

describe("classifyValue", () => {
  it("detects true as boolean", () => {
    expect(classifyValue("true")).toBe("boolean");
  });

  it("detects false as boolean", () => {
    expect(classifyValue("false")).toBe("boolean");
  });

  it("detects numbers", () => {
    expect(classifyValue("42")).toBe("number");
  });

  it("detects quoted strings with double quotes", () => {
    expect(classifyValue('"hello"')).toBe("string");
  });

  it("detects quoted strings with single quotes", () => {
    expect(classifyValue("'hello'")).toBe("string");
  });

  it("detects empty value", () => {
    expect(classifyValue("")).toBe("empty");
  });

  it("detects pipe operator", () => {
    expect(classifyValue("|")).toBe("empty");
  });

  it("detects fold operator", () => {
    expect(classifyValue(">")).toBe("empty");
  });

  it("detects plain value", () => {
    expect(classifyValue("some-value")).toBe("plain");
  });

  it("handles value with spaces", () => {
    expect(classifyValue("  true  ")).toBe("boolean");
  });
});
