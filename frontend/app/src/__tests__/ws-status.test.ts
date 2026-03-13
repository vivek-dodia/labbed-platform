import { describe, it, expect } from "vitest";
import type { WSConnectionStatus } from "@/lib/ws";

describe("WSConnectionStatus type", () => {
  it("supports connected state", () => {
    const status: WSConnectionStatus = "connected";
    expect(status).toBe("connected");
  });

  it("supports connecting state", () => {
    const status: WSConnectionStatus = "connecting";
    expect(status).toBe("connecting");
  });

  it("supports disconnected state", () => {
    const status: WSConnectionStatus = "disconnected";
    expect(status).toBe("disconnected");
  });
});

describe("WS status indicator logic", () => {
  function getWSColor(status: WSConnectionStatus): string {
    if (status === "connected") return "#27c93f";
    if (status === "connecting") return "#ffbd2e";
    return "#ff5f56";
  }

  function getWSLabel(status: WSConnectionStatus): string {
    if (status === "connected") return "WS";
    if (status === "connecting") return "WS...";
    return "WS OFF";
  }

  it("shows green for connected", () => {
    expect(getWSColor("connected")).toBe("#27c93f");
  });

  it("shows yellow for connecting", () => {
    expect(getWSColor("connecting")).toBe("#ffbd2e");
  });

  it("shows red for disconnected", () => {
    expect(getWSColor("disconnected")).toBe("#ff5f56");
  });

  it("shows WS label for connected", () => {
    expect(getWSLabel("connected")).toBe("WS");
  });

  it("shows WS... label for connecting", () => {
    expect(getWSLabel("connecting")).toBe("WS...");
  });

  it("shows WS OFF label for disconnected", () => {
    expect(getWSLabel("disconnected")).toBe("WS OFF");
  });
});
