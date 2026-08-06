import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, ExternalLink, RotateCcw, Sparkles, X } from "lucide-react";
import { askAssistant, askAssistantAdvice } from "../../services/assistantApi";
import { scaleInventoryPrice } from "../../utils/pricing";

/* Thread lives in sessionStorage only — a filter conversation is worth
 * keeping across a page refresh but not across days. */
const STORAGE_KEY = "inventory.assistant.thread";
const MAX_TURNS = 40;
/* Kept in step with SHORTLIST_MAX in the backend, which caps it again. */
const SHORTLIST_MAX = 20;
const PREVIEW_MAX = 6;

const HEBREW = /[\u0590-\u05FF]/;
const dirOf = (text) => (HEBREW.test(String(text || "")) ? "rtl" : "ltr");

const usd = (n) => `$${Number(n).toLocaleString()}`;

/* Human labels for the chips. The jewelry tab reuses several filter keys for
 * different columns, so the label depends on the active tab. */
const MULTI_LABELS = {
  shape: { stones: "Shape", jewelry: "Style" },
  treatment: { stones: "Clarity", jewelry: "Collection" },
  category: { stones: "Category", jewelry: "Type" },
  tag: { stones: "Tag", jewelry: "Tag" },
  location: { stones: "Location", jewelry: "Location" },
  groupingType: { stones: "Grouping", jewelry: "Grouping" },
  diamondColor: { stones: "Color", jewelry: "Stone" },
  fancyColor: { stones: "Fancy", jewelry: "Metal" },
  lab: { stones: "Lab", jewelry: "Lab" },
};

const RANGE_LABELS = {
  minPrice: (v) => `≥ ${usd(v)}`,
  maxPrice: (v) => `≤ ${usd(v)}`,
  minPricePerCt: (v) => `≥ ${usd(v)}/ct`,
  maxPricePerCt: (v) => `≤ ${usd(v)}/ct`,
  minCarat: (v) => `≥ ${v} ct`,
  maxCarat: (v) => `≤ ${v} ct`,
  minLength: (v) => `≥ ${v} mm long`,
  maxLength: (v) => `≤ ${v} mm long`,
  minWidth: (v) => `≥ ${v} mm wide`,
  maxWidth: (v) => `≤ ${v} mm wide`,
};

const SORT_LABELS = {
  pricePerCt: "price/ct",
  priceTotal: "price",
  weightCt: "weight",
  sku: "SKU",
  color: "colour",
  clarity: "clarity",
  lab: "lab",
  shape: "shape",
  ratio: "ratio",
};

export const describeFilterKey = (key, value, inventoryMode) => {
  if (RANGE_LABELS[key]) return RANGE_LABELS[key](value);
  if (MULTI_LABELS[key]) {
    const label = MULTI_LABELS[key][inventoryMode === "jewelry" ? "jewelry" : "stones"];
    return `${label}: ${(Array.isArray(value) ? value : [value]).join(", ")}`;
  }
  if (key === "sku") return `SKU: ${value}`;
  if (key === "box") return `Box: ${value}`;
  return `${key}: ${value}`;
};

const isSet = (v) => (Array.isArray(v) ? v.length > 0 : v !== "" && v != null);

/* Fields the assistant is allowed to reason about. Prices are scaled here to
 * whatever the dealer is currently looking at, so a Bruto view doesn't get
 * discussed in Neto figures. Cost is never included. */
const toShortlistRow = (item, priceMode) => ({
  sku: item.sku,
  category: item.category || item.jewelryType,
  shape: item.shape || item.style,
  weightCt: item.weightCt,
  color: item.color,
  clarity: item.clarity,
  treatment: item.treatment || item.collection,
  lab: item.lab,
  origin: item.origin,
  fluorescence: item.fluorescence,
  measurements: item.measurements,
  ratio: item.ratio,
  pricePerCt: item.pricePerCt != null
    ? Math.round(scaleInventoryPrice(item.pricePerCt, item, priceMode))
    : undefined,
  priceTotal: item.priceTotal != null
    ? Math.round(scaleInventoryPrice(item.priceTotal, item, priceMode))
    : undefined,
  location: item.location,
  certificateNumber: item.certificateNumber,
  metalType: item.metalType,
  stoneType: item.stoneType,
  title: item.title,
});

