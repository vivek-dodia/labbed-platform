"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { LoginResponse } from "@/types/api";

function GoogleCallbackInner() {
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithTokens } = useAuth();

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code received");
      return;
    }

    api
      .post<LoginResponse>("/api/v1/auth/google/callback", { code })
      .then(async (res) => {
        await loginWithTokens(res.accessToken, res.refreshToken, res.user);
        router.push("/");
      })
      .catch(() => {
        setError("Google authentication failed. Please try again.");
      });
  }, [searchParams, loginWithTokens, router]);

  if (error) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{
          fontSize: "0.65rem",
          textTransform: "uppercase",
          fontWeight: 700,
          letterSpacing: "0.05em",
          fontFamily: "'Manrope', sans-serif",
          color: "#000000",
          marginBottom: "1rem",
        }}>
          {error}
        </p>
        <a
          href="/login"
          style={{
            fontSize: "0.65rem",
            textTransform: "uppercase",
            fontWeight: 700,
            letterSpacing: "0.05em",
            fontFamily: "'Manrope', sans-serif",
            color: "#000000",
            textDecoration: "underline",
          }}
        >
          RETURN TO LOGIN
        </a>
      </div>
    );
  }

  return (
    <p style={{
      fontSize: "0.65rem",
      textTransform: "uppercase",
      fontWeight: 700,
      letterSpacing: "0.05em",
      fontFamily: "'Manrope', sans-serif",
      opacity: 0.4,
      color: "#000000",
    }}>
      AUTHENTICATING WITH GOOGLE...
    </p>
  );
}

export default function GoogleCallbackPage() {
  return (
    <div
      style={{
        backgroundColor: "#79f673",
        color: "#000000",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      <Suspense
        fallback={
          <p style={{
            fontSize: "0.65rem",
            textTransform: "uppercase",
            fontWeight: 700,
            letterSpacing: "0.05em",
            fontFamily: "'Manrope', sans-serif",
            opacity: 0.4,
            color: "#000000",
          }}>
            LOADING...
          </p>
        }
      >
        <GoogleCallbackInner />
      </Suspense>
    </div>
  );
}
