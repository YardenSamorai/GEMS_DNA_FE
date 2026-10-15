import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import Sheet from "../ui/Sheet";
import { Segmented } from "../ui/InventoryHeader";
import { supportsBrutoMode } from "../../../utils/pricing";
import { memoRecordFromInventory, sharedOrigin, stoneFromInventory } from "../../../memo/inventoryMemo";
import { memoHtmlFromRecord, printMemoHtml } from "../../../memo/printMemo";
import { CUSTOMER_PROFILES, profileForCustomer } from "../../../memo/customerProfiles";

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

const KINDS = [
  { id: "memo", label: "Memo" },
  { id: "invoice", label: "Invoice" },
];

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
 *
 * Invoice mode prints a copy of the tax invoice already issued in SAP: it
 * carries SAP's number and can't be created until its total equals SAP's.
 */
export default function MemoSheet({ open, onClose, stones, priceMode, salesman, variant }) {
  const [kind, setKind] = useState("memo");
  // null follows the customer's name; a pick in the menu overrides it.
  const [profileChoice, setProfileChoice] = useState(null);
  const [dueDate, setDueDate] = useState("");
  const [customerNo, setCustomerNo] = useState("");
  const [memoRef, setMemoRef] = useState("");
  const [sapTotal, setSapTotal] = useState("");
  const [memoTo, setMemoTo] = useState(emptyParty);
  const [separateShipTo, setSeparateShipTo] = useState(false);
  const [shipTo, setShipTo] = useState(emptyParty);
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [salesmanName, setSalesmanName] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [shipVia, setShipVia] = useState("");
  const [origin, setOrigin] = useState("");
  const [shipmentRef, setShipmentRef] = useState("");
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
    setOrigin(sharedOrigin(stones));
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

  const invoice = kind === "invoice";
  const noun = invoice ? "invoice" : "memo";
  const profileId = profileChoice ?? profileForCustomer(memoTo.name).id;
  const missingPrices = stones.length - totals.priced;
  const sapAmount = sapTotal.trim() === "" ? null : Number(sapTotal.replace(/,/g, ""));
  const sapDiff = Number.isFinite(sapAmount) ? Math.round((totals.price - sapAmount) * 100) / 100 : null;
  const invoiceReady = number.trim() && sapDiff === 0;
  const canCreate = memoTo.name.trim() && stones.length > 0 && missingPrices === 0 && (!invoice || invoiceReady) && !busy;

  const create = async () => {
    if (!canCreate) return;
    setBusy(true);
    const t = toast.loading(`Preparing ${noun}…`);
    try {
      const record = memoRecordFromInventory(
        stones,
        Object.fromEntries(Object.entries(prices).map(([id, v]) => [id, v === "" ? NaN : Number(v)])),
        {
          kind,
          profile: profileId,
          memoTo,
          shipTo: separateShipTo ? shipTo : null,
          number,
          issueDate,
          dueDate: invoice ? dueDate : "",
          customerNo: invoice ? customerNo : "",
          memoRef: invoice ? memoRef : "",
          salesman: salesmanName,
          poNumber,
          shipVia,
          origin,
          shipmentRef,
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
      const ready = invoice ? "Invoice ready" : "Memo ready";
      toast.success(noImage ? `${ready} · ${noImage} without a photo` : ready, { id: t });
      await printMemoHtml(html);
    } catch (err) {
      console.error(`${noun} generation failed:`, err);
      toast.error(`Couldn't create the ${noun}`, { id: t });
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
        {busy ? "Preparing…" : `Create ${noun}`}
      </button>
    </>
  );

  return (
    <Sheet
      open={open}
      variant={variant}
      tall={variant === "bottom"}
      onClose={busy ? () => {} : onClose}
      title={invoice ? "Invoice" : "Memo"}
      titleId="inv-memo-title"
      closeLabel={`Close ${noun}`}
      footer={footer}
      initialFocus={variant === "bottom" ? undefined : nameRef}
    >
      <div className="inv-memo">
        <section className="inv-memo-section">
          <Segmented label="Document" options={KINDS} value={kind} onChange={setKind} className="inv-memo-kind" />
          {invoice && (
            <>
              <p className="inv-fnote inv-memo-kind-note">
                A copy of the tax invoice issued in SAP. Use SAP&apos;s invoice number, and match its total below.
              </p>
              <Field label="Customer format" hint="The customer's own declarations and terms. Picked from the customer's name; change it here if needed.">
                <select className="inv-input" value={profileId} onChange={(e) => setProfileChoice(e.target.value)}>
                  {CUSTOMER_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </section>

        <section className="inv-memo-section" aria-labelledby="inv-memo-to">
          <h3 id="inv-memo-to" className="inv-memo-h">{invoice ? "Bill to" : "Memo to"}</h3>
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
            <Field label={invoice ? "SAP invoice no." : "Memo no."}>
              <input
                className="inv-input"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder={invoice ? "Required" : "Optional"}
                required={invoice}
              />
            </Field>
            <Field label="Issue date">
              <input className="inv-input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </Field>
          </div>
          {invoice && (
            <>
              <div className="inv-memo-row">
                <Field label="Payment due">
                  <input className="inv-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </Field>
                <Field label="Customer no.">
                  <input className="inv-input" value={customerNo} onChange={(e) => setCustomerNo(e.target.value)} placeholder="Optional" />
                </Field>
              </div>
              <Field label="Memo ref." hint="The memo this sale came from.">
                <input className="inv-input" value={memoRef} onChange={(e) => setMemoRef(e.target.value)} placeholder="Optional" />
              </Field>
            </>
          )}
          <div className="inv-memo-row">
            <Field label="Salesman">
              <input className="inv-input" value={salesmanName} onChange={(e) => setSalesmanName(e.target.value)} />
            </Field>
            <Field label="P.O. #">
              <input className="inv-input" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <div className="inv-memo-row">
            <Field label="Ship via">
              <input className="inv-input" value={shipVia} onChange={(e) => setShipVia(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Shipment ref.">
              <input className="inv-input" value={shipmentRef} onChange={(e) => setShipmentRef(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <Field label="Country of origin">
            <input className="inv-input" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Optional" />
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
            Prices start from the inventory{showsBruto ? " (Bruto for gemstones; diamonds stay Neto)" : ""}. Edit any $/ct to the price{" "}
            {invoice ? "on the SAP invoice" : "quoted on this memo"}.
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
          {invoice && (
            <div className="inv-memo-sap">
              <Field label="Total on the SAP invoice">
                <div className="inv-field inv-field--prefix">
                  <input
                    className="inv-input"
                    aria-label="Total on the SAP invoice"
                    type="text"
                    inputMode="decimal"
                    value={sapTotal}
                    onChange={(e) => setSapTotal(e.target.value)}
                    placeholder="Required"
                    aria-describedby="inv-memo-sap-status"
                  />
                  <span className="inv-field-unit" aria-hidden="true">$</span>
                </div>
              </Field>
              <p id="inv-memo-sap-status" className={`inv-fnote${sapDiff === 0 ? "" : " inv-memo-warn"}`} role="status">
                {sapDiff === null
                  ? "Enter SAP's total; the copy must match it to the cent."
                  : sapDiff === 0
                    ? "Matches the SAP invoice."
                    : `Off by $${money(Math.abs(sapDiff))} (${sapDiff > 0 ? "above" : "below"} SAP). Adjust the prices until it matches.`}
              </p>
            </div>
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
