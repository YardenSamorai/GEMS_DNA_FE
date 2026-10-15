/**
 * Per-customer wording on Gemstar's documents. The design is the same for
 * every customer; a profile only changes what is declared and which fixed
 * details print. Anything a profile leaves out falls back to Gemstar's
 * standard text (gemstarTemplate.js).
 *
 * invoice.declarations  replace the standard gemstone declaration
 * invoice.notes         replace the standard invoice notes ([] prints none)
 * invoice.paymentTerms  the customer's fixed terms of payment (null: not printed)
 */
export const CUSTOMER_PROFILES = [
  {
    id: "standard",
    label: "Standard",
    match: null,
  },
  {
    id: "cartier",
    label: "Cartier",
    match: /\bcartier\b/i,
    invoice: {
      declarations: [
        "Based on documented evidence and/or written declarations from its suppliers, Gemstar LTD declares that the herein gemstones comply with the origin restrictions and their associated dates in the latest version of Cartier's colored gemstones guidelines.",
        "Gemstar LTD hereby declare under our own exclusive responsibility / guarantee that the all the gemstones herein invoiced are 100% natural stones, are of the gem species agreed upon/ ordered, and do not include any synthetic gemstones or gemstone imitation or simulants.",
        "The above-mentioned gemstones comply with accepted/forbidden treatments contained in the latest version of Cartier's colored gemstones guidelines.",
      ],
      notes: [],
      paymentTerms: null,
    },
  },
];

export const STANDARD_PROFILE = CUSTOMER_PROFILES[0];

export const profileById = (id) => CUSTOMER_PROFILES.find((p) => p.id === id) || STANDARD_PROFILE;

/** The profile whose name pattern matches the customer, or the standard one. */
export const profileForCustomer = (name) => CUSTOMER_PROFILES.find((p) => p.match?.test(name || "")) || STANDARD_PROFILE;
