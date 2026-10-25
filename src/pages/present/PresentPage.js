import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useClerk, useUser } from "@clerk/clerk-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, FileText, LayoutGrid, Maximize, Minimize, Play, Rotate3d, X } from "lucide-react";
import VimeoEmbed from "../sales/VimeoEmbed";
import { fetchSoapStones } from "../../services/stonesApi";
import { readPriceMode } from "../../utils/pricing";
import { API_BASE } from "../inventory/helpers/constants";
import {
  normalizeCatalogJewelry,
  normalizeStone,
  normalizeWorkshopJewelry,
} from "../inventory/model/inventoryModel";
import { gradingLine, itemTitle, pricePerCtText, priceTotalText } from "../inventory/ui/format";
import {
  categoryLabel,
  mediaFor,
  parseItemsParam,
  pickItems,
  posterFor,
  recallItems,
  specsFor,
} from "./presentModel";
import CodeSheet from "./CodeSheet";
import {
  CODE_LENGTH,
  checkCode,
  engageLock,
  forgetEverything,
  hasCode,
  releaseLock,
  saveCode,
  waitRemaining,
} from "./presentLock";

/* =============================================================================
 * Presentation — the selected stones and jewelry, full screen, for showing a
 * client on an iPad. Overview grid first, then one piece at a time: large
 * media on the left (photos, video / 360°, certificate), the essentials on
 * the right. Swipe, the arrows or the keyboard move between pieces.
 * Leaving takes the device's exit code (see presentLock.js), so a client
 * holding the iPad can't wander into the rest of the inventory.
 * ========================================================================== */

const PRICES_KEY = "present.prices";
const PRICE_OPTIONS = [
  { id: "off", label: "No prices" },
  { id: "total", label: "Price" },
  { id: "both", label: "Price + /ct" },
];

const readPrices = () => {
  const v = localStorage.getItem(PRICES_KEY);
  return PRICE_OPTIONS.some((o) => o.id === v) ? v : "off";
};

const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 450;

const loadJewelry = async (userId) => {
  const [catalog, workshop] = await Promise.allSettled([
    fetch(`${API_BASE}/api/jewelry`).then((r) => (r.ok ? r.json() : { jewelry: [] })),
    userId
      ? fetch(`${API_BASE}/api/jewelry-items?userId=${encodeURIComponent(userId)}`).then((r) =>
          r.ok ? r.json() : { items: [] }
        )
      : Promise.resolve({ items: [] }),
  ]);
  return [
    ...(workshop.status === "fulfilled" ? workshop.value?.items || [] : []).map(normalizeWorkshopJewelry),
    ...(catalog.status === "fulfilled" ? catalog.value?.jewelry || [] : []).map(normalizeCatalogJewelry),
  ];
};

const usePresentationItems = (param) => {
  const { user, isLoaded } = useUser();
  const [state, setState] = useState(() => {
    const items = recallItems(param);
    return items ? { items, loading: false, error: "" } : { items: [], loading: true, error: "" };
  });

  useEffect(() => {
    if (!state.loading || !isLoaded) return undefined;
    const refs = parseItemsParam(param);
    if (!refs.length) {
      setState({ items: [], loading: false, error: "" });
      return undefined;
    }
    let alive = true;
    Promise.all([
      refs.some((r) => r.kind === "stone")
        ? fetchSoapStones({ id: user?.id, email: user?.primaryEmailAddress?.emailAddress, name: user?.fullName }).then(
            (data) => (Array.isArray(data?.stones) ? data.stones : Array.isArray(data) ? data : []).map(normalizeStone)
          )
        : [],
      refs.some((r) => r.kind === "jewelry") ? loadJewelry(user?.id) : [],
    ])
      .then(([stones, jewelry]) => {
        if (alive) setState({ items: pickItems(refs, stones, jewelry), loading: false, error: "" });
      })
      .catch((err) => {
        if (alive) setState({ items: [], loading: false, error: err?.message || "Could not load the selection" });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param, isLoaded]);

  return state;
};

/* Keeps the iPad from dimming mid-presentation. Released when the tab hides
 * (the browser drops it anyway), re-acquired when it comes back. */
const useWakeLock = () => {
  useEffect(() => {
    let lock = null;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || !navigator.wakeLock) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* denied or unsupported: the screen just follows its own timeout */
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      lock?.release?.().catch(() => {});
    };
  }, []);
};

