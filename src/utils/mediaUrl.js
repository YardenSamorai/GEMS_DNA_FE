/* =============================================================================
 * Cleaning a media URL that came out of the supplier feed
 * =============================================================================
 *
 * Every photo, video and certificate link in the catalog arrives from the
 * Barak / SOAP export, and arrives dirty in three specific ways:
 *
 *   - Folder-only paths. The export emits the directory (".../StoneImages/")
 *     even when nothing was ever uploaded, so the URL 404s and renders as a
 *     torn-page icon. Those count as no media at all.
 *
 *   - HTML entities. The rows come out of an HTML export, so an "&" survives
 *     as "&amp;" and the query string of any URL carrying one is wrong.
 *
 *   - Plain http. The app is served over https, and browsers refuse to load
 *     insecure video on a secure page — the slide comes up black with nothing
 *     on screen to explain why. Upgrading the scheme is safe here in a way it
 *     often isn't: a host that doesn't answer on https was already being
 *     blocked outright, so there is nothing left to lose.
 * ========================================================================== */

/**
 * @param u  raw URL from the feed
 * @returns the URL in a form that can be used as a src, or null when the feed
 *          gave us a folder rather than a file.
 */
export const usableMediaUrl = (u) => {
  if (!u || typeof u !== "string") return null;
  const clean = u
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/^http:\/\//i, "https://");
  if (!clean) return null;
  const file = clean.split("?")[0].split("/").pop();
  return file ? clean : null;
};

export default usableMediaUrl;
