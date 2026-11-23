import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type LoginInput,
  type RegisterInput,
  type User,
} from "../api/auth";
import {
  onSessionExpired,
  refreshAccessToken,
  setAccessToken,
} from "../api/http";
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from "./authContext";

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
  });

  const markUnauthenticated = useCallback(() => {
    setAccessToken(null);
    setState({
      status: "unauthenticated",
      user: null,
    });
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      markUnauthenticated();
    });
  }, [markUnauthenticated]);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      try {
        const token = await refreshAccessToken();
        if (!token) {
          if (active) {
            setState({ status: "unauthenticated", user: null });
          }
          return;
        }

        const currentUser = await getMe();
        if (active) {
          setState({ status: "authenticated", user: currentUser });
        }
      } catch {
        if (active) {
          setAccessToken(null);
          setState({ status: "unauthenticated", user: null });
        }
      }
    }

    void bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput): Promise<User> => {
    const loggedInUser = await loginRequest(input);
    setState({
      status: "authenticated",
      user: loggedInUser,
    });
    return loggedInUser;
  }, []);

  const register = useCallback(async (input: RegisterInput): Promise<User> => {
    const registeredUser = await registerRequest(input);
    setState({
      status: "authenticated",
      user: registeredUser,
    });
    return registeredUser;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutRequest();
    } finally {
      markUnauthenticated();
    }
  }, [markUnauthenticated]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      login,
      register,
      logout,
    }),
    [state.status, state.user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