/* Aggregates over every match, not just the sample. Totals computed from the
 * 20-row sample would badly under-report a 200-stone selection, so the whole
 * set is reduced here and the sample is only ever used to name pieces. */
const buildSummary = (items, priceMode) => {
  const scaled = (v, item) =>
    v != null && isFinite(Number(v)) ? scaleInventoryPrice(Number(v), item, priceMode) : null;

  let totalValue = 0;
  let totalCarats = 0;
  let minPricePerCt = null;
  let maxPricePerCt = null;
  const groups = { byCategory: new Map(), byLocation: new Map(), byLab: new Map() };

  const bump = (map, key, value, carats) => {
    if (!key) return;
    const row = map.get(key) || { key, count: 0, totalValue: 0, totalCarats: 0 };
    row.count += 1;
    row.totalValue += value || 0;
    row.totalCarats += carats || 0;
    map.set(key, row);
  };

  for (const item of items) {
    const value = scaled(item.priceTotal, item) || 0;
    const carats = Number(item.weightCt) || 0;
    const ppc = scaled(item.pricePerCt, item);

    totalValue += value;
    totalCarats += carats;
    if (ppc != null && ppc > 0) {
      if (minPricePerCt == null || ppc < minPricePerCt) minPricePerCt = ppc;
      if (maxPricePerCt == null || ppc > maxPricePerCt) maxPricePerCt = ppc;
    }

    bump(groups.byCategory, item.category || item.jewelryType, value, carats);
    bump(groups.byLocation, item.location, value, carats);
    bump(groups.byLab, item.lab && item.lab !== "N/A" ? item.lab : null, value, carats);
  }

  const top = (map) =>
    [...map.values()].sort((a, b) => b.count - a.count).slice(0, 12);

  return {
    count: items.length,
    totalValue: Math.round(totalValue),
    totalCarats: Math.round(totalCarats * 100) / 100,
    // Blended rather than a mean of the per-carat figures: this is the number
    // a dealer means by "what am I averaging on this parcel".
    avgPricePerCt: totalCarats > 0 ? Math.round(totalValue / totalCarats) : null,
    minPricePerCt: minPricePerCt != null ? Math.round(minPricePerCt) : null,
    maxPricePerCt: maxPricePerCt != null ? Math.round(maxPricePerCt) : null,
    priceMode,
    byCategory: top(groups.byCategory),
    byLocation: top(groups.byLocation),
    byLab: top(groups.byLab),
  };
};

const SUGGESTIONS = [
  "אמרלדים מעל 5 קראט",
  "כמה שווה המלאי בניו יורק?",
  "Round diamonds, GIA, 1–2ct",
];

const readThread = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
};

/** One matched stone, small enough that several fit without scrolling. */
const ResultCard = ({ item, priceMode, onOpen }) => {
  const price = item.priceTotal != null
    ? Math.round(scaleInventoryPrice(item.priceTotal, item, priceMode))
    : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full items-center gap-2.5 rounded-xl border border-app-line bg-app-surface p-2 text-left transition-colors hover:bg-app-canvas-2"
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.sku}
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-lg bg-app-canvas-2" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-app-ink">{item.sku}</div>
        <div className="truncate text-[10.5px] text-app-muted">
          {[item.weightCt ? `${item.weightCt}ct` : null, item.color, item.lab || item.metalType]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      {price != null && (
        <div className="shrink-0 text-[11.5px] font-semibold text-app-ink">{usd(price)}</div>
      )}
    </button>
  );
};

