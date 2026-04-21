/**
 * Geo detection helpers — frontend.
 *
 * Two layers:
 *   1. Synchronous client-side detection from phone number / email TLD,
 *      using libphonenumber-js. Zero network, instant — perfect for live
 *      typing suggestions.
 *   2. Async backend call (/api/crm/geo/detect) that adds Mapbox
 *      geocoding when a city/address is present.
 *
 * Components should generally call `useGeoSuggestion` (the hook) so they
 * get debouncing + cancellation for free.
 */

import { useEffect, useRef, useState } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

/* ---------- Country code → English name -------------------------------- */
const COUNTRY_NAMES = {
  US: "United States", CA: "Canada", MX: "Mexico",
  GB: "United Kingdom", IE: "Ireland",
  IL: "Israel", AE: "United Arab Emirates", SA: "Saudi Arabia",
  TR: "Turkey", EG: "Egypt", JO: "Jordan", LB: "Lebanon",
  DE: "Germany", FR: "France", IT: "Italy", ES: "Spain",
  NL: "Netherlands", BE: "Belgium", CH: "Switzerland", AT: "Austria",
  PL: "Poland", CZ: "Czech Republic", SE: "Sweden", NO: "Norway",
  DK: "Denmark", FI: "Finland", PT: "Portugal", GR: "Greece",
  HU: "Hungary", RO: "Romania", RU: "Russia", UA: "Ukraine",
  IN: "India", PK: "Pakistan", CN: "China", JP: "Japan",
  KR: "South Korea", TH: "Thailand", VN: "Vietnam", PH: "Philippines",
  ID: "Indonesia", MY: "Malaysia", SG: "Singapore", HK: "Hong Kong",
  TW: "Taiwan", AU: "Australia", NZ: "New Zealand",
  BR: "Brazil", AR: "Argentina", CL: "Chile", CO: "Colombia", PE: "Peru",
  ZA: "South Africa", NG: "Nigeria", KE: "Kenya", MA: "Morocco",
};
export const countryName = (cc) => (cc ? COUNTRY_NAMES[cc.toUpperCase()] || cc.toUpperCase() : null);

export const flagEmoji = (cc) => {
  if (!cc || cc.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
};

/* ---------- Quick client-side helpers ---------------------------------- */
export const countryFromPhone = (phone) => {
  if (!phone) return null;
  try {
    const parsed = parsePhoneNumberFromString(String(phone).trim());
    if (parsed?.country) return parsed.country;
  } catch (_) { /* invalid number — silent */ }
  return null;
};

const TLD_COUNTRY = {
  il: "IL", uk: "GB", us: "US", de: "DE", fr: "FR", it: "IT", es: "ES",
  nl: "NL", be: "BE", ch: "CH", at: "AT", se: "SE", no: "NO", dk: "DK",
  fi: "FI", pt: "PT", gr: "GR", pl: "PL", cz: "CZ", hu: "HU", ro: "RO",
  ru: "RU", ua: "UA", tr: "TR", ae: "AE", sa: "SA", in: "IN", cn: "CN",
  jp: "JP", kr: "KR", th: "TH", sg: "SG", hk: "HK", tw: "TW", au: "AU",
  nz: "NZ", br: "BR", ar: "AR", mx: "MX", za: "ZA", ca: "CA", ie: "IE",
  "co.il": "IL", "co.uk": "GB", "co.za": "ZA", "co.in": "IN",
  "com.br": "BR", "com.mx": "MX", "com.au": "AU", "com.tr": "TR",
};
export const countryFromEmail = (email) => {
  if (!email || typeof email !== "string") return null;
  const at = email.toLowerCase().split("@")[1];
  if (!at) return null;
  const parts = at.split(".");
  if (parts.length >= 2) {
    const last2 = parts.slice(-2).join(".");
    if (TLD_COUNTRY[last2]) return TLD_COUNTRY[last2];
  }
  return TLD_COUNTRY[parts[parts.length - 1]] || null;
};

/* ---------- Backend call (with Mapbox) --------------------------------- */
export async function detectGeoApi({ phone, city, address, country, email } = {}) {
  try {
    const r = await fetch(`${API_BASE}/api/crm/geo/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, city, address, country, email }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

/* ---------- React hook: debounced live suggestion ---------------------- */
/**
 * Returns the current best-guess suggestion as the user types.
 *
 * The hook:
 *   - debounces 500 ms before calling the backend
 *   - cancels stale requests when inputs change
 *   - returns null while loading or when nothing useful was found
 *   - never overwrites an explicit `country` value the user has already set
 */
export function useGeoSuggestion({ phone, city, address, country, email }, opts = {}) {
  const { delay = 500, skipIfCountrySet = true } = opts;
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    // Already has a country? Don't pester the user.
    if (skipIfCountrySet && country && String(country).trim()) {
      setSuggestion(null);
      return;
    }
    const hasAnyInput = (phone && phone.length >= 4) || (city && city.length >= 2) || address || email;
    if (!hasAnyInput) {
      setSuggestion(null);
      return;
    }

    const myReq = ++reqIdRef.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const result = await detectGeoApi({ phone, city, address, country, email });
      if (myReq !== reqIdRef.current) return; // stale
      setLoading(false);
      // Only show suggestions we actually believe in
      if (result?.country && (result.confidence === "high" || result.confidence === "medium")) {
        setSuggestion(result);
      } else {
        setSuggestion(null);
      }
    }, delay);

    return () => clearTimeout(t);
  }, [phone, city, address, country, email, delay, skipIfCountrySet]);

  return { suggestion, loading, dismiss: () => setSuggestion(null) };
}

/* ---------- Static map URL (Mapbox) ------------------------------------ */
/**
 * Returns a Mapbox static-tile image URL for embedding a tiny map preview
 * in the contact drawer. Returns null if we don't have a usable token or
 * coordinates.
 *
 * NOTE: the token is read from REACT_APP_MAPBOX_TOKEN — for static maps
 * we're fine to use a public token in the browser since Mapbox enforces
 * URL referer restrictions on it.
 */
export function staticMapUrl({ lat, lng, zoom = 10, width = 480, height = 220 }) {
  const token = process.env.REACT_APP_MAPBOX_TOKEN;
  if (!token || typeof lat !== "number" || typeof lng !== "number") return null;
  const marker = `pin-s+ef4444(${lng},${lat})`;
  return (
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
    `${marker}/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${token}`
  );
}
