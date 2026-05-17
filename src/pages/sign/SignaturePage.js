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
    return <Centered><div className="text-stone-500 text-sm">Loading…</div></Centered>;
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
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10 space-y-4 sm:space-y-5">
        {/* Header card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-bold">Electronic signature</div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1 break-words">{heading}</h1>
          <p className="text-sm text-stone-600 mt-1">
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
            accent="border-stone-300"
          />
          <PartyCard
            kind="To"
            name={memo.company_name}
            email={memo.company_email}
            phone={memo.company_phone}
            address={[memo.company_address, memo.company_city, memo.company_country].filter(Boolean).join(", ")}
            logoUrl={memo.company_logo}
            accent="border-stone-900"
          />
        </div>

        {/* Summary */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Stat label="Memo" value={memo.memo_number} />
          <Stat label="Issued" value={fmtDate(memo.issued_at)} />
          <Stat label="Due" value={fmtDate(memo.due_at)} />
          <Stat label="Total" value={fmtMoney(total, memo.currency)} />
        </div>

        {/* Items */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-200 font-semibold text-stone-900">
            Items ({(memo.items || []).length})
          </div>
          {(memo.items || []).length === 0 ? (
            <div className="p-6 text-center text-sm text-stone-400">No items</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {memo.items.map((it) => <ItemRow key={it.id} item={it} currency={memo.currency} />)}
            </div>
          )}
        </div>

        {/* Signature capture */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="text-sm font-semibold text-stone-900">Your signature</div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Draw your signature
              </label>
              <button
                type="button"
                onClick={handleClear}
                disabled={submitting || !dataUrl}
                className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 disabled:opacity-30"
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
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Full legal name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                placeholder="e.g. Sarah Cohen"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-stone-400 disabled:opacity-50"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="for a receipt copy"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-stone-400 disabled:opacity-50"
                autoComplete="email"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg bg-stone-50 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs text-stone-700 leading-relaxed">{CONSENT_TEXT}</span>
          </label>

          <div className="text-[11px] text-stone-400 leading-relaxed">
            Your IP address, browser, and a timestamp will be recorded with this signature for audit purposes.
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : (isClose ? "Sign return acknowledgment" : "Sign acknowledgment")}
          </button>
        </div>

        <div className="text-center text-[11px] text-stone-400 pb-4">
          GEMS DNA · Electronic signature
        </div>
      </div>
    </div>
  );
}

/* ─────────── Small layout primitives ─────────── */

function PartyCard({ kind, name, email, phone, address, logoUrl, accent }) {
  const initials = (name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <div className={`bg-white border-l-4 ${accent} border border-stone-200 rounded-xl p-4`}>
      <div className="text-[10px] uppercase tracking-[0.15em] text-stone-400 font-bold mb-2">{kind}</div>
      <div className="flex items-start gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="w-10 h-10 rounded-lg object-cover bg-stone-100 ring-1 ring-stone-200 shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-stone-700 to-stone-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold text-stone-900 truncate">{name}</div>
          {address && <div className="text-xs text-stone-500 break-words">{address}</div>}
          <div className="mt-1.5 space-y-0.5 text-xs text-stone-600">
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
      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{label}</div>
      <div className="text-base sm:text-lg font-bold text-stone-900 break-words">{value}</div>
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
        <img src={snap.imageUrl} alt={item.item_sku} className="w-12 h-12 rounded-lg object-cover bg-stone-100 ring-1 ring-stone-200 shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-stone-200 shrink-0 flex items-center justify-center text-stone-400 text-[10px] font-bold">
          {isJewelry ? "JW" : "ST"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-stone-500">{item.item_sku}</div>
        <div className="text-sm font-semibold text-stone-900 truncate">{title}</div>
        {spec && <div className="text-xs text-stone-500 truncate">{spec}</div>}
      </div>
      <div className="text-right shrink-0 text-base font-bold text-stone-900">
        {item.memo_price ? fmtMoney(item.memo_price, currency) : <span className="text-stone-300 text-sm">—</span>}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      {children}
    </div>
  );
}

function StatusCard({ tone, title, body }) {
  const toneClasses = {
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", title: "text-emerald-900", body: "text-emerald-800", icon: "text-emerald-700" },
    amber:   { bg: "bg-amber-50",   border: "border-amber-200",   title: "text-amber-900",   body: "text-amber-800",   icon: "text-amber-700"   },
    rose:    { bg: "bg-rose-50",    border: "border-rose-200",    title: "text-rose-900",    body: "text-rose-800",    icon: "text-rose-700"    },
  }[tone] || { bg: "bg-stone-50", border: "border-stone-200", title: "text-stone-900", body: "text-stone-700", icon: "text-stone-500" };

  return (
    <Centered>
      <div className={`max-w-md w-full ${toneClasses.bg} border ${toneClasses.border} rounded-2xl p-6 text-center`}>
        <div className={`mx-auto w-10 h-10 rounded-full bg-white border ${toneClasses.border} flex items-center justify-center mb-3`}>
          <svg className={`w-5 h-5 ${toneClasses.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className={`text-base font-semibold ${toneClasses.title}`}>{title}</div>
        <div className={`mt-1 text-sm ${toneClasses.body}`}>{body}</div>
      </div>
    </Centered>
  );
}
