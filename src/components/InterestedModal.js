import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { submitDnaLead } from "../services/crmApi";

/**
 * "I'm interested" dialog shown on the public DNA pages.
 * Sends a lead into the shared CRM pipeline.
 *
 * Props:
 *   open      - boolean
 *   onClose   - () => void
 *   sku       - string  (the stone the visitor is interested in)
 *   snapshot  - object  (extra context about the stone, kept on the deal)
 */
export default function InterestedModal({ open, onClose, sku, snapshot }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    company: "",
    title: "",
    email: "",
    phone: "",
    message: "",
    hp: "", // honeypot
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setSuccess(false);
      // Restore previous identity if the visitor already submitted before
      try {
        const cached = JSON.parse(localStorage.getItem("dnaLeadIdentity") || "null");
        if (cached) setForm((f) => ({ ...f, ...cached }));
      } catch (_) {}
    }
  }, [open]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleEsc = useCallback(
    (e) => {
      if (e.key === "Escape" && open && !submitting) onClose();
    },
    [open, onClose, submitting]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [handleEsc]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!firstName && !lastName) {
      toast.error("Please enter your name");
      return;
    }
    if (!email && !phone) {
      toast.error("Please enter an email or phone");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email looks invalid");
      return;
    }

    setSubmitting(true);
    try {
      await submitDnaLead({
        firstName,
        lastName,
        email,
        phone,
        company: form.company.trim(),
        title: form.title.trim(),
        message: form.message.trim(),
        sku,
        snapshot: snapshot || null,
        hp: form.hp,
      });

      try {
        localStorage.setItem(
          "dnaLeadIdentity",
          JSON.stringify({
            firstName,
            lastName,
            email,
            phone,
            company: form.company.trim(),
            title: form.title.trim(),
          })
        );
      } catch (_) {}

      setSuccess(true);
      toast.success("Thank you! We will contact you shortly.");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
          onClick={() => !submitting && onClose()}
        />

        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        >
          {success ? (
            <SuccessView sku={sku} onClose={onClose} />
          ) : (
            <form onSubmit={handleSubmit}>
              <Header sku={sku} onClose={() => !submitting && onClose()} />

              <div className="px-5 pt-4 pb-5 space-y-3 max-h-[70vh] overflow-y-auto">
                <Row>
                  <Field label="First name *" autoFocus value={form.firstName} onChange={update("firstName")} />
                  <Field label="Last name" value={form.lastName} onChange={update("lastName")} />
                </Row>
                <Field label="Company" value={form.company} onChange={update("company")} />
                <Field label="Title" placeholder="e.g. Buyer, Designer" value={form.title} onChange={update("title")} />
                <Field label="Email *" type="email" inputMode="email" value={form.email} onChange={update("email")} />
                <Field label="Phone *" type="tel" inputMode="tel" value={form.phone} onChange={update("phone")} />
                <Textarea
                  label="Message (optional)"
                  rows={3}
                  placeholder={sku ? `I'm interested in stone ${sku}…` : "Anything you'd like us to know…"}
                  value={form.message}
                  onChange={update("message")}
                />

                {/* Honeypot — hidden from real users, bots fill it */}
                <input
                  type="text"
                  name="company_url"
                  tabIndex="-1"
                  autoComplete="off"
                  value={form.hp}
                  onChange={update("hp")}
                  style={{
                    position: "absolute",
                    left: "-10000px",
                    width: 1,
                    height: 1,
                    opacity: 0,
                  }}
                />

                <p className="text-[11px] text-stone-500 leading-relaxed pt-1">
                  By submitting, you allow our team to contact you about this stone. Either email or phone is required.
                </p>
              </div>

              <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <Spinner />}
                  {submitting ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

const Header = ({ sku, onClose }) => (
  <div className="px-5 pt-5 pb-3 border-b border-stone-200 flex items-start gap-3">
    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
      </svg>
    </div>
    <div className="flex-1 min-w-0">
      <h2 className="text-base font-semibold text-stone-900">I'm interested</h2>
      <p className="text-xs text-stone-500 mt-0.5 truncate">
        {sku ? <>Stone <span className="font-medium text-stone-700">{sku}</span> — leave your details and we'll reach out.</> : "Leave your details and we'll reach out."}
      </p>
    </div>
    <button
      type="button"
      onClick={onClose}
      className="p-1 -m-1 text-stone-400 hover:text-stone-700 rounded"
      aria-label="Close"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

const Row = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
);

const Field = ({ label, ...rest }) => (
  <label className="block">
    <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</span>
    <input
      {...rest}
      className="mt-1 w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
    />
  </label>
);

const Textarea = ({ label, ...rest }) => (
  <label className="block">
    <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</span>
    <textarea
      {...rest}
      className="mt-1 w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent resize-none"
    />
  </label>
);

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const SuccessView = ({ sku, onClose }) => (
  <div className="px-6 py-10 text-center">
    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
      <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-stone-900">Thank you!</h3>
    <p className="text-sm text-stone-600 mt-2 max-w-xs mx-auto">
      We received your interest{sku ? <> in <span className="font-medium">{sku}</span></> : null}. Our team will be in touch shortly.
    </p>
    <button
      type="button"
      onClick={onClose}
      className="mt-6 px-5 py-2 text-sm font-semibold rounded-lg bg-stone-900 text-white hover:bg-stone-800"
    >
      Close
    </button>
  </div>
);
