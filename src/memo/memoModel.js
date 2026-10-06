/**
 * Raw source record (e.g. parseBarakMemo) -> Gems DNA memo model.
 *
 * Normalising means naming and typing, never rewriting: every value keeps
 * its source text, numbers carry the decimals they were printed with, and
 * anything that can't be read cleanly is surfaced as a warning for the
 * operator instead of being guessed. Warnings never print on the document.
 */

import { present } from "../pages/dna/dnaModel";

export const clean = (value) => (present(value) ? String(value).replace(/\s+/g, " ").trim() : null);

const NUMBER = /^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/;
const CURRENCY = /^(US\$|\$|€|£|₪|USD|EUR|GBP|ILS)\s*/i;
const CURRENCY_AFTER = /\s*(US\$|\$|€|£|₪|USD|EUR|GBP|ILS)$/i;

/**
 * "9.36" / "$ 88,000.00" / "1,250" -> { text, value, decimals, currency }.
 * `value` is null when the text isn't a plain number; the text is kept.
 */
export function parseAmount(raw) {
  const text = clean(raw);
  if (!text) return null;
  let body = text;
  let currency = null;
  const lead = CURRENCY.exec(body);
  if (lead) {
    currency = lead[1];
    body = body.slice(lead[0].length);
  } else {
    const trail = CURRENCY_AFTER.exec(body);
    if (trail) {
      currency = trail[1];
      body = body.slice(0, -trail[0].length);
    }
  }
  if (!NUMBER.test(body)) return { text, value: null, decimals: null, currency };
  const decimals = body.includes(".") ? body.split(".")[1].length : 0;
  return { text, value: Number(body.replace(/,/g, "")), decimals, currency };
}

/** Number with the decimals the source printed; never rounds further. */
export function formatAmount(amount, { withCurrency = true } = {}) {
  if (!amount) return null;
  if (amount.value === null) return amount.text;
  const digits = amount.value.toLocaleString("en-US", {
    minimumFractionDigits: amount.decimals,
    maximumFractionDigits: amount.decimals,
  });
  return withCurrency && amount.currency ? `${amount.currency}${/^[A-Z]/i.test(amount.currency) ? " " : ""}${digits}` : digits;
}

