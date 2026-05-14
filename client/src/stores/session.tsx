import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import { api } from "../services/api";
import type { DataEnvelope, UserProfile } from "../types";

type SessionContextValue = {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  loginMock: (userId: string) => Promise<void>;
  logout: () => void;
  setUser: (nextUser: UserProfile | null) => void;
  api: <T>(endpoint: string, data?: unknown, options?: RequestInit) => Promise<T>;
};

type SessionProviderProps = {
  children: ReactNode;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: SessionProviderProps) {
  const [user, setUserState] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem("chambleUser");
    return stored ? (JSON.parse(stored) as UserProfile) : null;
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("chambleToken")
  );
  const [loadingCount, setLoadingCount] = useState(0);

  const isLoading = loadingCount > 0;

  const setUser = useCallback((nextUser: UserProfile | null) => {
    setUserState(nextUser);
    if (nextUser) {
      localStorage.setItem("chambleUser", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("chambleUser");
    }
  }, []);

  const setSessionToken = useCallback((nextToken: string | null) => {
    setToken(nextToken);
    if (nextToken) {
      localStorage.setItem("chambleToken", nextToken);
    } else {
      localStorage.removeItem("chambleToken");
    }
  }, []);

  const apiWithSession = useCallback(
    async <T,>(endpoint: string, data?: unknown, options?: RequestInit) => {
      setLoadingCount((count) => count + 1);
      try {
        return await api<T>(endpoint, data, options ?? {});
      } finally {
        setLoadingCount((count) => Math.max(0, count - 1));
      }
    },
    []
  );

  const loginMock = useCallback(async (userId: string) => {
    const response = await apiWithSession<
      DataEnvelope<{ user: UserProfile; token: string }>
    >("/api/v1/auth/mock-login", { userId }, { method: "POST" });

    if (!response.isSuccess || !response.data) {
      throw new Error(response.message ?? "Unable to login right now.");
    }

    setUser(response.data.user);
    setSessionToken(response.data.token);
  }, [apiWithSession, setSessionToken, setUser]);

  const logout = useCallback(() => {
    setUser(null);
    setSessionToken(null);
  }, [setSessionToken, setUser]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      loginMock,
      logout,
      setUser,
      api: apiWithSession
    }),
    [apiWithSession, isLoading, loginMock, logout, setUser, token, user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
