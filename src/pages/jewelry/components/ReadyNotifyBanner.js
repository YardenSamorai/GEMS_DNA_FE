import React, { useState } from "react";
import { fetchContact, createInteraction } from "../../../services/crmApi";

/* Phase C — When a workshop piece flips to status="ready" and has a linked
 * CRM contact, show a single, focused panel that lets the salesperson reach
 * out in one click. We deliberately keep this client-side (link-out to
 * WhatsApp / mailto) so it works without server-side messaging credentials,
 * but we DO log a `customer_notified` interaction in CRM so the customer
 * profile timeline reflects it.
 */
const ReadyNotifyBanner = ({ item, userId, onLogged }) => {
  const [busyKind, setBusyKind] = useState(null);
  const [logged, setLogged] = useState(false);
  const [contact, setContact] = useState(null);
  const [loadedContact, setLoadedContact] = useState(false);
  const [err, setErr] = useState(null);

  // Pull the contact once so we have phone + email even if the parent only
  // gave us contact_id + contact_name (which is the case in JewelryItemDetail).
  React.useEffect(() => {
    if (!item?.contact_id || !userId) {
      setLoadedContact(true);
      return;
    }
    let alive = true;
    fetchContact(userId, item.contact_id)
      .then((c) => alive && setContact(c))
      .catch(() => {})
      .finally(() => alive && setLoadedContact(true));
    return () => {
      alive = false;
    };
  }, [item?.contact_id, userId]);

  if (item?.status !== "ready" || !item?.contact_id) return null;

  const firstWord = (s) => (s ? String(s).trim().split(/\s+/)[0] : "");
  const firstName =
    firstWord(contact?.name) ||
    (item.contact_name ? firstWord(item.contact_name) : "there");
  const piece = item.name || item.category || "your piece";
  const sku = item.sku ? ` (${item.sku})` : "";
  const messageBody = `Hi ${firstName}, just letting you know that ${piece}${sku} is ready! Let us know when you'd like to come by and pick it up. — Gemstar`;

  const phoneRaw = (contact?.phone_e164 || contact?.phone || "").replace(/[^\d]/g, "");
  const email = contact?.email || "";

  const waUrl = phoneRaw
    ? `https://wa.me/${phoneRaw}?text=${encodeURIComponent(messageBody)}`
    : null;
  const mailUrl = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Your ${piece} is ready`)}&body=${encodeURIComponent(messageBody)}`
    : null;

  const logTouch = async (kind) => {
    if (!userId || !item.contact_id) return;
    setBusyKind(kind);
    setErr(null);
    try {
      await createInteraction({
        userId,
        contactId: item.contact_id,
        type: kind === "whatsapp" ? "whatsapp" : "email",
        direction: "outgoing",
        subject: `Notified customer: ${piece} ready`,
        content: messageBody,
        metadata: {
          source: "jewelry_ready_banner",
          jewelry_item_id: item.id,
          sku: item.sku || null,
        },
      });
      setLogged(true);
      onLogged && onLogged();
    } catch (e) {
      setErr(e.message || "Failed to log");
    } finally {
      setBusyKind(null);
    }
  };

  const openAndLog = (kind, url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    // Best-effort log — don't block the user if it fails.
    logTouch(kind).catch(() => {});
  };

  if (!loadedContact) return null;

  return (
    <div className="mb-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-emerald-900">
              Ready to ship — notify {firstName}?
            </h3>
            {logged && (
              <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                Logged
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-emerald-800/80">
            Pre-fills a WhatsApp / email message and drops a touchpoint in their CRM timeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {waUrl ? (
            <button
              type="button"
              onClick={() => openAndLog("whatsapp", waUrl)}
              disabled={busyKind === "whatsapp"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163A11.867 11.867 0 010 12.057C0 5.405 5.405 0 12.057 0c3.181 0 6.167 1.24 8.413 3.488A11.823 11.823 0 0124 12.072c-.003 6.652-5.41 12.057-12.063 12.057a12.06 12.06 0 01-5.764-1.466L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.886a9.86 9.86 0 001.516 5.265l-1.001 3.659 3.974-1.06z" />
              </svg>
              WhatsApp
            </button>
          ) : (
            <span className="rounded-lg border border-emerald-200 bg-white/60 px-3 py-1.5 text-[11px] text-emerald-700/70">
              No phone on file
            </span>
          )}
          {mailUrl ? (
            <button
              type="button"
              onClick={() => openAndLog("email", mailUrl)}
              disabled={busyKind === "email"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </button>
          ) : (
            <span className="rounded-lg border border-emerald-200 bg-white/60 px-3 py-1.5 text-[11px] text-emerald-700/70">
              No email on file
            </span>
          )}
        </div>
      </div>
      {err && <div className="mt-2 text-xs text-red-700">{err}</div>}
    </div>
  );
};

export default ReadyNotifyBanner;