const INFO_FIELDS = [
  [/^memo\s*(#|no\.?|number)$/i, "number"],
  [/^(issue\s*)?date$/i, "issueDate"],
  [/^issue\s*date$/i, "issueDate"],
  [/^p\.?\s*o\.?\s*(#|no\.?|number)?$/i, "poNumber"],
  [/^(salesman|sales\s*person|salesperson)$/i, "salesman"],
  [/^ship\s*via$/i, "shipVia"],
  [/^due\s*date$/i, "dueDate"],
  [/^terms$/i, "paymentTerms"],
];

const BANK_FIELDS = [
  [/^account\s*name$/i, "accountName", "Account name"],
  [/^account\s*(number|no\.?|#)$/i, "accountNumber", "Account number"],
  [/^bank\s*name$/i, "bankName", "Bank"],
  [/^bank(er'?s)?\s*address$/i, "bankAddress", "Bank address"],
  [/^iban$/i, "iban", "IBAN"],
  [/^(swift|bic)(\s*code)?$/i, "swift", "SWIFT"],
];

const REMARK_FIELD = /^re+a?marks?$/i;

const warn = (warnings, code, message, extra) => warnings.push({ code, message, ...extra });

/** ISO 13616 mod-97 check; validation only, the IBAN is never changed. */
export function ibanIsValid(iban) {
  const compact = String(iban || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

function normalizeParty(raw) {
  if (!raw) return null;
  const party = {
    name: clean(raw.name),
    lines: (raw.lines || []).map(clean).filter(Boolean),
    phone: clean(raw.phone),
    attention: clean(raw.attention),
  };
  return party.name || party.lines.length ? party : null;
}

function normalizeItem(raw, index, warnings) {
  const known = new Set(["lot", "sku", "description", "qty", "carat", "pricePerCarat", "totalPrice"]);
  const item = {
    index: index + 1,
    lot: clean(raw.lot),
    sku: clean(raw.sku),
    description: clean(raw.description),
    qty: parseAmount(raw.qty),
    carat: parseAmount(raw.carat),
    pricePerCarat: parseAmount(raw.pricePerCarat),
    totalPrice: parseAmount(raw.totalPrice),
    extra: Object.entries(raw)
      .filter(([key, value]) => !known.has(key) && present(value))
      .map(([label, value]) => ({ label, value: clean(value) })),
    catalog: null,
  };
  const where = item.sku ? `item ${item.sku}` : `item row ${item.index}`;
  if (!item.sku) warn(warnings, "MISSING_SKU", `Item row ${item.index} has no item number.`, { item: item.index });
  ["qty", "carat", "pricePerCarat", "totalPrice"].forEach((key) => {
    if (item[key] && item[key].value === null) {
      warn(warnings, "NOT_NUMERIC", `${where}: "${item[key].text}" in ${key} is not a plain number; shown as printed.`, { item: item.index });
    }
  });
  const { carat, pricePerCarat, totalPrice } = item;
  if (carat?.value && pricePerCarat?.value && totalPrice?.value) {
    const expected = carat.value * pricePerCarat.value;
    if (Math.abs(expected - totalPrice.value) > Math.max(1, totalPrice.value * 0.001)) {
      warn(warnings, "LINE_TOTAL_MISMATCH", `${where}: ${carat.text} ct × ${pricePerCarat.text} ≠ ${totalPrice.text}. Shown as printed.`, {
        item: item.index,
      });
    }
  }
  return item;
}

/**
 * @param raw     record from a source parser (see parseBarakMemo)
 * @param options { draft?: boolean } overrides draft detection
 */
export function buildMemoModel(raw, options = {}) {
  const warnings = [];
  const info = {};
  const infoExtra = [];
  (raw.info || []).forEach(({ label, value }) => {
    const hit = INFO_FIELDS.find(([re]) => re.test(label.trim()));
    if (hit && info[hit[1]] === undefined) info[hit[1]] = clean(value);
    else if (present(value)) infoExtra.push({ label: label.trim(), value: clean(value) });
  });

  const issuer = raw.issuer
    ? {
        name: clean(raw.issuer.name),
        addressLines: (raw.issuer.addressLines || []).map(clean).filter(Boolean),
        phone: clean(raw.issuer.phone),
        fax: clean(raw.issuer.fax),
        email: clean(raw.issuer.email),
        website: clean(raw.issuer.website),
      }
    : null;

  const bank = [];
  const otherFields = [];
  let remark = null;
  (raw.fields || []).forEach(({ label, lines }) => {
    const values = (lines || []).map(clean).filter(Boolean);
    if (REMARK_FIELD.test(label.trim())) {
      if (values.length) remark = values.join("\n");
      return;
    }
    if (!values.length) return;
    const hit = BANK_FIELDS.find(([re]) => re.test(label.trim()));
    if (hit) bank.push({ key: hit[1], label: hit[2], lines: values });
    else otherFields.push({ label: label.trim(), lines: values });
  });

  const iban = bank.find((b) => b.key === "iban");
  if (iban && !ibanIsValid(iban.lines.join(""))) {
    warn(warnings, "IBAN_CHECKSUM", `IBAN "${iban.lines.join(" ")}" fails the ISO 13616 checksum. Shown as printed; confirm with finance.`);
  }

  const items = (raw.items || []).map((item, i) => normalizeItem(item, i, warnings));
  const seen = new Map();
  items.forEach((item) => {
    if (!item.sku) return;
    const key = item.sku.toUpperCase();
    if (seen.has(key)) warn(warnings, "DUPLICATE_SKU", `Item ${item.sku} appears more than once (rows ${seen.get(key)} and ${item.index}).`);
    else seen.set(key, item.index);
  });

  const totalsCells = raw.totals?.cells || {};
  const totals = raw.totals
    ? {
        qty: parseAmount(totalsCells.qty),
        carat: parseAmount(totalsCells.carat),
        totalPrice: parseAmount(totalsCells.totalPrice),
      }
    : null;
  if (totals) {
    ["qty", "carat", "totalPrice"].forEach((key) => {
      if (totals[key] && totals[key].value === null) {
        warn(warnings, "NOT_NUMERIC", `Total ${key} "${totals[key].text}" is not a plain number; shown as printed.`);
      }
    });
  }

  if (!items.length) {
    const summary = totals ? [totals.carat && `${totals.carat.text} ct`, totals.totalPrice?.text].filter(Boolean).join(", ") : "";
    warn(
      warnings,
      "NO_ITEMS",
      summary
        ? `The source lists totals (${summary}) but no item rows. The document shows a summary only.`
        : "The source has no item rows.",
    );
  } else if (totals) {
    const sum = (key) => items.reduce((acc, item) => acc + (item[key]?.value || 0), 0);
    if (totals.carat?.value != null && Math.abs(sum("carat") - totals.carat.value) > 0.005) {
      warn(warnings, "TOTAL_CARAT_MISMATCH", `Item carats add up to ${sum("carat").toFixed(2)}, the source total is ${totals.carat.text}. Shown as printed.`);
    }
    if (totals.totalPrice?.value != null && Math.abs(sum("totalPrice") - totals.totalPrice.value) > 0.5) {
      warn(warnings, "TOTAL_PRICE_MISMATCH", `Item totals add up to ${sum("totalPrice").toFixed(2)}, the source total is ${totals.totalPrice.text}. Shown as printed.`);
    }
  }

  const currencies = new Set(
    [...items.flatMap((i) => [i.pricePerCarat?.currency, i.totalPrice?.currency]), totals?.totalPrice?.currency].filter(Boolean),
  );
  if (currencies.size > 1) warn(warnings, "MIXED_CURRENCY", `More than one currency appears: ${[...currencies].join(", ")}.`);

  const number = info.number ?? null;
  if (!number || /^0+$/.test(number)) {
    warn(warnings, "UNNUMBERED", `Memo number is "${number ?? ""}" in the source; the document shows it as printed.`);
  }

  const draft = options.draft ?? Boolean(raw.fullPageImageOnEveryPage);
  if (options.draft === undefined && raw.fullPageImageOnEveryPage) {
    warn(warnings, "DRAFT", "Every source page carries a full-page background image (Barak's draft watermark). The document is marked Draft.");
  }

  (raw.conflicts || []).forEach((c) => warn(warnings, "PAGE_CONFLICT", `Page ${c.page} repeats "${c.field}" with different content; page 1 is used.`));
  if (raw.unmapped?.length) {
    warn(
      warnings,
      "UNMAPPED_TEXT",
      `${raw.unmapped.length} source text fragment(s) were not mapped and are not shown: ${raw.unmapped.map((u) => `"${u.text}" (p${u.page})`).join(", ")}.`,
    );
  }

  const billTo = normalizeParty(raw.billTo);
  const shipTo = normalizeParty(raw.shipTo);
  const omitted = [
    ...(raw.info || []).filter((f) => !present(f.value)).map((f) => f.label.trim()),
    ...(raw.fields || []).filter((f) => !(f.lines || []).some(present)).map((f) => f.label.trim()),
    ...(raw.shipTo && !present(raw.shipTo.attention) ? ["Ship to · Attention"] : []),
    ...(raw.billTo && !present(raw.billTo.attention) ? ["Bill to · Attention"] : []),
    ...(raw.issuer && "courier" in raw.issuer && !present(raw.issuer.courier) ? ["Courier"] : []),
  ];

  return {
    kind: "memo",
    source: { ...raw.source, title: clean(raw.title), documentNumber: raw.documentNumber || null },
    document: {
      number,
      issueDate: info.issueDate ?? null,
      dueDate: info.dueDate ?? null,
      poNumber: info.poNumber ?? null,
      salesman: info.salesman ?? null,
      shipVia: info.shipVia ?? null,
      paymentTerms: info.paymentTerms ?? null,
      courier: clean(raw.issuer?.courier),
      extra: infoExtra,
      draft,
    },
    issuer,
    footer: (raw.footer || []).map(clean).filter(Boolean),
    billTo,
    shipTo,
    partiesIdentical: Boolean(billTo && shipTo && JSON.stringify(billTo) === JSON.stringify(shipTo)),
    items,
    totals,
    terms: (raw.terms || []).map(clean).filter(Boolean),
    remarks: (raw.remarks || []).map(clean).filter(Boolean),
    remark,
    bank,
    otherFields,
    signature: clean(raw.signature),
    omitted,
    warnings,
  };
}
