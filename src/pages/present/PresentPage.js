import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import { useClerk } from "@clerk/clerk-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, LayoutGrid, Lock, Pause, Play } from "lucide-react";
import { readPriceMode } from "../../utils/pricing";
import { gradingLine, itemTitle, pricePerCtText, priceTotalText } from "../inventory/ui/format";
import {
  categoryLabel,
  mediaFor,
  mediaGroups,
  posterFor,
  primaryMediaIndex,
  showcaseSpecs,
} from "./presentModel";
import { useFullscreen, usePresentationItems, useWakeLock } from "./presentHooks";
import ShowcaseStage from "./ShowcaseStage";
import CodeSheet from "./CodeSheet";
import { ForgotSheet, StaffSheet } from "./StaffSheets";
import {
  CODE_LENGTH,
  checkCode,
  clearLeft,
  engageLock,
  forgetEverything,
  hasCode,
  lockedUrl,
  markLeft,
  releaseLock,
  saveCode,
  waitRemaining,
  wasLeft,
} from "./presentLock";

/* =============================================================================
 * Showcase — the selected stones and jewelry on an iPad standing on the
 * counter at a show. Each piece fills the screen: its photo slowly drifting
 * (360° and videos one tap away) on a stage shaped to the media, its details
 * beside it on Apple's light ground, nothing to scroll. With several pieces it rotates on
 * its own; a visitor's touch holds the current piece for a while. Prices,
 * timing and leaving sit behind the staff code (presentLock.js), so a visitor
 * can't change what is shown or wander into the rest of the inventory.
 * ========================================================================== */

const PRICES_KEY = "present.prices";
const PRICE_OPTIONS = [
  { id: "off", label: "Hidden" },
  { id: "total", label: "Price" },
  { id: "both", label: "Price + /ct" },
];

const INTERVAL_KEY = "present.interval";
const INTERVAL_OPTIONS = [
  { id: "8", label: "8 s" },
  { id: "12", label: "12 s" },
  { id: "20", label: "20 s" },
  { id: "30", label: "30 s" },
];

const BRAND_KEY = "present.brand";
const BRAND_OPTIONS = [
  { id: "none", label: "None" },
  { id: "eshed", label: "Eshed" },
  { id: "gemstar", label: "Gemstar" },
];
const BRAND_LOGOS = {
  eshed: { src: "/images/eshed_logo_dark.png", alt: "Eshed", w: 429, h: 189 },
  gemstar: { src: "/brands/gemstar.svg", alt: "Gemstar", w: 1071, h: 584 },
};

const BrandLogo = ({ logo, className = "" }) => (
  <img
    src={logo.src}
    alt={logo.alt}
    width={logo.w}
    height={logo.h}
    draggable={false}
    className={`block h-auto w-[clamp(128px,12vw,168px)] shrink-0 select-none ${className}`}
  />
);

const readOption = (key, options, fallback) => {
  const v = localStorage.getItem(key);
  return options.some((o) => o.id === v) ? v : fallback;
};

const HOLD_MS = 30_000; // a visitor's touch pauses the rotation this long
const CHROME_MS = 4_500; // controls fade after this much stillness
const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 450;

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

const priceLines = (item, prices, priceMode) => {
  if (prices === "off") return { total: "", perCt: "" };
  return {
    total: priceTotalText(item, priceMode),
    perCt: prices === "both" ? pricePerCtText(item, priceMode) : "",
  };
};

/* ---------------- One piece ---------------- */

const enter = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};
const rise = {
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 30 } },
};

/* Apple segmented control: one track, the selected segment a white chip
 * that slides between choices. */
const MediaSwitch = ({ groups, active, onPick }) =>
  groups.length > 1 ? (
    <motion.div variants={rise} className="flex">
      <div className="flex max-w-full gap-0.5 overflow-hidden rounded-full bg-[#e8e8ed] p-1">
        {groups.map((g) => {
          const on = g.indices.includes(active);
          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const at = g.indices.indexOf(active);
                onPick(on && g.indices.length > 1 ? g.indices[(at + 1) % g.indices.length] : g.indices[0]);
              }}
              className={`relative h-10 shrink-0 select-none whitespace-nowrap rounded-full px-[18px] text-[15px] font-medium tracking-[-0.01em] transition-colors ${
                on ? "text-[#1d1d1f]" : "text-[#6e6e73] active:text-[#1d1d1f]"
              }`}
              style={{ touchAction: "manipulation" }}
            >
              {on && (
                <motion.span
                  layoutId="media-chip"
                  className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1),0_3px_10px_rgba(0,0,0,0.06)]"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative">{g.label}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  ) : null;

/* The last spec cell stretches to the end of its row, so the divider above a
 * lone last cell runs the full width (2 columns, or 4 in portrait). */
const lastCellSpan = (n) =>
  `${n % 2 ? "col-span-2" : ""} ${["", "portrait:col-span-4", "portrait:col-span-3", "portrait:col-span-2"][n % 4]}`;

/* Watches an element's content box. */
const useBox = () => {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box];
};

