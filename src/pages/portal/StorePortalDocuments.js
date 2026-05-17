import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { fetchPortalMemos, fetchPortalMemo } from "../../services/portalApi";
import { MEMO_STATUSES, isMemoEffectivelyExpired } from "../../services/memosApi";
import { downloadMemoPdf, printMemoPdf } from "../../services/memoPdf";

/**
 * StorePortalDocuments — store-side Documents Hub.
 *
 * Mirrors the supplier-side CrmDocuments page but talks to
 * /api/portal/memos which is automatically scoped to the store's
 * own consignment memos (the BE store-user gate rejects anything
 * else). Same UX: search, status filter, per-row signature badges,
 * Download / Print actions.
 *
 * Note on labels: this is the store's perspective, so the status
 * pill uses `portalLabel` ("IN" for the canonical `out` value) when
 * available — same translation as the rest of the portal UI.
 */

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtMoney = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function StorePortalDocuments() {
  const { user } = useUser();
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [hydratedCache] = useState(() => new Map());

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    setLoading(true);
    fetchPortalMemos(user.id)
      .then((rows) => { if (alive) setMemos(Array.isArray(rows) ? rows : []); })
      .catch((e) => toast.error(e.message))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return memos.filter((m) => {
      if (statusFilter === "active" && !["out", "partially_returned"].includes(m.status)) return false;
      if (statusFilter === "closed" && m.status !== "closed") return false;
      if (!q) return true;
      const hay = `${m.memo_number || ""} ${m.supplier_name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [memos, search, statusFilter]);

  const handleDownload = async (memo) => {
    if (busyId) return;
    setBusyId(memo.id);
    try {
      const full = hydratedCache.get(memo.id) || (await fetchPortalMemo(user.id, memo.id));
      hydratedCache.set(memo.id, full);
      await downloadMemoPdf(full);
    } catch (e) {
      toast.error(e.message || "Failed to build PDF");
    } finally { setBusyId(null); }
  };
  const handlePrint = async (memo) => {
    if (busyId) return;
    setBusyId(memo.id);
    try {
      const full = hydratedCache.get(memo.id) || (await fetchPortalMemo(user.id, memo.id));
      hydratedCache.set(memo.id, full);
      await printMemoPdf(full);
    } catch (e) {
      toast.error(e.message || "Failed to open print preview");
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Header total={memos.length} />
      <Toolbar
        search={search}
        onSearch={setSearch}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
      />
      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState hasAny={memos.length > 0} />
      ) : (
        <DocumentList
          memos={filtered}
          busyId={busyId}
          onDownload={handleDownload}
          onPrint={handlePrint}
        />
      )}
    </div>
  );
}

function Header({ total }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl px-4 sm:px-6 py-4 sm:py-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-bold">Documents</div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-0.5">Your signed memos</h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-prose">
            Every memo you have received with at least one electronic signature. Each entry can be exported as a print-ready PDF for your records.
          </p>
        </div>
        <div className="text-xs text-stone-400">
          {total} memo{total === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}

function Toolbar({ search, onSearch, statusFilter, onStatusFilter }) {
  const chip = (value, label) => (
    <button
      key={value}
      onClick={() => onStatusFilter(value)}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
        statusFilter === value
          ? "bg-stone-900 text-white border-stone-900"
          : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3 sm:p-4 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[180px]">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by memo number or supplier…"
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400"
        />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {chip("all", "All")}
        {chip("active", "Active")}
        {chip("closed", "Closed")}
      </div>
    </div>
  );
}

function DocumentList({ memos, busyId, onDownload, onPrint }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100 overflow-hidden">
      {memos.map((memo) => (
        <DocumentRow
          key={memo.id}
          memo={memo}
          busy={busyId === memo.id}
          onDownload={() => onDownload(memo)}
          onPrint={() => onPrint(memo)}
        />
      ))}
    </div>
  );
}

function DocumentRow({ memo, busy, onDownload, onPrint }) {
  const expired = isMemoEffectivelyExpired(memo);
  const effectiveStatus = expired ? "expired" : memo.status;
  const status = MEMO_STATUSES.find((s) => s.value === effectiveStatus) || MEMO_STATUSES[0];
  // Portal label override — see MEMO_STATUSES doc-comment in memosApi.
  const statusLabel = status.portalLabel || status.label;

  return (
    <div className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 hover:bg-stone-50/60 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
            {statusLabel}
          </span>
          {memo.signature_count > 0 && (
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {memo.signature_count} signature{memo.signature_count === 1 ? "" : "s"}
            </span>
          )}
          {!memo.has_sig_issue_supplier && (
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              Awaiting supplier
            </span>
          )}
        </div>
        <Link
          to={`/store-portal/memos/${memo.id}`}
          className="block font-bold text-stone-900 text-base sm:text-lg mt-1 break-all hover:text-indigo-700 transition-colors"
        >
          {memo.memo_number}
        </Link>
        <div className="text-[11px] sm:text-xs text-stone-500 mt-0.5 truncate">
          {memo.supplier_name && <>{memo.supplier_name} · </>}
          {memo.item_count} {memo.item_count === 1 ? "item" : "items"}
          {memo.issued_at && <> · Received {fmtDate(memo.issued_at)}</>}
          {memo.total_value != null && <> · {fmtMoney(memo.total_value)}</>}
        </div>
        <SignatureBadges memo={memo} />
      </div>
      <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2">
        <button
          onClick={onPrint}
          disabled={busy}
          title="Open a print-ready PDF in a new tab"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-stone-200 text-stone-700 text-[11px] font-semibold hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>
        <button
          onClick={onDownload}
          disabled={busy}
          title="Download signed memo PDF"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-900 text-white text-[11px] font-semibold hover:bg-stone-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          {busy ? "…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}

function SignatureBadges({ memo }) {
  const Badge = ({ ok, label }) => (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${ok ? "text-emerald-700" : "text-stone-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-stone-300"}`} />
      {label}
    </span>
  );
  const showClose = memo.has_sig_close_supplier || memo.has_sig_close_store || memo.status === "closed";
  return (
    <div className="mt-2 flex items-center gap-3 flex-wrap">
      <Badge ok={!!memo.has_sig_issue_supplier} label="Supplier · issuance" />
      <Badge ok={!!memo.has_sig_issue_store}    label="You · issuance" />
      {showClose && <Badge ok={!!memo.has_sig_close_supplier} label="Supplier · close" />}
      {showClose && <Badge ok={!!memo.has_sig_close_store}    label="You · close" />}
    </div>
  );
}

function EmptyState({ hasAny }) {
  return (
    <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-8 text-center">
      <div className="text-stone-400 text-sm">
        {hasAny ? "No memos match your filters." : "You don't have any signed memos yet."}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100 overflow-hidden animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="px-5 py-4 flex items-center gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-stone-100" />
            <div className="h-4 w-48 rounded bg-stone-100" />
            <div className="h-3 w-24 rounded bg-stone-100" />
          </div>
          <div className="h-8 w-28 rounded bg-stone-100" />
        </div>
      ))}
    </div>
  );
}
