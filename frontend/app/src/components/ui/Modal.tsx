"use client";

import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: Props) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(10,10,10,0.8)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#F2F2F2",
          border: "1px solid #0A0A0A",
          padding: "2rem",
          maxWidth: 600,
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <span
            className="label"
            style={{ fontSize: "1rem", fontWeight: 700 }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.2rem",
              color: "#0A0A0A",
              fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
