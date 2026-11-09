import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import {
  Check,
  ChevronLeft,
  Copy,
  GripVertical,
  Link2,
  Lock,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  createPresentation,
  deletePresentation,
  fetchPeople,
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
  forgetRecent,
  itemRef,
  parseItemsParam,
  posterFor,
  readRecent,
} from "./presentModel";
import { loadCatalog } from "./presentHooks";

/* =============================================================================
 * Presentations — the iPad showcase saved under a name: prepared at the office,
 * opened at the show, run again next time. Each keeps its own pieces, order
 * and settings; prices and photos come live from the inventory. Below them,
 * what this device presented straight from Inventory, ready to save.
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

const linkFor = (p) => `${window.location.origin}/present?p=${p.id}`;

const copyLink = async (p) => {
  try {
    await navigator.clipboard.writeText(linkFor(p));
    toast.success("Link copied. Open it on the iPad to present.");
  } catch {
    toast.error("Couldn't copy the link");
  }
};

const audienceOf = (p) => (p.shared ? "team" : p.sharedWith?.length ? "people" : "me");

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
    {label && <p className="mb-1.5 text-[12px] font-medium text-app-muted">{label}</p>}
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
          {o.count != null && <span className="ml-1.5 tabular-nums opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  </div>
);

const Thumb = ({ item, src: given, className = "" }) => {
  const src = given || (item ? posterFor(item) : null);
  return (
    <div className={`overflow-hidden bg-[#f5f5f7] ${className}`}>
      {src ? <img src={src} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" /> : null}
    </div>
  );
};

/* Up to four photos in one tile. */
const Cover = ({ srcs, empty = "No pieces yet" }) => (
  <div className="grid aspect-[16/10] grid-cols-2 grid-rows-2 gap-px bg-app-line">
    {srcs.length ? (
      srcs.map((s, i) => (
        <Thumb
          key={`${i}-${s.key}`}
          item={s.item}
          src={s.src}
          className={srcs.length === 1 ? "col-span-2 row-span-2" : srcs.length === 2 || (srcs.length === 3 && i === 0) ? "row-span-2" : ""}
        />
      ))
    ) : (
      <div className="col-span-2 row-span-2 flex items-center justify-center bg-[#f5f5f7] text-[13px] text-app-muted">{empty}</div>
    )}
  </div>
);

