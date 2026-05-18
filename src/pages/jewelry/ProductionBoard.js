import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { fetchJewelryItems, changeJewelryStatus } from "../../services/jewelryApi";
import AssigneeFilter from "../../components/team/AssigneeFilter";
import MemberAvatar from "../../components/team/MemberAvatar";
import { useTeam } from "../../context/TeamContext";

/* ---------- Stage config ---------- */
/*
 * Each stage owns:
 *   - value: status enum stored on jewelry_items.status
 *   - label: shown in column header
 *   - hex:   exact accent color (used inline for left card border)
 *   - bg:    Tailwind class for the rounded icon tile
 *   - icon:  inline SVG element
 */
const PencilIcon = (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
);
const MonitorIcon = (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
);
const DropletIcon = (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2.5l5.5 7a7 7 0 11-11 0L12 2.5z" /></svg>
);
const FlameIcon = (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 7.5c.5 1.5.5 3-.5 4.5C20 13 21 17 17.657 18.657z" /></svg>
);
const GemIcon = (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3l3.057-3 4.886 0L16 3l4 5-8 13L4 8l1-5z" /></svg>
);
const SparkleIcon = (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
);
const ShieldCheckIcon = (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
);
const PackageIcon = (
  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
);

const STAGES = [
  { value: "design",    label: "Design",    hex: "#a855f7", bg: "bg-violet-500",  icon: PencilIcon },
  { value: "cad",       label: "CAD",       hex: "#0ea5e9", bg: "bg-sky-500",     icon: MonitorIcon },
  { value: "wax",       label: "Wax",       hex: "#f59e0b", bg: "bg-amber-500",   icon: DropletIcon },
  { value: "casting",   label: "Casting",   hex: "#f97316", bg: "bg-orange-500",  icon: FlameIcon },
  { value: "setting",   label: "Setting",   hex: "#ec4899", bg: "bg-pink-500",    icon: GemIcon },
  { value: "polishing", label: "Polishing", hex: "#06b6d4", bg: "bg-cyan-500",    icon: SparkleIcon },
  { value: "qc",        label: "QC",        hex: "#10b981", bg: "bg-emerald-500", icon: ShieldCheckIcon },
  { value: "ready",     label: "Ready",     hex: "#eab308", bg: "bg-yellow-500",  icon: PackageIcon },
];
const STAGE_VALUES = STAGES.map((s) => s.value);

/* ---------- Priority + date derivation ---------- */
/*
 * No priority/due_date columns yet — derive heuristically:
 *   - >21 days in current stage (proxy via created_at) → Urgent
 *   - type === "custom"                                → High
 *   - type === "stock"                                 → Low
 *   - else                                              → Normal (badge hidden)
 */
const derivePriority = (item) => {
  if (!item.created_at) return "normal";
  const ageDays = (Date.now() - new Date(item.created_at).getTime()) / 86400000;
  if (ageDays > 21) return "urgent";
  if (item.type === "custom") return "high";
  if (item.type === "stock") return "low";
  return "normal";
};

const formatDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en", { month: "short", day: "numeric" });
};

/* ---------- Card ---------- */
const ClockIcon = (cls) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);
const WarningIcon = (cls) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
);

const PRIORITY_STYLES = {
  low:    "bg-stone-100 text-stone-600",
  high:   "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700",
};

