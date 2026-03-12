interface StatusBadgeProps {
  state: string;
}

const STATE_STYLES: Record<string, { bg: string; border: string }> = {
  running: { bg: "transparent", border: "2px solid #000000" },
  online: { bg: "transparent", border: "2px solid #000000" },
  stopped: { bg: "transparent", border: "1px dashed #000000" },
  offline: { bg: "transparent", border: "1px dashed #000000" },
  deploying: { bg: "transparent", border: "1px dotted #000000" },
  stopping: { bg: "transparent", border: "1px dotted #000000" },
  pending: { bg: "transparent", border: "1px dotted #000000" },
  failed: { bg: "#000000", border: "1px solid #000000" },
  draft: { bg: "transparent", border: "1px solid #000000" },
};

export default function StatusBadge({ state }: StatusBadgeProps) {
  const normalized = state.toLowerCase();
  const styles = STATE_STYLES[normalized] || { bg: "transparent", border: "1px solid #000000" };

  return (
    <span
      style={{
        fontSize: "0.6rem",
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "0.15rem 0.5rem",
        border: styles.border,
        borderRadius: 4,
        background: styles.bg,
        color: styles.bg === "#000000" ? "#79f673" : "#000000",
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
