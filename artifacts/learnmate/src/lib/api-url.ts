/**
 * Builds an API URL for both local/Replit same-origin development and the
 * separately hosted production frontend.
 */
export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return base
    ? `${base}/api${normalizedPath}`
    : `${import.meta.env.BASE_URL}api${normalizedPath}`;
}