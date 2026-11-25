import { dnaSubtitle, dnaTitle, formatCarat, shapeName } from "../../pages/dna/dnaModel";

export const IDENTITY_KEY = "dnaLeadIdentity";

export const INTERESTS = [
  { id: "price", label: "Price & availability" },
  { id: "media", label: "More photos or video" },
  { id: "hold", label: "Hold it for me" },
  { id: "similar", label: "Similar options" },
];

export const ROLES = [
  { id: "trade", label: "Jeweler or retailer" },
  { id: "designer", label: "Designer" },
  { id: "private", label: "Private buyer" },
];

export const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", field: "phone", reply: "on WhatsApp" },
  { id: "email", label: "Email", field: "email", reply: "by email" },
  { id: "call", label: "Phone call", field: "phone", reply: "by phone" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const channelOf = (id) => CHANNELS.find((c) => c.id === id) || CHANNELS[0];

export const splitName = (full) => {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
};

export const firstNameOf = (full) => splitName(full).firstName;

export const nameError = (name) => (String(name || "").trim() ? null : "Tell us what to call you.");

export const contactError = (channelId, form) => {
  if (channelOf(channelId).field === "email") {
    const email = String(form.email || "").trim();
    if (!email) return "Add your email so we can reply.";
    return EMAIL_RE.test(email) ? null : "That email doesn't look complete.";
  }
  const digits = String(form.phone || "").replace(/\D/g, "");
  if (!digits) return "Add your number so we can reply.";
  return digits.length < 7 ? "That number looks too short." : null;
};

// What the visitor is looking at, in the words the DNA page uses for it.
export const itemSummary = (snapshot) => {
  const s = snapshot || {};
  if (s.isSet) {
    const count = Array.isArray(s.stones) ? s.stones.length : 0;
    return {
      noun: "set",
      title: count ? `Set of ${count} stones` : "Matched set",
      subtitle: formatCarat(s.weightCt) ? `${formatCarat(s.weightCt)} total` : null,
    };
  }
  if (s.isPair) {
    const shape = shapeName({ shape: s.shape });
    return {
      noun: "pair",
      title: "Matched pair",
      subtitle: [formatCarat(s.weightCt) && `${formatCarat(s.weightCt)} total`, shape].filter(Boolean).join(" · ") || null,
    };
  }
  if (s.category === "Jewelry") {
    return {
      noun: "piece",
      title: s.title || s.jewelryType || "Jewelry piece",
      subtitle: [s.stoneType, s.metalType].filter(Boolean).join(" · ") || null,
    };
  }
  const stone = { carat: s.weightCt, shape: s.shape, category: s.category, stone_id: s.sku };
  return { noun: "stone", title: dnaTitle(stone), subtitle: dnaSubtitle(stone) };
};

// Older submissions cached first/last name separately.
export const readIdentity = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const name = raw.name || [raw.firstName, raw.lastName].filter(Boolean).join(" ");
  return {
    name: name || "",
    email: raw.email || "",
    phone: raw.phone || "",
    company: raw.company || "",
    role: ROLES.some((r) => r.id === raw.role) ? raw.role : "",
    channel: CHANNELS.some((c) => c.id === raw.channel) ? raw.channel : "",
  };
};

export const leadPayload = ({ form, sku, snapshot }) => {
  const { firstName, lastName } = splitName(form.name);
  const interests = INTERESTS.filter((i) => form.interests.includes(i.id)).map((i) => i.label);
  const channel = channelOf(form.channel);
  const message = [
    String(form.note || "").trim(),
    interests.length ? `Interested in: ${interests.join(", ")}` : null,
    `Reply by: ${channel.label}`,
  ].filter(Boolean).join("\n");

  return {
    firstName,
    lastName,
    email: String(form.email || "").trim(),
    phone: String(form.phone || "").trim(),
    company: String(form.company || "").trim(),
    title: ROLES.find((r) => r.id === form.role)?.label || "",
    message,
    sku,
    snapshot: {
      ...(snapshot || {}),
      interests: form.interests,
      preferredChannel: channel.id,
      role: form.role || null,
    },
    hp: form.hp,
  };
};
