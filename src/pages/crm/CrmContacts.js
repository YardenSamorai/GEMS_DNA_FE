import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchContacts,
  fetchContactThumbs,
  createContact,
  bulkDeleteContacts,
  bulkTagContacts,
  fetchTags,
  fetchFolders,
  moveContactsToFolder,
  CONTACT_TYPES,
} from "../../services/crmApi";
import ContactDrawer from "./components/ContactDrawer";
import ContactFormModal from "./components/ContactFormModal";
import ScanCardModal from "./components/ScanCardModal";
import FolderTree from "./components/FolderTree";
import AdvancedFiltersDrawer, { EMPTY_FILTERS, countActiveFilters } from "./components/AdvancedFiltersDrawer";
import ImportContactsModal from "./components/ImportContactsModal";
import BroadcastEmailModal from "./components/BroadcastEmailModal";
import CardImageLightbox from "./components/CardImageLightbox";

const typeStyle = (type) => {
  const t = CONTACT_TYPES.find((x) => x.value === type);
  return t?.color || "bg-stone-100 text-stone-700 border-stone-200";
};

// ---- Contacts list cache (stale-while-revalidate) -------------------------
// We persist the last successful response per (user × filter combo) in
// localStorage so re-opening the Contacts tab is instantaneous, even before
// the network roundtrip finishes. The cached data is then quietly refreshed
// in the background; the UI swaps in the fresh data when it arrives.
const CONTACTS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const cacheKey = (userId, filterPayload) =>
  `crm.contactsCache.${userId || "anon"}.${JSON.stringify(filterPayload)}`;
const thumbsCacheKey = (userId) => `crm.thumbsCache.${userId || "anon"}`;

const loadCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (parsed.savedAt && Date.now() - parsed.savedAt > CONTACTS_CACHE_TTL)) return null;
    return parsed.data;
  } catch (_) { return null; }
};
const saveCache = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data })); }
  catch (_) { /* quota exceeded etc. — ignore */ }
};

const DnaBadge = () => (
  <span
    title="Created from a public DNA page"
    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200"
  >
    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5 2a1 1 0 011 1c0 2.5 2 4.5 4 4.5s4-2 4-4.5a1 1 0 112 0c0 3-1.74 5.36-4 6.27v.96c2.26.91 4 3.27 4 6.27a1 1 0 11-2 0c0-2.5-2-4.5-4-4.5s-4 2-4 4.5a1 1 0 11-2 0c0-3 1.74-5.36 4-6.27v-.96C5.74 8.36 4 6 4 3a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
    DNA
  </span>
);

