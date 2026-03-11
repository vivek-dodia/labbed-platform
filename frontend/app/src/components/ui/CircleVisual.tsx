export default function CircleVisual({ size = "10vw" }: { size?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: "1px solid #0A0A0A",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "2rem",
      }}
    >
      <div
        style={{
          width: "60%",
          height: "60%",
          background: "#0A0A0A",
          borderRadius: "50%",
        }}
      />
    </div>
  );
}
