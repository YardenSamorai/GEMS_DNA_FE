import React, { useMemo, useState } from "react";
import { ChevronDown, Plus, Settings2, X } from "lucide-react";
import ShapeIcon from "../components/ShapeIcon";
import {
  countGroupActive,
  GROUPING_OPTIONS,
  LOCATION_OPTIONS,
  shapeLabel,
  TREATMENT_OPTIONS,
} from "../model/inventoryModel";

/* ---------------- primitives ---------------- */

const FilterGroup = ({ id, label, count, summary, open, onToggle, children }) => {
  const bodyId = `inv-fg-${id}`;
  return (
    <section className="inv-fgroup">
      <button type="button" className="inv-fgroup-head" aria-expanded={open} aria-controls={bodyId} onClick={() => onToggle(id)}>
        <span className="inv-fgroup-label">{label}</span>
        {count > 0 && !open && summary && <span className="inv-fgroup-summary">{summary}</span>}
        {count > 0 && open && <span className="inv-badge" aria-label={`${count} active`}>{count}</span>}
        <ChevronDown className="inv-chev" size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <div id={bodyId} className="inv-fgroup-body" hidden={!open}>
        {open && children}
      </div>
    </section>
  );
};

const Sub = ({ label, children, id }) => (
  <div className="inv-fsub" role="group" aria-labelledby={label ? id : undefined}>
    {label && <span id={id} className="inv-fsub-label">{label}</span>}
    {children}
  </div>
);

const toggleIn = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

const ChipList = ({ options, selected, onChange, label = (v) => v, limit = 12 }) => {
  const [all, setAll] = useState(false);
  // Selected values always stay visible, even past the fold.
  const visible = all || options.length <= limit + 2
    ? options
    : options.filter((o, i) => i < limit || selected.includes(o));
  return (
    <>
      <div className="inv-chips">
        {visible.map((o) => (
          <button
            key={o}
            type="button"
            className="inv-chip"
            aria-pressed={selected.includes(o)}
            onClick={() => onChange(toggleIn(selected, o))}
          >
            {label(o)}
          </button>
        ))}
      </div>
      {visible.length < options.length && (
        <button type="button" className="inv-more" onClick={() => setAll(true)}>
          Show all {options.length}
        </button>
      )}
      {all && options.length > limit + 2 && (
        <button type="button" className="inv-more" onClick={() => setAll(false)}>
          Show fewer
        </button>
      )}
    </>
  );
};

const NumField = ({ value, onChange, label, unit, prefix, step = "any" }) => (
  <label className={`inv-field${prefix ? " inv-field--prefix" : ""}`}>
    <span className="inv-sr">{label}</span>
    <input
      className="inv-input"
      type="number"
      inputMode="decimal"
      min="0"
      step={step}
      value={value}
      placeholder={label.startsWith("Min") ? "Min" : "Max"}
      onChange={(e) => onChange(e.target.value)}
      onWheel={(e) => e.currentTarget.blur()}
    />
    {(unit || prefix) && <span className="inv-field-unit" aria-hidden="true">{prefix || unit}</span>}
  </label>
);

const Range = ({ name, minKey, maxKey, filters, set, unit, prefix }) => (
  <div className="inv-range">
    <NumField label={`Min ${name}`} value={filters[minKey]} onChange={(v) => set({ [minKey]: v })} unit={unit} prefix={prefix} />
    <span className="inv-range-sep" aria-hidden="true">–</span>
    <NumField label={`Max ${name}`} value={filters[maxKey]} onChange={(v) => set({ [maxKey]: v })} unit={unit} prefix={prefix} />
  </div>
);

/* ---------------- smart search ---------------- */

