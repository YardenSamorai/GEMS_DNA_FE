import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchContact } from "../../../services/crmApi";

/**
 * Lightbox to view scanned business card images for a contact.
 * Always opens to the FRONT side. A "Flip" button switches to BACK
 * (lazily fetched if not already in props).
 *
 * Props:
 *   contactId  - id to fetch images for if not provided directly
 *   front      - full data URL for front (optional, will fetch if missing)
 *   back       - full data URL for back  (optional, will fetch if missing)
 *   hasBack    - whether the contact has a back image (for the flip button)
 *   contactName- display name for the header
 *   onClose    - close handler
 */
export default function CardImageLightbox({
  contactId,
  front: frontProp,
  back: backProp,
  hasBack: hasBackProp,
  contactName,
  onClose,
}) {
  const { user } = useUser();
  const [side, setSide] = useState("front");
  const [front, setFront] = useState(frontProp || null);
  const [back, setBack] = useState(backProp || null);
  const [hasBack, setHasBack] = useState(!!hasBackProp || !!backProp);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(contactName || "");
  const [flipping, setFlipping] = useState(false);

  // Fetch full images on demand
  useEffect(() => {
    if (!contactId || !user?.id) return;
    if (front && (back || !hasBack)) return;
    setLoading(true);
    fetchContact(user.id, contactId)
      .then((c) => {
        if (!front && c.card_image_front) setFront(c.card_image_front);
        if (!back && c.card_image_back) setBack(c.card_image_back);
        setHasBack(!!c.card_image_back);
        if (!name) setName(c.name || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, user?.id]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (hasBack && (front || back)) handleFlip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBack, front, back, side]);

  const handleFlip = () => {
    if (!hasBack && !back) return;
    setFlipping(true);
    setTimeout(() => {
      setSide((s) => (s === "front" ? "back" : "front"));
      setFlipping(false);
    }, 220);
  };

  const currentImage = side === "front" ? front : back;
  const currentLabel = side === "front" ? "FRONT" : "BACK";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/85 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-6 py-3 z-10"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 12px)" }}
      >
        <div className="text-white min-w-0 flex-1">
          {name && <div className="text-sm sm:text-base font-semibold truncate">{name}</div>}
          <div className="text-[11px] uppercase tracking-wider text-white/60">Business card · {currentLabel}</div>
        </div>
        <button
          onClick={onClose}
          className="ml-3 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Image area with flip animation */}
      <div
        className="relative max-w-full max-h-full flex items-center justify-center"
        style={{ perspective: 1400 }}
        onClick={(e) => e.stopPropagation()}
      >
        {loading && !currentImage ? (
          <div className="text-white/70 text-sm flex items-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
            Loading image…
          </div>
        ) : currentImage ? (
          <div
            className={`transition-transform duration-300 ease-in-out ${flipping ? "rotate-y-90" : ""}`}
            style={{
              transformStyle: "preserve-3d",
              transform: flipping ? "rotateY(90deg)" : "rotateY(0deg)",
            }}
          >
            <img
              src={currentImage}
              alt={currentLabel}
              className="max-h-[80vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
              draggable={false}
            />
          </div>
        ) : (
          <div className="text-white/70 text-sm">
            {side === "back" ? "No back image was scanned for this contact." : "No image available."}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-4 py-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {(hasBack || back) && (
          <button
            onClick={handleFlip}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-stone-900 text-sm font-medium hover:bg-stone-100 shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Flip to {side === "front" ? "back" : "front"}
          </button>
        )}
        {currentImage && (
          <a
            href={currentImage}
            download={`card-${(name || "contact").replace(/\s+/g, "-").toLowerCase()}-${side}.jpg`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        )}
      </div>
    </div>
  );
}
