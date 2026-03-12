"use client";

import { useState } from "react";

interface PillProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "secondary";
  type?: "button" | "submit";
  disabled?: boolean;
  style?: React.CSSProperties;
  dashed?: boolean;
}

const VARIANT_BG: Record<string, string> = {
  default: "transparent",
  primary: "#000000",
  secondary: "transparent",
};

const VARIANT_COLOR: Record<string, string> = {
  default: "#000000",
  primary: "#79f673",
  secondary: "#000000",
};

export default function Pill({
  children,
  onClick,
  variant = "default",
  type = "button",
  disabled = false,
  style,
  dashed = false,
}: PillProps) {
  const [hovered, setHovered] = useState(false);

  const canHover = !disabled && hovered;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 99,
        border: `1px ${dashed ? "dashed" : "solid"} #000000`,
        padding: "0.5rem 1.2rem",
        fontSize: "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        fontFamily: "Manrope, sans-serif",
        background: VARIANT_BG[variant] || "transparent",
        color: VARIANT_COLOR[variant] || "#000000",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transform: canHover ? "translateY(-2px)" : "none",
        boxShadow: canHover ? "4px 4px 0 #000000" : "none",
        transition: "transform 0.15s, box-shadow 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