/**
 * Natural-language filtering and advice for the inventory page.
 *
 * Phase one sends only the question and the values present in the current
 * inventory, and applies the filter it gets back through the page's own state
 * so results always match manual filtering. Phase two runs only when the
 * dealer asked the assistant to choose, and sends the rows already on screen.
 *
 * @param {object}   props
 * @param {string}   props.inventoryMode  diamonds | gemstones | jewelry
 * @param {object}   props.vocabulary     { [filterField]: string[] } from live stock
 * @param {Array}    props.navTargets     [{ path, label }] this user may open
 * @param {object}   props.filters        the page's live filter state
 * @param {Array}    props.results        the filtered, sorted list on screen
 * @param {string}   props.priceMode      neto | bruto
 * @param {Function} props.onApply        (filters, suggestedMode, sort) => void
 * @param {Function} props.onRemoveFilter (key) => void
 * @param {Function} props.onNavigate     (path) => void
 * @param {Function} props.onOpenStone    (item) => void
 * @param {boolean}  props.liftAboveFab   raise the button clear of the export FAB
 */
const AssistantChat = ({
  inventoryMode,
  vocabulary,
  navTargets,
  filters,
  results,
  priceMode,
  onApply,
  onRemoveFilter,
  onNavigate,
  onOpenStone,
  liftAboveFab,
}) => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState(readThread);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAdvice, setPendingAdvice] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_TURNS)));
    } catch (_) {
      /* Private-mode quota — the thread just won't survive a refresh. */
    }
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  useEffect(() => {
    if (open && !isMobile) inputRef.current?.focus();
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* Phase two. Setting pendingAdvice and applying the filter happen in the
   * same batch, so by the time this runs `results` is the freshly filtered
   * list — which is exactly what we want the assistant to talk about. */
  useEffect(() => {
    if (!pendingAdvice) return;
    const { message, history, replaceId } = pendingAdvice;
    setPendingAdvice(null);

    const matched = results || [];
    const shortlist = matched.slice(0, SHORTLIST_MAX).map((r) => toShortlistRow(r, priceMode));

    askAssistantAdvice({
      message,
      history,
      shortlist,
      summary: buildSummary(matched, priceMode),
      totalCount: matched.length,
    })
      .then((res) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replaceId
              ? { ...m, content: res.reply || m.content, highlightSkus: res.skus || [] }
              : m
          )
        );
      })
      .catch((e) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === replaceId ? { ...m, content: e.message, error: true } : m))
        );
      })
      .finally(() => setBusy(false));
  }, [pendingAdvice, results, priceMode]);

  const send = useCallback(
    async (text) => {
      const question = String(text || "").trim();
      if (!question || busy) return;

      // Only user/assistant prose goes back as history; the filter payloads
      // would just burn tokens the model can't act on.
      const history = messages
        .filter((m) => m.content && !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: "user", content: question }]);
      setInput("");
      setBusy(true);

      try {
        const res = await askAssistant({
          message: question,
          history,
          inventoryMode,
          vocabulary,
          navTargets,
        });

        if (res.navigateTo) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a${Date.now()}`,
              role: "assistant",
              content: res.reply || `Opening ${res.navigateTo.label}.`,
              navigateTo: res.navigateTo,
            },
          ]);
          onNavigate(res.navigateTo.path);
          setBusy(false);
          return;
        }

        const appliedKeys = Object.keys(res.filters || {});
        const hasSlice = appliedKeys.length > 0 || !!res.sort;
        if (hasSlice) onApply(res.filters, res.inventoryMode, res.sort);

        const id = `a${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id,
            role: "assistant",
            content: res.reply || "",
            appliedKeys,
            sort: res.sort || null,
            showResults: hasSlice,
            // The tab the filter was built for, so chip labels stay correct
            // even after the user switches tabs later.
            mode: res.inventoryMode || inventoryMode,
          },
        ]);

        // Deliberately not gated on hasSlice: a question about what is already
        // on screen carries no new filter. Whether anything actually matched is
        // decided by the effect below, which sees the settled `results`.
        if (res.wantsAnswer) {
          setPendingAdvice({ message: question, history, replaceId: id });
          return; // busy stays true until the advice call settles
        }
        setBusy(false);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { id: `e${Date.now()}`, role: "assistant", content: e.message, error: true },
        ]);
        setBusy(false);
      }
    },
    [busy, messages, inventoryMode, vocabulary, navTargets, onApply, onNavigate]
  );

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  // Half the screen on a phone so the stone list stays visible behind it —
  // watching the results change is the whole point. On desktop the vertical
  // insets set the height, so it must not be pinned to 100% as well.
  const sheetHeight = isMobile ? (expanded ? "88vh" : "52vh") : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the inventory assistant"
        className={`fixed right-6 z-40 flex items-center gap-2 rounded-2xl px-4 py-3 font-medium text-white shadow-2xl shadow-stone-500/30 transition-all hover:scale-105
                    bg-gradient-to-r from-stone-700 to-stone-800 hover:from-stone-800 hover:to-stone-900
                    ${open ? "pointer-events-none opacity-0" : ""}
                    ${liftAboveFab
                      ? "bottom-[calc(env(safe-area-inset-bottom,0px)+148px)] md:bottom-24"
                      : "bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] md:bottom-6"}`}
      >
        {/* Carries the working state over to the button if the panel is
            dismissed mid-answer, so the reply never arrives unannounced. */}
        {busy && <span className="assistant-ring" aria-hidden="true" />}
        <Sparkles className="h-4 w-4" />
        <span className="hidden text-sm sm:inline">Ask</span>
      </button>

      <AnimatePresence>
        {open && (
          /* No backdrop on purpose. The dealer asked to keep seeing the stock
             while the assistant filters it, so the page stays lit and usable. */
          <motion.div
            key="assistant-panel"
            /* Past 100% so the panel clears its own bottom gap on the way
               out instead of leaving a sliver on screen. */
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag={isMobile ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.03, bottom: 0.5 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > 120) setOpen(false);
              else if (info.offset.y < -70) setExpanded(true);
              else if (info.offset.y > 45) setExpanded(false);
            }}
            style={{ height: sheetHeight }}
            /* Held off the viewport edges so the working ring has a full
               frame to travel around; flush to an edge it would be half
               off-screen. */
            className={`fixed inset-x-2 bottom-2 z-50 flex flex-col overflow-hidden rounded-3xl border border-app-line bg-app-surface shadow-2xl
                       sm:inset-y-3 sm:left-auto sm:right-3 sm:w-[400px] sm:max-w-[calc(100vw-1.5rem)]
                       ${busy ? "assistant-busy-glow" : ""}`}
          >
            {busy && <span className="assistant-ring" aria-hidden="true" />}

            <div className="flex cursor-grab justify-center pt-3 pb-1 active:cursor-grabbing sm:hidden">
              <div className="h-1.5 w-12 rounded-full bg-app-line-2" />
            </div>

            <div className="flex items-center justify-between border-b border-app-line px-4 py-2.5 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-app-graphite" />
                <h2 className="text-sm font-semibold text-app-ink">Inventory Assistant</h2>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    aria-label="Clear conversation"
                    className="rounded-full p-2 text-app-muted transition-colors hover:bg-app-canvas-2 hover:text-app-ink"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-2 text-app-muted transition-colors hover:bg-app-canvas-2 hover:text-app-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
              {messages.length === 0 && (
                <div className="pt-4 text-center">
                  <p className="text-sm text-app-muted">
                    Describe the stock you're looking for, in Hebrew or English.
                  </p>
                  <div className="mt-4 flex flex-col items-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        dir={dirOf(s)}
                        onClick={() => send(s)}
                        className="rounded-full glass-surface px-3 py-1.5 text-xs text-app-graphite transition-colors hover:bg-app-surface/85"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => {
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div
                        dir={dirOf(m.content)}
                        className="max-w-[85%] rounded-2xl rounded-br-md bg-stone-800 px-3.5 py-2 text-[13px] leading-relaxed text-white"
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                }

                // Show a chip only while its filter is still applied, so
                // removing one here or in the filter panel keeps them honest.
                const chips = (m.appliedKeys || []).filter((k) => isSet(filters[k]));
                const isLatest = m.id === lastAssistantId;

                // Only the newest answer previews stones; older ones describe
                // a slice the page has since moved on from.
                const preview = isLatest && m.showResults ? (results || []) : [];
                const highlighted = m.highlightSkus?.length
                  ? preview.filter((r) => m.highlightSkus.includes(r.sku))
                  : [];
                const cards = (highlighted.length ? highlighted : preview).slice(0, PREVIEW_MAX);

                return (
                  <div key={m.id} className="flex justify-start">
                    <div className="w-[92%] space-y-2">
                      {m.content && (
                        <div
                          dir={dirOf(m.content)}
                          className={`rounded-2xl rounded-bl-md px-3.5 py-2 text-[13px] leading-relaxed ${
                            m.error ? "bg-red-50 text-red-700" : "glass-surface text-app-ink"
                          }`}
                        >
                          {m.content}
                        </div>
                      )}

                      {m.navigateTo && (
                        <button
                          type="button"
                          onClick={() => onNavigate(m.navigateTo.path)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-app-canvas-2 px-3 py-1.5 text-[11px] font-medium text-app-graphite transition-colors hover:bg-app-line"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {m.navigateTo.label}
                        </button>
                      )}

                      {(chips.length > 0 || m.sort) && (
                        <div className="flex flex-wrap gap-1.5">
                          {chips.map((k) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => onRemoveFilter(k)}
                              title="Remove this filter"
                              className="group inline-flex items-center gap-1 rounded-full bg-app-canvas-2 px-2.5 py-1 text-[11px] font-medium text-app-graphite transition-colors hover:bg-red-50 hover:text-red-700"
                            >
                              {describeFilterKey(k, filters[k], m.mode)}
                              <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                            </button>
                          ))}
                          {m.sort && (
                            <span className="inline-flex items-center rounded-full bg-app-canvas-2 px-2.5 py-1 text-[11px] font-medium text-app-graphite">
                              {m.sort.direction === "asc" ? "↑" : "↓"}{" "}
                              {SORT_LABELS[m.sort.field] || m.sort.field}
                            </span>
                          )}
                        </div>
                      )}

                      {cards.length > 0 && (
                        <div className="space-y-1.5">
                          {cards.map((item) => (
                            <ResultCard
                              key={item.id || item.sku}
                              item={item}
                              priceMode={priceMode}
                              onOpen={onOpenStone}
                            />
                          ))}
                        </div>
                      )}

                      {isLatest && m.showResults && (
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <p className="text-[11px] text-app-muted">
                            {results.length === 1 ? "1 result" : `${results.length} results`}
                          </p>
                          {results.length > cards.length && (
                            <button
                              type="button"
                              onClick={() => (isMobile ? setExpanded(false) : setOpen(false))}
                              className="text-[11px] font-medium text-app-graphite underline underline-offset-2"
                            >
                              See all on the page
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* The ring replaced the visible spinner, but it is decoration a
                  screen reader cannot see. This keeps the state announced. */}
              <span role="status" aria-live="polite" className="sr-only">
                {busy ? "Searching your inventory" : ""}
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-app-line px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] sm:px-5"
            >
              <div className="flex items-end gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => isMobile && setExpanded(true)}
                  dir={dirOf(input)}
                  maxLength={1000}
                  placeholder="Ask for a slice of stock…"
                  className="flex-1 rounded-2xl border border-app-line bg-app-canvas-2 px-3.5 py-2.5 text-[13px] text-app-ink placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="shrink-0 rounded-full bg-stone-800 p-2.5 text-white transition-colors hover:bg-stone-900 disabled:opacity-40 disabled:hover:bg-stone-800"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AssistantChat;
