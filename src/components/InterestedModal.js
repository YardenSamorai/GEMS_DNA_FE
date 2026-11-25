import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { submitDnaLead } from "../services/crmApi";
import { EASE_OUT, FADE, FADE_FAST, SPRING, SPRING_EXIT, shouldDismiss } from "../design/motion";
import { ChevronLeft, CloseIcon } from "../pages/dna/icons";
import {
  CHANNELS,
  IDENTITY_KEY,
  INTERESTS,
  ROLES,
  channelOf,
  contactError,
  firstNameOf,
  itemSummary,
  leadPayload,
  nameError,
  readIdentity,
} from "./interested/interestedModel";
import "./interested/interested.css";

const STEPS = 3;

const EMPTY = {
  interests: [],
  role: "",
  name: "",
  company: "",
  channel: "whatsapp",
  email: "",
  phone: "",
  note: "",
  hp: "",
};

const usePhone = () => {
  const query = "(max-width: 639.98px)";
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return match;
};

const loadIdentity = () => {
  try {
    return readIdentity(JSON.parse(localStorage.getItem(IDENTITY_KEY) || "null"));
  } catch (_) {
    return null;
  }
};

/**
 * "I'm interested" on the public DNA and jewelry pages: a short guided
 * request that lands in the shared CRM pipeline.
 *
 * Props: open, onClose, sku, snapshot (context kept on the deal).
 */
export default function InterestedModal({ open, onClose, sku, snapshot }) {
  return createPortal(
    <AnimatePresence>
      {open && <InterestedSheet key="sheet" onClose={onClose} sku={sku} snapshot={snapshot} />}
    </AnimatePresence>,
    document.body
  );
}

