"use client";

import { useEffect, useRef } from "react";

interface EditorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function EditorialModal({
  isOpen,
  onClose,
  title,
  children,
}: EditorialModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(18,18,18,0.6)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#F3EFE7",
          border: "1px solid #121212",
          padding: "2.5rem",
          maxWidth: 560,
          width: "90%",
          position: "relative",
          fontFamily: "Manrope, sans-serif",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1.25rem",
            background: "none",
            border: "none",
            fontSize: "1.25rem",
            cursor: "pointer",
            color: "#121212",
            fontFamily: "Manrope, sans-serif",
            lineHeight: 1,
          }}
          aria-label="Close modal"
        >
          ✕
        </button>

        {/* Title */}
        <h2
          style={{
            margin: "0 0 1.5rem 0",
            fontSize: "0.85rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#121212",
          }}
        >
          {title}
        </h2>

        {children}
      </div>
    </div>
  );
}
