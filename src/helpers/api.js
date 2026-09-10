export const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

let authToken = null;

// Set after a successful login so mutating requests carry an explicit
// Authorization header instead of relying solely on the HttpOnly cookie.
// The cookie stays in place too (AuthContext still uses it to restore a
// session on page reload via GET /api/auth/me) — this just means a
// state-changing request from an already-open tab isn't cookie-only.
export function setAuthToken(token) {
  authToken = token;
}

export async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(API + path, { credentials: "include", ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return response.json();
}

export function jsonOptions(method, body) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}