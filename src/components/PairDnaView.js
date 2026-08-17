import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { decryptPrice } from "../utils/decrypt";
import { changeMeasurementsFormat, encryptPrice } from "../utils/helper";
import { getMappedCategories } from "../utils/categoryMap";
import { readPriceMode, scaleInventoryPrice } from "../utils/pricing";

const FALLBACK_IMAGE =
  "https://app.barakdiamonds.com/Gemstones/Output/StoneImages/Eshed_no_image_2.jpg";

const certUrlOf = (stone, barakURL) =>
  stone.certificate_url ||
  (stone.certificate_number ? `${barakURL}/${stone.certificate_number}.pdf` : null);

const num = (v) => (v == null || v === "" || !isFinite(Number(v)) ? null : Number(v));

/* Both stones are priced individually; a pair is quoted as the sum. Each is
 * scaled on its own terms before adding — scaling the sum would be wrong the
 * moment a pair ever mixes categories. Returns raw alongside scaled so the
 * caller can tell whether a Bruto figure is being shown. */
const sumPrices = (stones, field, priceMode) => {
  let raw = 0;
  let scaled = 0;
  let found = false;

  for (const stone of stones) {
    const value = num(decryptPrice(stone?.[field]));
    if (value == null) continue;
    found = true;
    raw += value;
    scaled += scaleInventoryPrice(value, stone, priceMode);
  }

  return found ? { raw, scaled } : null;
};

const priceCode = (totals) => {
  if (!totals) return "N/A";
  const code = encryptPrice(totals.scaled);
  if (code === "N/A") return code;
  return totals.scaled !== totals.raw ? `B${code}` : code;
};

/* Rows the two stones are compared on. Only fields that mean something for
 * this category, and only when at least one side has a value — an empty row
 * on a page a customer sees reads as missing information. */
const buildComparisonRows = (a, b) => {
  const cats = getMappedCategories(a?.category) || [];
  const isDiamond = cats.includes("Diamond");
  const isEmerald = cats.includes("Emerald");

  const rows = [
    { label: "Shape", get: (s) => s.shape },
    { label: "Carat", get: (s) => (s.carat ? `${s.carat} ct` : null) },
    isDiamond && { label: "Color", get: (s) => s.color },
    isDiamond && { label: "Clarity", get: (s) => s.clarity },
    isEmerald && { label: "Treatment", get: (s) => s.treatment },
    { label: "Origin", get: (s) => s.origin },
    { label: "Lab", get: (s) => s.lab },
    isDiamond && { label: "Fluorescence", get: (s) => s.fluorescence },
    isDiamond && { label: "Cut", get: (s) => s.cut },
    isDiamond && { label: "Polish", get: (s) => s.polish },
    isDiamond && { label: "Symmetry", get: (s) => s.symmetry },
    { label: "Ratio", get: (s) => s.ratio },
    { label: "Measurements", get: (s) => changeMeasurementsFormat(s.measurements1) },
    { label: "Certificate", get: (s) => s.certificate_number },
  ].filter(Boolean);

  return rows
    .map(({ label, get }) => ({ label, a: get(a) || null, b: get(b) || null }))
    .filter((r) => r.a || r.b);
};

const StoneMedia = ({ stone, index }) => (
  <div className="space-y-2">
    <div className="relative rounded-2xl overflow-hidden bg-app-canvas-2 aspect-square">
      {stone.video ? (
        <iframe
          className="w-full h-full absolute inset-0"
          src={stone.video}
          title={`Stone ${index} video`}
          allowFullScreen
        />
      ) : (
        <img
          src={stone.picture || FALLBACK_IMAGE}
          alt={`Stone ${index}`}
          className="w-full h-full object-cover"
        />
      )}
      <span className="absolute top-2 left-2 text-[10.5px] font-medium tracking-[0.08em] uppercase text-white bg-black/55 backdrop-blur-md px-2.5 py-1 rounded-full">
        Stone {index}
      </span>
    </div>
    <div className="flex items-baseline justify-between gap-2 px-1">
      <span className="text-[12.5px] font-medium text-app-ink truncate">{stone.stone_id}</span>
      <span className="text-[12px] text-app-muted shrink-0">{stone.carat} ct</span>
    </div>
  </div>
);

/* Either stone's URL can be the way in, so the two are put in a fixed order
 * by SKU. Without this, Stone 1 and the order of the switcher below would
 * swap depending on which half of the pair you happened to open. */
export const orderPair = (x, y) =>
  String(x?.stone_id ?? "").localeCompare(String(y?.stone_id ?? "")) <= 0 ? [x, y] : [y, x];

/* Shown on the pair screen and on each stone's own page, so moving between
 * the three views works in every direction. `current` is either "pair" or a
 * SKU. */
export const PairSwitcher = ({ a, b, current }) => {
  const [first, second] = orderPair(a, b);
  const base =
    "flex-1 py-1.5 px-4 rounded-full text-[12.5px] font-medium text-center truncate transition-colors";
  const on = "bg-app-ink text-app-canvas shadow-[0_4px_14px_-6px_rgba(0,0,0,0.45)]";
  const off = "text-app-graphite hover:text-app-ink";

  const tabs = [
    { key: "pair", label: "Pair", to: `/${first.stone_id}` },
    { key: first.stone_id, label: first.stone_id, to: `/${first.stone_id}?single=1` },
    { key: second.stone_id, label: second.stone_id, to: `/${second.stone_id}?single=1` },
  ];

  return (
    <div className="inline-flex gap-1 p-1 rounded-full glass-surface w-full">
      {tabs.map((tab) =>
        tab.key === current ? (
          <span key={tab.key} className={`${base} ${on}`}>
            {tab.label}
          </span>
        ) : (
          <Link key={tab.key} to={tab.to} className={`${base} ${off}`}>
            {tab.label}
          </Link>
        )
      )}
    </div>
  );
};

