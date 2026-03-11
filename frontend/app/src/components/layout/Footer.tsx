export default function Footer() {
  return (
    <>
      {/* Gradient divider */}
      <div
        style={{
          gridColumn: "span 4",
          background:
            "linear-gradient(90deg, #d3cadd 0%, #e2a088 35%, #f4601d 65%, #206d39 100%)",
          height: "8vw",
        }}
      />
      {/* Status bar */}
      <div
        style={{
          gridColumn: "span 4",
          backgroundColor: "#F2F2F2",
          padding: "1vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="footnote">
          Section: Labbed / Network Simulation Platform
        </span>
        <span className="footnote">System Status: [Ready] — V.01.00</span>
      </div>
    </>
  );
}
