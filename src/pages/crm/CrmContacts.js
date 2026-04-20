import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchContacts,
  createContact,
  bulkDeleteContacts,
  bulkTagContacts,
  fetchTags,
  CONTACT_TYPES,
} from "../../services/crmApi";
import ContactDrawer from "./components/ContactDrawer";
import ContactFormModal from "./components/ContactFormModal";
import ScanCardModal from "./components/ScanCardModal";

const typeStyle = (type) => {
  const t = CONTACT_TYPES.find((x) => x.value === type);
  return t?.color || "bg-stone-100 text-stone-700 border-stone-200";
};

export default function CrmContacts() {
  const { user } = useUser();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [showTagModal, setShowTagModal] = useState(false);

  useEffect(() => {
    if (routeId) setDrawerId(routeId);
  }, [routeId]);

  const reload = () => {
    if (!user?.id) return;
    setLoading(true);
    fetchContacts(user.id, { search, type: typeFilter })
      .then(setContacts)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    fetchTags(user.id).then(setTags).catch(() => {});
  };

  useEffect(() => {
    if (!user?.id) return;
    const t = setTimeout(reload, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, search, typeFilter]);

  const filteredContacts = useMemo(() => {
    if (!tagFilter) return contacts;
    return contacts.filter((c) => Array.isArray(c.tags) && c.tags.includes(tagFilter));
  }, [contacts, tagFilter]);

  const counts = useMemo(() => {
    const c = { all: contacts.length };
    CONTACT_TYPES.forEach((t) => (c[t.value] = 0));
    contacts.forEach((x) => {
      if (c[x.type] != null) c[x.type] += 1;
    });
    return c;
  }, [contacts]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filteredContacts.length) setSelected(new Set());
    else setSelected(new Set(filteredContacts.map((c) => c.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} contact${selected.size > 1 ? "s" : ""} and all their data? This cannot be undone.`)) return;
    try {
      const r = await bulkDeleteContacts(user.id, Array.from(selected));
      toast.success(`Deleted ${r.deleted} contact${r.deleted !== 1 ? "s" : ""}`);
      clearSelection();
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleBulkTag = async (tag, action) => {
    if (selected.size === 0 || !tag) return;
    try {
      await bulkTagContacts(user.id, Array.from(selected), tag, action);
      toast.success(`${action === "add" ? "Tagged" : "Removed tag from"} ${selected.size} contact${selected.size > 1 ? "s" : ""}`);
      setShowTagModal(false);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleCreate = async (data) => {
    try {
      const created = await createContact({ userId: user.id, ...data });
      toast.success("Contact added");
      setShowForm(false);
      setContacts((prev) => [created, ...prev]);
      setDrawerId(String(created.id));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleClose = () => {
    setDrawerId(null);
    if (routeId) navigate("/crm/contacts");
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-9 pr-3 py-2.5 sm:py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowScan(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 rounded-lg bg-white border border-stone-300 text-stone-800 text-sm font-medium hover:border-stone-500 transition-colors"
            title="Scan business card"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Scan</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Type chips */}
      <div className="flex gap-1.5 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 scrollbar-hide">
        <Chip label={`All (${counts.all || 0})`} active={typeFilter === "all"} onClick={() => setTypeFilter("all")} />
        {CONTACT_TYPES.map((t) => (
          <Chip
            key={t.value}
            label={`${t.label} (${counts[t.value] || 0})`}
            active={typeFilter === t.value}
            onClick={() => setTypeFilter(t.value)}
            color={t.color}
          />
        ))}
      </div>

      {/* Tag chips (if any tags exist) */}
      {tags.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 scrollbar-hide">
          <button
            onClick={() => setTagFilter(null)}
            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              !tagFilter ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200"
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            All tags
          </button>
          {tags.map((t) => (
            <button
              key={t.tag}
              onClick={() => setTagFilter(tagFilter === t.tag ? null : t.tag)}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                tagFilter === t.tag
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              }`}
            >
              #{t.tag}
              <span className="opacity-70">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 bg-stone-900 text-white rounded-xl shadow-lg flex items-center gap-1 sm:gap-2 px-3 py-2.5 animate-in slide-in-from-top-2">
          <button onClick={clearSelection} className="p-1 hover:bg-white/10 rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <span className="text-sm font-medium flex-1">{selected.size} selected</span>
          <button
            onClick={() => setShowTagModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-white/10 rounded text-xs font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            <span className="hidden sm:inline">Tag</span>
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-rose-500 rounded text-xs font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-stone-500 text-sm">Loading…</div>
        ) : filteredContacts.length === 0 ? (
          <EmptyState onCreate={() => setShowForm(true)} hasFilter={tagFilter || search || typeFilter !== "all"} />
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredContacts.length && filteredContacts.length > 0}
                      onChange={selectAll}
                      className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                    />
                  </th>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Tags</th>
                  <th className="py-3 px-4 font-medium">Phone</th>
                  <th className="py-3 px-4 font-medium">Email</th>
                  <th className="py-3 px-4 font-medium text-right">Won</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setDrawerId(String(c.id))}
                    className={`border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer ${
                      selected.has(c.id) ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <td className="py-3 px-4" onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-stone-900">{c.name}</div>
                      {c.company && <div className="text-xs text-stone-500">{c.company}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${typeStyle(c.type)}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(c.tags) && c.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">#{t}</span>
                        ))}
                        {Array.isArray(c.tags) && c.tags.length > 3 && (
                          <span className="text-[10px] text-stone-400">+{c.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-stone-700">{c.phone || "—"}</td>
                    <td className="py-3 px-4 text-stone-700">{c.email || "—"}</td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                      ${Number(c.total_won || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-stone-100">
              {filteredContacts.map((c) => {
                const isSelected = selected.has(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => (selected.size > 0 ? toggleSelect(c.id) : setDrawerId(String(c.id)))}
                    className={`relative p-3 active:bg-stone-50 ${isSelected ? "bg-blue-50/60" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                        className={`shrink-0 mt-1 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {isSelected ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          (c.name || "?").charAt(0).toUpperCase()
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-stone-900 truncate">{c.name}</div>
                          {Number(c.total_won) > 0 && (
                            <div className="text-xs font-semibold text-emerald-600 shrink-0">
                              ${Number(c.total_won || 0).toLocaleString()}
                            </div>
                          )}
                        </div>
                        {c.company && <div className="text-xs text-stone-500 truncate">{c.company}</div>}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${typeStyle(c.type)}`}>
                            {c.type}
                          </span>
                          {Array.isArray(c.tags) && c.tags.slice(0, 2).map((t) => (
                            <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">#{t}</span>
                          ))}
                          {c.phone && <span className="text-[11px] text-stone-500 truncate">{c.phone}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showForm && (
        <ContactFormModal onClose={() => setShowForm(false)} onSubmit={handleCreate} />
      )}

      {showScan && (
        <ScanCardModal
          onClose={() => setShowScan(false)}
          onSaved={(c) => {
            reload();
            if (c?.id) setDrawerId(String(c.id));
          }}
        />
      )}

      {drawerId && (
        <ContactDrawer contactId={drawerId} onClose={handleClose} onChanged={reload} />
      )}

      {showTagModal && (
        <BulkTagModal
          existingTags={tags.map((t) => t.tag)}
          onClose={() => setShowTagModal(false)}
          onApply={handleBulkTag}
          count={selected.size}
        />
      )}
    </div>
  );
}

const Chip = ({ label, active, onClick, color }) => (
  <button
    onClick={onClick}
    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
      active
        ? "bg-stone-900 text-white border-stone-900"
        : color
          ? `${color} hover:opacity-80`
          : "bg-white text-stone-700 border-stone-200 hover:border-stone-300"
    }`}
  >
    {label}
  </button>
);

const EmptyState = ({ onCreate, hasFilter }) => (
  <div className="p-12 text-center">
    <div className="mx-auto w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
      <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    </div>
    <h3 className="font-semibold text-stone-800">{hasFilter ? "No matches" : "No contacts yet"}</h3>
    <p className="text-sm text-stone-500 mt-1">
      {hasFilter ? "Try clearing filters or search." : "Add your first lead, buyer or supplier to get started."}
    </p>
    {!hasFilter && (
      <button onClick={onCreate} className="mt-4 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800">
        New contact
      </button>
    )}
  </div>
);

function BulkTagModal({ existingTags, onClose, onApply, count }) {
  const [tag, setTag] = useState("");
  const [mode, setMode] = useState("add");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-semibold text-stone-900">Tag {count} contact{count > 1 ? "s" : ""}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5">
            <button onClick={() => setMode("add")} className={`px-3 py-1.5 rounded-md text-xs font-medium ${mode === "add" ? "bg-white shadow text-stone-900" : "text-stone-500"}`}>Add tag</button>
            <button onClick={() => setMode("remove")} className={`px-3 py-1.5 rounded-md text-xs font-medium ${mode === "remove" ? "bg-white shadow text-stone-900" : "text-stone-500"}`}>Remove tag</button>
          </div>
          <div>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. VIP, Tucson 2026, Hot lead…"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
              autoFocus
            />
          </div>
          {existingTags.length > 0 && (
            <div>
              <div className="text-xs font-medium text-stone-500 mb-2">Existing tags</div>
              <div className="flex flex-wrap gap-1.5">
                {existingTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(t)}
                    className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium hover:bg-blue-100"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onApply(tag.trim(), mode)}
            disabled={!tag.trim()}
            className={`px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${
              mode === "add" ? "bg-stone-900 text-white hover:bg-stone-800" : "bg-rose-600 text-white hover:bg-rose-700"
            }`}
          >
            {mode === "add" ? "Add tag" : "Remove tag"}
          </button>
        </div>
      </div>
    </div>
  );
}