const parsedTerms = (ss) => {
  if (!ss) return [];
  const t = [];
  ss.skus.forEach((s) => t.push(`SKU ${s}`));
  ss.categories.forEach((c) => t.push(c));
  ss.shapes.forEach((s) => t.push(s));
  if (ss.weightRange) t.push(`${ss.weightRange.min}–${ss.weightRange.max} ct`);
  else if (ss.weight) t.push(`~${ss.weight} ct`);
  if (ss.pricePerCt) t.push(`$${Math.round(ss.pricePerCt.min).toLocaleString()}–${Math.round(ss.pricePerCt.max).toLocaleString()}/ct`);
  ss.clarities.forEach((c) => t.push(c));
  ss.colors.forEach((c) => t.push(`Color ${c}`));
  ss.fancyColors.forEach((c) => t.push(`Fancy ${c}`));
  ss.treatments.forEach((x) => t.push(x));
  ss.labs.forEach((l) => t.push(l));
  ss.locations.forEach((l) => t.push(l));
  ss.origins.forEach((o) => t.push(o));
  ss.groupingTypes.forEach((g) => t.push(g));
  return t;
};

/* ---------------- shapes ---------------- */

const ShapePicker = ({ options, selected, onChange }) => {
  const [moreOpen, setMoreOpen] = useState(() => options.more.some((s) => selected.includes(s)));
  return (
    <>
      <div className="inv-shapes">
        {options.main.map((s) => {
          const on = selected.includes(s);
          return (
            <button key={s} type="button" className="inv-shape" aria-pressed={on} onClick={() => onChange(toggleIn(selected, s))}>
              <ShapeIcon shape={s} color="currentColor" size={28} />
              <span>{s}</span>
            </button>
          );
        })}
      </div>
      {options.more.length > 0 && (
        <div className="inv-fsub">
          {moreOpen ? (
            <ChipList options={options.more} selected={selected} onChange={onChange} label={shapeLabel} limit={40} />
          ) : (
            <button type="button" className="inv-more" onClick={() => setMoreOpen(true)}>
              More shapes ({options.more.length})
            </button>
          )}
        </div>
      )}
    </>
  );
};

/* ---------------- assignee ---------------- */

const AssigneeChips = ({ team, value, onChange }) => {
  const me = team.actorUserId;
  const members = (team.members || []).filter((m) => m.clerk_user_id && m.clerk_user_id !== me);
  const opts = [
    { id: "all", label: "All team" },
    ...(me ? [{ id: "me", label: "Mine" }] : []),
    { id: "unassigned", label: "Unassigned" },
    ...members.map((m) => ({ id: m.clerk_user_id, label: m.name || "Member" })),
  ];
  const current = value === me ? "me" : value;
  return (
    <div className="inv-chips">
      {opts.map((o) => (
        <button key={o.id} type="button" className="inv-chip" aria-pressed={current === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
};

/* ---------------- saved views ---------------- */

const MODE_SHORT = { diamonds: "Diamonds", gemstones: "Gemstones", jewelry: "Jewelry" };

const SavedViews = ({ saved, onLoad, onDelete, onSave, canSave }) => {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
    setName("");
    setNaming(false);
  };
  return (
    <>
      {saved.length > 0 && (
        <div className="inv-saved">
          {saved.map((p) => (
            <span key={p.id} className="inv-saved-item">
              <button type="button" onClick={() => onLoad(p)} title={`Apply “${p.name}”`}>
                {p.name}
                {p.inventory_mode && <span className="inv-saved-mode">{MODE_SHORT[p.inventory_mode] || ""}</span>}
              </button>
              <button type="button" className="inv-x" onClick={() => onDelete(p.id)} aria-label={`Delete saved filter ${p.name}`}>
                <X size={14} strokeWidth={1.75} />
              </button>
            </span>
          ))}
        </div>
      )}
      {canSave && (naming ? (
        <form className="inv-save-form" onSubmit={submit}>
          <input
            className="inv-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setNaming(false);
              }
            }}
            placeholder="Name, e.g. Emeralds over 5 ct"
            aria-label="Saved filter name"
            autoFocus
          />
          <button type="submit" className="inv-btn inv-btn--primary inv-btn--sm" disabled={!name.trim()}>Save</button>
        </form>
      ) : (
        <button type="button" className="inv-more" onClick={() => setNaming(true)}>
          <Plus size={13} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 3 }} aria-hidden="true" />
          Save current filters
        </button>
      ))}
    </>
  );
};

/* ---------------- panel ---------------- */