function InterestedSheet({ onClose, sku, snapshot }) {
  const reduce = useReducedMotion();
  const phone = usePhone();
  const drag = useDragControls();
  const [identity] = useState(loadIdentity);
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...(identity || {}),
    channel: identity?.channel || (identity?.email && !identity?.phone ? "email" : "whatsapp"),
    role: identity?.role || "",
  }));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [done, setDone] = useState(false);
  const item = itemSummary({ ...snapshot, sku: snapshot?.sku || sku });
  const greetName = firstNameOf(identity?.name);

  const close = useCallback(() => {
    if (!sending) onClose();
  }, [sending, onClose]);

  useEffect(() => {
    const prev = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [close]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: null }));
  };

  const toggleInterest = (id) =>
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(id) ? f.interests.filter((x) => x !== id) : [...f.interests, id],
    }));

  const go = (next) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setSendError(null);
  };

  const send = async () => {
    setSending(true);
    setSendError(null);
    try {
      const payload = leadPayload({ form, sku, snapshot });
      await submitDnaLead(payload);
      try {
        localStorage.setItem(
          IDENTITY_KEY,
          JSON.stringify({
            name: form.name.trim(),
            email: payload.email,
            phone: payload.phone,
            company: payload.company,
            role: form.role,
            channel: form.channel,
          })
        );
      } catch (_) {}
      setDir(1);
      setDone(true);
    } catch (err) {
      setSendError(err?.message && !/^Request failed/.test(err.message)
        ? err.message
        : "We couldn't send that. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (sending) return;
    if (step === 0) return go(1);
    if (step === 1) {
      const name = nameError(form.name);
      if (name) return setErrors({ name });
      return go(2);
    }
    const field = channelOf(form.channel).field;
    const contact = contactError(form.channel, form);
    if (contact) return setErrors({ [field]: contact });
    send();
  };

  const sheetMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: FADE_FAST }, transition: FADE }
    : phone
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%", transition: SPRING_EXIT }, transition: SPRING }
      : {
          initial: { opacity: 0, scale: 0.96, y: 16 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.97, y: 10, transition: SPRING_EXIT },
          transition: SPRING,
        };

  const stepMotion = {
    custom: dir,
    variants: {
      enter: (d) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 28 }),
      center: { opacity: 1, x: 0 },
      exit: (d) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -28 }),
    },
    initial: "enter",
    animate: "center",
    exit: "exit",
    transition: { duration: 0.22, ease: EASE_OUT },
  };

  const channel = channelOf(form.channel);

  return (
    <div className="dli" role="dialog" aria-modal="true" aria-labelledby="dli-title">
      <motion.div
        className="dli-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
        transition={FADE}
        onClick={close}
      />
      <motion.div
        className="dli-sheet"
        {...sheetMotion}
        drag={phone && !reduce ? "y" : false}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.8 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 0 && shouldDismiss(info)) close();
        }}
      >
        <div className="dli-grab" onPointerDown={(e) => drag.start(e)} aria-hidden="true">
          <span />
        </div>

        <div className="dli-head" onPointerDown={(e) => phone && e.target === e.currentTarget && drag.start(e)}>
          {step > 0 && !done ? (
            <button type="button" className="dli-icon" onClick={() => go(step - 1)} aria-label="Back" disabled={sending}>
              <ChevronLeft size={22} />
            </button>
          ) : (
            <span className="dli-icon-space" />
          )}
          {!done && (
            <div className="dli-progress" aria-label={`Step ${step + 1} of ${STEPS}`}>
              {Array.from({ length: STEPS }, (_, i) => (
                <span key={i} data-on={i <= step ? "" : undefined} data-current={i === step ? "" : undefined} />
              ))}
            </div>
          )}
          <button type="button" className="dli-icon" onClick={close} aria-label="Close" disabled={sending}>
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="dli-body">
          {!done && <ItemCard item={item} sku={sku} image={snapshot?.image} />}

          <AnimatePresence mode="wait" initial={false} custom={dir}>
            {done ? (
              <motion.div key="done" className="dli-step dli-done" {...stepMotion}>
                <SuccessMark reduce={reduce} />
                <h2 id="dli-title" className="dli-title">
                  Thank you{firstNameOf(form.name) ? `, ${firstNameOf(form.name)}` : ""}.
                </h2>
                <p className="dli-lede">
                  Your request about this {item.noun} is with our team. We'll get back to you {channel.reply} shortly.
                </p>
                <div className="dli-foot">
                  <button type="button" className="dli-primary" onClick={onClose} autoFocus>
                    Back to the {item.noun}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form key={step} className="dli-step" onSubmit={submit} noValidate {...stepMotion}>
                {step === 0 && (
                  <>
                    <h2 id="dli-title" className="dli-title">
                      {greetName ? `Welcome back, ${greetName}.` : `Love this ${item.noun}?`}
                    </h2>
                    <p className="dli-lede">Tell us what you'd like to know. Pick as many as you want.</p>
                    <div className="dli-chips" role="group" aria-label="What would you like to know">
                      {INTERESTS.map((i) => (
                        <Chip key={i.id} on={form.interests.includes(i.id)} onClick={() => toggleInterest(i.id)}>
                          {i.label}
                        </Chip>
                      ))}
                    </div>
                    <div className="dli-group-label" id="dli-role">I'm a…</div>
                    <div className="dli-chips" role="group" aria-labelledby="dli-role">
                      {ROLES.map((r) => (
                        <Chip key={r.id} on={form.role === r.id} onClick={() => setForm((f) => ({ ...f, role: f.role === r.id ? "" : r.id }))}>
                          {r.label}
                        </Chip>
                      ))}
                    </div>
                    <Foot>
                      <button type="submit" className="dli-primary">Continue</button>
                    </Foot>
                  </>
                )}

                {step === 1 && (
                  <>
                    <h2 id="dli-title" className="dli-title">Who are we talking to?</h2>
                    <p className="dli-lede">So the right person on our team can answer you.</p>
                    <Field
                      label="Your name"
                      error={errors.name}
                      autoFocus={!form.name}
                      autoComplete="name"
                      autoCapitalize="words"
                      enterKeyHint="next"
                      placeholder="First and last name"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                    />
                    <Field
                      label="Company"
                      optional
                      autoComplete="organization"
                      enterKeyHint="next"
                      placeholder="Where you work, if it's for business"
                      value={form.company}
                      onChange={(e) => set("company", e.target.value)}
                    />
                    <Foot>
                      <button type="submit" className="dli-primary">Continue</button>
                    </Foot>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h2 id="dli-title" className="dli-title">Where should we reply?</h2>
                    <p className="dli-lede">Choose what's easiest for you.</p>
                    <div className="dli-seg" role="radiogroup" aria-label="Reply by">
                      {CHANNELS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={form.channel === c.id}
                          className="dli-seg-btn"
                          onClick={() => {
                            set("channel", c.id);
                            setErrors({});
                          }}
                        >
                          {form.channel === c.id && (
                            <motion.span
                              layoutId="dli-seg-pill"
                              className="dli-seg-pill"
                              transition={reduce ? { duration: 0 } : SPRING}
                            />
                          )}
                          <span className="dli-seg-label">{c.label}</span>
                        </button>
                      ))}
                    </div>
                    {channel.field === "email" ? (
                      <Field
                        key="email"
                        label="Email"
                        error={errors.email}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                      />
                    ) : (
                      <Field
                        key="phone"
                        label={channel.id === "whatsapp" ? "WhatsApp number" : "Phone number"}
                        error={errors.phone}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="Include your country code"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                      />
                    )}
                    <Field
                      as="textarea"
                      label="Anything else?"
                      optional
                      rows={3}
                      placeholder={`A budget, a deadline, a question about the ${item.noun}…`}
                      value={form.note}
                      onChange={(e) => set("note", e.target.value)}
                    />
                    <input
                      className="dli-hp"
                      type="text"
                      name="company_url"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      value={form.hp}
                      onChange={(e) => set("hp", e.target.value)}
                    />
                    {sendError && (
                      <p className="dli-send-error" role="alert">
                        {sendError}
                      </p>
                    )}
                    <Foot note="We only use your details to answer this request.">
                      <button type="submit" className="dli-primary" disabled={sending}>
                        {sending ? (
                          <>
                            <Spinner /> Sending…
                          </>
                        ) : (
                          "Send request"
                        )}
                      </button>
                    </Foot>
                  </>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

const ItemCard = ({ item, sku, image }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className="dli-item">
      <div className="dli-item-thumb">
        {image && !broken ? (
          <img src={image} alt="" onError={() => setBroken(true)} />
        ) : (
          <span className="dli-item-gem" aria-hidden="true" />
        )}
      </div>
      <div className="dli-item-text">
        <div className="dli-item-title">{item.title}</div>
        {(item.subtitle || sku) && (
          <div className="dli-item-sub">{[item.subtitle, sku].filter(Boolean).join(" · ")}</div>
        )}
      </div>
    </div>
  );
};

const Chip = ({ on, onClick, children }) => (
  <button type="button" className="dli-chip" aria-pressed={on} onClick={onClick}>
    {children}
  </button>
);

const Field = ({ label, optional, error, as = "input", ...rest }) => {
  const Tag = as;
  return (
    <label className="dli-field">
      <span className="dli-label">
        {label}
        {optional && <span className="dli-optional"> · optional</span>}
      </span>
      <Tag className="dli-input" aria-invalid={error ? true : undefined} {...rest} />
      <AnimatePresence initial={false}>
        {error && (
          <motion.span
            className="dli-error"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: FADE_FAST }}
            transition={FADE}
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </label>
  );
};

const Foot = ({ note, children }) => (
  <div className="dli-foot">
    {children}
    {note && <p className="dli-note">{note}</p>}
  </div>
);

const Spinner = () => <span className="dli-spinner" aria-hidden="true" />;

const SuccessMark = ({ reduce }) => (
  <motion.div
    className="dli-success"
    initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={reduce ? FADE : { type: "spring", bounce: 0.35, duration: 0.5 }}
  >
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: reduce ? 0 : 0.18, duration: 0.35, ease: EASE_OUT }}
      />
    </svg>
  </motion.div>
);
