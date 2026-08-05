import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { askAssistant } from "../../services/assistantApi";

/* Thread lives in sessionStorage only — a filter conversation is worth
 * keeping across a page refresh but not across days. */
const STORAGE_KEY = "inventory.assistant.thread";
const MAX_TURNS = 40;

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

const SUGGESTIONS = [
  "אמרלדים מעל 5 קראט",
  "Round diamonds, GIA, 1–2ct",
  "כל האבנים בניו יורק",
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

/**
 * Natural-language filtering for the inventory page.
 *
 * The panel sends the question and the list of values present in the current
 * inventory — never the stones themselves — and applies the filter it gets
 * back through the page's own filter state, so results always match what
 * manual filtering would produce.
 *
 * @param {object}   props
 * @param {string}   props.inventoryMode  diamonds | gemstones | jewelry
 * @param {object}   props.vocabulary     { [filterField]: string[] } from live stock
 * @param {object}   props.filters        the page's live filter state
 * @param {Function} props.onApply        (filters, suggestedMode) => void
 * @param {Function} props.onRemoveFilter (key) => void
 * @param {number}   props.resultCount    stones currently matching
 */
const AssistantChat = ({
  inventoryMode,
  vocabulary,
  filters,
  onApply,
  onRemoveFilter,
  resultCount,
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(readThread);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

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
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
        });

        const appliedKeys = Object.keys(res.filters || {});
        if (appliedKeys.length > 0) onApply(res.filters, res.inventoryMode);

        setMessages((prev) => [
          ...prev,
          {
            id: `a${Date.now()}`,
            role: "assistant",
            content: res.reply || "",
            appliedKeys,
            // The tab the filter was built for, so chip labels stay correct
            // even after the user switches tabs later.
            mode: res.inventoryMode || inventoryMode,
          },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { id: `e${Date.now()}`, role: "assistant", content: e.message, error: true },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, inventoryMode, vocabulary, onApply]
  );

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <>
      {/* Left-hand side so it never collides with the export bar on the right.
          The mobile offset clears the bottom nav. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the inventory assistant"
        className="fixed left-6 z-40 bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] md:bottom-6
                   flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl shadow-stone-500/30
                   bg-gradient-to-r from-stone-700 to-stone-800 hover:from-stone-800 hover:to-stone-900
                   text-white font-medium transition-all hover:scale-105"
      >
        <Sparkles className="w-4 h-4" />
        <span className="hidden sm:inline text-sm">Ask</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ y: "100%", x: 0 }}
              animate={{ y: 0, x: 0 }}
              exit={{ y: "100%", x: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-app-surface border-app-line border rounded-t-3xl h-[85vh] overflow-hidden shadow-xl
                         sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[440px] sm:max-w-full sm:h-full sm:rounded-t-none sm:rounded-l-3xl sm:border-r-0 sm:border-t-0 sm:border-b-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="w-12 h-1.5 bg-app-line-2 rounded-full" />
              </div>

              <div className="flex items-center justify-between border-b border-app-line px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-app-graphite" />
                  <h2 className="text-sm font-semibold text-app-ink">Inventory Assistant</h2>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMessages([])}
                      aria-label="Clear conversation"
                      className="p-2 rounded-full text-app-muted hover:text-app-ink hover:bg-app-canvas-2 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="p-2 rounded-full text-app-muted hover:text-app-ink hover:bg-app-canvas-2 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-3">
                {messages.length === 0 && (
                  <div className="pt-6 text-center">
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
                          className="px-3 py-1.5 rounded-full glass-surface text-xs text-app-graphite hover:bg-app-surface/85 transition-colors"
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

                  return (
                    <div key={m.id} className="flex justify-start">
                      <div className="max-w-[92%] space-y-2">
                        {m.content && (
                          <div
                            dir={dirOf(m.content)}
                            className={`rounded-2xl rounded-bl-md px-3.5 py-2 text-[13px] leading-relaxed ${
                              m.error
                                ? "bg-red-50 text-red-700"
                                : "glass-surface text-app-ink"
                            }`}
                          >
                            {m.content}
                          </div>
                        )}

                        {chips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {chips.map((k) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => onRemoveFilter(k)}
                                title="Remove this filter"
                                className="group inline-flex items-center gap-1 rounded-full bg-app-canvas-2 px-2.5 py-1 text-[11px] font-medium text-app-graphite hover:bg-red-50 hover:text-red-700 transition-colors"
                              >
                                {describeFilterKey(k, filters[k], m.mode)}
                                <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                              </button>
                            ))}
                          </div>
                        )}

                        {chips.length > 0 && m.id === lastAssistantId && (
                          <p className="text-[11px] text-app-muted">
                            {resultCount === 1 ? "1 result" : `${resultCount} results`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {busy && (
                  <div className="flex items-center gap-2 text-app-muted">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-xs">Thinking…</span>
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="border-t border-app-line px-4 py-3 sm:px-5 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]"
              >
                <div className="flex items-end gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
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
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AssistantChat;
