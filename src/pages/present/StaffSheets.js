import React, { useState } from "react";
import { motion } from "framer-motion";

const Backdrop = ({ label, role = "dialog", children }) => (
  <motion.div
    role={role}
    aria-modal="true"
    aria-label={label}
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6 backdrop-blur-2xl"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
  >
    <motion.div
      className="w-full max-w-[420px] rounded-[32px] border border-white/70 bg-white/95 p-7 text-glass-ink shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-xl"
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    >
      {children}
    </motion.div>
  </motion.div>
);

const Segmented = ({ label, options, value, onChange }) => (
  <div>
    <p className="mb-2 text-[13px] font-medium text-glass-muted">{label}</p>
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-black/[0.05] p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-10 flex-1 select-none whitespace-nowrap rounded-full px-2 text-[14px] font-medium transition ${
            value === o.id ? "bg-white text-glass-ink shadow-[0_1px_3px_rgba(0,0,0,0.14)]" : "text-glass-muted"
          }`}
          style={{ touchAction: "manipulation" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const Pill = ({ children, onClick, tone = "plain", disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`h-12 w-full select-none rounded-full text-[15px] font-medium transition active:scale-[0.98] disabled:opacity-50 ${
      tone === "primary"
        ? "bg-glass-ink text-white"
        : tone === "danger"
        ? "bg-red-600 text-white"
        : "bg-black/[0.05] text-glass-ink"
    }`}
    style={{ touchAction: "manipulation" }}
  >
    {children}
  </button>
);

export const StaffSheet = ({ prices, priceOptions, onPrices, interval, intervalOptions, onInterval, fullscreen, onExit, onDone }) => (
  <Backdrop label="Presentation settings">
    <h2 className="text-[20px] font-semibold tracking-[-0.015em]">Presentation settings</h2>
    <p className="mt-1 text-[14px] text-glass-muted">Visitors can browse, but only staff can change these.</p>
    <div className="mt-6 space-y-5">
      <Segmented label="Prices" options={priceOptions} value={prices} onChange={onPrices} />
      <Segmented label="Next piece every" options={intervalOptions} value={interval} onChange={onInterval} />
    </div>
    <div className="mt-7 space-y-2.5">
      {fullscreen.supported && <Pill onClick={fullscreen.toggle}>{fullscreen.on ? "Exit full screen" : "Full screen"}</Pill>}
      <Pill tone="primary" onClick={onDone}>
        Back to the presentation
      </Pill>
      <Pill tone="danger" onClick={onExit}>
        Exit presentation
      </Pill>
    </div>
  </Backdrop>
);

export const ForgotSheet = ({ onCancel, onSignOut }) => {
  const [busy, setBusy] = useState(false);
  return (
    <Backdrop label="Reset the staff code" role="alertdialog">
      <div className="text-center">
        <h2 className="text-[20px] font-semibold tracking-[-0.015em]">Reset the staff code</h2>
        <p className="mt-2 text-[14px] leading-snug text-glass-muted">
          This signs DNA out on this device. Signing back in needs the account password, then you can set a new code.
        </p>
      </div>
      <div className="mt-6 flex gap-3">
        <Pill onClick={onCancel}>Cancel</Pill>
        <Pill
          tone="danger"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onSignOut();
          }}
        >
          Sign out
        </Pill>
      </div>
    </Backdrop>
  );
};
