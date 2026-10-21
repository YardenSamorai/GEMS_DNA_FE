import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { fetchStoneOverrides, patchStoneOverrides } from "../../../services/stonesApi";

const TEXT_FIELDS = [
  ["shape", "Shape"],
  ["color", "Color"],
  ["clarity", "Clarity"],
  ["measurements", "Measurements"],
  ["groupingType", "Grouping"],
  ["pairSku", "Pair SKU"],
  ["origin", "Origin"],
  ["treatment", "Treatment"],
  ["lab", "Lab"],
  ["fluorescence", "Fluorescence"],
];

const GROUPING = ["", "Single", "Pair", "Set", "Parcel", "Fancy", "Side Stones", "Melee"];

const seed = (item) => ({
  weightCt: item.weightCt != null && Number.isFinite(Number(item.weightCt)) ? String(item.weightCt) : "",
  stones: item.stones != null && Number.isFinite(Number(item.stones)) ? String(item.stones) : "",
  ratio: item.ratio != null && Number.isFinite(Number(item.ratio)) ? String(item.ratio) : "",
  shape: item.shape || "",
  color: item.color || "",
  clarity: item.clarity || "",
  measurements: item.measurements || "",
  groupingType: item.groupingType || "",
  pairSku: item.pairSku || "",
  origin: item.origin || "",
  treatment: item.treatment || "",
  lab: item.lab || "",
  fluorescence: item.fluorescence || "",
});

const same = (a, b) => String(a ?? "").trim() === String(b ?? "").trim();

const SpecEditor = ({ item, onSaved, onCancel }) => {
  const [form, setForm] = useState(() => seed(item));
  const [initial, setInitial] = useState(() => seed(item));
  const [overridden, setOverridden] = useState({});
  const [cleared, setCleared] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = seed(item);
    setForm(next);
    setInitial(next);
    setCleared([]);
    let alive = true;
    fetchStoneOverrides(item.sku)
      .then((data) => {
        if (alive) setOverridden(data.fields || {});
      })
      .catch(() => {
        if (alive) setOverridden({});
      });
    return () => {
      alive = false;
    };
  }, [item.sku]);

  const dirty = useMemo(
    () => Object.keys(form).some((k) => !same(form[k], initial[k]) || cleared.includes(k)),
    [form, initial, cleared]
  );

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setCleared((c) => c.filter((k) => k !== key));
  };

  const revert = (key) => {
    setForm((f) => ({ ...f, [key]: initial[key] }));
    setCleared((c) => (c.includes(key) ? c : [...c, key]));
    setOverridden((o) => {
      if (!Object.prototype.hasOwnProperty.call(o, key)) return o;
      const next = { ...o };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    const fields = {};
    for (const key of Object.keys(form)) {
      if (cleared.includes(key)) fields[key] = null;
      else if (!same(form[key], initial[key])) fields[key] = form[key] === "" ? null : form[key];
    }
    if (!Object.keys(fields).length) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      const data = await patchStoneOverrides(item.sku, fields);
      toast.success("Saved — this stays after the next Barak sync");
      onSaved(data.applied || {});
    } catch (err) {
      toast.error(err.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ id, label, children }) => (
    <label className="inv-spec-field">
      <span>
        {label}
        {Object.prototype.hasOwnProperty.call(overridden, id) && (
          <button type="button" className="inv-spec-revert" onClick={() => revert(id)}>
            Revert
          </button>
        )}
      </span>
      {children}
    </label>
  );

  return (
    <form
      className="inv-spec-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="inv-spec-grid">
        <Field id="weightCt" label="Weight (ct)">
          <input className="inv-input" inputMode="decimal" value={form.weightCt} onChange={set("weightCt")} />
        </Field>
        <Field id="stones" label="Stones in lot">
          <input className="inv-input" inputMode="numeric" value={form.stones} onChange={set("stones")} />
        </Field>
        <Field id="ratio" label="Ratio">
          <input className="inv-input" inputMode="decimal" value={form.ratio} onChange={set("ratio")} />
        </Field>
        <Field id="groupingType" label="Grouping">
          <select className="inv-input" value={form.groupingType} onChange={set("groupingType")}>
            {GROUPING.map((g) => (
              <option key={g || "none"} value={g}>
                {g || "—"}
              </option>
            ))}
          </select>
        </Field>
        {TEXT_FIELDS.filter(([k]) => k !== "groupingType").map(([key, label]) => (
          <Field key={key} id={key} label={label}>
            <input className="inv-input" value={form[key]} onChange={set(key)} />
          </Field>
        ))}
      </div>
      <div className="inv-spec-actions">
        <button type="button" className="inv-btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="inv-btn inv-btn--primary" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
};

export default SpecEditor;