const Showcase = ({ item, media, active, onPick, prices, priceMode, duration, onSwipe, logo }) => {
  const reduceMotion = useReducedMotion();
  const poster = posterFor(item);
  const title = itemTitle(item);
  const grading = gradingLine(item);
  const specs = showcaseSpecs(item);
  const { total, perCt } = priceLines(item, prices, priceMode);

  const [area, box] = useBox();
  const [aspect, setAspect] = useState(1);
  const stageW = box ? Math.floor(Math.min(box.w, box.h * aspect)) : 0;
  const size = { w: stageW, h: Math.floor(stageW / aspect) };

  return (
    <div
      className="flex h-full w-full flex-col gap-[clamp(24px,3.4vh,44px)] px-[clamp(24px,5vw,80px)] pb-[clamp(40px,6vh,64px)] landscape:flex-row landscape:items-stretch landscape:gap-[clamp(32px,4.5vw,80px)]"
      style={{ paddingTop: "max(clamp(48px, 7vh, 80px), calc(env(safe-area-inset-top, 0px) + 40px))" }}
    >
      <div ref={area} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
        {box && (
          <ShowcaseStage
            m={media[active]}
            poster={poster}
            title={title}
            duration={duration}
            onSwipe={onSwipe}
            size={size}
            onAspect={setAspect}
          />
        )}
      </div>

      <motion.div
        onPanEnd={onSwipe}
        variants={enter}
        initial={reduceMotion ? "shown" : "hidden"}
        animate="shown"
        className="flex min-w-0 shrink-0 flex-col justify-center gap-[clamp(16px,2.6vh,30px)] landscape:w-[clamp(340px,40%,540px)]"
        style={{ touchAction: "pan-y" }}
      >
        <motion.div
          variants={rise}
          className="flex gap-x-8 gap-y-[clamp(16px,2.6vh,30px)] landscape:flex-col portrait:flex-row-reverse portrait:items-start portrait:justify-between"
        >
          {logo && <BrandLogo logo={logo} />}
          <div className="min-w-0">
            <p className="text-[clamp(15px,1.4vw,19px)] font-semibold tracking-[-0.01em] text-[#86868b]">{categoryLabel(item)}</p>
            <h1
              className={`mt-1.5 line-clamp-3 font-semibold leading-[1.06] tracking-[-0.035em] text-[#1d1d1f] ${
                title.length <= 28
                  ? "text-[clamp(36px,4.4vw,60px)]"
                  : title.length <= 48
                  ? "text-[clamp(30px,3.4vw,46px)]"
                  : "text-[clamp(26px,2.8vw,36px)]"
              }`}
            >
              {title}
            </h1>
            {grading && <p className="mt-2.5 text-[clamp(19px,1.8vw,24px)] tracking-[-0.015em] text-[#6e6e73]">{grading}</p>}
            {total && (
              <p className="mt-4 text-[clamp(21px,2vw,28px)] font-semibold tabular-nums tracking-[-0.02em] text-[#1d1d1f]">
                {total}
                {perCt && <span className="ml-2.5 text-[0.7em] font-normal text-[#86868b]">{perCt}</span>}
              </p>
            )}
          </div>
        </motion.div>

        {specs.length > 0 && (
          <motion.dl
            variants={rise}
            className="grid grid-cols-2 overflow-hidden rounded-[22px] bg-white px-[clamp(18px,2vw,26px)] shadow-[0_1px_3px_rgba(0,0,0,0.05),0_14px_40px_rgba(0,0,0,0.05)] portrait:grid-cols-4"
          >
            {specs.map(([k, v], i) => (
              <div
                key={k}
                className={`min-w-0 border-t border-black/[0.07] pr-3 [&:nth-child(-n+2)]:border-t-0 portrait:[&:nth-child(-n+4)]:border-t-0 ${
                  specs.length > 8 ? "py-[clamp(8px,1.2vh,12px)] leading-tight" : "py-[clamp(11px,1.7vh,16px)]"
                } ${i === specs.length - 1 ? lastCellSpan(specs.length) : ""}`}
              >
                <dt className="text-[13px] tracking-[-0.005em] text-[#86868b]">{k}</dt>
                <dd
                  title={v}
                  className={`mt-0.5 truncate font-semibold tabular-nums tracking-[-0.015em] text-[#1d1d1f] ${
                    v.length > 14 ? "text-[clamp(15px,1.3vw,17px)]" : "text-[clamp(16px,1.5vw,19px)]"
                  }`}
                >
                  {v}
                </dd>
              </div>
            ))}
          </motion.dl>
        )}

        <MediaSwitch groups={mediaGroups(media)} active={active} onPick={onPick} />

        <motion.div variants={rise} className="flex items-center justify-between text-[13px] text-[#aeaeb2]">
          <span className="font-semibold tracking-[-0.01em]">{logo ? "" : "Gems DNA"}</span>
          <span className="tabular-nums">{item.sku}</span>
        </motion.div>
      </motion.div>
    </div>
  );
};

