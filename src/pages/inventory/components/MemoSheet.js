import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import Sheet from "../ui/Sheet";
import { supportsBrutoMode } from "../../../utils/pricing";
import { memoRecordFromInventory, stoneFromInventory } from "../../../memo/inventoryMemo";
import { memoHtmlFromRecord, printMemoHtml } from "../../../memo/printMemo";

const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const emptyParty = { name: "", address: "", attention: "", phone: "" };

const basePricePerCt = (stone) => {
  if (stone.pricePerCt > 0) return stone.pricePerCt;
  return stone.weightCt > 0 && stone.priceTotal > 0 ? stone.priceTotal / stone.weightCt : null;
};

const toPriceInput = (n) => (n == null ? "" : String(Math.round(n * 100) / 100));

const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function certificateResponds(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const Field = ({ label, children, hint }) => (
  <div className="inv-memo-field">
    <label>
      <span className="inv-memo-label">{label}</span>
      {children}
    </label>
    {hint && <p className="inv-fnote">{hint}</p>}
  </div>
);

const PartyFields = ({ value, onChange, nameRef }) => {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  return (
    <>
      <Field label="Company / name">
        <input ref={nameRef} className="inv-input" value={value.name} onChange={set("name")} autoComplete="organization" />
      </Field>
      <Field label="Address">
        <textarea className="inv-input inv-memo-textarea" rows={3} value={value.address} onChange={set("address")} autoComplete="street-address" />
      </Field>
      <div className="inv-memo-row">
        <Field label="Attention">
          <input className="inv-input" value={value.attention} onChange={set("attention")} autoComplete="name" />
        </Field>
        <Field label="Phone">
          <input className="inv-input" type="tel" value={value.phone} onChange={set("phone")} autoComplete="tel" />
        </Field>
      </div>
    </>
  );
};

/**
 * Builds Gemstar's consignment memo from the selected stones, in the Gems DNA
 * design, and opens the print dialog (Save as PDF). Stones arrive priced in
 * the inventory's current Neto/Bruto view; every $/ct is editable because a
 * memo quotes the price agreed with this customer.
 */
export default function MemoSheet({ open, onClose, stones, priceMode, salesman, variant }) {
  const [memoTo, setMemoTo] = useState(emptyParty);
  const [separateShipTo, setSeparateShipTo] = useState(false);
  const [shipTo, setShipTo] = useState(emptyParty);
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [salesmanName, setSalesmanName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [includeBank, setIncludeBank] = useState(true);
  const [draft, setDraft] = useState(false);
  const [prices, setPrices] = useState({});
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPrices(Object.fromEntries(stones.map((s) => [s.id, toPriceInput(basePricePerCt(s))])));
    setIssueDate(today());
    setSalesmanName((name) => name || salesman || "");
  }, [open, stones, salesman]);

  const showsBruto = priceMode === "bruto" && stones.some(supportsBrutoMode);

  const totals = useMemo(() => {
    let carat = 0;
    let price = 0;
    let priced = 0;
    for (const s of stones) {
      const ct = Math.round((Number(s.weightCt) || 0) * 100) / 100;
      carat += ct;
      const ppc = Number(prices[s.id]);
      if (prices[s.id] !== "" && Number.isFinite(ppc)) {
        price += Math.round(ppc * ct * 100) / 100;
        priced += 1;
      }
    }
    return { carat, price, priced };
  }, [stones, prices]);

  const missingPrices = stones.length - totals.priced;
  const canCreate = memoTo.name.trim() && stones.length > 0 && missingPrices === 0 && !busy;

  const create = async () => {
    if (!canCreate) return;
    setBusy(true);
    const t = toast.loading("Preparing memo…");
    try {
      const record = memoRecordFromInventory(
        stones,
        Object.fromEntries(Object.entries(prices).map(([id, v]) => [id, v === "" ? NaN : Number(v)])),
        {
          memoTo,
          shipTo: separateShipTo ? shipTo : null,
          number,
          issueDate,
          salesman: salesmanName,
          remarks,
          includeBank,
        }
      );
      const byKey = new Map(stones.map((s) => [String(s.sku).toUpperCase(), s]));
      const { html, model } = await memoHtmlFromRecord(record, {
        draft,
        verifyUrl: certificateResponds,
        lookupStone: async (sku) => {
          const stone = byKey.get(String(sku).toUpperCase());
          return stone ? stoneFromInventory(stone) : null;
        },
      });
      const noImage = model.warnings.filter((w) => w.code === "MISSING_IMAGE").length;
      toast.success(noImage ? `Memo ready · ${noImage} without a photo` : "Memo ready", { id: t });
      await printMemoHtml(html);
    } catch (err) {
      console.error("Memo generation failed:", err);
      toast.error("Couldn't create the memo", { id: t });
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      <button type="button" className="inv-btn inv-btn--plain" onClick={onClose}>
        Cancel
      </button>
      <button type="button" className="inv-btn inv-btn--primary" onClick={create} disabled={!canCreate} aria-busy={busy}>
        {busy ? "Preparing…" : "Create memo"}
      </button>
    </>
  );

  return (
    <Sheet
      open={open}
      variant={variant}
      tall={variant === "bottom"}
      onClose={busy ? () => {} : onClose}
      title="Memo"
      titleId="inv-memo-title"
      closeLabel="Close memo"
      footer={footer}
      initialFocus={variant === "bottom" ? undefined : nameRef}
    >
      <div className="inv-memo">
        <section className="inv-memo-section" aria-labelledby="inv-memo-to">
          <h3 id="inv-memo-to" className="inv-memo-h">Memo to</h3>
          <PartyFields value={memoTo} onChange={setMemoTo} nameRef={nameRef} />
          <label className="inv-memo-toggle">
            <input type="checkbox" checked={separateShipTo} onChange={(e) => setSeparateShipTo(e.target.checked)} />
            <span>Ship to a different address</span>
          </label>
        </section>

        {separateShipTo && (
          <section className="inv-memo-section" aria-labelledby="inv-memo-ship">
            <h3 id="inv-memo-ship" className="inv-memo-h">Ship to</h3>
            <PartyFields value={shipTo} onChange={setShipTo} />
          </section>
        )}

        <section className="inv-memo-section" aria-labelledby="inv-memo-details">
          <h3 id="inv-memo-details" className="inv-memo-h">Details</h3>
          <div className="inv-memo-row">
            <Field label="Memo no.">
              <input className="inv-input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Issue date">
              <input className="inv-input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Salesman">
            <input className="inv-input" value={salesmanName} onChange={(e) => setSalesmanName(e.target.value)} />
          </Field>
        </section>

        <section className="inv-memo-section" aria-labelledby="inv-memo-stones">
          <div className="inv-memo-h-row">
            <h3 id="inv-memo-stones" className="inv-memo-h">
              {stones.length} {stones.length === 1 ? "stone" : "stones"}
            </h3>
            <span className="inv-memo-badge">{showsBruto ? "Bruto prices" : "Neto prices"}</span>
          </div>
          <p className="inv-fnote inv-memo-note">
            Prices start from the inventory{showsBruto ? " (Bruto for gemstones; diamonds stay Neto)" : ""}. Edit any $/ct to the price quoted on this memo.
          </p>
          <ul className="inv-memo-stones">
            {stones.map((s) => {
              const ppc = Number(prices[s.id]);
              const ct = Math.round((Number(s.weightCt) || 0) * 100) / 100;
              const line = prices[s.id] !== "" && Number.isFinite(ppc) ? money(Math.round(ppc * ct * 100) / 100) : "—";
              return (
                <li key={s.id} className="inv-memo-stone">
                  <div className="inv-memo-stone-id">
                    <span className="inv-memo-sku">{s.sku}</span>
                    <span className="inv-memo-meta">
                      {ct.toFixed(2)} ct · ${line}
                    </span>
                  </div>
                  <div className="inv-field inv-field--prefix inv-memo-price">
                    <input
                      className="inv-input"
                      aria-label={`Price per carat for ${s.sku}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={prices[s.id] ?? ""}
                      onChange={(e) => setPrices((p) => ({ ...p, [s.id]: e.target.value }))}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                    <span className="inv-field-unit" aria-hidden="true">$</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <dl className="inv-memo-total">
            <div>
              <dt>Total carat</dt>
              <dd>{totals.carat.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>${money(totals.price)}</dd>
            </div>
          </dl>
          {missingPrices > 0 && (
            <p className="inv-fnote inv-memo-warn" role="status">
              {missingPrices} {missingPrices === 1 ? "stone needs" : "stones need"} a price per carat.
            </p>
          )}
        </section>

        <section className="inv-memo-section" aria-labelledby="inv-memo-more">
          <h3 id="inv-memo-more" className="inv-memo-h">Remarks &amp; options</h3>
          <Field label="Remarks" hint="Printed as written, one line per row.">
            <textarea className="inv-input inv-memo-textarea" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
          <label className="inv-memo-toggle">
            <input type="checkbox" checked={includeBank} onChange={(e) => setIncludeBank(e.target.checked)} />
            <span>Include bank details</span>
          </label>
          <label className="inv-memo-toggle">
            <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
            <span>Mark as draft</span>
          </label>
          <p className="inv-fnote">
            Opens the print dialog — choose <b>Save as PDF</b> and turn off <b>Headers and footers</b>.
          </p>
        </section>
      </div>
    </Sheet>
  );
}
