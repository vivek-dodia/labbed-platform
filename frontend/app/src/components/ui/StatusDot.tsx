const stateColors: Record<string, string> = {
  running: "var(--status-live)",
  online: "var(--status-live)",
  deploying: "var(--status-pending)",
  draining: "var(--status-pending)",
  stopping: "var(--status-pending)",
  scheduled: "var(--status-pending)",
  failed: "var(--status-fail)",
  stopped: "#0A0A0A",
  offline: "#0A0A0A",
  exited: "#0A0A0A",
};

export default function StatusDot({ state }: { state: string }) {
  const color = stateColors[state] || "#0A0A0A";
  const dim = state === "stopped" || state === "offline" || state === "exited";

  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: color,
        opacity: dim ? 0.3 : 1,
        flexShrink: 0,
      }}
    />
  );
}
