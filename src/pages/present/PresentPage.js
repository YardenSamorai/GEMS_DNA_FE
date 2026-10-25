import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import ShowcaseStage, { Glow } from "./ShowcaseStage";
import CodeSheet from "./CodeSheet";
import { ForgotSheet, StaffSheet } from "./StaffSheets";
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
 * Showcase — the selected stones and jewelry on an iPad standing on the
 * counter at a show. Each piece fills the screen: its 360° spin (or video, or
 * a slowly drifting photo) on a dark stage lit in the stone's own colour, the
 * essentials beside it, nothing to scroll. With several pieces it rotates on
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

const MediaButtons = ({ groups, active, onPick }) =>
  groups.length > 1 ? (
    <motion.div variants={rise} className="flex flex-wrap gap-2">
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
            className={`h-10 select-none rounded-full px-4 text-[14px] font-medium transition active:scale-95 ${
              on ? "bg-white text-black" : "bg-white/10 text-white/80 active:bg-white/20"
            }`}
            style={{ touchAction: "manipulation" }}
          >
            {g.label}
          </button>
        );
      })}
    </motion.div>
  ) : null;

const Showcase = ({ item, media, active, onPick, prices, priceMode, duration, onSwipe }) => {
  const reduceMotion = useReducedMotion();
  const poster = posterFor(item);
  const title = itemTitle(item);
  const grading = gradingLine(item);
  const specs = showcaseSpecs(item);
  const { total, perCt } = priceLines(item, prices, priceMode);

  return (
    <div
      className="flex h-full w-full flex-col items-center gap-[clamp(20px,3.2vh,40px)] px-[clamp(20px,4.5vw,72px)] pb-[clamp(24px,4vh,48px)] pt-[clamp(44px,6.5vh,76px)] landscape:flex-row landscape:gap-[clamp(28px,4.5vw,80px)]"
      style={{ paddingTop: "max(clamp(44px, 6.5vh, 76px), calc(env(safe-area-inset-top, 0px) + 36px))" }}
    >
      <div className="relative aspect-square shrink-0 portrait:w-full portrait:max-w-[min(100%,50dvh)] landscape:h-full landscape:max-w-[58%]">
        <Glow src={poster} />
        <div className="relative h-full w-full">
          <ShowcaseStage m={media[active]} poster={poster} title={title} duration={duration} onSwipe={onSwipe} />
        </div>
      </div>

      <motion.div
        onPanEnd={onSwipe}
        variants={enter}
        initial={reduceMotion ? "shown" : "hidden"}
        animate="shown"
        className="flex min-h-0 w-full min-w-0 flex-1 flex-col justify-center gap-[clamp(14px,2.4vh,28px)] self-stretch"
        style={{ touchAction: "pan-y" }}
      >
        <motion.div variants={rise}>
          <p className="text-[clamp(12px,1.1vw,14px)] font-semibold uppercase tracking-[0.24em] text-white/50">
            {categoryLabel(item)}
          </p>
          <h1 className="mt-3 line-clamp-3 text-[clamp(34px,4.3vw,64px)] font-semibold leading-[1.02] tracking-[-0.035em] text-white">
            {title}
          </h1>
          {grading && <p className="mt-3 text-[clamp(17px,1.7vw,24px)] tracking-[-0.01em] text-white/60">{grading}</p>}
        </motion.div>

        {total && (
          <motion.p variants={rise} className="text-[clamp(24px,2.6vw,36px)] font-semibold tabular-nums tracking-[-0.02em]">
            {total}
            {perCt && <span className="ml-3 text-[0.55em] font-normal text-white/55">{perCt}</span>}
          </motion.p>
        )}

        {specs.length > 0 && (
          <motion.dl
            variants={rise}
            className="grid grid-cols-2 gap-x-[clamp(16px,2.4vw,36px)] border-t border-white/10 portrait:grid-cols-4"
          >
            {specs.map(([k, v]) => (
              <div key={k} className="min-w-0 border-b border-white/10 py-[clamp(9px,1.5vh,14px)]">
                <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">{k}</dt>
                <dd title={v} className="mt-1 truncate text-[clamp(15px,1.5vw,20px)] font-medium tabular-nums tracking-[-0.01em] text-white/90">
                  {v}
                </dd>
              </div>
            ))}
          </motion.dl>
        )}

        <MediaButtons groups={mediaGroups(media)} active={active} onPick={onPick} />

        <motion.div variants={rise} className="flex items-center justify-between text-[12px] tracking-[0.08em] text-white/30">
          <span className="font-semibold uppercase tracking-[0.28em]">Gems DNA</span>
          <span className="tabular-nums">{item.sku}</span>
        </motion.div>
      </motion.div>
    </div>
  );
};

