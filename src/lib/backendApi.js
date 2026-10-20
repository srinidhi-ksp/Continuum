export function getBackendUrl() {
  const configuredUrl = import.meta.env.VITE_BACKEND_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  if (import.meta.env.DEV) return "http://localhost:8000";
  throw new Error("VITE_BACKEND_URL must be configured for production.");
}
