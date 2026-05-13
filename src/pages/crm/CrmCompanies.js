import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  COMPANY_TYPES,
} from "../../services/companiesApi";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import CompanyFormModal from "./components/CompanyFormModal";

/**
 * CRM → Stores page.
 *
 * A "store" (company) is the parent entity for all memos. Reps land here
 * to create a new retail-store record before they can issue a memo to it.
 * Owner sees every store in the workspace; rep sees their own + unassigned.
 */
export default function CrmCompanies() {
  const { user } = useUser();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editing, setEditing] = useState(null); // null | "new" | <company>

  const reload = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const rows = await fetchCompanies(user.id);
      setCompanies(rows);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return companies.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (!q) return true;
      return [c.name, c.email, c.city, c.country, c.primary_contact]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [companies, search, typeFilter]);

  const handleSave = async (data) => {
    try {
      if (editing === "new") {
        await createCompany(user.id, data);
        toast.success("Store created");
      } else {
        await updateCompany(user.id, editing.id, data);
        toast.success("Saved");
      }
      setEditing(null);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (company) => {
    if (!window.confirm(`Delete "${company.name}"? This cannot be undone.`)) return;
    try {
      await deleteCompany(user.id, company.id);
      toast.success("Store deleted");
      reload();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search stores by name, city, contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
        >
          <option value="all">All types</option>
          {COMPANY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New store
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setEditing("new")} hasSearch={!!search || typeFilter !== "all"} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              onEdit={() => setEditing(c)}
              onDelete={() => handleDelete(c)}
            />
          ))}
        </div>
      )}

      {editing && (
        <CompanyFormModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={handleSave}
        />
      )}
    </div>
  );
}

function CompanyCard({ company, onEdit, onDelete }) {
  const type = COMPANY_TYPES.find((t) => t.value === company.type) || COMPANY_TYPES[0];
  const hasOpenMemos = company.active_memos > 0;
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="w-10 h-10 rounded-lg object-cover bg-stone-100 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-stone-700 to-stone-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {(company.name || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-stone-900 truncate">{company.name}</h3>
            <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${type.color} mt-0.5`}>
              {type.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} title="Edit" className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={onDelete} title="Delete" className="p-1.5 rounded-md hover:bg-rose-50 text-rose-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
          </button>
        </div>
      </div>

      <div className="text-xs text-stone-500 space-y-1 mb-3 flex-1">
        {company.primary_contact && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="truncate">{company.primary_contact}</span>
          </div>
        )}
        {(company.city || company.country) && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="truncate">{[company.city, company.country].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {company.email && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <a href={`mailto:${company.email}`} className="truncate hover:text-stone-700">{company.email}</a>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px]">
        <div className="flex items-center gap-2 text-stone-500">
          <span>{company.contact_count || 0} contact{company.contact_count !== 1 ? "s" : ""}</span>
          <span className="text-stone-300">·</span>
          <span className={hasOpenMemos ? "font-semibold text-blue-600" : "text-stone-500"}>
            {company.active_memos || 0} active memo{company.active_memos !== 1 ? "s" : ""}
          </span>
        </div>
        <Link
          to={`/crm/memos?companyId=${company.id}`}
          className="font-semibold text-stone-700 hover:text-stone-900 inline-flex items-center gap-1"
        >
          Memos
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ onCreate, hasSearch }) {
  return (
    <div className="bg-white border border-dashed border-stone-300 rounded-xl p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 7v14m18-14v14M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-stone-900 mb-1">
        {hasSearch ? "No matching stores" : "No stores yet"}
      </h3>
      <p className="text-xs text-stone-500 mb-4">
        {hasSearch
          ? "Try a different search or filter."
          : "Add a retail store to start sending out memos."}
      </p>
      {!hasSearch && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add first store
        </button>
      )}
    </div>
  );
}