const PairDnaView = ({
  a: rawA,
  b: rawB,
  isSignedIn,
  barakURL,
  onInterested,
  onShare,
  onShareVideo,
  onBack,
}) => {
  const [a, b] = orderPair(rawA, rawB);
  const priceMode = readPriceMode();
  const rows = buildComparisonRows(a, b);

  const totalCarat = (num(a.carat) || 0) + (num(b.carat) || 0);
  const certA = certUrlOf(a, barakURL);
  const certB = certUrlOf(b, barakURL);

  const totals = sumPrices([a, b], "total_price", priceMode);
  // Price per carat is a rate, so the pair's figure is the combined price over
  // the combined weight. Adding the two stones' rates together would inflate
  // it to roughly double.
  const blendedPpc =
    totals && totalCarat
      ? { raw: totals.raw / totalCarat, scaled: totals.scaled / totalCarat }
      : null;

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
                    Matched pair
                  </span>
                  {a.lab && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-surface text-[11px] font-medium tracking-[0.08em] uppercase text-app-graphite">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald" />
                      {a.lab}
                    </span>
                  )}
                  <span className="text-app-muted text-[11.5px] tracking-[0.04em]">
                    {a.stone_id} + {b.stone_id}
                  </span>
                </div>
                <h1 className="text-[28px] sm:text-[38px] font-semibold tracking-tight text-app-ink leading-tight">
                  {a.shape} · {totalCarat ? totalCarat.toFixed(2) : "—"} ct
                  <span className="text-app-graphite"> total</span>
                </h1>
                <p className="text-app-muted text-[13px] mt-1.5">
                  Two stones sold together · {a.carat} ct + {b.carat} ct
                </p>
              </div>
              {isSignedIn && (
                <div className="flex flex-col items-start sm:items-end shrink-0">
                  <span className="text-app-soft text-[10.5px] font-medium uppercase tracking-[0.14em] mb-1">
                    Pair total
                  </span>
                  <span className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-app-ink">
                    {priceCode(totals)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-10 space-y-8">
            <PairSwitcher a={a} b={b} current="pair" />

            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <StoneMedia stone={a} index={1} />
              <StoneMedia stone={b} index={2} />
            </div>

            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-app-muted mb-3">
                Comparison
              </h2>
              <div className="rounded-2xl overflow-hidden border border-app-line">
                {rows.map((row, i) => {
                  const same = row.a && row.b && String(row.a) === String(row.b);
                  return (
                    <div
                      key={row.label}
                      className={`grid grid-cols-[minmax(88px,1fr)_1.2fr_1.2fr] items-center gap-2 px-4 py-3 text-[13px] ${
                        i % 2 ? "bg-app-surface/40" : "bg-app-surface/70"
                      }`}
                    >
                      <span className="text-app-muted font-medium text-[12.5px]">{row.label}</span>
                      {same ? (
                        /* Identical on both stones — stated once, which is the
                           whole point of a matched pair. */
                        <span className="col-span-2 text-app-ink font-medium text-center">
                          {row.a}
                        </span>
                      ) : (
                        <>
                          <span className="text-app-ink font-medium text-center truncate">
                            {row.a || "—"}
                          </span>
                          <span className="text-app-ink font-medium text-center truncate">
                            {row.b || "—"}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11.5px] text-app-muted mt-2 px-1">
                A single value spans both columns where the stones match.
              </p>
            </div>

            {isSignedIn && (
              <div className="p-4 rounded-2xl glass-surface flex items-center justify-between">
                <span className="text-app-muted font-medium text-[12.5px]">
                  Price per carat · blended
                </span>
                <span className="text-[16px] font-semibold tracking-tight text-app-ink">
                  {priceCode(blendedPpc)}
                </span>
              </div>
            )}

            {(certA || certB) && (
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-app-muted mb-3">
                  Certificates
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { url: certA, stone: a, index: 1 },
                    { url: certB, stone: b, index: 2 },
                  ].map(({ url, stone, index }) =>
                    url ? (
                      <a
                        key={stone.stone_id}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative group"
                      >
                        <div className="rounded-xl overflow-hidden bg-app-canvas-2 aspect-square ring-1 ring-app-line group-hover:ring-app-line2 transition">
                          <embed src={url} type="application/pdf" className="w-full h-full pointer-events-none" />
                        </div>
                        <span className="absolute bottom-2 left-2 text-[10.5px] font-medium tracking-[0.08em] uppercase text-white bg-black/55 backdrop-blur-md px-2 py-0.5 rounded-full">
                          Stone {index}
                        </span>
                        <div className="absolute inset-0 bg-app-ink/0 group-hover:bg-app-ink/10 transition-colors rounded-xl flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity btn-primary">
                            View PDF
                          </span>
                        </div>
                      </a>
                    ) : (
                      <div
                        key={stone.stone_id}
                        className="rounded-xl border border-dashed border-app-line aspect-square flex items-center justify-center"
                      >
                        <span className="text-[12px] text-app-muted">No certificate</span>
                      </div>
                    )
                  )}
                </div>
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
                I'm interested in this pair
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

export default PairDnaView;
