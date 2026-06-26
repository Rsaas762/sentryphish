import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
}
interface Org {
  id: string;
  name: string;
  slug: string;
}
interface Session {
  user: User;
  organization: Org;
}

export interface SignupInput {
  name: string;
  orgName: string;
  email: string;
  password: string;
  legalAuthorityConfirmed: boolean;
}

interface AuthState {
  user: User | null;
  org: Org | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Session>("/api/auth/me")
      .then((s) => {
        setUser(s.user);
        setOrg(s.organization);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const apply = (s: Session) => {
    setUser(s.user);
    setOrg(s.organization);
  };

  const login = async (email: string, password: string) =>
    apply(await api.post<Session>("/api/auth/login", { email, password }));
  const signup = async (input: SignupInput) =>
    apply(await api.post<Session>("/api/auth/signup", input));
  const logout = async () => {
    await api.post("/api/auth/logout");
    setUser(null);
    setOrg(null);
  };

  return (
    <Ctx.Provider value={{ user, org, loading, login, signup, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
