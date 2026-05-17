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
    <div className="space-y-10 sm:space-y-12">
      <Header total={memos.length} />
      <section className="bg-portal-canvas border border-portal-line">
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
      </section>
    </div>
  );
}

function Header({ total }) {
  return (
    <section className="border-t border-portal-champagne/60 pt-8 sm:pt-12 pb-2">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="max-w-xl">
          <div className="text-[10px] tracking-[0.32em] uppercase text-portal-champagne font-medium mb-4">
            Documents
          </div>
          <h1 className="font-serif-display text-[32px] sm:text-[44px] leading-[1.05] text-portal-ink tracking-tight">
            Your signed memos
          </h1>
          <p className="text-[13.5px] sm:text-[14px] text-portal-graphite mt-5 max-w-md leading-relaxed">
            Every memo you have received with at least one electronic signature. Each record can be exported as a print-ready PDF.
          </p>
        </div>
        <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium tabular-nums">
          {total} memo{total === 1 ? "" : "s"} on file
        </div>
      </div>
    </section>
  );
}

function Toolbar({ search, onSearch, statusFilter, onStatusFilter }) {
  const chip = (value, label) => (
    <button
      key={value}
      onClick={() => onStatusFilter(value)}
      className={`px-3 py-1.5 text-[10px] tracking-[0.22em] uppercase whitespace-nowrap transition-colors border font-medium ${
        statusFilter === value
          ? "border-portal-ink text-portal-ink bg-portal-bone"
          : "border-portal-line text-portal-muted hover:border-portal-line2 hover:text-portal-ink bg-transparent"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="px-5 sm:px-7 py-5 border-b border-portal-line flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-[200px] relative max-w-md">
        <svg className="w-3.5 h-3.5 absolute left-0 top-1/2 -translate-y-1/2 text-portal-soft pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by memo number or supplier"
          className="w-full pl-6 pr-3 py-2 text-[12.5px] bg-transparent border-b border-portal-line2 focus:outline-none focus:border-portal-ink placeholder:text-portal-soft text-portal-ink tracking-wide"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {chip("all", "All")}
        {chip("active", "Active")}
        {chip("closed", "Closed")}
      </div>
    </div>
  );
}

function DocumentList({ memos, busyId, onDownload, onPrint }) {
  return (
    <div className="divide-y divide-portal-line">
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
    <div className="flex items-start gap-4 sm:gap-5 px-5 sm:px-7 py-5 hover:bg-portal-bone/60 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-block text-[10px] uppercase tracking-[0.22em] font-medium px-2 py-0.5 border ${status.color}`}>
            {statusLabel}
          </span>
          {memo.signature_count > 0 && (
            <span className="text-[10px] uppercase tracking-[0.22em] font-medium px-2 py-0.5 border border-portal-champagne/70 text-portal-champagne2 tabular-nums">
              {memo.signature_count} signature{memo.signature_count === 1 ? "" : "s"}
            </span>
          )}
          {!memo.has_sig_issue_supplier && (
            <span className="text-[10px] uppercase tracking-[0.22em] font-medium px-2 py-0.5 border border-[#cdb0a8] text-[#7a3f3f]">
              Awaiting supplier
            </span>
          )}
        </div>
        <Link
          to={`/store-portal/memos/${memo.id}`}
          className="block font-serif-display text-portal-ink text-[20px] sm:text-[22px] mt-2 break-all hover:text-portal-champagne2 transition-colors leading-tight"
        >
          {memo.memo_number}
        </Link>
        <div className="text-[11.5px] text-portal-muted mt-2 truncate tracking-wide">
          {memo.supplier_name && <>{memo.supplier_name} · </>}
          {memo.item_count} {memo.item_count === 1 ? "item" : "items"}
          {memo.issued_at && <> · Received {fmtDate(memo.issued_at)}</>}
          {memo.total_value != null && <> · {fmtMoney(memo.total_value)}</>}
        </div>
        <SignatureBadges memo={memo} />
      </div>
      <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-2">
        <button
          onClick={onPrint}
          disabled={busy}
          title="Open a print-ready PDF in a new tab"
          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[10px] tracking-[0.22em] uppercase border border-portal-line2 text-portal-ink hover:border-portal-ink transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </button>
        <button
          onClick={onDownload}
          disabled={busy}
          title="Download signed memo PDF"
          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-[10px] tracking-[0.22em] uppercase bg-portal-ink text-portal-bone hover:bg-portal-graphite transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          {busy ? "…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}

function SignatureBadges({ memo }) {
  const Badge = ({ ok, label }) => (
    <span className={`inline-flex items-center gap-1.5 text-[10px] tracking-[0.18em] uppercase font-medium ${ok ? "text-portal-champagne2" : "text-portal-soft"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-portal-champagne" : "bg-portal-line2"}`} />
      {label}
    </span>
  );
  const showClose = memo.has_sig_close_supplier || memo.has_sig_close_store || memo.status === "closed";
  return (
    <div className="mt-3 flex items-center gap-5 flex-wrap">
      <Badge ok={!!memo.has_sig_issue_supplier} label="Supplier · issuance" />
      <Badge ok={!!memo.has_sig_issue_store}    label="You · issuance" />
      {showClose && <Badge ok={!!memo.has_sig_close_supplier} label="Supplier · close" />}
      {showClose && <Badge ok={!!memo.has_sig_close_store}    label="You · close" />}
    </div>
  );
}

function EmptyState({ hasAny }) {
  return (
    <div className="px-6 py-16 sm:py-20 text-center">
      <div className="h-px w-12 bg-portal-champagne mx-auto mb-6" />
      <div className="font-serif-display text-[22px] text-portal-ink">
        {hasAny ? "No memos match your filters" : "No signed memos yet"}
      </div>
      <div className="text-[12.5px] text-portal-muted mt-3 max-w-sm mx-auto leading-relaxed">
        {hasAny
          ? "Try clearing the search or switching the status filter."
          : "Memos you receive with an electronic signature will appear here for your records."}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-portal-line animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="px-5 sm:px-7 py-5 flex items-center gap-5">
          <div className="flex-1 space-y-3">
            <div className="h-3 w-32 bg-portal-pearl" />
            <div className="h-6 w-48 bg-portal-pearl" />
            <div className="h-3 w-64 bg-portal-pearl" />
          </div>
          <div className="h-8 w-28 bg-portal-pearl" />
        </div>
      ))}
    </div>
  );
}
