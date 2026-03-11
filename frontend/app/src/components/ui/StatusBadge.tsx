interface StatusBadgeProps {
  state: string;
}

const STATE_COLORS: Record<string, string> = {
  running: "#A8EAB5",
  online: "#A8EAB5",
  stopped: "#ddd",
  offline: "#ddd",
  deploying: "#E4CB6A",
  stopping: "#E4CB6A",
  pending: "#E4CB6A",
  failed: "#EAA8C6",
  draft: "#D0C3DF",
};

export default function StatusBadge({ state }: StatusBadgeProps) {
  const normalized = state.toLowerCase();
  const bg = STATE_COLORS[normalized] || "transparent";

  return (
    <span
      style={{
        fontSize: "0.6rem",
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "0.15rem 0.5rem",
        border: "1px solid #121212",
        borderRadius: 4,
        background: bg,
        color: "#121212",
        fontFamily: "Manrope, sans-serif",
        letterSpacing: "0.05em",
        display: "inline-block",
        lineHeight: 1.4,
      }}
    >
      {state}
    </span>
  );
}
