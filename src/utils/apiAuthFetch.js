/**
 * Global fetch interceptor — attaches the verified Clerk session token to
 * every request bound for our backend.
 *
 * Why this exists: the backend used to identify callers from client-set
 * headers (x-actor-id / userId), which anyone could spoof. The backend now
 * verifies a Clerk session JWT instead. Rather than editing every one of the
 * dozens of `fetch()` call sites across services and components, we patch
 * `window.fetch` once here so that any request to the API base automatically
 * carries `Authorization: Bearer <token>`.
 *
 * Imported first in src/index.js so the patch is installed before any
 * component mounts and issues a request.
 */
const API_BASE =
  process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

const targetsApi = (url) => {
  if (!url) return false;
  const u = String(url);
  // Absolute calls to our backend, or relative "/api/..." paths.
  return u.startsWith(API_BASE) || u.startsWith("/api/");
};

if (typeof window !== "undefined" && !window.__gemsAuthFetchPatched) {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const opts = init ? { ...init } : {};
    try {
      const url = typeof input === "string" ? input : input && input.url;
      const clerk = window.Clerk;
      if (targetsApi(url) && clerk && clerk.session) {
        const token = await clerk.session.getToken();
        if (token) {
          const headers = new Headers(
            (init && init.headers) ||
              (typeof input !== "string" && input && input.headers) ||
              {}
          );
          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
          }
          opts.headers = headers;
        }
      }
    } catch (_) {
      // If token retrieval fails, fall through to the original request so
      // genuinely public endpoints keep working.
    }
    return originalFetch(input, opts);
  };

  window.__gemsAuthFetchPatched = true;
}