const STONE_GROUPS = (mode) => [
  { id: "saved", keys: [] },
  { id: "smart", keys: [] },
  { id: "shape", keys: ["shape"] },
  { id: "weight", keys: ["minCarat", "maxCarat"] },
  mode === "diamonds" ? { id: "color", keys: ["diamondColor", "fancyColor"] } : { id: "category", keys: ["category"] },
  ...(mode === "gemstones" ? [{ id: "clarity", keys: ["treatment"] }] : []),
  { id: "lab", keys: ["lab"] },
  { id: "price", keys: ["minPrice", "maxPrice", "minPricePerCt", "maxPricePerCt"] },
  { id: "size", keys: ["minLength", "maxLength", "minWidth", "maxWidth"] },
  { id: "stock", keys: ["groupingType", "location", "box", "tag"] },
];

const JEWELRY_GROUPS = [
  { id: "saved", keys: [] },
  { id: "source", keys: [] },
  { id: "jtype", keys: ["category"] },
  { id: "weight", keys: ["minCarat", "maxCarat"] },
  { id: "price", keys: ["minPrice", "maxPrice"] },
  { id: "jstyle", keys: ["shape", "treatment"] },
  { id: "jstone", keys: ["diamondColor", "fancyColor"] },
];

const DEFAULT_OPEN = new Set(["shape", "weight", "color", "category", "price", "source", "jtype"]);

