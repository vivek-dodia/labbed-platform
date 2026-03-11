"use client";

import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function SchematicInput({ label, ...props }: Props) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <span
        className="label"
        style={{ fontSize: "0.7rem", display: "block", marginBottom: "0.3rem" }}
      >
        {label}
      </span>
      <input
        {...props}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid #0A0A0A",
          padding: "0.5rem 0",
          fontSize: "1.2rem",
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          outline: "none",
          color: "#0A0A0A",
          ...props.style,
        }}
      />
    </div>
  );
}