export default function CrmContacts() {
  const { user } = useUser();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [advancedFilters, setAdvancedFilters] = useState({ ...EMPTY_FILTERS });

  const [showForm, setShowForm] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showFoldersMobile, setShowFoldersMobile] = useState(false);
  const [showMoveFolder, setShowMoveFolder] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [showTagModal, setShowTagModal] = useState(false);
  const [cardLightbox, setCardLightbox] = useState(null); // { contactId, name, hasBack }

  useEffect(() => {
    if (routeId) setDrawerId(routeId);
  }, [routeId]);

  // Deep-link support for iPhone home-screen shortcuts and PWA shortcuts.
  //   /crm/contacts?action=scan  → opens the business-card scanner directly
  //   /crm/contacts?action=new   → opens the "New contact" form directly
  // The URL param is stripped after we consume it so back/forward stays clean.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get("action");
    if (action === "scan") setShowScan(true);
    else if (action === "new") setShowForm(true);
    if (action) {
      params.delete("action");
      const qs = params.toString();
      navigate(`/crm/contacts${qs ? `?${qs}` : ""}`, { replace: true });
    }
  }, [location.search, navigate]);

  const [refreshing, setRefreshing] = useState(false);

  // Hydrate thumbnails from a per-user localStorage cache the moment the page mounts.
  const [thumbCache, setThumbCache] = useState(() =>
    user?.id ? (loadCache(thumbsCacheKey(user.id)) || {}) : {}
  );

  const reload = useCallback(() => {
    if (!user?.id) return;
    const filterPayload = {
      search,
      type: typeFilter,
      folderId: selectedFolderId,
      ...stripTypeFromFilters(advancedFilters),
    };
    const key = cacheKey(user.id, filterPayload);

    // ---- Stale-while-revalidate ----
    // Render cached data INSTANTLY (if any), then fetch fresh in background.
    const cached = loadCache(key);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setContacts(cached);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    fetchContacts(user.id, filterPayload)
      .then((fresh) => {
        setContacts(fresh);
        saveCache(key, fresh);

        // Lazy-load thumbnails for any contact that has one but isn't in our local cache.
        const missingIds = fresh
          .filter((c) => c.has_card_thumb && !thumbCache[c.id])
          .map((c) => c.id);
        if (missingIds.length > 0) {
          fetchContactThumbs(missingIds)
            .then((rows) => {
              if (!rows.length) return;
              setThumbCache((prev) => {
                const next = { ...prev };
                rows.forEach((r) => { if (r.thumb) next[r.id] = r.thumb; });
                if (user?.id) saveCache(thumbsCacheKey(user.id), next);
                return next;
              });
            })
            .catch(() => {});
        }
      })
      .catch((e) => {
        // Don't toast if we have cached data — silent retry on next interaction
        if (!cached) toast.error(e.message);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [user?.id, search, typeFilter, selectedFolderId, advancedFilters, thumbCache]);

  // Load tags + folders ONCE per page (not on every keystroke / filter change)
  const reloadSidebars = useCallback(() => {
    if (!user?.id) return;
    fetchTags(user.id).then(setTags).catch(() => {});
    fetchFolders(user.id).then(setFolders).catch(() => {});
  }, [user?.id]);

  useEffect(() => { reloadSidebars(); }, [reloadSidebars]);

  useEffect(() => {
    if (!user?.id) return;
    const t = setTimeout(reload, 250);
    return () => clearTimeout(t);
  }, [user?.id, search, typeFilter, selectedFolderId, advancedFilters, reload]);

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

  const activeFiltersCount = useMemo(() => countActiveFilters(advancedFilters), [advancedFilters]);

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
      reloadSidebars();
    } catch (e) { toast.error(e.message); }
  };

  const handleBulkMoveToFolder = async (folderId) => {
    if (selected.size === 0) return;
    try {
      await moveContactsToFolder(user.id, Array.from(selected), folderId);
      toast.success(`Moved ${selected.size} contact${selected.size > 1 ? "s" : ""}`);
      setShowMoveFolder(false);
      clearSelection();
      reload();
      reloadSidebars();
    } catch (e) { toast.error(e.message); }
  };

  const handleCreate = async (data) => {
    try {
      const created = await createContact({ userId: user.id, ...data });
      toast.success("Contact added");
      setShowForm(false);
      reload();
      setDrawerId(String(created.id));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleClose = () => {
    setDrawerId(null);
    if (routeId) navigate("/crm/contacts");
  };

  const selectedContacts = useMemo(
    () => filteredContacts.filter((c) => selected.has(c.id)),
    [filteredContacts, selected]
  );

  const broadcastRecipients = useMemo(
    () => (selected.size > 0 ? selectedContacts : filteredContacts),
    [selected.size, selectedContacts, filteredContacts]
  );

  return (
    <div className="flex gap-4 sm:gap-5">
      {/* Folder sidebar - desktop only */}
      <aside className="hidden lg:block w-64 shrink-0 self-start sticky top-4">
        <div className="bg-white rounded-xl border border-stone-200 p-3">
          <FolderTree
            folders={folders}
            contacts={contacts}
            selectedFolderId={selectedFolderId}
            onSelect={(id) => setSelectedFolderId(id)}
            userId={user?.id}
            onChange={() => { reload(); reloadSidebars(); }}
          />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
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
          <div className="flex gap-2 items-center">
            {/* Folders button - mobile/tablet only */}
            <button
              onClick={() => setShowFoldersMobile(true)}
              className="lg:hidden inline-flex items-center justify-center gap-1 px-3 py-2.5 sm:py-2 rounded-lg bg-white border border-stone-300 text-stone-700 text-sm font-medium"
              title="Folders"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
            </button>

            {/* Filters button */}
            <button
              onClick={() => setShowFilters(true)}
              className={`inline-flex items-center justify-center gap-1 px-3 py-2.5 sm:py-2 rounded-lg border text-sm font-medium relative ${
                activeFiltersCount > 0 ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-stone-300 text-stone-700"
              }`}
              title="Advanced filters"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">{activeFiltersCount}</span>
              )}
            </button>

            {/* Actions menu */}
            <div className="relative">
              <button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2.5 sm:py-2 rounded-lg bg-white border border-stone-300 text-stone-700 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
              </button>
              {showActionsMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowActionsMenu(false)} />
                  <div className="absolute right-0 mt-1 w-48 rounded-lg shadow-lg bg-white border border-stone-200 z-20 overflow-hidden">
                    <MenuItem icon="upload" onClick={() => { setShowImport(true); setShowActionsMenu(false); }}>Import contacts</MenuItem>
                    <MenuItem icon="mail" onClick={() => { setShowBroadcast(true); setShowActionsMenu(false); }}>
                      Email broadcast
                    </MenuItem>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowScan(true)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 rounded-lg bg-white border border-stone-300 text-stone-800 text-sm font-medium hover:border-stone-500 transition-colors"
              title="Scan business card"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Scan</span>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Active filter pills row */}
        {(selectedFolderId || activeFiltersCount > 0 || tagFilter) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-stone-500">Active:</span>
            {selectedFolderId && (
              <FilterPill onRemove={() => setSelectedFolderId(null)}>
                {selectedFolderId === "unfiled" ? "Unfiled" : (folders.find(f => f.id === selectedFolderId)?.name || "Folder")}
              </FilterPill>
            )}
            {tagFilter && (
              <FilterPill onRemove={() => setTagFilter(null)}>#{tagFilter}</FilterPill>
            )}
            {Object.entries(advancedFilters).map(([k, v]) => {
              if (!v || (k === "type" && v === "all")) return null;
              return (
                <FilterPill key={k} onRemove={() => setAdvancedFilters({ ...advancedFilters, [k]: k === "type" ? "all" : "" })}>
                  {filterLabel(k, v)}
                </FilterPill>
              );
            })}
          </div>
        )}

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

        {/* Tag chips */}
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
          <div className="sticky top-2 z-20 bg-stone-900 text-white rounded-xl shadow-lg flex items-center gap-1 sm:gap-2 px-3 py-2.5">
            <button onClick={clearSelection} className="p-1 hover:bg-white/10 rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <span className="text-sm font-medium flex-1">{selected.size} selected</span>
            <button onClick={() => setShowTagModal(true)} className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-white/10 rounded text-xs font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              <span className="hidden sm:inline">Tag</span>
            </button>
            <button onClick={() => setShowMoveFolder(true)} className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-white/10 rounded text-xs font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
              <span className="hidden sm:inline">Move</span>
            </button>
            <button onClick={() => setShowBroadcast(true)} className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-white/10 rounded text-xs font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span className="hidden sm:inline">Email</span>
            </button>
            <button onClick={handleBulkDelete} className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-rose-500 rounded text-xs font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        )}

        {/* Quiet "refreshing" indicator — visible when we already painted cached rows
            but a background fetch is still in flight. */}
        {refreshing && !loading && (
          <div className="flex items-center gap-2 text-[11px] text-stone-500 mb-2">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            Refreshing…
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-stone-500 text-sm">Loading…</div>
          ) : filteredContacts.length === 0 ? (
            <EmptyState onCreate={() => setShowForm(true)} hasFilter={tagFilter || search || typeFilter !== "all" || selectedFolderId || activeFiltersCount > 0} />
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
                    <th className="py-3 px-2 font-medium w-14">Card</th>
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium">Title</th>
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
                      <td className="py-3 px-2">
                        <CardThumb
                          contact={c}
                          thumb={thumbCache[c.id]}
                          onOpen={() =>
                            setCardLightbox({
                              contactId: c.id,
                              name: c.name,
                              hasBack: !!c.has_card_back,
                            })
                          }
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-stone-900">{c.name}</span>
                          {c.source === 'dna_lead' && <DnaBadge />}
                        </div>
                        {c.company && <div className="text-xs text-stone-500">{c.company}</div>}
                        {c.source === 'dna_lead' && c.dna_sku && (
                          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">From DNA · {c.dna_sku}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-700 text-xs">{c.title || "—"}</td>
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
                            isSelected ? "bg-blue-600 text-white" : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {isSelected ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            (c.name || "?").charAt(0).toUpperCase()
                          )}
                        </button>
                        {(thumbCache[c.id] || c.has_card_front || c.has_card_thumb) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardLightbox({ contactId: c.id, name: c.name, hasBack: !!c.has_card_back });
                            }}
                            className="shrink-0 w-12 h-9 rounded-md overflow-hidden border border-stone-200 bg-stone-100"
                            aria-label="View card image"
                          >
                            {thumbCache[c.id] ? (
                              <img src={thumbCache[c.id]} alt="Card" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 8a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" /></svg>
                              </div>
                            )}
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="font-semibold text-stone-900 truncate">{c.name}</div>
                              {c.source === 'dna_lead' && <DnaBadge />}
                            </div>
                            {Number(c.total_won) > 0 && (
                              <div className="text-xs font-semibold text-emerald-600 shrink-0">
                                ${Number(c.total_won || 0).toLocaleString()}
                              </div>
                            )}
                          </div>
                          {c.title && <div className="text-xs text-stone-700 truncate">{c.title}</div>}
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
      </div>

      {/* Modals */}
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
      {showFilters && (
        <AdvancedFiltersDrawer
          initial={advancedFilters}
          tags={tags}
          onClose={() => setShowFilters(false)}
          onApply={(f) => setAdvancedFilters(f)}
        />
      )}
      {showImport && (
        <ImportContactsModal
          onClose={() => setShowImport(false)}
          onImported={() => { reload(); }}
          defaultFolderId={typeof selectedFolderId === "number" ? selectedFolderId : null}
        />
      )}
      {showBroadcast && (
        <BroadcastEmailModal
          recipients={broadcastRecipients}
          onClose={() => setShowBroadcast(false)}
          onSent={() => reload()}
        />
      )}
      {cardLightbox && (
        <CardImageLightbox
          contactId={cardLightbox.contactId}
          contactName={cardLightbox.name}
          hasBack={cardLightbox.hasBack}
          onClose={() => setCardLightbox(null)}
        />
      )}
      {showMoveFolder && (
        <MoveToFolderModal
          folders={folders}
          count={selected.size}
          onClose={() => setShowMoveFolder(false)}
          onApply={handleBulkMoveToFolder}
        />
      )}
      {showFoldersMobile && (
        <MobileFoldersDrawer
          folders={folders}
          contacts={contacts}
          selectedFolderId={selectedFolderId}
          onSelect={(id) => { setSelectedFolderId(id); setShowFoldersMobile(false); }}
          userId={user?.id}
          onChange={() => { reload(); reloadSidebars(); }}
          onClose={() => setShowFoldersMobile(false)}
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

const FilterPill = ({ children, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-medium border border-blue-200">
    {children}
    <button onClick={onRemove} className="hover:bg-blue-200 rounded-full p-0.5">
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  </span>
);

const MenuItem = ({ icon, children, onClick }) => {
  const icons = {
    upload: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />,
    mail: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  };
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-3 py-2.5 w-full text-left text-sm hover:bg-stone-100">
      <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">{icons[icon]}</svg>
      {children}
    </button>
  );
};

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

function CardThumb({ contact, thumb, onOpen }) {
  const hasFront = contact.has_card_front || contact.has_card_thumb || !!thumb;
  if (!hasFront) {
    return <div className="w-12 h-9 rounded-md border border-dashed border-stone-200 bg-stone-50" />;
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className="group relative w-12 h-9 rounded-md overflow-hidden border border-stone-200 bg-stone-100 hover:ring-2 hover:ring-stone-400"
      title="View business card"
    >
      {thumb ? (
        <img src={thumb} alt="Card" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-stone-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 8a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" /></svg>
        </div>
      )}
      {contact.has_card_back && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-stone-900 text-white text-[8px] font-bold flex items-center justify-center ring-2 ring-white" title="Has back side">
          2
        </span>
      )}
    </button>
  );
}

function BulkTagModal({ existingTags, onClose, onApply, count }) {
  const [tag, setTag] = useState("");
  const [mode, setMode] = useState("add");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
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
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="e.g. VIP, Tucson 2026, Hot lead…"
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
            autoFocus
          />
          {existingTags.length > 0 && (
            <div>
              <div className="text-xs font-medium text-stone-500 mb-2">Existing tags</div>
              <div className="flex flex-wrap gap-1.5">
                {existingTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(t)}
                    className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium hover:bg-blue-100"
                  >#{t}</button>
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

function MoveToFolderModal({ folders, count, onClose, onApply }) {
  const [folderId, setFolderId] = useState(null);
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-stone-200">
          <h3 className="font-semibold text-stone-900">Move {count} contact{count > 1 ? "s" : ""} to folder</h3>
        </div>
        <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
          <button
            onClick={() => setFolderId(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${folderId === null ? "bg-stone-900 text-white" : "hover:bg-stone-100"}`}
          >
            — Root (no folder) —
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setFolderId(f.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${folderId === f.id ? "bg-stone-900 text-white" : "hover:bg-stone-100"}`}
              style={{ paddingLeft: `${12 + (countDepth(f.id, folders)) * 14}px` }}
            >
              {f.name}
            </button>
          ))}
        </div>
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button onClick={() => onApply(folderId)} className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800">
            Move
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileFoldersDrawer({ folders, contacts, selectedFolderId, onSelect, userId, onChange, onClose }) {
  return (
    <div className="fixed inset-0 z-[55] flex" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-72 max-w-[85vw] h-full overflow-y-auto p-3 shadow-2xl">
        <div className="text-sm font-semibold text-stone-800 px-2 py-2 mb-2">Folders</div>
        <FolderTree
          folders={folders}
          contacts={contacts}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          userId={userId}
          onChange={onChange}
        />
      </div>
      <div className="flex-1" />
    </div>
  );
}

/* helpers */
function countDepth(id, folders) {
  let d = 0;
  let cur = folders.find((f) => f.id === id);
  while (cur && cur.parent_id) {
    d++;
    cur = folders.find((f) => f.id === cur.parent_id);
    if (d > 10) break;
  }
  return d;
}

function stripTypeFromFilters(f) {
  const out = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === "type" && v === "all") continue;
    if (v) out[k] = v;
  }
  return out;
}

function filterLabel(k, v) {
  switch (k) {
    case "type": return `Type: ${v}`;
    case "country": return `Country: ${v}`;
    case "city": return `City: ${v}`;
    case "company": return `Company: ${v}`;
    case "tag": return `#${v}`;
    case "lastContactDays": return `No contact ${v}+ days`;
    case "createdSince": return `Created ≥ ${v}`;
    case "createdUntil": return `Created ≤ ${v}`;
    case "hasEmail": return v === "true" ? "Has email" : "No email";
    case "hasPhone": return v === "true" ? "Has phone" : "No phone";
    case "hasWebsite": return v === "true" ? "Has website" : "No website";
    default: return `${k}: ${v}`;
  }
}