/* ---------------- All pieces ---------------- */

const Overview = ({ items, prices, priceMode, onOpen }) => (
  <div
    className="h-full overflow-y-auto overscroll-contain px-[clamp(20px,4.5vw,72px)] pb-32"
    style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 40px)" }}
  >
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
            <div className="relative aspect-square overflow-hidden rounded-[26px] bg-[#111113] ring-1 ring-white/10">
              {poster ? (
                <img src={poster} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-[13px] text-white/30">No photo</div>
              )}
            </div>
            <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{categoryLabel(item)}</p>
            <p className="mt-1 line-clamp-2 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-white">{itemTitle(item)}</p>
            {gradingLine(item) && <p className="mt-0.5 text-[14px] text-white/55">{gradingLine(item)}</p>}
            {total && <p className="mt-1.5 text-[15px] font-medium tabular-nums text-white/85">{total}</p>}
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
    className="pointer-events-none absolute inset-x-0 top-0 z-10 flex gap-1.5 px-[clamp(20px,4.5vw,72px)]"
    style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)" }}
  >
    {(count <= 30 ? Array.from({ length: count }, (_, i) => i) : [index]).map((i) => (
      <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
        <div
          ref={i === index ? fillRef : undefined}
          className="h-full w-full origin-left rounded-full bg-white/85"
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
    className="flex h-12 w-12 select-none items-center justify-center rounded-full text-white transition active:scale-95 active:bg-white/20"
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
    <div className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/10 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl backdrop-saturate-150">
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
      {count > 1 && <span className="mx-1 h-6 w-px bg-white/15" aria-hidden="true" />}
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
  const { signOut } = useClerk();
  const reduceMotion = useReducedMotion();
  const { items, loading, error } = usePresentationItems(param);
  const priceMode = useMemo(readPriceMode, []);
  const fullscreen = useFullscreen();
  useWakeLock();

  const [prices, setPrices] = useState(() => readOption(PRICES_KEY, PRICE_OPTIONS, "off"));
  const [interval, setInterval_] = useState(() => readOption(INTERVAL_KEY, INTERVAL_OPTIONS, "12"));
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
    if (hasCode()) engageLock(here);
  }, [here]);

  useEffect(() => localStorage.setItem(PRICES_KEY, prices), [prices]);
  useEffect(() => localStorage.setItem(INTERVAL_KEY, interval), [interval]);

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
      className="fixed inset-0 select-none overflow-hidden bg-black text-white antialiased"
      style={{ height: "100dvh", overscrollBehavior: "none", WebkitTapHighlightColor: "transparent", fontFamily: FONT }}
      onPointerDown={() => {
        hold();
        poke();
      }}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-[15px] text-white/50">Preparing the presentation…</div>
      ) : error ? (
        <div className="flex h-full items-center justify-center px-8 text-center text-[15px] text-red-400">{error}</div>
      ) : !count ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
          <p className="text-[21px] font-semibold tracking-tight">Nothing to present</p>
          <p className="text-[15px] text-white/50">Select stones or jewelry in Inventory, then choose Present.</p>
        </div>
      ) : view === "grid" ? (
        <Overview
          items={items}
          prices={prices}
          priceMode={priceMode}
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