const ProductionCard = ({ item, stage, draggedId, onDragStart, onDragEnd }) => {
  const team = useTeam();
  const priority = derivePriority(item);
  const dateStr = formatDate(item.created_at);
  const overdue = priority === "urgent";
  const showAssignee = team.ready && team.members.length > 1;
  const assignee = item.assigned_to ? team.membersByClerkId[item.assigned_to] : null;

  return (
    <Link
      to={`/jewelry/items/${item.id}`}
      draggable
      onDragStart={() => onDragStart(item.id)}
      onDragEnd={onDragEnd}
      className={`group block cursor-grab select-none rounded-xl glass-surface p-3 transition hover:-translate-y-0.5 active:cursor-grabbing ${
        draggedId === item.id ? "opacity-40" : ""
      }`}
      style={{ borderLeft: `3px solid ${stage.hex}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-tight text-stone-900">
            {item.sku || "—"}
          </div>
          <div className="mt-0.5 truncate text-xs text-stone-500" title={item.name}>
            {item.name || "Untitled"}
          </div>
        </div>
        {showAssignee && (
          <MemberAvatar member={assignee} size="xs" ring={false} />
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2 text-[11px]">
        {priority !== "normal" && (
          <span className={`rounded px-1.5 py-0.5 font-semibold capitalize ${PRIORITY_STYLES[priority]}`}>
            {priority}
          </span>
        )}
        {dateStr && (
          <span className={`flex items-center gap-1 ${overdue ? "text-rose-600" : "text-stone-500"}`}>
            {overdue ? WarningIcon("h-3 w-3") : ClockIcon("h-3 w-3")}
            {dateStr}
          </span>
        )}
      </div>
    </Link>
  );
};

/* ---------- Column ----------
 *
 * Width strategy:
 *   - Below xl (1280px) we keep the columns at a fixed 240px and let the
 *     board scroll horizontally — there isn't enough room to show 8 stages
 *     side by side without making each one unreadable.
 *   - On xl+ we drop the fixed width and use flex-1 + min-w-0 so the 8
 *     columns share the page width equally and no horizontal scrollbar
 *     appears. min-w-0 is required so flex children can shrink past their
 *     natural content size; without it long stage names would force the
 *     row wider than the viewport. */
const Column = ({ stage, items, onDrop, isOver, onDragOver, onDragLeave, draggedId, onDragStart, onDragEnd }) => (
  <div
    className="flex w-60 shrink-0 flex-col xl:w-auto xl:min-w-0 xl:flex-1"
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={() => onDrop(stage.value)}
  >
    {/* Header */}
    <div className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2.5 transition ${
      isOver ? "border-brand-emerald bg-brand-emerald/8" : "glass-surface"
    }`}>
      <div className="flex min-w-0 items-center gap-2">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${stage.bg}`}>
          {stage.icon}
        </div>
        <span className="truncate text-sm font-semibold text-stone-900">{stage.label}</span>
      </div>
      <span className="shrink-0 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-stone-700">
        {items.length}
      </span>
    </div>

    {/* Cards */}
    <div className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 240px)" }}>
      {items.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-stone-200 bg-stone-50/60 py-10 text-center text-xs text-stone-400">
          Drop items here
        </div>
      ) : (
        items.map((it) => (
          <ProductionCard
            key={it.id}
            item={it}
            stage={stage}
            draggedId={draggedId}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))
      )}
    </div>
  </div>
);

/* ---------- Page ---------- */
const ProductionBoard = () => {
  const { user } = useUser();
  const userId = user?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [assigneeFilter, setAssigneeFilter] = useState(() => {
    try { return localStorage.getItem("production.assigneeFilter") || "all"; } catch { return "all"; }
  });
  useEffect(() => {
    try { localStorage.setItem("production.assigneeFilter", assigneeFilter); } catch {}
  }, [assigneeFilter]);

  const load = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    const filters = assigneeFilter && assigneeFilter !== "all" ? { assignedTo: assigneeFilter } : {};
    fetchJewelryItems(userId, filters)
      .then((res) => {
        const all = res.items || [];
        // Only items that are in an active production stage
        setItems(all.filter((i) => STAGE_VALUES.includes(i.status)));
      })
      .catch((err) => toast.error(err.message || "Failed to load items"))
      .finally(() => setLoading(false));
  }, [userId, assigneeFilter]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const out = {};
    STAGE_VALUES.forEach((s) => (out[s] = []));
    items.forEach((it) => { if (out[it.status]) out[it.status].push(it); });
    // Within column, urgent first then by date asc
    Object.keys(out).forEach((k) => {
      out[k].sort((a, b) => {
        const pa = derivePriority(a), pb = derivePriority(b);
        const order = { urgent: 0, high: 1, normal: 2, low: 3 };
        if (order[pa] !== order[pb]) return order[pa] - order[pb];
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });
    });
    return out;
  }, [items]);

  const handleDrop = async (newStatus) => {
    setDragOverCol(null);
    if (!draggedId) return;
    const item = items.find((i) => i.id === draggedId);
    setDraggedId(null);
    if (!item || item.status === newStatus) return;
    setUpdating(true);
    try {
      await changeJewelryStatus(item.id, { newStatus, userId });
      toast.success(`Moved to ${STAGES.find((s) => s.value === newStatus)?.label}`);
      load();
    } catch (err) {
      toast.error(err.message || "Failed to change status");
    } finally {
      setUpdating(false);
    }
  };

  const totalActive = items.length;

  return (
    // The Kanban needs a wider canvas than the rest of the app so all 8
    // stages can sit side by side on a normal desktop. We cap at 1800px so
    // ultra-wide displays don't stretch each column to absurd widths.
    <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-emerald-100">
            <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">Production</h1>
              <span className="text-sm text-stone-500">Jobs &amp; workflow</span>
            </div>
            {!loading && (
              <div className="mt-0.5 text-xs text-stone-500">
                {totalActive} {totalActive === 1 ? "active job" : "active jobs"} across {STAGES.length} stages
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AssigneeFilter value={assigneeFilter} onChange={setAssigneeFilter} align="right" />
          <button
            type="button"
            onClick={() => toast("Production workflow docs are coming soon", { icon: "📘" })}
            className="shrink-0 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Learn more →
          </button>
        </div>
      </div>

      {/* Board — horizontal scroll on tablets, full-width grid on desktop. */}
      <div
        className={`mt-6 flex gap-2 overflow-x-auto pb-4 transition xl:overflow-x-visible ${
          updating ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {loading ? (
          STAGES.map((s) => (
            <div key={s.value} className="flex w-60 shrink-0 flex-col gap-2 xl:w-auto xl:min-w-0 xl:flex-1">
              <div className="h-12 animate-pulse rounded-xl bg-stone-100" />
              <div className="h-20 animate-pulse rounded-lg bg-stone-100" />
              <div className="h-20 animate-pulse rounded-lg bg-stone-100" />
              <div className="h-20 animate-pulse rounded-lg bg-stone-100" />
            </div>
          ))
        ) : (
          STAGES.map((s) => (
            <Column
              key={s.value}
              stage={s}
              items={grouped[s.value]}
              isOver={dragOverCol === s.value}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(s.value); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={handleDrop}
              draggedId={draggedId}
              onDragStart={(id) => setDraggedId(id)}
              onDragEnd={() => setDraggedId(null)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ProductionBoard;
