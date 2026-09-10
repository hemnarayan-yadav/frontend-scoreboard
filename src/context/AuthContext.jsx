import { createContext, useContext, useEffect, useState } from "react";
import { api, jsonOptions, setAuthToken } from "../helpers/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const result = await api("/api/auth/login", jsonOptions("POST", { email, password }));
    setAuthToken(result.token);
    setUser(result.user);
    return result.user;
  }

  async function logout() {
    // Clear local session state even if the network call fails — a signed
    // out admin should stay signed out from the UI's point of view either
    // way, rather than getting stuck because /logout timed out.
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuthToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}