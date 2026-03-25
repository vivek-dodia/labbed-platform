"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const MONO = "'Space Mono', monospace";
const FONT = "'Manrope', sans-serif";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      <div style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        pointerEvents: "none",
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === "error" ? "#1a1a1a" : t.type === "success" ? "#000" : "#000",
              color: t.type === "error" ? "#ff6b6b" : t.type === "success" ? "#79f673" : "#fff",
              border: `1px solid ${t.type === "error" ? "#ff6b6b33" : t.type === "success" ? "#79f67333" : "rgba(255,255,255,0.1)"}`,
              padding: "0.6rem 1.2rem",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontFamily: MONO,
              pointerEvents: "auto",
              animation: "toastIn 0.3s ease",
              maxWidth: 400,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
