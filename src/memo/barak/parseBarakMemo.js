/**
 * Barak (ComponentOne C1Report) memo/invoice layout -> raw Barak record.
 *
 * Input is positioned text: { pages: [{ width, height, runs, images }] } where
 * a run is { text, x0, x1, y0, y1, size } with a top-left origin (see
 * tools/barak-memo/extract.mjs). Everything is read by label anchors and
 * geometry, never by fixed coordinates, and every value is kept verbatim.
 * Runs that no rule claims are returned in `unmapped` so nothing disappears
 * silently.
 */

const ROW_TOLERANCE = 3;

const textOf = (run) => (run ? run.text : null);
const center = (run) => (run.x0 + run.x1) / 2;
const byPosition = (a, b) => a.y0 - b.y0 || a.x0 - b.x0;

export function groupRows(runs, tolerance = ROW_TOLERANCE) {
  const rows = [];
  for (const run of [...runs].sort((a, b) => a.y0 - b.y0)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(run.y0 - row.y0) <= tolerance) row.runs.push(run);
    else rows.push({ y0: run.y0, runs: [run] });
  }
  rows.forEach((row) => {
    row.runs.sort((a, b) => a.x0 - b.x0);
    row.y1 = Math.max(...row.runs.map((r) => r.y1));
  });
  return rows;
}

/** "Label : value" / "Label:value" -> { label, value } (value may be ""). */
export function splitLabel(text) {
  const m = /^([^:]{1,40}?)\s*:\s*(.*)$/.exec(text);
  return m ? { label: m[1].trim(), value: m[2].trim() } : null;
}

