"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { getAccessToken, setTokens, clearTokens } from "@/lib/auth";
import type { LoginRequest, LoginResponse, UserResponse } from "@/types/api";

interface AuthContextValue {
  user: UserResponse | null;
  loading: boolean;
  login: (req: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<UserResponse>("/api/v1/users/me")
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (req: LoginRequest) => {
    const res = await api.post<LoginResponse>("/api/v1/auth/login", req);
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