/* ---------------- All pieces ---------------- */

const Overview = ({ items, prices, priceMode, onOpen, logo }) => (
  <div
    className="h-full overflow-y-auto overscroll-contain px-[clamp(24px,5vw,80px)] pb-32"
    style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 48px)" }}
  >
    {logo && <BrandLogo logo={logo} className="mx-auto mb-10" />}
    <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, i) => {
        const poster = posterFor(item);
        const { total } = priceLines(item, prices, priceMode);
        return (
          <button
            key={`${item.sku}-${i}`}
            type="button"
            onClick={() => onOpen(i)}
            className="select-none text-left transition active:scale-[0.98]"
            style={{ touchAction: "manipulation" }}
          >
            <div className="relative aspect-square overflow-hidden rounded-[18px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.05)]">
              {poster ? (
                <img src={poster} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[13px] text-[#aeaeb2]">No photo</div>
              )}
            </div>
            <p className="mt-3.5 text-[13px] font-semibold text-[#86868b]">{categoryLabel(item)}</p>
            <p className="mt-0.5 line-clamp-2 text-[17px] font-semibold leading-snug tracking-[-0.015em] text-[#1d1d1f]">{itemTitle(item)}</p>
            {gradingLine(item) && <p className="mt-0.5 text-[14px] text-[#6e6e73]">{gradingLine(item)}</p>}
            {total && <p className="mt-1.5 text-[15px] font-medium tabular-nums text-[#1d1d1f]">{total}</p>}
          </button>
        );
      })}
    </div>
  </div>
);

/* ---------------- Chrome ---------------- */

/* Story-style bars: which piece is on, how long until the next. The live
 * bar is driven straight from the rotation loop, not through React. */
const Progress = ({ count, index, fillRef }) => (
  <div
    className="pointer-events-none absolute inset-x-0 top-0 z-10 flex gap-1.5 px-[clamp(24px,5vw,80px)]"
    style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}
  >
    {(count <= 30 ? Array.from({ length: count }, (_, i) => i) : [index]).map((i) => (
      <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-black/[0.08]">
        <div
          ref={i === index ? fillRef : undefined}
          className="h-full w-full origin-left rounded-full bg-[#1d1d1f]/70"
          style={{ transform: `scaleX(${i < index ? 1 : 0})` }}
        />
      </div>
    ))}
  </div>
);