const SENTENCE_END = /[.!?:;”"’)]$/;
const PARAGRAPH_START = /^[A-Z•“"‘(\d]/;

/**
 * Lines of running text -> paragraphs. A paragraph ends on a font size
 * change, a vertical gap wider than a line, or a short line that closes a
 * sentence before a line that opens one.
 */
export function toParagraphs(lines) {
  const sorted = [...lines].sort(byPosition);
  const fullWidth = Math.max(0, ...sorted.map((l) => l.x1 - l.x0));
  const paragraphs = [];
  let current = null;
  let prev = null;
  for (const line of sorted) {
    const breaks =
      !current ||
      Math.abs(line.size - prev.size) > 0.3 ||
      line.y0 - prev.y1 > prev.size * 0.9 ||
      (SENTENCE_END.test(prev.text) &&
        prev.x1 - prev.x0 < fullWidth * 0.8 &&
        PARAGRAPH_START.test(line.text));
    if (breaks) {
      current = { text: line.text, size: line.size };
      paragraphs.push(current);
    } else {
      current.text += ` ${line.text}`;
    }
    prev = line;
  }
  return paragraphs.map((p) => p.text.replace(/\s+/g, " ").trim());
}

const COLUMN_KEYS = [
  [/^lot\b/i, "lot"],
  [/^item\b/i, "sku"],
  [/^(stock|sku)\b/i, "sku"],
  [/^desc/i, "description"],
  [/^(qty|quantity|pcs)\b/i, "qty"],
  [/^(carat|cts?|weight)\b/i, "carat"],
  [/^(per\s*carat|price\s*\/?\s*ct|ppc)\b/i, "pricePerCarat"],
  [/^(total\s*price|amount|total)\b/i, "totalPrice"],
];

export function columnKey(label) {
  const hit = COLUMN_KEYS.find(([re]) => re.test(label));
  return hit ? hit[1] : null;
}

const ISSUER_FIELDS = [
  [/^phone$/i, "phone"],
  [/^(tel|telephone)$/i, "phone"],
  [/^fax$/i, "fax"],
  [/^(mail|e-?mail)$/i, "email"],
  [/^courier$/i, "courier"],
];

/** Nearest column by horizontal centre; columns are { x0, x1 }. */
function nearestColumn(run, columns) {
  let best = null;
  let bestDistance = Infinity;
  columns.forEach((col, i) => {
    const d = Math.abs(center(run) - (col.x0 + col.x1) / 2);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}

/** Column index by boundaries halfway between adjacent header centres. */
function columnAt(run, columns) {
  const c = center(run);
  for (let i = 0; i < columns.length - 1; i += 1) {
    const edge = (center(columns[i]) + center(columns[i + 1])) / 2;
    if (c < edge) return i;
  }
  return columns.length - 1;
}

function isFullPageImage(image, page) {
  const area = (image.x1 - image.x0) * (image.y1 - image.y0);
  return area > page.width * page.height * 0.8;
}

function parseParty(runs) {
  const party = { name: null, lines: [], phone: null, attention: null };
  for (const run of [...runs].sort(byPosition)) {
    const field = splitLabel(run.text);
    if (field && /^(phone|tel)$/i.test(field.label)) party.phone = field.value || null;
    else if (field && /^attention$/i.test(field.label)) party.attention = field.value || null;
    else if (!party.name) party.name = run.text;
    else party.lines.push(run.text);
  }
  return party;
}

const sameParty = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function parsePage(page, ctx) {
  const used = new Set();
  const claim = (...runs) => runs.forEach((r) => r && used.add(r));
  const runs = [...page.runs].sort(byPosition);
  const find = (re, from = runs) => from.find((r) => !used.has(r) && re.test(r.text));
  const out = { number: page.number };

  /* Document title: the largest type on the upper half of the page. */
  const upper = runs.filter((r) => r.y0 < page.height / 2);
  const title = upper.reduce((a, r) => (!a || r.size > a.size ? r : a), null);
  if (title) {
    claim(title);
    out.title = title.text;
  }
  const numberRun = find(/^.+?#\s*:/);
  if (numberRun) {
    const m = /^(.+?)\s*#\s*:\s*(.*)$/.exec(numberRun.text);
    claim(numberRun);
    out.documentNumber = { label: m[1].trim(), value: m[2].trim() || null };
  }

  /* Issuer block: everything above the title, right of the logo. */
  if (title) {
    const issuerRuns = runs.filter((r) => !used.has(r) && r.y1 < title.y0);
    if (issuerRuns.length) {
      const issuer = { name: null, addressLines: [], phone: null, fax: null, email: null, website: null, courier: null };
      const top = issuerRuns.reduce((a, r) => (r.size > a.size ? r : a), issuerRuns[0]);
      issuer.name = top.text;
      for (const run of issuerRuns.sort(byPosition)) {
        if (run === top) continue;
        const field = splitLabel(run.text);
        const known = field && ISSUER_FIELDS.find(([re]) => re.test(field.label));
        if (known) issuer[known[1]] = field.value || null;
        else if (/^(www\.|https?:\/\/)/i.test(run.text)) issuer.website = run.text;
        else issuer.addressLines.push(run.text);
      }
      claim(...issuerRuns);
      out.issuer = issuer;
    }
  }

  /* Parties: SHIP TO / BILL TO headers split the page into two columns. */
  const shipHead = find(/^ship\s*to$/i);
  const billHead = find(/^bill\s*to$/i);
  if (shipHead || billHead) {
    claim(shipHead, billHead);
    const heads = [shipHead, billHead].filter(Boolean);
    const top = Math.max(...heads.map((h) => h.y1));
    const attention = runs.filter((r) => r.y0 > top && /^attention\s*:/i.test(r.text));
    const bottom = attention.length ? Math.max(...attention.map((r) => r.y1)) + 2 : Infinity;
    const block = [];
    for (const run of runs) {
      if (used.has(run) || run.y0 < top) continue;
      if (run.y0 > bottom || run.x1 - run.x0 > page.width * 0.6) break;
      if (bottom === Infinity && block.length && run.y0 - Math.max(...block.map((b) => b.y1)) > 18) break;
      block.push(run);
    }
    claim(...block);
    if (shipHead && billHead) {
      const split = (center(shipHead) + center(billHead)) / 2;
      const left = block.filter((r) => center(r) < split);
      const right = block.filter((r) => center(r) >= split);
      const shipLeft = center(shipHead) < center(billHead);
      out.shipTo = parseParty(shipLeft ? left : right);
      out.billTo = parseParty(shipLeft ? right : left);
    } else {
      out[shipHead ? "shipTo" : "billTo"] = parseParty(block);
    }
  }

  /* Memo information row: header labels with values on the next row. */
  const memoHead = find(/^memo\s*#$/i);
  const rows = groupRows(runs);
  let infoRow = null;
  if (memoHead) {
    infoRow = rows.find((row) => row.runs.includes(memoHead));
    const valueRow = rows.find((row) => row.y0 > infoRow.y1 && row.y0 - infoRow.y1 < 20);
    const labels = infoRow.runs;
    out.info = labels.map((label) => ({ label: label.text, value: null }));
    if (valueRow) {
      valueRow.runs.forEach((run) => {
        const i = nearestColumn(run, labels);
        const field = out.info[i];
        field.value = field.value ? `${field.value} ${run.text}` : run.text;
      });
      claim(...valueRow.runs);
    }
    claim(...labels);
  }

  /* Terms (before "Remarks") and remarks (before the memo information). */
  const remarksHead = find(/^remarks?\s*:?\s*$/i);
  const prose = runs.filter((r) => !used.has(r) && r !== remarksHead);
  const proseEnd = infoRow ? infoRow.y0 : page.height;
  const termLines = prose.filter((r) => r.y0 < (remarksHead ? remarksHead.y0 : proseEnd) && r.y0 < proseEnd);
  if (termLines.length && infoRow) {
    out.terms = toParagraphs(termLines);
    claim(...termLines);
  }
  if (remarksHead) {
    claim(remarksHead);
    const remarkLines = prose.filter((r) => r.y0 > remarksHead.y0 && r.y0 < proseEnd);
    out.remarks = toParagraphs(remarkLines);
    claim(...remarkLines);
  }

  /* Items table: header labels (stacked labels merge), rows until the end. */
  const itemHead = find(/^item\s*#?$/i);
  const signature = find(/^customer\s+signature$/i);
  if (itemHead) {
    const headerRuns = runs.filter(
      (r) => !used.has(r) && Math.abs(r.y0 - itemHead.y0) <= 9 && r.size >= itemHead.size - 0.5,
    );
    const columns = [];
    for (const run of headerRuns.sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0)) {
      const col = columns.find((c) => run.x0 < c.x1 && run.x1 > c.x0);
      if (col) {
        col.label += ` ${run.text}`;
        col.x0 = Math.min(col.x0, run.x0);
        col.x1 = Math.max(col.x1, run.x1);
        col.y1 = Math.max(col.y1, run.y1);
      } else {
        columns.push({ label: run.text, x0: run.x0, x1: run.x1, y1: run.y1 });
      }
    }
    claim(...headerRuns);
    columns.forEach((col) => {
      col.key = columnKey(col.label);
    });
    out.columns = columns.map(({ label, key }) => ({ label, key }));

    const headerBottom = Math.max(...columns.map((c) => c.y1));
    const tableEnd = signature ? signature.y0 : page.height;
    const bodyRows = groupRows(runs.filter((r) => !used.has(r) && r.y0 > headerBottom && r.y0 < tableEnd));
    out.items = [];
    for (const row of bodyRows) {
      const cells = {};
      row.runs.forEach((run) => {
        const col = columns[columnAt(run, columns)];
        const key = col.key || col.label;
        cells[key] = cells[key] ? `${cells[key]} ${run.text}` : run.text;
      });
      claim(...row.runs);
      const labelCell = Object.values(cells).find((v) => /^total\b/i.test(v));
      if (labelCell) {
        const totals = { label: labelCell, cells: {} };
        Object.entries(cells).forEach(([key, value]) => {
          if (value !== labelCell) totals.cells[key] = value;
        });
        out.totals = totals;
        continue;
      }
      const keys = Object.keys(cells);
      const last = out.items[out.items.length - 1];
      if (last && keys.length === 1 && keys[0] === "description") {
        last.description = last.description ? `${last.description} ${cells.description}` : cells.description;
        continue;
      }
      out.items.push(cells);
    }
  }

  /* Labelled fields ("Account Name :", "IBAN :", "Reamark:" ...). */
  const fieldLabels = runs.filter((r) => !used.has(r) && /:\s*$/.test(r.text) && r !== signature);
  if (fieldLabels.length) {
    const labelRight = Math.max(...fieldLabels.map((r) => r.x1));
    const labelLeft = Math.min(...fieldLabels.map((r) => r.x0));
    const top = Math.min(...fieldLabels.map((r) => r.y0)) - 3;
    const bottom = signature ? signature.y0 : page.height;
    const values = runs.filter(
      (r) => !used.has(r) && !fieldLabels.includes(r) && r.x0 > labelLeft + 20 && r.x0 < labelRight + 60 && r.y0 >= top && r.y0 < bottom,
    );
    const fields = fieldLabels.map((label) => ({ label: label.text.replace(/\s*:\s*$/, ""), lines: [], y: label.y0 }));
    values.forEach((value) => {
      const owner = [...fields].reverse().find((f) => f.y <= value.y0 + 3);
      if (owner) {
        owner.lines.push(value.text);
        claim(value);
      }
    });
    claim(...fieldLabels);
    out.fields = fields.map(({ label, lines }) => ({ label, lines }));
  }

  /* Signature and the unlabelled footer line. */
  if (signature) {
    claim(signature);
    out.signature = signature.text;
    const footer = runs.filter((r) => !used.has(r) && r.y0 > signature.y1 + 10);
    out.footer = footer.sort((a, b) => a.x0 - b.x0).map(textOf);
    claim(...footer);
  }

  out.fullPageImage = page.images.some((image) => isFullPageImage(image, page));
  out.unmapped = runs.filter((r) => !used.has(r)).map(({ text, x0, y0 }) => ({ page: page.number, text, x: Math.round(x0), y: Math.round(y0) }));
  ctx.pages.push(out);
}

/** Merge page results; repeated header content must agree across pages. */
export function parseBarakMemo(doc) {
  const ctx = { pages: [] };
  doc.pages.forEach((page) => parsePage(page, ctx));
  const record = {
    source: {
      producer: doc.producer || null,
      title: doc.title || null,
      created: doc.created || null,
      pageCount: doc.pages.length,
    },
    title: null,
    documentNumber: null,
    issuer: null,
    shipTo: null,
    billTo: null,
    info: [],
    columns: [],
    items: [],
    totals: null,
    terms: [],
    remarks: [],
    fields: [],
    signature: null,
    footer: [],
    fullPageImageOnEveryPage: ctx.pages.length > 0 && ctx.pages.every((p) => p.fullPageImage),
    unmapped: [],
    conflicts: [],
  };

  const keepFirst = (key, value, page) => {
    if (value == null) return;
    if (record[key] == null) record[key] = value;
    else if (!sameParty(record[key], value)) record.conflicts.push({ page, field: key });
  };

  for (const page of ctx.pages) {
    keepFirst("title", page.title, page.number);
    keepFirst("documentNumber", page.documentNumber, page.number);
    keepFirst("shipTo", page.shipTo, page.number);
    keepFirst("billTo", page.billTo, page.number);
    keepFirst("signature", page.signature, page.number);
    if (page.issuer) {
      if (!record.issuer) record.issuer = page.issuer;
      else {
        const merged = { ...record.issuer };
        Object.entries(page.issuer).forEach(([key, value]) => {
          if (key === "addressLines") return;
          if (value == null) return;
          if (merged[key] == null) merged[key] = value;
          else if (merged[key] !== value) record.conflicts.push({ page: page.number, field: `issuer.${key}` });
        });
        page.issuer.addressLines.forEach((line) => {
          if (!merged.addressLines.includes(line)) merged.addressLines = [...merged.addressLines, line];
        });
        record.issuer = merged;
      }
    }
    if (page.info && !record.info.length) record.info = page.info;
    if (page.columns && !record.columns.length) record.columns = page.columns;
    if (page.items) record.items.push(...page.items);
    if (page.totals) {
      if (record.totals && !sameParty(record.totals, page.totals)) record.conflicts.push({ page: page.number, field: "totals" });
      record.totals = page.totals;
    }
    if (page.terms) record.terms.push(...page.terms.filter((t) => !record.terms.includes(t)));
    if (page.remarks) record.remarks.push(...page.remarks.filter((t) => !record.remarks.includes(t)));
    if (page.fields) record.fields.push(...page.fields);
    if (page.footer && page.footer.length) {
      if (!record.footer.length) record.footer = page.footer;
      else if (!sameParty(record.footer, page.footer)) record.conflicts.push({ page: page.number, field: "footer" });
    }
    record.unmapped.push(...page.unmapped);
  }
  return record;
}
