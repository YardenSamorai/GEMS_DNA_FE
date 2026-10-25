import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { Delete, Lock } from "lucide-react";
import { CODE_LENGTH } from "./presentLock";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const clock = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const Key = ({ children, label, onPress, disabled, quiet }) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onPress}
    className={`flex h-[72px] w-[72px] select-none items-center justify-center rounded-full text-[28px] font-normal tabular-nums text-glass-ink transition active:scale-95 disabled:opacity-30 ${
      quiet ? "text-[15px] font-medium active:bg-black/[0.06]" : "bg-black/[0.05] active:bg-black/[0.14]"
    }`}
    style={{ touchAction: "manipulation" }}
  >
    {children}
  </button>
);

/* A numeric pad over the presentation. `onComplete(code)` resolves to an
 * error string (shake and clear) or nothing (done). `waitUntil` freezes the
 * pad and counts down after too many wrong codes. */
const CodeSheet = ({ title, message, onComplete, onCancel, cancelLabel = "Cancel", waitUntil = 0, footer }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const shake = useAnimationControls();
  const reduceMotion = useReducedMotion();
  const busyRef = useRef(false);
  const codeRef = useRef("");

  const put = useCallback((next) => {
    codeRef.current = next;
    setCode(next);
  }, []);

  const waiting = waitUntil > now;

  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  const submit = useCallback(
    async (full) => {
      busyRef.current = true;
      setBusy(true);
      const err = await onComplete(full);
      busyRef.current = false;
      setBusy(false);
      if (!err) return;
      setError(err);
      put("");
      setNow(Date.now());
      if (!reduceMotion) shake.start({ x: [0, -12, 12, -9, 9, -4, 4, 0], transition: { duration: 0.45 } });
    },
    [onComplete, put, reduceMotion, shake]
  );

  const press = useCallback(
    (digit) => {
      if (busyRef.current || waitUntil > Date.now() || codeRef.current.length >= CODE_LENGTH) return;
      setError("");
      const next = codeRef.current + digit;
      put(next);
      if (next.length === CODE_LENGTH) submit(next);
    },
    [put, submit, waitUntil]
  );

  const erase = useCallback(() => {
    if (!busyRef.current) put(codeRef.current.slice(0, -1));
  }, [put]);

  useEffect(() => {
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") erase();
      else if (e.key === "Escape" && onCancel) onCancel();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [press, erase, onCancel]);

  const shown = waiting ? `Too many tries. Try again in ${clock(waitUntil - now)}` : error || message;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6 backdrop-blur-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="flex w-full max-w-[360px] flex-col items-center rounded-[32px] border border-white/70 bg-white/90 px-7 pb-6 pt-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl"
        initial={reduceMotion ? false : { scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-glass-ink text-white">
          <Lock size={18} strokeWidth={2} />
        </div>
        <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.015em] text-glass-ink">{title}</h2>
        <p
          aria-live="polite"
          className={`mt-1.5 min-h-[40px] text-center text-[14px] leading-snug ${
            error || waiting ? "text-red-600" : "text-glass-muted"
          }`}
        >
          {shown}
        </p>

        <motion.div animate={shake} className="mt-3 flex gap-4" aria-hidden="true">
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-[1.5px] border-glass-ink transition-colors ${
                i < code.length ? "bg-glass-ink" : "bg-transparent"
              }`}
            />
          ))}
        </motion.div>

        <div className="mt-7 grid grid-cols-3 gap-x-5 gap-y-3.5">
          {KEYS.map((k) => (
            <Key key={k} label={k} onPress={() => press(k)} disabled={waiting || busy}>
              {k}
            </Key>
          ))}
          {onCancel ? (
            <Key quiet label={cancelLabel} onPress={onCancel}>
              {cancelLabel}
            </Key>
          ) : (
            <span />
          )}
          <Key label="0" onPress={() => press("0")} disabled={waiting || busy}>
            0
          </Key>
          <Key quiet label="Delete" onPress={erase} disabled={!code || busy}>
            <Delete size={24} strokeWidth={1.6} />
          </Key>
        </div>

        {footer && <div className="mt-5">{footer}</div>}
      </motion.div>
    </motion.div>
  );
};

export default CodeSheet;
