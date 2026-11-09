import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { Reorder, useDragControls } from "framer-motion";
import { ChevronLeft, Copy, GripVertical, Lock, Play, Plus, Trash2, Users, X } from "lucide-react";
import {
  createPresentation,
  deletePresentation,
  fetchPresentations,
  updatePresentation,
} from "../../services/presentationsApi";
import { itemTitle } from "../inventory/ui/format";
import {
  BRAND_OPTIONS,
  INTERVAL_OPTIONS,
  PRICE_OPTIONS,
  categoryLabel,
  deviceSettings,
  itemRef,
  parseItemsParam,
  posterFor,
} from "./presentModel";
import { loadCatalog } from "./presentHooks";

/* =============================================================================
 * Presentations — the iPad showcase saved under a name: prepared at the office,
 * opened at the show, run again next time. Each keeps its own pieces, order
 * and settings; prices and photos come live from the inventory.
 * ========================================================================== */

const pieces = (n) => `${n} piece${n === 1 ? "" : "s"}`;

const when = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/* The live item behind a saved reference, or null once it left the inventory
 * (undefined while the inventory is still loading). */
const useCatalog = () => {
  const { user, isLoaded } = useUser();
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    if (!isLoaded) return undefined;
    let alive = true;
    loadCatalog(user)
      .then(({ stones, jewelry }) => {
        if (!alive) return;
        const map = new Map();
        stones.forEach((s) => s?.sku && map.set(itemRef(s), s));
        jewelry.forEach((j) => j?.sku && map.set(itemRef(j), j));
        setCatalog({ map, stones, jewelryList: jewelry });
      })
      .catch(() => alive && setCatalog({ map: new Map(), failed: true, stones: [], jewelryList: [] }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const lookup = useCallback(
    (ref) => {
      if (!catalog || catalog.failed) return undefined;
      return catalog.map.get(ref) || null;
    },
    [catalog]
  );

  /* A typed SKU to a reference: a stone first, then jewelry by model number. */
  const resolve = useCallback(
    (typed) => {
      const q = typed.trim().toUpperCase();
      if (!q || !catalog) return null;
      const stone = catalog.stones.find((s) => String(s.sku || "").toUpperCase() === q);
      if (stone) return itemRef(stone);
      const piece = catalog.jewelryList.find((j) => String(j.sku || "").toUpperCase() === q);
      return piece ? itemRef(piece) : null;
    },
    [catalog]
  );

  return { lookup, resolve, ready: Boolean(catalog) && !catalog.failed };
};

/* ---------------- bits ---------------- */

const Seg = ({ label, options, value, onChange, disabled }) => (
  <div>
    <p className="mb-1.5 text-[12px] font-medium text-app-muted">{label}</p>
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-black/[0.05] p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={`h-8 rounded-[8px] px-3 text-[13px] font-medium transition-colors disabled:opacity-50 ${
            value === o.id ? "bg-white text-app-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-app-muted hover:text-app-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const Thumb = ({ item, className = "" }) => {
  const src = item ? posterFor(item) : null;
  return (
    <div className={`overflow-hidden bg-[#f5f5f7] ${className}`}>
      {src ? <img src={src} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" /> : null}
    </div>
  );
};

const Audience = ({ p }) =>
  p.shared ? (
    <span className="inline-flex items-center gap-1">
      <Users size={13} strokeWidth={1.75} aria-hidden="true" />
      Team
    </span>
  ) : (
    <span className="inline-flex items-center gap-1">
      <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
      Only me
    </span>
  );

const PresentButton = ({ p, onPresent, className = "" }) => (
  <button
    type="button"
    onClick={() => onPresent(p)}
    disabled={!p.items.length}
    className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-app-ink px-5 text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40 ${className}`}
  >
    <Play size={15} strokeWidth={2} aria-hidden="true" />
    Present
  </button>
);

/* ---------------- list ---------------- */

const Card = ({ p, lookup, onOpen, onPresent }) => {
  const cover = p.items.slice(0, 4);
  const missing = p.items.filter((r) => lookup(r) === null).length;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-app-line bg-app-surface">
      <button type="button" onClick={() => onOpen(p.id)} className="text-left" aria-label={`Edit ${p.name}`}>
        <div className="grid aspect-[16/10] grid-cols-2 grid-rows-2 gap-px bg-app-line">
          {cover.length ? (
            cover.map((r, i) => (
              <Thumb
                key={r}
                item={lookup(r)}
                className={cover.length === 1 ? "col-span-2 row-span-2" : cover.length === 2 || (cover.length === 3 && i === 0) ? "row-span-2" : ""}
              />
            ))
          ) : (
            <div className="col-span-2 row-span-2 flex items-center justify-center bg-[#f5f5f7] text-[13px] text-app-muted">
              No pieces yet
            </div>
          )}
        </div>
        <div className="px-4 pt-3.5">
          <h2 className="truncate text-[16px] font-semibold tracking-tight text-app-ink">{p.name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-app-muted">
            <span>{pieces(p.items.length)}</span>
            <span aria-hidden="true">·</span>
            <Audience p={p} />
            <span aria-hidden="true">·</span>
            <span>Updated {when(p.updatedAt)}{p.updatedByName ? ` by ${p.updatedByName}` : ""}</span>
          </p>
          {missing > 0 && (
            <p className="mt-1.5 text-[12px] font-medium text-amber-700">
              {missing === 1 ? "1 piece is" : `${missing} pieces are`} no longer in inventory
            </p>
          )}
        </div>
      </button>
      <div className="mt-auto flex items-center gap-2 px-4 pb-4 pt-3">
        <PresentButton p={p} onPresent={onPresent} />
        <button
          type="button"
          onClick={() => onOpen(p.id)}
          className="h-10 rounded-full px-4 text-[14px] font-medium text-app-ink hover:bg-black/[0.05]"
        >
          Edit
        </button>
      </div>
    </article>
  );
};

/* ---------------- editor ---------------- */

const Row = ({ refId, item, onRemove, onDropped }) => {
  const drag = useDragControls();
  const gone = item === null;
  return (
    <Reorder.Item
      value={refId}
      dragListener={false}
      dragControls={drag}
      onDragEnd={onDropped}
      className="flex items-center gap-3 border-b border-app-line bg-app-surface py-2 last:border-b-0"
    >
      <button
        type="button"
        aria-label={`Drag ${refId} to reorder`}
        onPointerDown={(e) => drag.start(e)}
        className="flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-app-muted active:cursor-grabbing"
      >
        <GripVertical size={18} strokeWidth={1.75} />
      </button>
      <Thumb item={item} className="h-12 w-12 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        {item ? (
          <>
            <p className="truncate text-[14px] font-medium text-app-ink">{itemTitle(item)}</p>
            <p className="truncate text-[12px] text-app-muted">
              {categoryLabel(item)} · {item.sku}
            </p>
          </>
        ) : (
          <>
            <p className="truncate text-[14px] font-medium text-app-ink">{parseItemsParam(refId)[0]?.sku}</p>
            <p className={`text-[12px] ${gone ? "font-medium text-amber-700" : "text-app-muted"}`}>
              {gone ? "No longer in inventory: left out when presenting" : "Loading…"}
            </p>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(refId)}
        aria-label={`Remove ${refId}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-app-muted hover:bg-black/[0.05] hover:text-app-ink"
      >
        <X size={18} strokeWidth={1.75} />
      </button>
    </Reorder.Item>
  );
};

const Editor = ({ p, lookup, resolve, catalogReady, onChange, onBack, onPresent, onDuplicate, onDelete }) => {
  const [name, setName] = useState(p.name);
  const [order, setOrder] = useState(p.items);
  const [sku, setSku] = useState("");
  const orderRef = useRef(order);
  orderRef.current = order;

  useEffect(() => setName(p.name), [p.name]);
  useEffect(() => setOrder(p.items), [p.items]);

  const missing = order.filter((r) => lookup(r) === null);

  const saveName = () => {
    const next = name.replace(/\s+/g, " ").trim();
    if (!next) {
      setName(p.name);
      return;
    }
    if (next !== p.name) onChange(p.id, { name: next });
  };

  const add = (e) => {
    e.preventDefault();
    const typed = sku.trim();
    if (!typed) return;
    const ref = resolve(typed);
    if (!ref) {
      toast.error(`${typed} isn't in the inventory`);
      return;
    }
    if (order.includes(ref)) {
      toast(`${typed} is already in this presentation`);
      setSku("");
      return;
    }
    onChange(p.id, { items: [...order, ref] });
    setSku("");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 mb-3 inline-flex h-9 items-center gap-1 rounded-full px-2 text-[14px] font-medium text-app-muted hover:text-app-ink"
      >
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        All presentations
      </button>

      <div className="flex flex-wrap items-start gap-3">
        <input
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Presentation name"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[26px] font-semibold tracking-tight text-app-ink outline-none hover:border-app-line focus:border-emerald-500"
        />
        <PresentButton p={{ ...p, items: order }} onPresent={onPresent} />
      </div>
      <p className="mt-1 px-1 text-[13px] text-app-muted">
        {pieces(order.length)} · made by {p.mine ? "you" : p.createdByName || "a teammate"}
        {p.updatedByName ? ` · last changed by ${p.updatedByName} ${when(p.updatedAt)}` : ""}
      </p>

      <section className="mt-6 grid gap-4 rounded-2xl border border-app-line bg-app-surface p-4 sm:grid-cols-2 sm:p-5">
        <Seg
          label="Logo"
          options={BRAND_OPTIONS}
          value={p.settings.brand}
          onChange={(brand) => onChange(p.id, { settings: { ...p.settings, brand } })}
        />
        <Seg
          label="Prices"
          options={PRICE_OPTIONS}
          value={p.settings.prices}
          onChange={(prices) => onChange(p.id, { settings: { ...p.settings, prices } })}
        />
        <Seg
          label="Next piece every"
          options={INTERVAL_OPTIONS}
          value={p.settings.interval}
          onChange={(interval) => onChange(p.id, { settings: { ...p.settings, interval } })}
        />
        {p.mine ? (
          <Seg
            label="Who can open and edit it"
            options={[
              { id: "team", label: "Whole team" },
              { id: "me", label: "Only me" },
            ]}
            value={p.shared ? "team" : "me"}
            onChange={(v) => onChange(p.id, { shared: v === "team" })}
          />
        ) : (
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-app-muted">Who can open and edit it</p>
            <p className="text-[13px] text-app-ink">The whole team (shared by {p.createdByName || "a teammate"})</p>
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-app-ink">Pieces, in presenting order</h2>
          {missing.length > 0 && (
            <button
              type="button"
              onClick={() => onChange(p.id, { items: order.filter((r) => lookup(r) !== null) })}
              className="text-[13px] font-medium text-amber-700 hover:underline"
            >
              Remove {missing.length === 1 ? "the missing piece" : `${missing.length} missing pieces`}
            </button>
          )}
        </div>
        <div className="rounded-2xl border border-app-line bg-app-surface px-3 sm:px-4">
          {order.length ? (
            <Reorder.Group axis="y" values={order} onReorder={setOrder} className="m-0 list-none p-0">
              {order.map((r) => (
                <Row
                  key={r}
                  refId={r}
                  item={lookup(r)}
                  onRemove={(ref) => onChange(p.id, { items: order.filter((x) => x !== ref) })}
                  onDropped={() => {
                    if (orderRef.current.join(",") !== p.items.join(",")) onChange(p.id, { items: orderRef.current });
                  }}
                />
              ))}
            </Reorder.Group>
          ) : (
            <p className="py-8 text-center text-[13px] text-app-muted">
              No pieces yet. Add them by SKU below, or select them in Inventory and choose Save as presentation.
            </p>
          )}
        </div>
        <form onSubmit={add} className="mt-3 flex gap-2">
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder={catalogReady ? "Add by SKU or model number" : "Loading the inventory…"}
            disabled={!catalogReady}
            aria-label="Add by SKU or model number"
            className="h-10 min-w-0 flex-1 rounded-xl border border-app-line bg-app-surface px-3 text-[14px] text-app-ink outline-none focus:border-emerald-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!catalogReady || !sku.trim()}
            className="inline-flex h-10 items-center gap-1 rounded-full bg-black/[0.05] px-4 text-[14px] font-medium text-app-ink disabled:opacity-40"
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            Add
          </button>
        </form>
      </section>

      <div className="mt-8 flex flex-wrap gap-2 border-t border-app-line pt-5">
        <button
          type="button"
          onClick={() => onDuplicate(p)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium text-app-ink hover:bg-black/[0.05]"
        >
          <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
          Duplicate
        </button>
        {p.canDelete && (
          <button
            type="button"
            onClick={() => onDelete(p)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

/* ---------------- page ---------------- */

const PresentationsPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openId = Number(params.get("open")) || null;
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const { lookup, resolve, ready } = useCatalog();

  const load = useCallback(() => {
    setError("");
    fetchPresentations()
      .then(setList)
      .catch((err) => setError(err.message || "Couldn't load the presentations"));
  }, []);
  useEffect(load, [load]);

  const open = (id) => setParams(id ? { open: String(id) } : {});
  const present = (p) => navigate(`/present?p=${p.id}`);

  const replace = (p) => setList((prev) => (prev || []).map((x) => (x.id === p.id ? p : x)));

  const change = async (id, changes) => {
    setList((prev) => (prev || []).map((x) => (x.id === id ? { ...x, ...changes } : x)));
    try {
      replace(await updatePresentation(id, changes));
    } catch (err) {
      toast.error(err.message || "Couldn't save the change");
      load();
    }
  };

  const create = async () => {
    try {
      const p = await createPresentation({ name: "New presentation", items: [], settings: deviceSettings(), shared: true });
      setList((prev) => [p, ...(prev || [])]);
      open(p.id);
    } catch (err) {
      toast.error(err.message || "Couldn't create the presentation");
    }
  };

  const duplicate = async (p) => {
    try {
      const copy = await createPresentation({ name: `${p.name} (copy)`, items: p.items, settings: p.settings, shared: p.shared });
      setList((prev) => [copy, ...(prev || [])]);
      open(copy.id);
      toast.success("Duplicated");
    } catch (err) {
      toast.error(err.message || "Couldn't duplicate");
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete “${p.name}”? ${p.shared ? "It is gone for the whole team." : ""}`)) return;
    try {
      await deletePresentation(p.id);
      setList((prev) => (prev || []).filter((x) => x.id !== p.id));
      open(null);
      toast.success("Deleted");
    } catch (err) {
      toast.error(err.message || "Couldn't delete");
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!list || !q) return list || [];
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.items.some((r) => r.toLowerCase().includes(q)));
  }, [list, query]);

  const editing = openId && list ? list.find((p) => p.id === openId) : null;
  if (editing) {
    return (
      <Editor
        p={editing}
        lookup={lookup}
        resolve={resolve}
        catalogReady={ready}
        onChange={change}
        onBack={() => open(null)}
        onPresent={present}
        onDuplicate={duplicate}
        onDelete={remove}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-app-ink">Presentations</h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-app-muted">
            Showcases for the iPad, saved to open again: prepare one before a show, then just press Present. Add pieces from
            Inventory with Save as presentation.
          </p>
        </div>
        <button
          type="button"
          onClick={create}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-black/[0.05] px-4 text-[14px] font-medium text-app-ink hover:bg-black/[0.08]"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New presentation
        </button>
      </header>

      {list && list.length > 6 && (
        <input
          className="mb-5 h-10 w-full max-w-sm rounded-xl border border-app-line bg-app-surface px-3 text-[14px] text-app-ink outline-none focus:border-emerald-500"
          placeholder="Search by name or SKU"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {error ? (
        <p className="text-[14px] text-red-600">{error}</p>
      ) : !list ? (
        <p className="text-[14px] text-app-muted">Loading presentations…</p>
      ) : openId && !editing ? (
        <div className="rounded-2xl border border-app-line bg-app-surface px-5 py-10 text-center text-[14px] text-app-muted">
          This presentation was deleted, or it is private to someone else.{" "}
          <button type="button" className="font-medium text-app-ink underline" onClick={() => open(null)}>
            See all presentations
          </button>
        </div>
      ) : !shown.length ? (
        <div className="rounded-2xl border border-app-line bg-app-surface px-5 py-12 text-center">
          <p className="text-[15px] font-medium text-app-ink">{list.length ? "No matches." : "No presentations yet"}</p>
          {!list.length && (
            <p className="mx-auto mt-1 max-w-md text-[13px] text-app-muted">
              In Inventory, select stones or jewelry and choose Save as presentation. Or start an empty one here and add
              pieces by SKU.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <Card key={p.id} p={p} lookup={lookup} onOpen={open} onPresent={present} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PresentationsPage;
