import type { ReactNode, CSSProperties } from "react";

interface Props {
  headers: string[];
  columnTemplate?: string;
  rows: ReactNode[][];
  onRowClick?: (index: number) => void;
}

export default function MatrixTable({
  headers,
  columnTemplate,
  rows,
  onRowClick,
}: Props) {
  const cols = columnTemplate || headers.map(() => "1fr").join(" ");

  const headerStyle: CSSProperties = {
    backgroundColor: "#EBEBEB",
    padding: "1rem 1.5rem",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    fontWeight: 700,
  };

  const cellStyle: CSSProperties = {
    backgroundColor: "#F2F2F2",
    padding: "1rem 1.5rem",
    borderBottom: "1px solid #0A0A0A",
    display: "flex",
    alignItems: "center",
    fontSize: "0.8rem",
    lineHeight: 1.4,
  };

  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "grid",
        gridTemplateColumns: cols,
        gap: "1px",
        backgroundColor: "#0A0A0A",
        width: "100%",
      }}
    >
      {headers.map((h, i) => (
        <div key={i} style={headerStyle}>
          {h}
        </div>
      ))}
      {rows.map((row, ri) =>
        row.map((cell, ci) => (
          <div
            key={`${ri}-${ci}`}
            onClick={() => onRowClick?.(ri)}
            style={{
              ...cellStyle,
              cursor: onRowClick ? "pointer" : "default",
            }}
          >
            {cell}
          </div>
        ))
      )}
    </div>
  );
}
