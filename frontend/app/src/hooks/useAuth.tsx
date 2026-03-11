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
import { getAccessToken, setTokens, clearTokens, getActiveOrg, setActiveOrg } from "@/lib/auth";
import type { LoginRequest, LoginResponse, UserResponse, OrgResponse } from "@/types/api";

interface AuthContextValue {
  user: UserResponse | null;
  orgs: OrgResponse[];
  activeOrg: OrgResponse | null;
  loading: boolean;
  login: (req: LoginRequest) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string, user: UserResponse) => Promise<void>;
  logout: () => void;
  switchOrg: (orgUUID: string) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  orgs: [],
  activeOrg: null,
  loading: true,
  login: async () => {},
  loginWithTokens: async () => {},
  logout: () => {},
  switchOrg: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [orgs, setOrgs] = useState<OrgResponse[]>([]);
  const [activeOrg, setActiveOrgState] = useState<OrgResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrgs = useCallback(async () => {
    try {
      const orgList = await api.get<OrgResponse[]>("/api/v1/organizations");
      setOrgs(orgList);

      // Restore or pick first org
      const savedOrgId = getActiveOrg();
      const saved = orgList.find((o) => o.uuid === savedOrgId);
      if (saved) {
        setActiveOrgState(saved);
      } else if (orgList.length > 0) {
        setActiveOrg(orgList[0].uuid);
        setActiveOrgState(orgList[0]);
      }
    } catch {
      // User might not have orgs yet
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<UserResponse>("/api/v1/users/me")
      .then(async (u) => {
        setUser(u);
        await loadOrgs();
      })
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, [loadOrgs]);

  const login = useCallback(async (req: LoginRequest) => {
    const res = await api.post<LoginResponse>("/api/v1/auth/login", req);
    setTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    await loadOrgs();
  }, [loadOrgs]);

  const loginWithTokens = useCallback(async (accessToken: string, refreshToken: string, u: UserResponse) => {
    setTokens(accessToken, refreshToken);
    setUser(u);
    await loadOrgs();
  }, [loadOrgs]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setOrgs([]);
    setActiveOrgState(null);
    window.location.href = "/login";
  }, []);

  const switchOrg = useCallback((orgUUID: string) => {
    const org = orgs.find((o) => o.uuid === orgUUID);
    if (org) {
      setActiveOrg(orgUUID);
      setActiveOrgState(org);
    }
  }, [orgs]);

  return (
    <AuthContext.Provider value={{ user, orgs, activeOrg, loading, login, loginWithTokens, logout, switchOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
