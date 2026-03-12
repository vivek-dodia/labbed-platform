"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface AppShellProps {
  children: React.ReactNode;
  navItems?: { label: string; href: string }[];
  activeNav?: string;
}

const DRAWER_ITEMS = [
  { label: "TOPOLOGIES", href: "/topologies" },
  { label: "COLLECTIONS", href: "/collections" },
  { label: "LABS", href: "/labs" },
  { label: "SETTINGS", href: "/settings" },
  { label: "DOCUMENTATION", href: "/docs" },
];

const SIDEBAR_LABELS = ["LABS", "ARCHIVE", "SETTINGS"];

function MenuDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200,
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 320,
          background: "#79f673",
          borderRight: "1px solid #000000",
          zIndex: 201,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
          padding: "2.5rem 2rem",
        }}
      >
        <button
          onClick={onClose}
          style={{
            alignSelf: "flex-end",
            background: "none",
            border: "none",
            fontSize: "1.25rem",
            cursor: "pointer",
            color: "#000000",
            marginBottom: "2rem",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          ✕
        </button>

        <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {DRAWER_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              style={{
                display: "block",
                padding: "1rem 0",
                borderBottom: "1px solid #000000",
                textDecoration: "none",
                color: "#000000",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontFamily: "Manrope, sans-serif",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

export default function AppShell({ children, navItems = [], activeNav }: AppShellProps) {
  const { user, orgs, activeOrg, switchOrg, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  const resolvedActive = activeNav || pathname;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#79f673",
        color: "#000000",
        fontFamily: "Manrope, sans-serif",
      }}
    >
      <MenuDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Left sidebar - 48px wide */}
      <aside
        style={{
          width: 48,
          minWidth: 48,
          borderRight: "1px solid #000000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            width: 48,
            height: 48,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            background: "none",
            border: "none",
            borderBottom: "1px solid #000000",
            cursor: "pointer",
            padding: 0,
          }}
          aria-label="Open menu"
        >
          <span style={{ display: "block", width: 24, height: 1, background: "#000000" }} />
          <span style={{ display: "block", width: 24, height: 1, background: "#000000" }} />
          <span style={{ display: "block", width: 24, height: 1, background: "#000000" }} />
        </button>

        {/* Vertical labels */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: "1rem",
            gap: "1.5rem",
          }}
        >
          {SIDEBAR_LABELS.map((label) => (
            <span
              key={label}
              style={{
                writingMode: "vertical-rl",
                transform: "scale(-1)",
                fontSize: "0.55rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                opacity: 0.35,
                userSelect: "none",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </aside>

      {/* Main column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top nav bar - 48px tall */}
        <header
          style={{
            height: 48,
            minHeight: 48,
            borderBottom: "1px solid #000000",
            display: "flex",
            alignItems: "stretch",
          }}
        >
          {/* Left side */}
          <div style={{ display: "flex", alignItems: "stretch" }}>
            {/* Brand */}
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 1.5rem",
                borderRight: "1px solid #000000",
                textDecoration: "none",
                color: "#000000",
                fontWeight: 800,
                fontSize: "0.75rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontFamily: "Manrope, sans-serif",
              }}
            >
              LABBED
            </Link>

            {/* Nav items */}
            {navItems.map((item) => {
              const isActive = resolvedActive === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 1.5rem",
                    height: "100%",
                    borderRight: "1px solid #000000",
                    textDecoration: "none",
                    color: isActive ? "#79f673" : "#000000",
                    background: isActive ? "#000000" : "transparent",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    fontFamily: "Manrope, sans-serif",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "#000000";
                      e.currentTarget.style.color = "#79f673";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#000000";
                    }
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "stretch" }}>
            {/* Org switcher */}
            {orgs.length > 0 && (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "stretch",
                }}
              >
                <button
                  onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 1.5rem",
                    height: "100%",
                    background: "none",
                    border: "none",
                    borderLeft: "1px solid #000000",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    fontFamily: "Manrope, sans-serif",
                    color: "#000000",
                  }}
                >
                  {activeOrg?.name || "ORG"}
                  <span style={{ marginLeft: "0.5rem", fontSize: "0.5rem" }}>
                    {orgDropdownOpen ? "\u25B2" : "\u25BC"}
                  </span>
                </button>

                {orgDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      background: "#79f673",
                      border: "1px solid #000000",
                      zIndex: 50,
                      minWidth: 180,
                    }}
                  >
                    {orgs.map((org) => (
                      <button
                        key={org.uuid}
                        onClick={() => {
                          switchOrg(org.uuid);
                          setOrgDropdownOpen(false);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "0.75rem 1.5rem",
                          border: "none",
                          borderBottom: "1px solid #000000",
                          background:
                            activeOrg?.uuid === org.uuid ? "#000000" : "transparent",
                          color:
                            activeOrg?.uuid === org.uuid ? "#79f673" : "#000000",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          fontFamily: "Manrope, sans-serif",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {org.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* User email */}
            {user && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 1.5rem",
                  borderLeft: "1px solid #000000",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                {user.email}
              </div>
            )}

            {/* Logout */}
            <button
              onClick={logout}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 1.5rem",
                height: "100%",
                background: "none",
                border: "none",
                borderLeft: "1px solid #000000",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontFamily: "Manrope, sans-serif",
                color: "#000000",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#000000";
                e.currentTarget.style.color = "#79f673";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#000000";
              }}
            >
              LOGOUT
            </button>
          </div>
        </header>

        {/* Content area */}
        <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
      </div>
    </div>
  );
}
