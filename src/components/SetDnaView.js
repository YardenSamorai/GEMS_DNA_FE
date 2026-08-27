import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { decryptPrice } from "../utils/decrypt";
import { encryptPrice } from "../utils/helper";
import { getMappedCategories } from "../utils/categoryMap";
import { readPriceMode, scaleInventoryPrice } from "../utils/pricing";

/* ============================================================================
 * A set is one record standing for a lot of matched stones, not a group of
 * linked records the way a pair is. `stones` counts them, and the weight and
 * price describe the lot as a whole; the feed carries nothing at all about any
 * individual stone in it. So this screen never pretends to show "the stones" —
 * it presents the lot: how many, how much it weighs, how big a stone in it
 * runs on average, and what the whole thing costs.
 *
 * Only 19% of sets carry a photo, so the empty state is a first-class part of
 * the design rather than a grey box: the count is drawn out as one facet per
 * stone, which reads at a glance and needs no data we don't have.
 * ========================================================================== */

const FALLBACK_IMAGE =
  "https://app.barakdiamonds.com/Gemstones/Output/StoneImages/Eshed_no_image_2.jpg";

const num = (v) => (v == null || v === "" || !isFinite(Number(v)) ? null : Number(v));

/* Sets record a typical stone size rather than real measurements, and they
 * routinely leave depth — or every axis — at zero. A zero is absence, not a
 * dimension, so it is dropped instead of printed as "6.00 x 4.00 x 0.00". */
const typicalSize = (measurements) => {
  const axes = String(measurements || "")
    .split("-")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  return axes.length ? axes.map((n) => n.toFixed(2)).join(" x ") : null;
};

const certUrlOf = (stone, barakURL) =>
  stone.certificate_url ||
  (stone.certificate_number ? `${barakURL}/${stone.certificate_number}.pdf` : null);

/* Scales one stored price and reports whether scaling happened, so a Bruto
 * figure can be marked as such the way every other price on the site is. */
const priceOf = (stone, field, priceMode) => {
  const raw = num(decryptPrice(stone?.[field]));
  if (raw == null) return null;
  return { raw, scaled: scaleInventoryPrice(raw, stone, priceMode) };
};

const priceCode = (value) => {
  if (!value) return "N/A";
  const code = encryptPrice(value.scaled);
  if (code === "N/A") return code;
  return value.scaled !== value.raw ? `B${code}` : code;
};

/* One facet per stone, capped so a 185-stone lot stays a picture rather than a
 * wall. The remainder is stated instead of drawn. */
const FACET_CAP = 60;

