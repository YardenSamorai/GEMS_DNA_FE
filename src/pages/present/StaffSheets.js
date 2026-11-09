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

/* A presentation opened from Inventory isn't saved; this keeps it, with the
 * settings on screen, so it shows up in Presentations next time. */
const SaveHere = ({ onSave, savedAs }) => {
  const [state, setState] = useState({ step: savedAs ? "saved" : "idle", name: savedAs || "", error: "" });
  if (state.step === "saved") {
    return <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-[14px] text-emerald-800">Saved as “{state.name}” in Presentations.</p>;
  }
  if (state.step === "idle") {
    return <Pill onClick={() => setState({ step: "naming", name: "", error: "" })}>Save as presentation</Pill>;
  }
  const busy = state.step === "saving";
  const submit = async (e) => {
    e.preventDefault();
    const name = state.name.replace(/\s+/g, " ").trim();
    if (!name || busy) return;
    setState({ step: "saving", name, error: "" });
    try {
      const p = await onSave(name);
      setState({ step: "saved", name: p.name, error: "" });
    } catch (err) {
      setState({ step: "naming", name, error: err.message || "Couldn't save" });
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        autoFocus
        value={state.name}
        maxLength={120}
        onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
        placeholder="Name, e.g. Dubai show"
        aria-label="Presentation name"
        className="h-12 w-full rounded-full border border-black/10 bg-white px-5 text-[15px] outline-none focus:border-black/30"
      />
      {state.error && <p className="px-2 text-[13px] text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <Pill onClick={() => setState({ step: "idle", name: "", error: "" })}>Cancel</Pill>
        <button
          type="submit"
          disabled={busy || !state.name.trim()}
          className="h-12 w-full select-none rounded-full bg-glass-ink text-[15px] font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
          style={{ touchAction: "manipulation" }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
};

export const StaffSheet = ({
  prices,
  priceOptions,
  onPrices,
  interval,
  intervalOptions,
  onInterval,
  brand,
  brandOptions,
  onBrand,
  fullscreen,
  name,
  note,
  onSave,
  savedAs,
  onExit,
  onDone,
}) => (
  <Backdrop label="Presentation settings">
    <h2 className="text-[20px] font-semibold tracking-[-0.015em]">{name || "Presentation settings"}</h2>
    <p className="mt-1 text-[14px] text-glass-muted">
      {name
        ? "Visitors can browse, but only staff can change these. Changes are saved to the presentation."
        : "Visitors can browse, but only staff can change these."}
    </p>
    {note && <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-snug text-amber-900">{note}</p>}
    <div className="mt-6 space-y-5">
      <Segmented label="Logo" options={brandOptions} value={brand} onChange={onBrand} />
      <Segmented label="Prices" options={priceOptions} value={prices} onChange={onPrices} />
      <Segmented label="Next piece every" options={intervalOptions} value={interval} onChange={onInterval} />
    </div>
    <div className="mt-7 space-y-2.5">
      {onSave && <SaveHere onSave={onSave} savedAs={savedAs} />}
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
