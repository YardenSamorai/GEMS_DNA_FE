import React, { useEffect, useState } from "react";
import { fetchContact, createInteraction } from "../../../services/crmApi";
import { JEWELRY_STATUSES } from "../../../services/jewelryApi";

/* Phase E — Tiny "WhatsApp the customer" button for the workshop header.
 * Lets staff fire off a friendly status update at any production stage
 * without leaving the page. Opens wa.me with a pre-filled message and
 * logs an outgoing whatsapp interaction in CRM so the customer profile
 * timeline stays accurate.
 *
 * Renders nothing if the piece has no linked contact or the contact has
 * no phone — there's nothing meaningful to do without those.
 */
const STATUS_LABELS = Object.fromEntries(
  (JEWELRY_STATUSES || []).map((s) => [s.value, s.label])
);

const buildMessage = (item, contact) => {
  const firstName =
    contact?.first_name ||
    (item.contact_name ? String(item.contact_name).split(" ")[0] : "there");
  const piece = item.name || item.category || "your piece";
  const sku = item.sku ? ` (${item.sku})` : "";
  const stage = STATUS_LABELS[item.status] || item.status;
  if (item.status === "ready") {
    return `Hi ${firstName}, ${piece}${sku} is ready! Let us know when you'd like to come pick it up. — Gemstar`;
  }
  if (item.status === "sold") {
    return `Hi ${firstName}, just confirming the sale of ${piece}${sku}. Thank you so much! — Gemstar`;
  }
  return `Hi ${firstName}, quick update on ${piece}${sku}: we're now at the "${stage}" stage. We'll keep you posted! — Gemstar`;
};

const WhatsAppCustomerButton = ({ item, userId }) => {
  const [contact, setContact] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!item?.contact_id || !userId) {
      setLoaded(true);
      return;
    }
    let alive = true;
    fetchContact(userId, item.contact_id)
      .then((c) => alive && setContact(c))
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => { alive = false; };
  }, [item?.contact_id, userId]);

  if (!item?.contact_id || !loaded) return null;
  const phoneRaw = (contact?.phone_e164 || contact?.phone || "").replace(/[^\d]/g, "");
  if (!phoneRaw) return null;

  const handleClick = () => {
    const msg = buildMessage(item, contact);
    const url = `https://wa.me/${phoneRaw}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    createInteraction({
      userId,
      contactId: item.contact_id,
      type: "whatsapp",
      direction: "outgoing",
      subject: `Status update: ${STATUS_LABELS[item.status] || item.status}`,
      content: msg,
      metadata: {
        source: "jewelry_header_share",
        jewelry_item_id: item.id,
        sku: item.sku || null,
        status: item.status,
      },
    }).catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`WhatsApp ${contact?.first_name || "customer"}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
    >
      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M.057 24l1.687-6.163A11.867 11.867 0 010 12.057C0 5.405 5.405 0 12.057 0c3.181 0 6.167 1.24 8.413 3.488A11.823 11.823 0 0124 12.072c-.003 6.652-5.41 12.057-12.063 12.057a12.06 12.06 0 01-5.764-1.466L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.886a9.86 9.86 0 001.516 5.265l-1.001 3.659 3.974-1.06z" />
      </svg>
      WhatsApp
    </button>
  );
};

export default WhatsAppCustomerButton;