const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);

/* iPadOS Safari only has the prefixed API; iPhone has none, so the button hides. */
const useFullscreen = () => {
  const root = document.documentElement;
  const supported = Boolean(root.requestFullscreen || root.webkitRequestFullscreen);
  const [on, setOn] = useState(isFullscreen);

  useEffect(() => {
    const sync = () => setOn(isFullscreen());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const el = document.documentElement;
    try {
      if (isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    } catch {
      /* the browser refused; nothing to undo */
    }
  }, []);

  return { supported, on, toggle };
};

const priceLines = (item, prices, priceMode) => {
  if (prices === "off") return { total: "", perCt: "" };
  return {
    total: priceTotalText(item, priceMode),
    perCt: prices === "both" ? pricePerCtText(item, priceMode) : "",
  };
};

/* ---------------- Chrome ---------------- */

const IconButton = ({ label, onClick, children, disabled }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    className="flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-full text-glass-ink transition active:scale-95 active:bg-black/[0.06] disabled:opacity-30"
    style={{ touchAction: "manipulation" }}
  >
    {children}
  </button>
);

const PriceToggle = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="Prices" className="flex rounded-full bg-black/[0.05] p-1">
    {PRICE_OPTIONS.map((o) => (
      <button
        key={o.id}
        type="button"
        role="radio"
        aria-checked={value === o.id}
        onClick={() => onChange(o.id)}
        className={`h-9 select-none whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition ${
          value === o.id ? "bg-white text-glass-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-glass-muted"
        }`}
        style={{ touchAction: "manipulation" }}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const TopBar = ({ view, index, count, prices, onPrices, onClose, onToggleView, fullscreen }) => (
  <header
    className="relative z-20 flex items-center gap-2 border-b border-black/[0.06] bg-glass-canvas/80 px-3 backdrop-blur-xl backdrop-saturate-[1.8] sm:px-5"
    style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
  >
    <div className="flex h-16 flex-1 items-center gap-1">
      <IconButton label="Exit presentation" onClick={onClose}>
        <X size={22} strokeWidth={1.75} />
      </IconButton>
      {count > 1 && (
        <IconButton label={view === "grid" ? "Show one piece" : "Show all pieces"} onClick={onToggleView}>
          {view === "grid" ? <Play size={20} strokeWidth={1.75} /> : <LayoutGrid size={20} strokeWidth={1.75} />}
        </IconButton>
      )}
    </div>
    <p className="hidden text-[15px] font-semibold tabular-nums tracking-tight text-glass-ink md:block">
      {!count ? "" : view === "grid" ? `${count} ${count === 1 ? "piece" : "pieces"}` : `${index + 1} of ${count}`}
    </p>
    <div className="flex flex-1 items-center justify-end gap-2">
      <PriceToggle value={prices} onChange={onPrices} />
      {fullscreen.supported && (
        <IconButton label={fullscreen.on ? "Exit full screen" : "Full screen"} onClick={fullscreen.toggle}>
          {fullscreen.on ? <Minimize size={20} strokeWidth={1.75} /> : <Maximize size={20} strokeWidth={1.75} />}
        </IconButton>
      )}
    </div>
  </header>
);

/* ---------------- Overview ---------------- */

const Overview = ({ items, prices, priceMode, onOpen }) => (
  <div className="h-full overflow-y-auto overscroll-contain px-5 pb-16 pt-8 sm:px-8">
    <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-x-5 gap-y-9 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, i) => {
        const poster = posterFor(item);
        const { total, perCt } = priceLines(item, prices, priceMode);
        return (
          <button
            key={`${item.sku}-${i}`}
            type="button"
            onClick={() => onOpen(i)}
            className="group select-none text-left transition active:scale-[0.98]"
            style={{ touchAction: "manipulation" }}
          >
            <div className="aspect-square overflow-hidden rounded-[22px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
              {poster ? (
                <img src={poster} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-[13px] text-glass-soft">No photo</div>
              )}
            </div>
            <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-glass-soft">
              {categoryLabel(item)}
            </p>
            <p className="mt-0.5 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-glass-ink">
              {itemTitle(item)}
            </p>
            {gradingLine(item) && <p className="mt-0.5 text-[14px] text-glass-muted">{gradingLine(item)}</p>}
            {total && (
              <p className="mt-1.5 text-[15px] font-medium tabular-nums text-glass-ink">
                {total}
                {perCt && <span className="ml-2 text-[13px] font-normal text-glass-muted">{perCt}</span>}
              </p>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

/* ---------------- One piece ---------------- */

const swipeHandler = (go) => (_e, info) => {
  if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) go(1);
  else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) go(-1);
};

const MediaChip = ({ m, active, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`flex h-14 shrink-0 select-none items-center justify-center overflow-hidden rounded-xl bg-white transition active:scale-95 ${
      m.type === "image" ? "w-14" : "gap-1.5 px-3.5 text-[13px] font-medium text-glass-ink"
    } ${active ? "ring-2 ring-glass-ink ring-offset-2 ring-offset-glass-canvas" : "ring-1 ring-black/[0.06]"}`}
    style={{ touchAction: "manipulation" }}
  >
    {m.type === "image" && <img src={m.src} alt="" draggable={false} className="h-full w-full object-cover" />}
    {m.type === "video" && (
      <>
        {m.label === "360°" ? <Rotate3d size={17} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
        {m.label}
      </>
    )}
    {m.type === "cert" && (
      <>
        <FileText size={16} strokeWidth={1.75} />
        Certificate
      </>
    )}
  </button>
);

const Stage = ({ item, go }) => {
  const media = useMemo(() => mediaFor(item), [item]);
  const [active, setActive] = useState(0);
  const m = media[active];
  const title = itemTitle(item);

  return (
    <div className="flex min-h-0 flex-col gap-3 portrait:h-[min(62dvh,760px)] portrait:flex-none">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.07)]">
        {!m ? (
          <div className="flex h-full items-center justify-center text-[15px] text-glass-soft">No media</div>
        ) : m.type === "video" ? (
          <div className="h-full w-full bg-black">
            <VimeoEmbed key={m.src} src={m.src} title={`${title} video`} />
          </div>
        ) : m.type === "cert" && !m.image ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <FileText size={40} strokeWidth={1.25} className="text-glass-soft" />
            <p className="text-[15px] text-glass-muted">The certificate opens in a new tab.</p>
            <a
              href={m.link}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-glass-ink px-5 py-2.5 text-[15px] font-medium text-white active:scale-95"
            >
              Open certificate
            </a>
          </div>
        ) : (
          <>
            {/* Photos come on white or black studio grounds; a blurred copy
                fills the letterbox in the photo's own colour. */}
            {m.type === "image" && (
              <img
                src={m.src}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover blur-3xl"
              />
            )}
            <motion.img
              key={m.src}
              src={m.src}
              alt={m.type === "cert" ? `Certificate for ${title}` : title}
              draggable={false}
              onPanEnd={swipeHandler(go)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className={`relative h-full w-full select-none object-contain ${m.type === "cert" ? "p-4" : ""}`}
              style={{ touchAction: "pan-y pinch-zoom" }}
            />
          </>
        )}
      </div>
      {media.length > 1 && (
        <div className={`flex gap-2.5 overflow-x-auto overscroll-contain px-1 pb-1 pt-1 ${NO_SCROLLBAR}`}>
          {media.map((x, i) => (
            <MediaChip key={`${x.type}-${x.src}`} m={x} active={i === active} onClick={() => setActive(i)} />
          ))}
        </div>
      )}
    </div>
  );
};

const Details = ({ item, prices, priceMode, go }) => {
  const { total, perCt } = priceLines(item, prices, priceMode);
  const specs = specsFor(item);
  const grading = gradingLine(item);

  return (
    <motion.div
      onPanEnd={swipeHandler(go)}
      className={`flex min-h-0 flex-col landscape:overflow-y-auto landscape:overscroll-contain ${NO_SCROLLBAR}`}
      style={{ touchAction: "pan-y" }}
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-glass-soft">{categoryLabel(item)}</p>
      <h1 className="mt-1.5 text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.08] tracking-[-0.025em] text-glass-ink">
        {itemTitle(item)}
      </h1>
      {grading && <p className="mt-2 text-[17px] text-glass-muted">{grading}</p>}
      {total && (
        <p className="mt-5 text-[26px] font-semibold tabular-nums tracking-[-0.015em] text-glass-ink">
          {total}
          {perCt && <span className="ml-3 text-[16px] font-normal text-glass-muted">{perCt}</span>}
        </p>
      )}
      {specs.length > 0 && (
        <dl className="mt-6 divide-y divide-black/[0.07] rounded-[20px] bg-white px-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {specs.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-6 py-3">
              <dt className="text-[14px] text-glass-muted">{k}</dt>
              <dd className="text-right text-[15px] font-medium tabular-nums text-glass-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-5 text-[13px] tabular-nums text-glass-soft">{item.sku}</p>
    </motion.div>
  );
};

const Slide = ({ item, prices, priceMode, go }) => (
  <div className="mx-auto flex h-full max-w-[1400px] flex-col gap-6 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-5 pb-28 pt-6 sm:px-8 landscape:grid landscape:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] landscape:grid-rows-[minmax(0,1fr)] landscape:gap-10 landscape:overflow-hidden landscape:pb-24">
    <Stage key={item.sku} item={item} go={go} />
    <Details item={item} prices={prices} priceMode={priceMode} go={go} />
  </div>
);

const Pager = ({ index, count, go }) => (
  <div
    className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-5"
    style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
  >
    <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/60 bg-white/75 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl backdrop-saturate-[1.8]">
      <IconButton label="Previous piece" onClick={() => go(-1)} disabled={index === 0}>
        <ChevronLeft size={24} strokeWidth={1.75} />
      </IconButton>
      <span className="min-w-[64px] text-center text-[14px] font-medium tabular-nums text-glass-ink">
        {index + 1} / {count}
      </span>
      <IconButton label="Next piece" onClick={() => go(1)} disabled={index === count - 1}>
        <ChevronRight size={24} strokeWidth={1.75} />
      </IconButton>
    </div>
  </div>
);

/* ---------------- Page ---------------- */

const PresentPage = () => {
  const [params] = useSearchParams();
  const param = params.get("items") || "";
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useClerk();
  const reduceMotion = useReducedMotion();
  const { items, loading, error } = usePresentationItems(param);
  const here = `${location.pathname}${location.search}`;
  const [sheet, setSheet] = useState(() => (hasCode() ? null : "setup"));
  const [firstCode, setFirstCode] = useState("");
  const [waitUntil, setWaitUntil] = useState(0);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    if (hasCode()) engageLock(here);
  }, [here]);
  const priceMode = useMemo(readPriceMode, []);
  const [prices, setPrices] = useState(readPrices);
  const [view, setView] = useState("grid");
  const [{ index, dir }, setPos] = useState({ index: 0, dir: 0 });
  const fullscreen = useFullscreen();
  useWakeLock();

  const count = items.length;
  const current = items[Math.min(index, Math.max(count - 1, 0))];

  useEffect(() => {
    if (count === 1) setView("slide");
  }, [count]);

  useEffect(() => {
    localStorage.setItem(PRICES_KEY, prices);
  }, [prices]);

  const go = useCallback(
    (delta) =>
      setPos(({ index: i }) => {
        const next = Math.min(Math.max(i + delta, 0), count - 1);
        return next === i ? { index: i, dir: 0 } : { index: next, dir: delta };
      }),
    [count]
  );

  const open = (i) => {
    setPos({ index: i, dir: 0 });
    setView("slide");
  };

  const requestExit = useCallback(() => {
    setWaitUntil(Date.now() + waitRemaining());
    setSheet("exit");
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (sheet || forgot) return;
      if (view === "slide" && (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ")) {
        e.preventDefault();
        go(1);
      } else if (view === "slide" && (e.key === "ArrowLeft" || e.key === "PageUp")) {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        if (view === "slide" && count > 1) setView("grid");
        else requestExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, count, go, requestExit, sheet, forgot]);

  const onCode = async (code) => {
    if (sheet === "setup") {
      setFirstCode(code);
      setSheet("confirm");
      return null;
    }
    if (sheet === "confirm") {
      if (code !== firstCode) {
        setFirstCode("");
        setSheet("setup");
        return "The codes didn't match. Choose a code again.";
      }
      await saveCode(code);
      engageLock(here);
      setSheet(null);
      return null;
    }
    const res = await checkCode(code);
    if (res.ok) {
      releaseLock();
      navigate("/inventory", { replace: true });
      return null;
    }
    setWaitUntil(Date.now() + res.wait);
    return "Wrong code";
  };

  const resetBySignOut = async () => {
    try {
      await signOut();
    } catch {
      setForgot(false);
      return;
    }
    forgetEverything();
    window.location.assign("/sign-in");
  };

  const settingUp = sheet === "setup" || sheet === "confirm";

  // Warm the neighbours' photos so a swipe lands on a painted image.
  useEffect(() => {
    if (view !== "slide") return;
    [items[index - 1], items[index + 1]].forEach((it) => {
      const src = it && posterFor(it);
      if (src) new Image().src = src;
    });
  }, [view, index, items]);

  const offset = reduceMotion ? 0 : 60;

  return (
    <div
      className="fixed inset-0 flex flex-col bg-glass-canvas text-glass-ink antialiased"
      style={{
        height: "100dvh",
        overscrollBehavior: "none",
        WebkitTapHighlightColor: "transparent",
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <TopBar
        view={view}
        index={index}
        count={count}
        prices={prices}
        onPrices={setPrices}
        onClose={requestExit}
        onToggleView={() => setView((v) => (v === "grid" ? "slide" : "grid"))}
        fullscreen={fullscreen}
      />
      <main className="relative min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[15px] text-glass-muted">Preparing the presentation…</div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-[15px] text-red-600">{error}</div>
        ) : !count ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <p className="text-[19px] font-semibold tracking-tight">Nothing to present</p>
            <p className="text-[15px] text-glass-muted">Select stones or jewelry in Inventory, then choose Present.</p>
          </div>
        ) : view === "grid" ? (
          <Overview items={items} prices={prices} priceMode={priceMode} onOpen={open} />
        ) : (
          <>
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.div
                key={`${current.sku}-${index}`}
                custom={dir}
                className="absolute inset-0"
                initial={{ opacity: 0, x: dir * offset }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -dir * offset }}
                transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
              >
                <Slide item={current} prices={prices} priceMode={priceMode} go={go} />
              </motion.div>
            </AnimatePresence>
            {count > 1 && <Pager index={index} count={count} go={go} />}
          </>
        )}
      </main>

      <AnimatePresence>
        {forgot ? (
          <ForgotSheet key="forgot" onCancel={() => setForgot(false)} onSignOut={resetBySignOut} />
        ) : sheet ? (
          <CodeSheet
            key={settingUp ? "setup" : "exit"}
            title={sheet === "setup" ? "Set an exit code" : sheet === "confirm" ? "Confirm the code" : "Enter the exit code"}
            message={
              sheet === "setup"
                ? `Choose ${CODE_LENGTH} digits. They will be needed to leave the presentation on this device.`
                : sheet === "confirm"
                ? "Enter the same code again."
                : "The presentation is locked."
            }
            onComplete={onCode}
            onCancel={settingUp ? () => navigate("/inventory", { replace: true }) : () => setSheet(null)}
            cancelLabel={settingUp ? "Back" : "Cancel"}
            waitUntil={sheet === "exit" ? waitUntil : 0}
            footer={
              sheet === "exit" && (
                <button
                  type="button"
                  onClick={() => setForgot(true)}
                  className="select-none text-[14px] font-medium text-glass-muted active:opacity-60"
                  style={{ touchAction: "manipulation" }}
                >
                  Forgot the code?
                </button>
              )
            }
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const ForgotSheet = ({ onCancel, onSignOut }) => {
  const [busy, setBusy] = useState(false);
  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-label="Reset the exit code"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6 backdrop-blur-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="w-full max-w-[360px] rounded-[32px] border border-white/70 bg-white/90 p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-glass-ink">Reset the exit code</h2>
        <p className="mt-2 text-[14px] leading-snug text-glass-muted">
          This signs DNA out on this device. Signing back in needs the account password, then you can set a new code.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 flex-1 select-none rounded-full bg-black/[0.05] text-[15px] font-medium text-glass-ink active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onSignOut();
            }}
            className="h-12 flex-1 select-none rounded-full bg-red-600 text-[15px] font-medium text-white active:scale-[0.98] disabled:opacity-60"
          >
            Sign out
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default PresentPage;