const Audience = ({ p, people }) => {
  const a = audienceOf(p);
  if (a === "team") {
    return (
      <span className="inline-flex items-center gap-1">
        <Users size={13} strokeWidth={1.75} aria-hidden="true" />
        Team
      </span>
    );
  }
  if (a === "people") {
    const names = p.sharedWith.map((id) => people.find((m) => m.id === id)?.name).filter(Boolean);
    return (
      <span className="inline-flex items-center gap-1" title={names.join(", ")}>
        <UserPlus size={13} strokeWidth={1.75} aria-hidden="true" />
        {names.length === 1 ? names[0] : `${p.sharedWith.length} people`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
      Only me
    </span>
  );
};

const PresentButton = ({ disabled, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-app-ink px-5 text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40 ${className}`}
  >
    <Play size={15} strokeWidth={2} aria-hidden="true" />
    Present
  </button>
);

const QuietButton = ({ icon: Icon, children, onClick, tone = "", ...rest }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors ${
      tone === "danger" ? "text-red-600 hover:bg-red-50" : "text-app-ink hover:bg-black/[0.05]"
    }`}
    {...rest}
  >
    {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
    {children}
  </button>
);

/* ---------------- dialogs ---------------- */

const Dialog = ({ title, onClose, children, footer }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[24px] bg-app-surface shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:max-w-[460px] sm:rounded-[24px]"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="text-[18px] font-semibold tracking-tight text-app-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-app-muted hover:text-app-ink"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-app-line px-5 py-3">{footer}</div>}
      </motion.div>
    </motion.div>
  );
};

const PrimaryButton = ({ children, disabled, onClick, type = "button" }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="h-10 rounded-full bg-app-ink px-5 text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
  >
    {children}
  </button>
);

const AUDIENCES = [
  { id: "me", label: "Only me" },
  { id: "people", label: "Specific people" },
  { id: "team", label: "Whole team" },
];

/* Who sees a presentation: only me, named teammates, or everyone. */
const AudienceFields = ({ audience, onAudience, chosen, onChosen, people }) => {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = people
    ? people.filter((m) => !query || `${m.name} ${m.email}`.toLowerCase().includes(query))
    : [];
  const toggle = (id) => onChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  return (
    <div>
      <Seg options={AUDIENCES} value={audience} onChange={onAudience} label="Who can open and edit it" />
      <p className="mt-2 text-[12px] leading-snug text-app-muted">
        {audience === "me"
          ? "Only you see it in Presentations."
          : audience === "team"
          ? "Everyone on the team who works with Inventory can open and edit it."
          : "You and the people you pick can open and edit it."}
      </p>
      {audience === "people" && (
        <div className="mt-3">
          {!people ? (
            <p className="text-[13px] text-app-muted">Loading the team…</p>
          ) : !people.length ? (
            <p className="text-[13px] text-app-muted">Nobody else on the team works with Inventory yet.</p>
          ) : (
            <>
              {people.length > 6 && (
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search the team"
                  aria-label="Search the team"
                  className="mb-2 h-9 w-full rounded-xl border border-app-line bg-app-surface px-3 text-[14px] text-app-ink outline-none focus:border-emerald-500"
                />
              )}
              <ul className="max-h-[240px] space-y-1 overflow-y-auto">
                {shown.map((m) => {
                  const on = chosen.includes(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(m.id)}
                        className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                          on ? "border-emerald-500 bg-emerald-50/60" : "border-app-line hover:border-black/20"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            on ? "border-emerald-600 bg-emerald-600 text-white" : "border-black/20"
                          }`}
                          aria-hidden="true"
                        >
                          {on && <Check size={13} strokeWidth={2.5} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-app-ink">{m.name}</span>
                          <span className="block truncate text-[12px] text-app-muted">
                            {m.email}
                            {m.pending ? " · invited, hasn't signed in yet" : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const audienceChanges = (audience, chosen) =>
  audience === "team"
    ? { shared: true, sharedWith: [] }
    : { shared: false, sharedWith: audience === "people" ? chosen : [] };

const ShareDialog = ({ p, people, onClose, onSave }) => {
  const [audience, setAudience] = useState(audienceOf(p));
  const [chosen, setChosen] = useState(p.sharedWith || []);
  const [busy, setBusy] = useState(false);
  const invalid = audience === "people" && !chosen.length;
  const save = async () => {
    setBusy(true);
    const ok = await onSave(p.id, audienceChanges(audience, chosen));
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Dialog
      title={`Share “${p.name}”`}
      onClose={onClose}
      footer={
        p.mine ? (
          <>
            <QuietButton onClick={onClose}>Cancel</QuietButton>
            <PrimaryButton onClick={save} disabled={busy || invalid}>
              {busy ? "Saving…" : "Save"}
            </PrimaryButton>
          </>
        ) : (
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        )
      }
    >
      {p.mine ? (
        <AudienceFields audience={audience} onAudience={setAudience} chosen={chosen} onChosen={setChosen} people={people} />
      ) : (
        <p className="text-[14px] leading-relaxed text-app-ink">
          {p.createdByName || "A teammate"} shared this with {p.shared ? "the whole team" : "you"}. Only they can change who
          sees it, but you can open, edit and present it.
        </p>
      )}
      <div className="mt-5 rounded-2xl bg-black/[0.03] p-3">
        <p className="text-[12px] font-medium text-app-muted">Link to present</p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate text-[12px] text-app-ink">{linkFor(p)}</code>
          <QuietButton icon={Link2} onClick={() => copyLink(p)}>
            Copy
          </QuietButton>
        </div>
        <p className="mt-1 text-[11px] text-app-muted">Opens on any signed-in device that can see it, like the iPad at the show.</p>
      </div>
    </Dialog>
  );
};

const NameDialog = ({ title, initial = "", action, onClose, onSubmit, withAudience, people }) => {
  const [name, setName] = useState(initial);
  const [audience, setAudience] = useState("team");
  const [chosen, setChosen] = useState([]);
  const [busy, setBusy] = useState(false);
  const clean = name.replace(/\s+/g, " ").trim();
  const invalid = !clean || (withAudience && audience === "people" && !chosen.length);
  const submit = async (e) => {
    e.preventDefault();
    if (invalid || busy) return;
    setBusy(true);
    const ok = await onSubmit(clean, withAudience ? audienceChanges(audience, chosen) : null);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-app-muted">Name</span>
          <input
            autoFocus
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="e.g. Dubai show · March"
            className="h-11 w-full rounded-xl border border-app-line bg-app-surface px-3 text-[15px] text-app-ink outline-none focus:border-emerald-500"
          />
        </label>
        {withAudience && (
          <div className="mt-5">
            <AudienceFields audience={audience} onAudience={setAudience} chosen={chosen} onChosen={setChosen} people={people} />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <QuietButton onClick={onClose}>Cancel</QuietButton>
          <PrimaryButton type="submit" disabled={invalid || busy}>
            {busy ? "Saving…" : action}
          </PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
};

/* ---------------- card menu ---------------- */

const CardMenu = ({ p, onRename, onShare, onDuplicate, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const item = (Icon, label, run, danger) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        run(p);
      }}
      className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[14px] ${
        danger ? "text-red-600 hover:bg-red-50" : "text-app-ink hover:bg-black/[0.05]"
      }`}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </button>
  );
  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        aria-label={`More for ${p.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-app-muted hover:bg-black/[0.05] hover:text-app-ink"
      >
        <MoreHorizontal size={20} strokeWidth={1.75} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute bottom-full right-0 z-20 mb-1 w-48 rounded-xl border border-app-line bg-app-surface p-1 shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            {item(Pencil, "Rename", onRename)}
            {item(UserPlus, "Share", onShare)}
            {item(Link2, "Copy link", copyLink)}
            {item(Copy, "Duplicate", onDuplicate)}
            {p.canDelete && item(Trash2, "Delete", onDelete, true)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ---------------- list ---------------- */

const Card = ({ p, people, lookup, onOpen, onPresent, menu }) => {
  const missing = p.items.filter((r) => lookup(r) === null).length;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-app-line bg-app-surface">
      <button type="button" onClick={() => onOpen(p.id)} className="text-left" aria-label={`Edit ${p.name}`}>
        <Cover srcs={p.items.slice(0, 4).map((r) => ({ key: r, item: lookup(r) }))} />
        <div className="px-4 pt-3.5">
          <h2 className="truncate text-[16px] font-semibold tracking-tight text-app-ink">{p.name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-app-muted">
            <span>{pieces(p.items.length)}</span>
            <span aria-hidden="true">·</span>
            <Audience p={p} people={people || []} />
            <span aria-hidden="true">·</span>
            <span>
              {p.mine ? "" : `${p.createdByName || "Teammate"} · `}
              {when(p.updatedAt)}
            </span>
          </p>
          {missing > 0 && (
            <p className="mt-1.5 text-[12px] font-medium text-amber-700">
              {missing === 1 ? "1 piece is" : `${missing} pieces are`} no longer in inventory
            </p>
          )}
        </div>
      </button>
      <div className="mt-auto flex items-center gap-1 px-4 pb-4 pt-3">
        <PresentButton disabled={!p.items.length} onClick={() => onPresent(p)} />
        <QuietButton onClick={() => onOpen(p.id)}>Edit</QuietButton>
        {menu}
      </div>
    </article>
  );
};

const RecentCard = ({ r, onPresent, onSave, onForget }) => (
  <article className="flex flex-col overflow-hidden rounded-2xl border border-dashed border-app-line bg-app-surface/60">
    <Cover srcs={(r.covers || []).map((src, i) => ({ key: i, src }))} empty="No photos" />
    <div className="px-4 pt-3.5">
      <h3 className="text-[15px] font-semibold tracking-tight text-app-ink">Not saved · {pieces(r.count)}</h3>
      <p className="mt-0.5 text-[12px] text-app-muted">
        Presented from Inventory {when(new Date(r.at).toISOString())},{" "}
        {new Date(r.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
    <div className="mt-auto flex items-center gap-1 px-4 pb-4 pt-3">
      <PresentButton onClick={() => onPresent(r)} />
      <QuietButton icon={Save} onClick={() => onSave(r)}>
        Save
      </QuietButton>
      <button
        type="button"
        onClick={() => onForget(r)}
        aria-label="Remove from this list"
        title="Remove from this list"
        className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-app-muted hover:bg-black/[0.05] hover:text-app-ink"
      >
        <X size={18} strokeWidth={1.75} />
      </button>
    </div>
  </article>
);

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

const Editor = ({ p, people, lookup, resolve, catalogReady, onChange, onBack, onPresent, onRename, onShare, onDuplicate, onDelete }) => {
  const [order, setOrder] = useState(p.items);
  const [sku, setSku] = useState("");
  const orderRef = useRef(order);
  orderRef.current = order;

  useEffect(() => setOrder(p.items), [p.items]);

  const missing = order.filter((r) => lookup(r) === null);

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

      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onRename(p)}
            className="group -ml-1 flex max-w-full items-center gap-2 rounded-lg px-1 text-left"
            title="Rename"
          >
            <h1 className="truncate text-[26px] font-semibold tracking-tight text-app-ink">{p.name}</h1>
            <Pencil size={16} strokeWidth={1.75} className="shrink-0 text-app-muted group-hover:text-app-ink" aria-label="Rename" />
          </button>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-app-muted">
            <span>{pieces(order.length)}</span>
            <span aria-hidden="true">·</span>
            <Audience p={p} people={people || []} />
            <span aria-hidden="true">·</span>
            <span>made by {p.mine ? "you" : p.createdByName || "a teammate"}</span>
            {p.updatedByName && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  changed by {p.updatedByName} {when(p.updatedAt)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <QuietButton icon={UserPlus} onClick={() => onShare(p)}>
            Share
          </QuietButton>
          <PresentButton disabled={!order.length} onClick={() => onPresent(p)} />
        </div>
      </div>

      <section className="mt-6 grid gap-4 rounded-2xl border border-app-line bg-app-surface p-4 sm:grid-cols-3 sm:p-5">
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

      <div className="mt-8 flex flex-wrap gap-1 border-t border-app-line pt-5">
        <QuietButton icon={Link2} onClick={() => copyLink(p)}>
          Copy link
        </QuietButton>
        <QuietButton icon={Copy} onClick={() => onDuplicate(p)}>
          Duplicate
        </QuietButton>
        {p.canDelete && (
          <QuietButton icon={Trash2} tone="danger" onClick={() => onDelete(p)}>
            Delete
          </QuietButton>
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
  const [tab, setTab] = useState("all");
  const [people, setPeople] = useState(null);
  const [recent, setRecent] = useState(readRecent);
  const [dialog, setDialog] = useState(null);
  const { lookup, resolve, ready } = useCatalog();

  const load = useCallback(() => {
    setError("");
    fetchPresentations()
      .then(setList)
      .catch((err) => setError(err.message || "Couldn't load the presentations"));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    fetchPeople()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, []);

  const open = (id) => setParams(id ? { open: String(id) } : {});
  const present = (p) => navigate(`/present?p=${p.id}`);
  const closeDialog = useCallback(() => setDialog(null), []);

  const replace = (p) => setList((prev) => (prev || []).map((x) => (x.id === p.id ? p : x)));

  const change = async (id, changes) => {
    setList((prev) => (prev || []).map((x) => (x.id === id ? { ...x, ...changes } : x)));
    try {
      replace(await updatePresentation(id, changes));
      return true;
    } catch (err) {
      toast.error(err.message || "Couldn't save the change");
      load();
      return false;
    }
  };

  const create = async (data) => {
    try {
      const p = await createPresentation({ settings: deviceSettings(), ...data });
      setList((prev) => [p, ...(prev || [])]);
      return p;
    } catch (err) {
      toast.error(err.message || "Couldn't save the presentation");
      return null;
    }
  };

  const duplicate = async (p) => {
    const copy = await create({
      name: `${p.name} (copy)`,
      items: p.items,
      settings: p.settings,
      shared: p.mine ? p.shared : true,
      sharedWith: p.mine ? p.sharedWith : [],
    });
    if (copy) {
      open(copy.id);
      toast.success("Duplicated");
    }
  };

  const remove = async (p) => {
    const who = p.shared ? " It is gone for the whole team." : p.sharedWith?.length ? " It is gone for everyone it was shared with." : "";
    if (!window.confirm(`Delete “${p.name}”?${who}`)) return;
    try {
      await deletePresentation(p.id);
      setList((prev) => (prev || []).filter((x) => x.id !== p.id));
      if (openId === p.id) open(null);
      toast.success("Deleted");
    } catch (err) {
      toast.error(err.message || "Couldn't delete");
    }
  };

  const forget = (r) => {
    forgetRecent(r.param);
    setRecent(readRecent());
  };

  const dialogs = {
    rename: (p) => setDialog({ kind: "rename", p }),
    share: (p) => setDialog({ kind: "share", p }),
  };

  const counts = useMemo(() => {
    const all = list || [];
    return { all: all.length, mine: all.filter((p) => p.mine).length, shared: all.filter((p) => !p.mine).length };
  }, [list]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list || [])
      .filter((p) => tab === "all" || (tab === "mine" ? p.mine : !p.mine))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.items.some((r) => r.toLowerCase().includes(q)));
  }, [list, query, tab]);

  const editing = openId && list ? list.find((p) => p.id === openId) : null;
  const current = dialog?.p ? (list || []).find((x) => x.id === dialog.p.id) || dialog.p : null;

  const dialogLayer = (
    <AnimatePresence>
      {dialog?.kind === "share" && current && (
        <ShareDialog key="share" p={current} people={people} onClose={closeDialog} onSave={change} />
      )}
      {dialog?.kind === "rename" && current && (
        <NameDialog
          key="rename"
          title="Rename presentation"
          initial={current.name}
          action="Rename"
          onClose={closeDialog}
          onSubmit={(name) => (name === current.name ? true : change(current.id, { name }))}
        />
      )}
      {dialog?.kind === "new" && (
        <NameDialog
          key="new"
          title="New presentation"
          action="Create"
          withAudience
          people={people}
          onClose={closeDialog}
          onSubmit={async (name, audience) => {
            const p = await create({ name, items: [], ...audience });
            if (p) open(p.id);
            return Boolean(p);
          }}
        />
      )}
      {dialog?.kind === "save-recent" && (
        <NameDialog
          key="save-recent"
          title={`Save ${pieces(dialog.r.count)} as a presentation`}
          action="Save"
          withAudience
          people={people}
          onClose={closeDialog}
          onSubmit={async (name, audience) => {
            const items = parseItemsParam(dialog.r.param).map((x) => (x.kind === "jewelry" ? `j:${x.sku}` : x.sku));
            const p = await create({ name, items, ...audience });
            if (!p) return false;
            forget(dialog.r);
            toast.success(`Saved “${p.name}”`);
            return true;
          }}
        />
      )}
    </AnimatePresence>
  );

  if (editing) {
    return (
      <>
        <Editor
          p={editing}
          people={people}
          lookup={lookup}
          resolve={resolve}
          catalogReady={ready}
          onChange={change}
          onBack={() => open(null)}
          onPresent={present}
          onRename={dialogs.rename}
          onShare={dialogs.share}
          onDuplicate={duplicate}
          onDelete={remove}
        />
        {dialogLayer}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-app-ink">Presentations</h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-app-muted">
            Showcases for the iPad, saved to open again: prepare one before a show, then just press Present. Add pieces from
            Inventory with Save as presentation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: "new" })}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-black/[0.05] px-4 text-[14px] font-medium text-app-ink hover:bg-black/[0.08]"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New presentation
        </button>
      </header>

      {list && list.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Seg
            options={[
              { id: "all", label: "All", count: counts.all },
              { id: "mine", label: "Mine", count: counts.mine },
              { id: "shared", label: "Shared with me", count: counts.shared },
            ]}
            value={tab}
            onChange={setTab}
          />
          {list.length > 6 && (
            <input
              className="h-9 min-w-[200px] max-w-sm flex-1 rounded-xl border border-app-line bg-app-surface px-3 text-[14px] text-app-ink outline-none focus:border-emerald-500"
              placeholder="Search by name or SKU"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
        </div>
      )}

      {error ? (
        <p className="text-[14px] text-red-600">{error}</p>
      ) : !list ? (
        <p className="text-[14px] text-app-muted">Loading presentations…</p>
      ) : openId && !editing ? (
        <div className="rounded-2xl border border-app-line bg-app-surface px-5 py-10 text-center text-[14px] text-app-muted">
          This presentation was deleted, or it isn't shared with you.{" "}
          <button type="button" className="font-medium text-app-ink underline" onClick={() => open(null)}>
            See all presentations
          </button>
        </div>
      ) : !shown.length ? (
        <div className="rounded-2xl border border-app-line bg-app-surface px-5 py-12 text-center">
          <p className="text-[15px] font-medium text-app-ink">
            {list.length ? (query ? "No matches." : tab === "mine" ? "You haven't made any yet." : "Nothing shared with you yet.") : "No presentations yet"}
          </p>
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
            <Card
              key={p.id}
              p={p}
              people={people}
              lookup={lookup}
              onOpen={open}
              onPresent={present}
              menu={<CardMenu p={p} onRename={dialogs.rename} onShare={dialogs.share} onDuplicate={duplicate} onDelete={remove} />}
            />
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[17px] font-semibold tracking-tight text-app-ink">Presented from Inventory on this device</h2>
          <p className="mt-0.5 text-[13px] text-app-muted">
            Not saved yet. Present them again, or save them to keep them and open them on other devices.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => (
              <RecentCard
                key={`${r.param}-${r.at}`}
                r={r}
                onPresent={(x) => navigate(`/present?items=${encodeURIComponent(x.param)}`)}
                onSave={(x) => setDialog({ kind: "save-recent", r: x })}
                onForget={forget}
              />
            ))}
          </div>
        </section>
      )}

      {dialogLayer}
    </div>
  );
};

export default PresentationsPage;