const Btn = ({ label, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className="flex h-12 w-12 select-none items-center justify-center rounded-full text-[#1d1d1f] transition active:scale-95 active:bg-black/[0.06]"
    style={{ touchAction: "manipulation" }}
  >
    {children}
  </button>
);

const Controls = ({ visible, count, view, paused, onGrid, onPrev, onPause, onNext, onStaff }) => (
  <div
    className={`absolute inset-x-0 bottom-0 z-20 flex justify-center transition-opacity duration-300 ${
      visible ? "opacity-100" : "pointer-events-none opacity-0"
    }`}
    style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
  >
    <div className="flex items-center gap-0.5 rounded-full border border-black/[0.07] bg-white/70 p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.08),0_20px_60px_rgba(0,0,0,0.14)] backdrop-blur-xl backdrop-saturate-[1.8]">
      {count > 1 && (
        <Btn label={view === "grid" ? "Back to the show" : "All pieces"} onClick={onGrid}>
          {view === "grid" ? <Play size={20} strokeWidth={1.75} /> : <LayoutGrid size={20} strokeWidth={1.75} />}
        </Btn>
      )}
      {count > 1 && view === "show" && (
        <>
          <Btn label="Previous piece" onClick={onPrev}>
            <ChevronLeft size={24} strokeWidth={1.75} />
          </Btn>
          <Btn label={paused ? "Resume rotation" : "Pause rotation"} onClick={onPause}>
            {paused ? <Play size={20} strokeWidth={1.75} /> : <Pause size={20} strokeWidth={1.75} />}
          </Btn>
          <Btn label="Next piece" onClick={onNext}>
            <ChevronRight size={24} strokeWidth={1.75} />
          </Btn>
        </>
      )}
      {count > 1 && <span className="mx-1 h-6 w-px bg-black/10" aria-hidden="true" />}
      <Btn label="Staff settings" onClick={onStaff}>
        <Lock size={18} strokeWidth={1.75} />
      </Btn>
    </div>
  </div>
);

/* ---------------- Page ---------------- */

const PresentPage = () => {
  const [params] = useSearchParams();
  const param = params.get("items") || "";
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { signOut } = useClerk();
  const reduceMotion = useReducedMotion();
  const { items, loading, error } = usePresentationItems(param);
  const priceMode = useMemo(readPriceMode, []);
  const fullscreen = useFullscreen();
  useWakeLock();

  const [prices, setPrices] = useState(() => readOption(PRICES_KEY, PRICE_OPTIONS, "off"));
  const [interval, setInterval_] = useState(() => readOption(INTERVAL_KEY, INTERVAL_OPTIONS, "12"));
  const [brand, setBrand] = useState(() => readOption(BRAND_KEY, BRAND_OPTIONS, "none"));
  const logo = BRAND_LOGOS[brand] || null;
  const [view, setView] = useState("show");
  const [{ index }, setPos] = useState({ index: 0 });
  const [pick, setPick] = useState({ index: -1, media: 0 });
  const [paused, setPaused] = useState(false);
  const [chrome, setChrome] = useState(true);

  const here = `${location.pathname}${location.search}`;
  const [sheet, setSheet] = useState(() => (hasCode() ? null : "setup"));
  const [staff, setStaff] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [firstCode, setFirstCode] = useState("");
  const [waitUntil, setWaitUntil] = useState(0);

  const count = items.length;
  const current = items[Math.min(index, Math.max(count - 1, 0))];
  const media = useMemo(() => mediaFor(current), [current]);
  const active = pick.index === index ? pick.media : primaryMediaIndex(media);
  const durationMs = Number(interval) * 1000;

  const holdRef = useRef(0);
  const fillRef = useRef(null);
  const runningRef = useRef(false);
  runningRef.current = !paused && view === "show" && !sheet && !staff && !forgot && count > 1;

  useEffect(() => {
    if (!hasCode()) return;
    if (navigationType === "POP" && wasLeft(here)) return;
    clearLeft();
    engageLock(here);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here]);

  // iPad's back swipe can't be switched off, so while locked a copy of this
  // page sits on top of it: the swipe lands on that copy and a new one is laid.
  useEffect(() => {
    if (!location.state?.presentGuard && lockedUrl() === here) navigate(here, { state: { presentGuard: true } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, sheet]);

  useEffect(() => localStorage.setItem(PRICES_KEY, prices), [prices]);
  useEffect(() => localStorage.setItem(INTERVAL_KEY, interval), [interval]);
  useEffect(() => localStorage.setItem(BRAND_KEY, brand), [brand]);

  const hold = () => {
    holdRef.current = performance.now() + HOLD_MS;
  };

  const go = useCallback(
    (delta) => setPos(({ index: i }) => ({ index: count > 1 ? (i + delta + count) % count : i })),
    [count]
  );

  const step = (delta) => {
    hold();
    go(delta);
  };

  const onSwipe = (_e, info) => {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) step(1);
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) step(-1);
  };

  // Rotation: time only runs while the show is on screen and nobody is touching.
  useEffect(() => {
    if (count < 2) return undefined;
    let raf;
    let last = performance.now();
    let elapsed = 0;
    const tick = (t) => {
      const dt = t - last;
      last = t;
      if (runningRef.current && t >= holdRef.current && document.visibilityState === "visible") elapsed += dt;
      const p = Math.min(elapsed / durationMs, 1);
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
      if (p >= 1) {
        go(1);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, durationMs, count, go]);

  // Controls appear on touch and fade when the screen is left alone.
  const chromeTimer = useRef(null);
  const poke = useCallback(() => {
    setChrome(true);
    clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChrome(false), CHROME_MS);
  }, []);
  useEffect(() => {
    poke();
    return () => clearTimeout(chromeTimer.current);
  }, [poke]);

  // Turning a 360° happens inside its iframe, which the page never hears
  // about — except that focus leaves the window. Treat that as a touch, then
  // hand focus back so the next one registers too.
  useEffect(() => {
    let rearm;
    const onBlur = () => {
      if (document.activeElement?.tagName !== "IFRAME") return;
      holdRef.current = performance.now() + HOLD_MS;
      clearTimeout(rearm);
      rearm = setTimeout(() => {
        if (document.activeElement?.tagName === "IFRAME") document.activeElement.blur();
      }, 3000);
    };
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("blur", onBlur);
      clearTimeout(rearm);
    };
  }, []);

  // Warm the next piece's photo so the crossfade lands on a painted image.
  useEffect(() => {
    const next = count > 1 ? items[(index + 1) % count] : null;
    const src = next && posterFor(next);
    if (src) new Image().src = src;
  }, [index, items, count]);

  const openStaff = useCallback(() => {
    setWaitUntil(Date.now() + waitRemaining());
    setSheet("code");
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (sheet || staff || forgot) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") step(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") step(-1);
      else if (e.key === " ") setPaused((p) => !p);
      else if (e.key === "Escape") {
        if (view === "grid") setView("show");
        else openStaff();
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
      setSheet(null);
      setStaff(true);
      return null;
    }
    setWaitUntil(Date.now() + res.wait);
    return "Wrong code";
  };

  const exitPresentation = () => {
    releaseLock();
    markLeft(here);
    navigate("/inventory", { replace: true });
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

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-[#f5f5f7] text-[#1d1d1f] antialiased"
      style={{ height: "100dvh", overscrollBehavior: "none", WebkitTapHighlightColor: "transparent", fontFamily: FONT }}
      onPointerDown={() => {
        hold();
        poke();
      }}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-[15px] text-[#86868b]">Preparing the presentation…</div>
      ) : error ? (
        <div className="flex h-full items-center justify-center px-8 text-center text-[15px] text-[#d70015]">{error}</div>
      ) : !count ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
          <p className="text-[21px] font-semibold tracking-tight">Nothing to present</p>
          <p className="text-[15px] text-[#6e6e73]">Select stones or jewelry in Inventory, then choose Present.</p>
        </div>
      ) : view === "grid" ? (
        <Overview
          items={items}
          prices={prices}
          priceMode={priceMode}
          logo={logo}
          onOpen={(i) => {
            hold();
            setPos({ index: i });
            setView("show");
          }}
        />
      ) : (
        <AnimatePresence initial={false}>
          <motion.div
            key={`${current.sku}-${index}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            <Showcase
              item={current}
              media={media}
              active={active}
              onPick={(i) => {
                hold();
                setPick({ index, media: i });
              }}
              prices={prices}
              priceMode={priceMode}
              duration={durationMs}
              onSwipe={onSwipe}
              logo={logo}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {count > 1 && view === "show" && !loading && <Progress count={count} index={index} fillRef={fillRef} />}

      {!loading && (
        <Controls
          visible={chrome && !sheet && !staff && !forgot}
          count={count}
          view={view}
          paused={paused}
          onGrid={() => setView((v) => (v === "grid" ? "show" : "grid"))}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onPause={() => {
            holdRef.current = 0;
            setPaused((p) => !p);
          }}
          onStaff={openStaff}
        />
      )}

      <AnimatePresence>
        {forgot ? (
          <ForgotSheet key="forgot" onCancel={() => setForgot(false)} onSignOut={resetBySignOut} />
        ) : staff ? (
          <StaffSheet
            key="staff"
            prices={prices}
            priceOptions={PRICE_OPTIONS}
            onPrices={setPrices}
            interval={interval}
            intervalOptions={INTERVAL_OPTIONS}
            onInterval={setInterval_}
            brand={brand}
            brandOptions={BRAND_OPTIONS}
            onBrand={setBrand}
            fullscreen={fullscreen}
            onExit={exitPresentation}
            onDone={() => setStaff(false)}
          />
        ) : sheet ? (
          <CodeSheet
            key={settingUp ? "setup" : "code"}
            title={sheet === "setup" ? "Set a staff code" : sheet === "confirm" ? "Confirm the code" : "Staff code"}
            message={
              sheet === "setup"
                ? `Choose ${CODE_LENGTH} digits. Staff will need them to change the settings or leave the presentation on this device.`
                : sheet === "confirm"
                ? "Enter the same code again."
                : "Enter the code to change settings or exit."
            }
            onComplete={onCode}
            onCancel={settingUp ? () => navigate("/inventory", { replace: true }) : () => setSheet(null)}
            cancelLabel={settingUp ? "Back" : "Cancel"}
            waitUntil={sheet === "code" ? waitUntil : 0}
            footer={
              sheet === "code" && (
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

export default PresentPage;
