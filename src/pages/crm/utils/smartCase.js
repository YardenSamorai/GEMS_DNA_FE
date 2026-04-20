/**
 * Smart-case helpers for CRM contact fields.
 *
 * Converts text that is ALL UPPER or all lower into Title Case while
 * preserving:
 *   - Strings that already have mixed case (iPhone, McDonald, Avglobale, ...)
 *   - Common acronyms (LTD, INC, GIA, CEO, USA, ...)
 *   - "Mc" / "O'" name prefixes (McDonald, O'Brien)
 *   - Roman numerals (II, III, IV, V, ...)
 */

export const ACRONYMS = new Set([
  // Business / legal entity suffixes
  "LTD", "INC", "LLC", "LLP", "CO", "CORP", "GMBH", "AG", "SA", "SRL", "BV", "PLC", "SE", "PTE", "DMCC", "FZE", "FZCO",
  // Geographic
  "USA", "UAE", "UK", "EU", "US", "NYC", "LA", "DC", "DXB", "TLV", "JFK", "HK",
  // Diamond / gem industry
  "GIA", "IGI", "HRD", "AGS", "GSI", "EGL", "AGL", "GRS", "AGTA", "RJC",
  // Job titles / departments
  "CEO", "CFO", "CTO", "COO", "CIO", "CMO", "CPO", "VP", "EVP", "SVP",
  "HR", "IT", "PR", "PA", "MD", "GM", "RD",
  // Tech / generic
  "API", "URL", "PDF", "ID", "ERP", "CRM", "B2B", "B2C",
  // Roman numerals
  "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
]);

/**
 * Smart-case a single string. Leaves already-mixed-case input alone.
 */
export const smartCase = (raw) => {
  if (!raw || typeof raw !== "string") return raw || "";
  const s = raw.trim();
  if (s.length <= 2) return s;
  const isAllUpper = s === s.toUpperCase();
  const isAllLower = s === s.toLowerCase();
  if (!isAllUpper && !isAllLower) return s;
  return s
    .toLowerCase()
    .replace(/\b([a-z][a-z0-9]*)\b/g, (word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      if (word.length > 2 && word.startsWith("mc")) {
        return "Mc" + word.charAt(2).toUpperCase() + word.slice(3);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
};

/**
 * Apply smart-casing to all contact fields that benefit from it.
 * Leaves email/phone/website alone (they have their own normalization).
 */
export const polishContact = (f = {}) => ({
  ...f,
  name: smartCase(f.name || ""),
  title: smartCase(f.title || ""),
  company: smartCase(f.company || ""),
  city: smartCase(f.city || ""),
  country: smartCase(f.country || ""),
  address: smartCase(f.address || ""),
  email: (f.email || "").trim().toLowerCase(),
  website: (f.website || "").trim(),
});
