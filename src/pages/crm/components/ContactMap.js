import React, { useEffect, useState } from "react";
import { detectGeoApi, staticMapUrl, flagEmoji } from "../../../utils/geoDetect";

/**
 * Tiny static-map preview for the contact drawer.
 *
 * Geocodes the contact's city/country once (server-side, via Mapbox), then
 * renders a non-interactive Mapbox static-tile image with a pin and a
 * "Open in Google Maps" link. Stays silent (renders nothing) if no token
 * is configured or geocoding returns nothing.
 */
export default function ContactMap({ city, country, address }) {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!city && !country && !address) return;

    setLoading(true);
    setFailed(false);
    detectGeoApi({ city, country, address })
      .then((r) => {
        if (cancelled) return;
        if (r && typeof r.lat === "number" && typeof r.lng === "number") {
          setCoords({ lat: r.lat, lng: r.lng, country: r.country, countryCode: r.countryCode, city: r.city });
        } else {
          setFailed(true);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [city, country, address]);

  if (loading) {
    return (
      <div className="mt-2 h-32 rounded-lg border border-stone-200 bg-stone-50 animate-pulse" />
    );
  }
  if (failed || !coords) return null;

  const url = staticMapUrl({ lat: coords.lat, lng: coords.lng, zoom: 9, width: 480, height: 220 });
  const place = [coords.city, coords.country].filter(Boolean).join(", ");
  const gmapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place || `${coords.lat},${coords.lng}`)}`;

  return (
    <div className="mt-2 rounded-lg border border-stone-200 overflow-hidden bg-white">
      {url ? (
        <a href={gmapsHref} target="_blank" rel="noreferrer" className="block group">
          <img src={url} alt={`Map of ${place}`} className="w-full h-32 object-cover" />
        </a>
      ) : (
        // No Mapbox token configured for the browser — skip the image, keep the link.
        <div className="h-16 bg-stone-50 flex items-center justify-center text-stone-400 text-xs">
          Map preview unavailable
        </div>
      )}
      <div className="px-3 py-2 flex items-center gap-2 text-xs">
        <span className="text-base leading-none">{flagEmoji(coords.countryCode) || "📍"}</span>
        <span className="flex-1 min-w-0 truncate text-stone-700">{place}</span>
        <a
          href={gmapsHref}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline shrink-0"
        >
          Open in Maps →
        </a>
      </div>
    </div>
  );
}
