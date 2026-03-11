"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import type { CSSProperties } from "react";

interface NavItem {
  label: string;
  href: string;
  dark?: boolean;
}

const cellBase: CSSProperties = {
  backgroundColor: "#F2F2F2",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1vw 1.5vw",
};

const cellDark: CSSProperties = {
  ...cellBase,
  backgroundColor: "#0A0A0A",
  color: "#F2F2F2",
};

export default function Header({ navItems }: { navItems: NavItem[] }) {
  const { user, logout } = useAuth();

  // always 4 cells: brand + up to 2 nav items + right cell
  const items = navItems.slice(0, 2);

  return (
    <div
      style={{
        gridColumn: "span 4",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gap: "1px",
        background: "#0A0A0A",
      }}
    >
      {/* Brand */}
      <Link
        href="/"
        style={{
          ...cellBase,
          textDecoration: "none",
          color: "#0A0A0A",
        }}
      >
        <span className="label" style={{ fontWeight: 700 }}>
          LABBED
        </span>
      </Link>

      {/* Nav items */}
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            ...(item.dark ? cellDark : cellBase),
            textDecoration: "none",
            color: item.dark ? "#F2F2F2" : "#0A0A0A",
          }}
        >
          <span className="label">{item.label}</span>
        </Link>
      ))}

      {/* Fill remaining cells if < 2 nav items */}
      {items.length < 2 && <div style={cellBase} />}

      {/* Right cell — user info or contextual action */}
      <div style={cellDark}>
        {user ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <span className="label">{user.email}</span>
            <button
              onClick={logout}
              className="label"
              style={{
                background: "none",
                border: "1px solid #F2F2F2",
                color: "#F2F2F2",
                padding: "0.3rem 0.8rem",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              LOGOUT
            </button>
          </div>
        ) : (
          <span className="label">SYSTEM ACCESS</span>
        )}
      </div>
    </div>
  );
}
