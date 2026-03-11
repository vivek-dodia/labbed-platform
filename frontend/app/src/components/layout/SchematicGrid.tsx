import type { ReactNode, CSSProperties } from "react";

export default function SchematicGrid({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "1px",
        backgroundColor: "#0A0A0A",
        width: "100%",
        minHeight: "100vh",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Cell({
  children,
  span = 1,
  style,
  dark,
  className,
  onClick,
}: {
  children?: ReactNode;
  span?: number;
  style?: CSSProperties;
  dark?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        backgroundColor: dark ? "#0A0A0A" : "#F2F2F2",
        color: dark ? "#F2F2F2" : "#0A0A0A",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gridColumn: `span ${span}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
