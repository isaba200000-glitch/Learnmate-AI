// Admin panel authentication. The admin logs in with a password and receives a
// short-lived signed token, stored locally and sent as a Bearer header on
// admin API calls. This is separate from the Clerk (student) session.

const TOKEN_KEY = "learnmate_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// Options passed to generated API functions so they carry the admin token.
// Setting Authorization explicitly also stops the Clerk token getter from
// overriding it.
export function adminOptions(): RequestInit {
  const token = getAdminToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

export function isUnauthorized(error: unknown): boolean {
  return !!error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 401;
}