const LotVisual = ({ stones }) => {
  const drawn = Math.min(stones, FACET_CAP);
  const rest = stones - drawn;

  return (
    <div className="relative aspect-square rounded-2xl border border-app-line bg-app-canvas-2 overflow-hidden flex flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-wrap justify-center gap-2 max-w-[260px]">
        {Array.from({ length: drawn }).map((_, i) => (
          <span
            key={i}
            className="w-3 h-3 rotate-45 rounded-[2px] bg-brand-emerald"
            style={{ opacity: 0.4 + ((i % 5) * 0.1) }}
          />
        ))}
      </div>
      <div className="text-center">
        <div className="text-[34px] font-semibold tracking-tight text-app-ink leading-none">
          {stones}
        </div>
        <div className="text-[11.5px] uppercase tracking-[0.14em] text-app-muted mt-2">
          stones in this lot
        </div>
        {rest > 0 && (
          <div className="text-[11.5px] text-app-soft mt-1">
            {drawn} shown · {rest} more
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value, hint }) => (
  <div className="rounded-2xl glass-surface px-4 py-3.5">
    <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-soft">
      {label}
    </div>
    <div className="text-[19px] font-semibold tracking-tight text-app-ink mt-1 truncate">
      {value}
    </div>
    {hint && <div className="text-[11.5px] text-app-muted mt-0.5">{hint}</div>}
  </div>
);

/* Only rows that mean something for a lot. Notably `measurements` is NOT the
 * size of a stone here — the feed uses it for the typical size of a stone in
 * the lot — so it is labelled for what it is. */
const buildRows = (stone) => {
  const cats = getMappedCategories(stone?.category) || [];
  const isEmerald = cats.includes("Emerald");

  return [
    { label: "Shape", value: stone.shape },
    { label: "Category", value: stone.category },
    isEmerald && { label: "Treatment", value: stone.treatment },
    { label: "Origin", value: stone.origin },
    { label: "Lab", value: stone.lab },
    { label: "Colour", value: stone.color },
    { label: "Typical stone size", value: typicalSize(stone.measurements1) },
  ]
    .filter(Boolean)
    .filter((r) => r.value && String(r.value).trim() && String(r.value).toUpperCase() !== "N/A");
};

const SetDnaView = ({
  stone,
  set,
  isSignedIn,
  barakURL,
  onInterested,
  onShare,
  onShareVideo,
  onBack,
}) => {
  const priceMode = readPriceMode();
  const rows = buildRows(stone);

  const stones = Number(set.stones) || 0;
  const totalCarat = num(set.total_carat);
  const avgCarat = num(set.avg_carat);

  const total = priceOf(stone, "total_price", priceMode);
  const perCarat = priceOf(stone, "price_per_carat", priceMode);
  // Derived from the lot total alone, so it can't contradict it — 215 sets
  // have a total that doesn't match price-per-carat times weight, and dividing
  // the wrong one of those would invent a figure.
  const perStone =
    total && stones ? { raw: total.raw / stones, scaled: total.scaled / stones } : null;

  const cert = certUrlOf(stone, barakURL);
  const companion = set.companion;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {isSignedIn && (
          <button
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-surface text-app-graphite text-sm font-medium hover:bg-app-surface/85 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        <div className="rounded-3xl glass-surface-strong overflow-hidden mb-6">
          <div className="px-6 py-6 sm:px-10 sm:py-8 border-b border-app-line">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-app-ink text-app-canvas text-[11px] font-medium tracking-[0.08em] uppercase">
                    Matched set
                  </span>
                  {stone.lab && String(stone.lab).toUpperCase() !== "N/A" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-surface text-[11px] font-medium tracking-[0.08em] uppercase text-app-graphite">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />
                      {stone.lab}
                    </span>
                  )}
                  <span className="text-app-muted text-[11.5px] tracking-[0.04em]">
                    ID · {stone.stone_id}
                  </span>
                </div>
                <h1 className="text-[28px] sm:text-[38px] font-semibold tracking-tight text-app-ink leading-tight">
                  {stone.shape ? `${stone.shape} · ` : ""}
                  {stones} stones
                  {totalCarat ? (
                    <span className="text-app-graphite"> · {totalCarat.toFixed(2)} ct total</span>
                  ) : null}
                </h1>
                <p className="text-app-muted text-[13px] mt-1.5">
                  Sold as one lot
                  {avgCarat ? ` · averaging ${avgCarat.toFixed(2)} ct a stone` : ""}
                </p>
              </div>
              {isSignedIn && (
                <div className="flex flex-col items-start sm:items-end shrink-0">
                  <span className="text-app-soft text-[10.5px] font-medium uppercase tracking-[0.14em] mb-1">
                    Lot total
                  </span>
                  <span className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-app-ink">
                    {priceCode(total)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-10 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {stone.video ? (
                <div className="relative rounded-2xl overflow-hidden bg-app-canvas-2 aspect-square">
                  <iframe
                    className="w-full h-full absolute inset-0"
                    src={stone.video}
                    title="Set video"
                    allowFullScreen
                  />
                </div>
              ) : stone.picture ? (
                <div className="relative rounded-2xl overflow-hidden bg-app-canvas-2 aspect-square">
                  <img
                    src={stone.picture || FALLBACK_IMAGE}
                    alt={`Set of ${stones} stones`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 text-[10.5px] font-medium tracking-[0.08em] uppercase text-white bg-black/55 backdrop-blur-md px-2.5 py-1 rounded-full">
                    {stones} stones
                  </span>
                </div>
              ) : (
                <LotVisual stones={stones} />
              )}

              <div className="grid grid-cols-2 gap-3 content-start">
                <Stat label="Stones" value={stones} />
                <Stat
                  label="Total weight"
                  value={totalCarat ? `${totalCarat.toFixed(2)} ct` : "—"}
                />
                <Stat
                  label="Average stone"
                  value={avgCarat ? `${avgCarat.toFixed(2)} ct` : "—"}
                  hint="Total weight ÷ stones"
                />
                <Stat label="Shape" value={stone.shape || "—"} />
                {isSignedIn && (
                  <>
                    <Stat label="Price per carat" value={priceCode(perCarat)} />
                    <Stat
                      label="Average per stone"
                      value={priceCode(perStone)}
                      hint="Lot total ÷ stones"
                    />
                  </>
                )}
              </div>
            </div>

            {companion && (
              /* Some lots are sold next to a second lot — centres beside their
                 side stones. The link is only ever shown when the feed's two
                 records agree with each other. */
              <Link
                to={`/${companion.sku}`}
                className="flex items-center justify-between gap-4 p-4 rounded-2xl glass-surface hover:bg-app-surface/85 transition-colors group"
              >
                <div className="min-w-0">
                  <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-soft">
                    Sold alongside
                  </div>
                  <div className="text-[15px] font-semibold tracking-tight text-app-ink mt-0.5 truncate">
                    {companion.sku}
                  </div>
                  <div className="text-[12px] text-app-muted mt-0.5">
                    {companion.stones} stones
                    {companion.total_carat ? ` · ${Number(companion.total_carat).toFixed(2)} ct` : ""}
                  </div>
                </div>
                <svg
                  className="w-5 h-5 text-app-muted group-hover:text-app-ink transition-colors shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}

            {rows.length > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-app-muted mb-3">
                  The lot
                </h2>
                <div className="rounded-2xl overflow-hidden border border-app-line">
                  {rows.map((row, i) => (
                    <div
                      key={row.label}
                      className={`flex items-center justify-between gap-4 px-4 py-3 text-[13px] ${
                        i % 2 ? "bg-app-surface/40" : "bg-app-surface/70"
                      }`}
                    >
                      <span className="text-app-muted font-medium text-[12.5px]">{row.label}</span>
                      <span className="text-app-ink font-medium text-right truncate">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11.5px] text-app-muted mt-2 px-1">
                  Every figure describes the lot as a whole. Individual stones in a set are not
                  graded separately.
                </p>
              </div>
            )}

            {cert && (
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-app-muted mb-3">
                  Certificate
                </h2>
                <a href={cert} target="_blank" rel="noopener noreferrer" className="relative group block">
                  <div className="rounded-xl overflow-hidden bg-app-canvas-2 aspect-[4/3] ring-1 ring-app-line group-hover:ring-app-line2 transition">
                    <embed src={cert} type="application/pdf" className="w-full h-full pointer-events-none" />
                  </div>
                  <div className="absolute inset-0 bg-app-ink/0 group-hover:bg-app-ink/10 transition-colors rounded-xl flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity btn-primary">
                      View PDF
                    </span>
                  </div>
                </a>
              </div>
            )}

            <div className="pt-6 border-t border-app-line space-y-3">
              <button type="button" onClick={onInterested} className="btn-primary w-full py-3 text-[14px]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"
                  />
                </svg>
                I'm interested in this set
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={onShare} className="btn-secondary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                  Share DNA
                </button>
                <button onClick={onShareVideo} className="btn-secondary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Share video
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SetDnaView;