const FilterPanel = ({
  mode,
  filters,
  onFiltersChange,
  smartSearch,
  onSmartSearchChange,
  parsedSearch,
  options,
  tags,
  onManageTags,
  priceMode,
  saved,
  onLoadSaved,
  onDeleteSaved,
  onSaveCurrent,
  canSave,
  team,
  assignee,
  onAssigneeChange,
  jewelrySource,
  onJewelrySourceChange,
  jewelryCounts,
}) => {
  const isJewelry = mode === "jewelry";
  const groups = isJewelry ? JEWELRY_GROUPS : STONE_GROUPS(mode);
  const showAssignee = !isJewelry && team?.ready && (team.members || []).length > 1;

  const activeOf = (g) => {
    if (g.id === "smart") return smartSearch.trim() ? 1 : 0;
    if (g.id === "source") return jewelrySource !== "all" ? 1 : 0;
    const n = countGroupActive(filters, g.keys);
    return g.id === "stock" && showAssignee && assignee !== "all" ? n + 1 : n;
  };

  const [open, setOpen] = useState(() => {
    const o = {};
    groups.forEach((g) => {
      o[g.id] = DEFAULT_OPEN.has(g.id) || g.id === "saved" || activeOf(g) > 0;
    });
    return o;
  });
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const set = (patch) => onFiltersChange((f) => ({ ...f, ...patch }));
  const setList = (key) => (list) => set({ [key]: list });

  const terms = useMemo(() => (smartSearch ? parsedTerms(parsedSearch) : []), [smartSearch, parsedSearch]);
  const priceUnit = mode === "gemstones" ? (priceMode === "neto" ? "Neto" : "Bruto") : "";

  const summaryOf = (g) => {
    const vals = g.keys.flatMap((k) => (Array.isArray(filters[k]) ? filters[k] : filters[k] ? [filters[k]] : []));
    if (g.id === "shape") return vals.map(shapeLabel).join(", ");
    if (g.id === "smart") return smartSearch;
    if (g.id === "source") return jewelrySource === "workshop" ? "Workshop" : "Catalog";
    if (g.keys.some((k) => k.startsWith("min") || k.startsWith("max"))) return `${activeOf(g)} set`;
    return vals.join(", ");
  };

  const render = (g) => {
    switch (g.id) {
      case "saved":
        if (!saved.length && !canSave) return null;
        return (
          <FilterGroup key={g.id} id={g.id} label="Saved filters" open={open[g.id]} onToggle={toggle} count={0}>
            <SavedViews saved={saved} onLoad={onLoadSaved} onDelete={onDeleteSaved} onSave={onSaveCurrent} canSave={canSave} />
          </FilterGroup>
        );
      case "smart":
        return (
          <FilterGroup key={g.id} id={g.id} label="Describe a stone" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            <label className="inv-field" style={{ display: "block" }}>
              <span className="inv-sr">Describe the stone in plain words</span>
              <input
                className="inv-input"
                type="text"
                value={smartSearch}
                onChange={(e) => onSmartSearchChange(e.target.value)}
                placeholder="Emerald 3ct VS2, Cushion 5-7ct GRS"
                autoComplete="off"
                spellCheck="false"
              />
            </label>
            {terms.length > 0 ? (
              <p className="inv-fnote">Reading: <b>{terms.join(" · ")}</b></p>
            ) : (
              <p className="inv-fnote">Shape, weight, colour, clarity, lab, origin, price per carat or SKU.</p>
            )}
          </FilterGroup>
        );
      case "shape":
        if (!options.shapes.all.length) return null;
        return (
          <FilterGroup key={g.id} id={g.id} label="Shape" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            <ShapePicker options={options.shapes} selected={filters.shape} onChange={setList("shape")} />
          </FilterGroup>
        );
      case "weight":
        return (
          <FilterGroup key={g.id} id={g.id} label={isJewelry ? "Carats" : "Weight"} open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            <Range name="carat" minKey="minCarat" maxKey="maxCarat" filters={filters} set={set} unit="ct" />
          </FilterGroup>
        );
      case "color":
        return (
          <FilterGroup key={g.id} id={g.id} label="Color" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            {options.diamondColors.length > 0 && (
              <Sub label="Colorless" id="inv-sub-dcolor">
                <ChipList options={options.diamondColors} selected={filters.diamondColor} onChange={setList("diamondColor")} limit={20} />
              </Sub>
            )}
            {options.fancyColors.length > 0 && (
              <Sub label="Fancy" id="inv-sub-fcolor">
                <ChipList options={options.fancyColors} selected={filters.fancyColor} onChange={setList("fancyColor")} />
              </Sub>
            )}
          </FilterGroup>
        );
      case "category":
        return (
          <FilterGroup key={g.id} id={g.id} label="Category" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            <ChipList
              options={options.categories}
              selected={filters.category}
              onChange={setList("category")}
              label={(v) => (v === "Empty" ? "No category" : v)}
            />
          </FilterGroup>
        );
      case "clarity":
        return (
          <FilterGroup key={g.id} id={g.id} label="Clarity" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            <ChipList options={TREATMENT_OPTIONS} selected={filters.treatment} onChange={setList("treatment")} />
          </FilterGroup>
        );
      case "lab":
        return (
          <FilterGroup key={g.id} id={g.id} label="Lab" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            <ChipList options={options.labs} selected={filters.lab || []} onChange={setList("lab")} />
          </FilterGroup>
        );
      case "price":
        return (
          <FilterGroup key={g.id} id={g.id} label={priceUnit ? `Price · ${priceUnit}` : "Price"} open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            <Sub label="Total" id="inv-sub-total">
              <Range name="total price" minKey="minPrice" maxKey="maxPrice" filters={filters} set={set} prefix="$" />
            </Sub>
            {!isJewelry && (
              <Sub label="Per carat" id="inv-sub-ppc">
                <Range name="price per carat" minKey="minPricePerCt" maxKey="maxPricePerCt" filters={filters} set={set} prefix="$" />
              </Sub>
            )}
          </FilterGroup>
        );
      case "size":
        return (
          <FilterGroup key={g.id} id={g.id} label="Measurements" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            <Sub label="Length" id="inv-sub-len">
              <Range name="length" minKey="minLength" maxKey="maxLength" filters={filters} set={set} unit="mm" />
            </Sub>
            <Sub label="Width" id="inv-sub-wid">
              <Range name="width" minKey="minWidth" maxKey="maxWidth" filters={filters} set={set} unit="mm" />
            </Sub>
          </FilterGroup>
        );
      case "stock":
        return (
          <FilterGroup key={g.id} id={g.id} label="Inventory" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            {showAssignee && (
              <Sub label="Assigned to" id="inv-sub-assignee">
                <AssigneeChips team={team} value={assignee} onChange={onAssigneeChange} />
              </Sub>
            )}
            <Sub label="Grouping" id="inv-sub-group">
              <ChipList
                options={GROUPING_OPTIONS}
                selected={filters.groupingType}
                onChange={setList("groupingType")}
                label={(v) => (v === "Empty" ? "No grouping" : v)}
              />
            </Sub>
            <Sub label="Location" id="inv-sub-loc">
              <ChipList options={LOCATION_OPTIONS} selected={filters.location} onChange={setList("location")} />
            </Sub>
            <Sub label="Box" id="inv-sub-box">
              <label className="inv-field" style={{ display: "block" }}>
                <span className="inv-sr">Box</span>
                <input
                  className="inv-input"
                  type="text"
                  value={filters.box}
                  onChange={(e) => set({ box: e.target.value })}
                  placeholder="Box name or number"
                  autoComplete="off"
                />
              </label>
            </Sub>
            <Sub label="Client tags" id="inv-sub-tags">
              <div className="inv-chips">
                {tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="inv-chip"
                    aria-pressed={filters.tag.includes(t.name)}
                    onClick={() => set({ tag: toggleIn(filters.tag, t.name) })}
                  >
                    <span className="inv-chip-dot" style={{ background: t.color }} aria-hidden="true" />
                    {t.name}
                  </button>
                ))}
                <button type="button" className="inv-chip" onClick={onManageTags}>
                  <Settings2 size={14} strokeWidth={1.75} aria-hidden="true" />
                  Manage
                </button>
              </div>
            </Sub>
          </FilterGroup>
        );
      case "source":
        return (
          <FilterGroup key={g.id} id={g.id} label="Source" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            <div className="inv-chips">
              {[
                { id: "all", label: "All", count: jewelryCounts.all },
                { id: "workshop", label: "Workshop", count: jewelryCounts.workshop },
                { id: "catalog", label: "Catalog", count: jewelryCounts.catalog },
              ].map((o) => (
                <button key={o.id} type="button" className="inv-chip" aria-pressed={jewelrySource === o.id} onClick={() => onJewelrySourceChange(o.id)}>
                  {o.label}
                  <span className="inv-chip-count">{o.count.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </FilterGroup>
        );
      case "jtype":
        if (!options.jewelry.type.length) return null;
        return (
          <FilterGroup key={g.id} id={g.id} label="Type" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            <ChipList options={options.jewelry.type} selected={filters.category} onChange={setList("category")} />
          </FilterGroup>
        );
      case "jstyle":
        if (!options.jewelry.style.length && !options.jewelry.collection.length) return null;
        return (
          <FilterGroup key={g.id} id={g.id} label="Style & collection" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            {options.jewelry.style.length > 0 && (
              <Sub label="Style" id="inv-sub-jstyle">
                <ChipList options={options.jewelry.style} selected={filters.shape} onChange={setList("shape")} />
              </Sub>
            )}
            {options.jewelry.collection.length > 0 && (
              <Sub label="Collection" id="inv-sub-jcoll">
                <ChipList options={options.jewelry.collection} selected={filters.treatment} onChange={setList("treatment")} />
              </Sub>
            )}
          </FilterGroup>
        );
      case "jstone":
        if (!options.jewelry.stoneType.length && !options.jewelry.metal.length) return null;
        return (
          <FilterGroup key={g.id} id={g.id} label="Stone & metal" open={open[g.id]} onToggle={toggle} count={activeOf(g)} summary={summaryOf(g)}>
            {options.jewelry.stoneType.length > 0 && (
              <Sub label="Stone" id="inv-sub-jstone">
                <ChipList options={options.jewelry.stoneType} selected={filters.diamondColor} onChange={setList("diamondColor")} />
              </Sub>
            )}
            {options.jewelry.metal.length > 0 && (
              <Sub label="Metal" id="inv-sub-jmetal">
                <ChipList options={options.jewelry.metal} selected={filters.fancyColor} onChange={setList("fancyColor")} />
              </Sub>
            )}
          </FilterGroup>
        );
      default:
        return null;
    }
  };

  return <div>{groups.map(render)}</div>;
};

export default FilterPanel;
