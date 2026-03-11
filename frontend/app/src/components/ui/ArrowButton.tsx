"use client";

import { useState, type CSSProperties } from "react";

interface Props {
  label: string;
  onClick?: () => void;
  inverted?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
}

export default function ArrowButton({
  label,
  onClick,
  inverted,
  type = "button",
  disabled,
  style,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const active = (inverted ? !hovered : hovered) && !disabled;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: disabled ? "not-allowed" : "pointer",
        border: "1px solid #0A0A0A",
        padding: "1rem 1.5rem",
        transition: "all 0.2s ease",
        backgroundColor: active ? "#0A0A0A" : "transparent",
        color: active ? "#F2F2F2" : "#0A0A0A",
        width: "100%",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      <span className="label">{label}</span>
      <svg width="30" height="15" viewBox="0 0 30 15">
        <line
          x1="0"
          y1="7.5"
          x2="28"
          y2="7.5"
          stroke={active ? "#F2F2F2" : "#0A0A0A"}
          strokeWidth="1.5"
        />
        <polygon
          points="25,3 30,7.5 25,12"
          fill={active ? "#F2F2F2" : "#0A0A0A"}
        />
      </svg>
    </button>
  );
}
