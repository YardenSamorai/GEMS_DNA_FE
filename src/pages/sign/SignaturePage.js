import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import SignaturePad from "../../components/signature/SignaturePad";
import {
  CONSENT_TEXT,
  fetchSignTokenContext,
  submitTokenSignature,
} from "../../services/signaturesApi";

/**
 * SignaturePage — public, no-auth route at `/sign/:token`.
 *
 * Lands when a counterparty (typically a retail store without a portal
 * account) opens the link a supplier shared over WhatsApp / email.
 * It renders a faithful, read-only preview of the memo (number,
 * parties, items, total) followed by a signature capture block.
 *
 * Backed by GET /api/sign/:token (preview) and POST /api/sign/:token
 * (submit). The token itself is consumed on first successful submit;
 * subsequent visits land on the "already used" state.
 */

const fmtMoney = (n, currency = "USD") => {
  const value = Number(n || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch (_) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
};

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export default function SignaturePage() {
  const { token } = useParams();
  const [state, setState] = useState({ status: "loading", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });
    fetchSignTokenContext(token)
      .then((data) => {
        if (cancelled) return;
        setState({
          status: data.existingSignature ? "already_signed" : "ready",
          data,
          error: null,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        // Map the BE error codes (`already_used` / `expired` / `not_found`)
        // into distinct UI states so the copy is right for each.
        const code = e.payload?.code || null;
        setState({
          status:
            code === "already_used" ? "used"
            : code === "expired"     ? "expired"
            : "error",
          data: null,
          error: e.message || "Failed to load",
        });
      });
    return () => { cancelled = true; };
  }, [token]);

  if (state.status === "loading") {
    return <Centered><div className="text-app-muted text-[13px]">Loading…</div></Centered>;
  }

  if (state.status === "used" || state.status === "already_signed") {
    return (
      <StatusCard
        tone="emerald"
        title="This memo has already been signed"
        body={
          state.data?.existingSignature
            ? `Signed by ${state.data.existingSignature.signer_name} on ${fmtDate(state.data.existingSignature.signed_at)}.`
            : "The signing link has already been redeemed. If you believe this is an error, contact the supplier."
        }
      />
    );
  }

  if (state.status === "expired") {
    return (
      <StatusCard
        tone="amber"
        title="This signing link has expired"
        body="The link is no longer valid. Please ask the supplier to issue a new one."
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatusCard
        tone="rose"
        title="Signing link unavailable"
        body={state.error || "This signing link is not available."}
      />
    );
  }

  // status === "ready"
  return <ReadyView token={token} ctx={state.data} onSigned={(sig) => {
    setState((s) => ({ ...s, status: "already_signed", data: { ...s.data, existingSignature: sig } }));
  }} />;
}

/* ─────────── Ready view (memo preview + signing form) ─────────── */

function ReadyView({ token, ctx, onSigned }) {
  const { memo, token: tokenMeta } = ctx;
  const padRef = useRef(null);
  const [dataUrl, setDataUrl] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(tokenMeta?.signerEmail || "");
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = name.trim();
  const canSubmit = !!dataUrl && !!trimmedName && consented && !submitting;

  const handleClear = () => {
    padRef.current?.clear();
    setDataUrl(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const sig = await submitTokenSignature(token, {
        signerName: trimmedName,
        signerEmail: email.trim() || undefined,
        signatureDataUrl: dataUrl,
      });
      toast.success("Signature recorded — thank you");
      onSigned?.(sig);
    } catch (e) {
      toast.error(e.message || "Failed to record signature");
    } finally {
      setSubmitting(false);
    }
  };

  const isClose = tokenMeta.event === "close";
  const heading = isClose
    ? `Sign return acknowledgment for memo ${memo.memo_number}`
    : `Acknowledge receipt of memo ${memo.memo_number}`;

  const total = Number(memo.total_value || 0)
    || (memo.items || []).reduce((a, i) => a + Number(i.memo_price || 0), 0);

  return (
    <div className="min-h-screen app-canvas">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10 space-y-4 sm:space-y-5">
        {/* Header card — quiet glass, ink display heading */}
        <div className="glass-surface-strong rounded-3xl p-5 sm:p-7">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-app-muted">Electronic signature</div>
          <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-tight text-app-ink mt-2 leading-tight break-words">{heading}</h1>
          <p className="text-[13.5px] text-app-muted mt-2 leading-relaxed">
            Please review the memo details below, then add your signature at the bottom to confirm
            {isClose ? " the return." : " receipt."}
          </p>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <PartyCard
            kind="From (Supplier)"
            name={memo.supplier_name || "Supplier"}
            email={memo.supplier_email}
          />
          <PartyCard
            kind="To"
            name={memo.company_name}
            email={memo.company_email}
            phone={memo.company_phone}
            address={[memo.company_address, memo.company_city, memo.company_country].filter(Boolean).join(", ")}
            logoUrl={memo.company_logo}
          />
        </div>

        {/* Summary */}
        <div className="glass-surface rounded-3xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Stat label="Memo" value={memo.memo_number} />
          <Stat label="Issued" value={fmtDate(memo.issued_at)} />
          <Stat label="Due" value={fmtDate(memo.due_at)} />
          <Stat label="Total" value={fmtMoney(total, memo.currency)} />
        </div>

        {/* Items */}
        <div className="glass-surface rounded-3xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-line text-[12.5px] font-semibold tracking-tight text-app-ink">
            Items ({(memo.items || []).length})
          </div>
          {(memo.items || []).length === 0 ? (
            <div className="p-6 text-center text-[13px] text-app-soft">No items</div>
          ) : (
            <div className="divide-y divide-app-line">
              {memo.items.map((it) => <ItemRow key={it.id} item={it} currency={memo.currency} />)}
            </div>
          )}
        </div>

        {/* Signature capture */}
        <div className="glass-surface-strong rounded-3xl p-5 sm:p-7 space-y-4">
          <div className="text-[13px] font-semibold tracking-tight text-app-ink">Your signature</div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">
                Draw your signature
              </label>
              <button
                type="button"
                onClick={handleClear}
                disabled={submitting || !dataUrl}
                className="text-[11px] font-medium text-app-muted hover:text-app-ink disabled:opacity-30"
              >
                Clear
              </button>
            </div>
            <SignaturePad
              ref={padRef}
              onChange={setDataUrl}
              disabled={submitting}
              height={200}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">
                Full legal name <span className="text-app-ink">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                placeholder="e.g. Sarah Cohen"
                className="input-modern disabled:opacity-50"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">
                Email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="for a receipt copy"
                className="input-modern disabled:opacity-50"
                autoComplete="email"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-2xl glass-surface px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 rounded border-app-line text-app-ink focus:ring-app-ink"
            />
            <span className="text-[12px] text-app-graphite leading-relaxed">{CONSENT_TEXT}</span>
          </label>

          <div className="text-[10.5px] text-app-soft leading-relaxed">
            Your IP address, browser, and a timestamp will be recorded with this signature for audit purposes.
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-primary w-full py-3"
          >
            {submitting ? "Saving…" : (isClose ? "Sign return acknowledgment" : "Sign acknowledgment")}
          </button>
        </div>

        <div className="text-center text-[10.5px] text-app-soft tracking-[0.04em] pb-4">
          GEMS DNA · Electronic signature
        </div>
      </div>
    </div>
  );
}

/* ─────────── Small layout primitives ─────────── */

function PartyCard({ kind, name, email, phone, address, logoUrl }) {
  const initials = (name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <div className="glass-surface rounded-2xl p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-app-muted mb-2">{kind}</div>
      <div className="flex items-start gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="w-10 h-10 rounded-xl object-cover bg-app-canvas-2 ring-1 ring-app-line shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-app-ink text-app-canvas flex items-center justify-center font-medium text-[12.5px] shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="font-semibold text-app-ink truncate">{name}</div>
          {address && <div className="text-[11.5px] text-app-muted break-words">{address}</div>}
          <div className="mt-1.5 space-y-0.5 text-[11.5px] text-app-graphite">
            {email && <div className="break-all">✉ {email}</div>}
            {phone && <div>☎ {phone}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-app-muted">{label}</div>
      <div className="text-[16px] sm:text-[18px] font-semibold tracking-tight text-app-ink break-words">{value}</div>
    </div>
  );
}

function ItemRow({ item, currency }) {
  const snap = item.snapshot || {};
  const isJewelry = item.item_type === "jewelry";
  const spec = isJewelry
    ? [snap.jewelryType, snap.metalType, snap.collection, snap.style].filter(Boolean).join(" · ")
    : [
        snap.shape && `${snap.shape}`,
        snap.weightCt && `${snap.weightCt}ct`,
        snap.color,
        snap.clarity,
        snap.lab,
      ].filter(Boolean).join(" · ");
  const title = snap.title || (isJewelry ? snap.jewelryType : snap.shape) || item.item_sku;
  return (
    <div className="flex items-start gap-3 p-3 sm:p-4">
      {snap.imageUrl ? (
        <img src={snap.imageUrl} alt={item.item_sku} className="w-12 h-12 rounded-xl object-cover bg-app-canvas-2 ring-1 ring-app-line shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-app-canvas-2 text-app-soft shrink-0 flex items-center justify-center text-[10px] font-medium tracking-[0.14em]">
          {isJewelry ? "JW" : "ST"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-mono text-app-muted">{item.item_sku}</div>
        <div className="text-[13px] font-semibold text-app-ink truncate">{title}</div>
        {spec && <div className="text-[11.5px] text-app-muted truncate">{spec}</div>}
      </div>
      <div className="text-right shrink-0 text-[14.5px] font-semibold tracking-tight text-app-ink">
        {item.memo_price ? fmtMoney(item.memo_price, currency) : <span className="text-app-soft text-[12px]">—</span>}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div className="min-h-screen app-canvas flex items-center justify-center px-4">
      {children}
    </div>
  );
}

function StatusCard({ tone, title, body }) {
  // v1.0.5 — every status tone collapses to a quiet glass card. The icon
  // tint conveys the meaning: emerald = success, ink = neutral/info.
  const isPositive = tone === "emerald";
  return (
    <Centered>
      <div className="max-w-md w-full glass-surface-strong rounded-3xl p-7 text-center">
        <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
          isPositive
            ? "bg-brand-emerald/12 text-brand-emerald"
            : "bg-app-surface/60 border border-white/55 text-app-graphite backdrop-blur-md"
        }`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-[16px] font-semibold tracking-tight text-app-ink">{title}</div>
        <div className="mt-2 text-[13px] text-app-muted leading-relaxed">{body}</div>
      </div>
    </Centered>
  );
}
