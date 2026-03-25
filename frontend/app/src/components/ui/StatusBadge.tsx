interface StatusBadgeProps {
  state: string;
}

const STATE_STYLES: Record<string, { bg: string; border: string; pulse?: boolean }> = {
  running:   { bg: "transparent", border: "2px solid #000000" },
  online:    { bg: "transparent", border: "2px solid #000000" },
  scheduled: { bg: "transparent", border: "1px solid rgba(0,0,0,0.3)" },
  stopped:   { bg: "transparent", border: "1px dashed rgba(0,0,0,0.3)" },
  offline:   { bg: "transparent", border: "1px dashed rgba(0,0,0,0.3)" },
  deploying: { bg: "transparent", border: "1px solid #000000", pulse: true },
  stopping:  { bg: "transparent", border: "1px solid #000000", pulse: true },
  pending:   { bg: "transparent", border: "1px dotted rgba(0,0,0,0.4)" },
  failed:    { bg: "#000000", border: "1px solid #000000" },
  draft:     { bg: "transparent", border: "1px solid rgba(0,0,0,0.3)" },
};

export default function StatusBadge({ state }: StatusBadgeProps) {
  const normalized = state.toLowerCase();
  const styles = STATE_STYLES[normalized] || { bg: "transparent", border: "1px solid #000000" };

  return (
    <>
      <span
        style={{
          fontSize: "0.55rem",
          fontWeight: 700,
          textTransform: "uppercase",
          padding: "0.2rem 0.5rem",
          border: styles.border,
          background: styles.bg,
          color: styles.bg === "#000000" ? "#79f673" : "#000000",
          fontFamily: "'Space Mono', monospace",
          letterSpacing: "0.06em",
          display: "inline-block",
          lineHeight: 1.3,
          animation: styles.pulse ? "statusPulse 1.5s ease-in-out infinite" : undefined,
        }}
      >
        {state}
      </span>
      {styles.pulse && (
        <style>{`
          @keyframes statusPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      )}
    </>
  );
}
