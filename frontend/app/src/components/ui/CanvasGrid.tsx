interface CanvasGridProps {
  style?: React.CSSProperties;
}

export default function CanvasGrid({ style }: CanvasGridProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "linear-gradient(rgba(18,18,18,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(18,18,18,0.05) 1px, transparent 1px)",
        backgroundSize: "30px 30px",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}
