import React, { Fragment, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchContacts,
  fetchContactThumbs,
  createContact,
  updateContact,
  bulkDeleteContacts,
  bulkTagContacts,
  fetchTags,
  fetchFolders,
  moveContactsToFolder,
  CONTACT_TYPES,
} from "../../services/crmApi";
import { makeThumbnail } from "./utils/cardImage";
import { buildAlphabet, groupByLetter, scrollToLetter } from "./utils/alphabetIndex";
import { useRouteLoading } from "../../components/RouteLoadingContext";
import AlphabetIndex from "./components/AlphabetIndex";
import ContactDrawer from "./components/ContactDrawer";
import ContactFormModal from "./components/ContactFormModal";
import ScanCardModal from "./components/ScanCardModal";
import AttachCardModal from "./components/AttachCardModal";
import FolderTree from "./components/FolderTree";
import AdvancedFiltersDrawer, { EMPTY_FILTERS, countActiveFilters } from "./components/AdvancedFiltersDrawer";
import ImportContactsModal from "./components/ImportContactsModal";
import BroadcastEmailModal from "./components/BroadcastEmailModal";
import CardImageLightbox from "./components/CardImageLightbox";
import AssigneeFilter from "../../components/team/AssigneeFilter";
import MemberAvatar from "../../components/team/MemberAvatar";
import { useTeam } from "../../context/TeamContext";
import {
  Camera, Check, Folder, FolderInput, Loader2, Mail, MoreHorizontal, Plus, ScanLine,
  Search, SlidersHorizontal, Tag, Trash2, Upload, Users, X,
} from "lucide-react";

const SORTS = [
  { value: "name", label: "Name" },
  { value: "recent", label: "Recently updated" },
  { value: "contacted", label: "Last contacted" },
  { value: "won", label: "Most won" },
];
const SORT_KEY = "crm.contacts.sort";

const time = (iso) => (iso ? new Date(iso).getTime() || 0 : 0);

/** "Today" / "Yesterday" / "3 days ago" / "12 Mar" / "12 Mar 2024". */
export function lastContactLabel(iso, now = new Date()) {
  const t = time(iso);
  if (!t) return null;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(new Date(t))) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const d = new Date(t);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

/** Up to two initials from the first two words; works for Hebrew names too. */
export function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return words.slice(0, 2).map((w) => Array.from(w)[0].toUpperCase()).join("");
}

/** Stable avatar colour per name. */
export function avatarTone(name) {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 7;
}

const money = (n) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

// ---- Contacts list cache (stale-while-revalidate) -------------------------
// We persist the last successful response per (user × filter combo) in
// localStorage so re-opening the Contacts tab is instantaneous, even before
// the network roundtrip finishes. The cached data is then quietly refreshed
// in the background; the UI swaps in the fresh data when it arrives.
const CONTACTS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
// Bump CACHE_VERSION whenever the list payload shape changes (new
// columns/flags) so previously cached responses don't keep older rows
// alive without the new fields. v2 = adds `has_card_front` awareness.
const CACHE_VERSION = "v2";
const cacheKey = (userId, filterPayload) =>
  `crm.contactsCache.${CACHE_VERSION}.${userId || "anon"}.${JSON.stringify(filterPayload)}`;
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
  <span className="crm-dna-badge" title="Created from a public DNA page">DNA</span>
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
  // `initialLoading` is true ONLY until the very first fetch lands.
  // After that it stays false forever, even when `loading` flips back
  // to true for a fresh search / filter change. That way the route-
  // transition gem appears once on page entry but doesn't reappear on
  // every keystroke in the search box.
  const [initialLoading, setInitialLoading] = useState(true);
  useRouteLoading(initialLoading);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [advancedFilters, setAdvancedFilters] = useState({ ...EMPTY_FILTERS });
  // Sprint 3 — sales-rep visibility chip ("All / Mine / Unassigned / <rep>").
  // Persisted per-user so reps don't have to re-pick "Mine" every page load.
  const team = useTeam();
  const [assigneeFilter, setAssigneeFilter] = useState(() => {
    try { return localStorage.getItem("crm.contacts.assigneeFilter") || "all"; } catch { return "all"; }
  });
  useEffect(() => {
    try { localStorage.setItem("crm.contacts.assigneeFilter", assigneeFilter); } catch {}
  }, [assigneeFilter]);
  const [sort, setSort] = useState(() => {
    try {
      const saved = localStorage.getItem(SORT_KEY);
      return SORTS.some((s) => s.value === saved) ? saved : "name";
    } catch { return "name"; }
  });
  useEffect(() => {
    try { localStorage.setItem(SORT_KEY, sort); } catch {}
  }, [sort]);
  const searchRef = useRef(null);

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
  // When set, opens the "Attach business card" modal for a contact that
  // currently has no card on file. Click target is the empty thumb tile.
  const [attachCardContact, setAttachCardContact] = useState(null);

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
    // NOTE: `type` (the Lead/Buyer/Dealer pill) is *intentionally* not
    // sent to the server. We need every chip's count to stay correct as
    // the user clicks between them (`All (16)` shouldn't shrink to 8 the
    // moment they peek at "Lead"), so the contacts state must always
    // contain the whole result and the type filter is applied locally
    // in `filteredContacts`. The cache key therefore doesn't include
    // type either — switching pills is now a zero-fetch UI flip.
    const filterPayload = {
      search,
      folderId: selectedFolderId,
      assignedTo: assigneeFilter !== "all" ? assigneeFilter : undefined,
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

        // Lazy-load thumbnails. We deliberately DO NOT predicate on
        // `has_card_thumb` / `has_card_front` because those flags can
        // be stale (e.g. the localStorage list cache predates the
        // columns being added). The /thumbs endpoint itself filters to
        // rows that actually have image data, so the worst case is one
        // empty response. The endpoint coalesces thumb-or-front and
        // flags `needs_backfill` for legacy rows — we downscale those
        // locally and POST a real thumbnail back so the next visit is
        // small.
        const missingIds = fresh
          .filter((c) => !thumbCache[c.id])
          .map((c) => c.id);
        if (missingIds.length > 0) {
          fetchContactThumbs(missingIds)
            .then(async (rows) => {
              if (!rows.length) return;
              // Stage 1 — paint immediately with whatever the BE sent.
              setThumbCache((prev) => {
                const next = { ...prev };
                rows.forEach((r) => { if (r.thumb) next[r.id] = r.thumb; });
                if (user?.id) saveCache(thumbsCacheKey(user.id), next);
                return next;
              });
              // Stage 2 — backfill: downscale legacy fronts into proper
              // thumbnails and persist them so localStorage and future
              // batched calls don't carry the heavy original image.
              const toBackfill = rows.filter((r) => r.needs_backfill && r.thumb);
              if (toBackfill.length === 0) return;
              const generated = [];
              for (const r of toBackfill) {
                try {
                  const small = await makeThumbnail(r.thumb);
                  generated.push({ id: r.id, thumb: small });
                } catch (_) { /* skip on decode failure */ }
              }
              if (generated.length === 0) return;
              // Replace the heavy fronts in the local cache with the
              // small thumbnails (keeps localStorage well under quota).
              setThumbCache((prev) => {
                const next = { ...prev };
                generated.forEach((g) => { next[g.id] = g.thumb; });
                if (user?.id) saveCache(thumbsCacheKey(user.id), next);
                return next;
              });
              // Fire-and-forget: write the thumb back so subsequent
              // /thumbs requests don't have to return the full front.
              generated.forEach((g) => {
                updateContact(g.id, { cardImageThumb: g.thumb }).catch(() => {});
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
        // The first fetch has settled — release the route-transition
        // gem. Setting state to the same value is a no-op in React, so
        // subsequent refreshes don't churn.
        setInitialLoading(false);
      });
  }, [user?.id, search, selectedFolderId, advancedFilters, assigneeFilter, thumbCache]);

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
  }, [user?.id, search, selectedFolderId, advancedFilters, assigneeFilter, reload]);

  // Apply the Lead/Buyer/Dealer pill *here* (client-side) so the contacts
  // state always contains the full set the server matched on search /
  // folder / assignee. That's what keeps every chip's count accurate even
  // when one of them is the active filter (previously clicking "Lead"
  // collapsed `All` to 8 because the server-side type filter shrank the
  // dataset the counts were derived from).
  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (typeFilter && typeFilter !== "all") {
      list = list.filter((c) => c.type === typeFilter);
    }
    if (tagFilter) {
      list = list.filter((c) => Array.isArray(c.tags) && c.tags.includes(tagFilter));
    }
    return list;
  }, [contacts, typeFilter, tagFilter]);

  // A-Z / א-ת jump index data. Sort by the first letter of `name`,
  // then alphabetically inside each bucket, and pre-compute the
  // sectioned groups so the table can render letter dividers between
  // them without re-grouping on every render.
  const { contactGroups, alphabetLetters, alphabetPresent } = useMemo(() => {
    const getName = (c) => c.name || "";
    const { groups } = groupByLetter(filteredContacts, getName);
    const { letters, present } = buildAlphabet(filteredContacts, getName);
    return {
      contactGroups: groups,
      alphabetLetters: letters,
      alphabetPresent: present,
    };
  }, [filteredContacts]);

  // Section headers + the A-Z jump strip only add value once there are
  // *multiple* letter groups to navigate between. After a tight search
  // ("Kes" → 1 contact under K) they just clutter the layout — especially
  // on mobile, where the thin sticky banner used to bleed the card avatar
  // through behind it and read as "broken". iOS Contacts hides both
  // affordances in this case for the same reason.
  const byName = sort === "name";
  const showSectionHeaders = byName && contactGroups.length > 1;
  const showAlphabetIndex = showSectionHeaders;
  // Any other order is one flat list: letter sections only make sense A–Z.
  const rowGroups = useMemo(() => {
    if (byName) return contactGroups;
    const list = [...filteredContacts];
    if (sort === "recent") list.sort((a, b) => time(b.updated_at) - time(a.updated_at));
    if (sort === "contacted") list.sort((a, b) => time(b.last_contact_at) - time(a.last_contact_at));
    if (sort === "won") list.sort((a, b) => Number(b.total_won || 0) - Number(a.total_won || 0));
    return [{ letter: "all", items: list }];
  }, [byName, contactGroups, filteredContacts, sort]);

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

  // "/" jumps to search; Esc clears the search, then the selection.
  const anyOverlay = showForm || showScan || showFilters || showImport || showBroadcast || showFoldersMobile
    || showMoveFolder || showTagModal || !!drawerId || !!cardLightbox || !!attachCardContact;
  useEffect(() => {
    if (anyOverlay) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/" && !isTyping(document.activeElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        if (showActionsMenu) setShowActionsMenu(false);
        else if (document.activeElement === searchRef.current && search) setSearch("");
        else if (selected.size > 0) setSelected(new Set());
        else if (document.activeElement === searchRef.current) searchRef.current.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyOverlay, search, selected.size, showActionsMenu]);

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

  const hasFilter = !!(tagFilter || search || typeFilter !== "all" || selectedFolderId || activeFiltersCount > 0);
  const allSelected = filteredContacts.length > 0 && selected.size === filteredContacts.length;
  const showTeam = team.ready && team.members.length > 1;
  const folderName = selectedFolderId === "unfiled"
    ? "Unfiled"
    : (folders.find((f) => f.id === selectedFolderId)?.name || "Folder");
  const openCard = (c) => setCardLightbox({ contactId: c.id, name: c.name, hasBack: !!c.has_card_back });
  const assignee = (c) => (c.assigned_to ? team.membersByClerkId[c.assigned_to] : null);
  const metaLine = (c) => [c.title, c.company].filter(Boolean).join(" · ");

  return (
    <div className="crm-split">
      <aside className="crm-side">
        <FolderTree
          folders={folders}
          contacts={contacts}
          selectedFolderId={selectedFolderId}
          onSelect={(id) => setSelectedFolderId(id)}
          userId={user?.id}
          onChange={() => { reload(); reloadSidebars(); }}
        />
      </aside>

      <div className="crm-main">
        <div className="crm-toolbar">
          <div className="crm-search">
            <Search size={16} strokeWidth={2} className="crm-search-icon" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts"
              aria-label="Search contacts"
              className="crm-search-input"
            />
            <span className="crm-search-end">
              {search ? (
                <button type="button" className="crm-icon-btn crm-icon-btn--sm" onClick={() => { setSearch(""); searchRef.current?.focus(); }} aria-label="Clear search">
                  <X size={14} strokeWidth={2.2} />
                </button>
              ) : (
                <kbd className="crm-kbd crm-hide-sm">/</kbd>
              )}
            </span>
          </div>
          <div className="crm-toolbar-actions">
            <button type="button" className="crm-btn crm-btn--quiet crm-folders-btn" onClick={() => setShowFoldersMobile(true)} aria-label="Folders">
              <Folder size={16} strokeWidth={1.9} />
              <span className="crm-btn-label">{selectedFolderId ? folderName : "Folders"}</span>
            </button>
            <button
              type="button"
              className="crm-btn crm-btn--quiet"
              onClick={() => setShowFilters(true)}
              aria-pressed={activeFiltersCount > 0}
              aria-label={activeFiltersCount > 0 ? `Filters, ${activeFiltersCount} active` : "Filters"}
            >
              <SlidersHorizontal size={16} strokeWidth={1.9} />
              <span className="crm-btn-label">Filters</span>
              {activeFiltersCount > 0 && <span className="crm-badge">{activeFiltersCount}</span>}
            </button>
            <div className="crm-menu-anchor">
              <button
                type="button"
                className="crm-icon-btn"
                onClick={() => setShowActionsMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={showActionsMenu}
                aria-label="More actions"
              >
                <MoreHorizontal size={18} strokeWidth={1.9} />
              </button>
              {showActionsMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowActionsMenu(false)} />
                  <div className="crm-menu" role="menu">
                    <button type="button" role="menuitem" className="crm-menu-item" onClick={() => { setShowImport(true); setShowActionsMenu(false); }}>
                      <Upload size={16} strokeWidth={1.9} /> Import contacts
                    </button>
                    <button type="button" role="menuitem" className="crm-menu-item" onClick={() => { setShowBroadcast(true); setShowActionsMenu(false); }}>
                      <Mail size={16} strokeWidth={1.9} /> Email broadcast
                    </button>
                  </div>
                </>
              )}
            </div>
            <button type="button" className="crm-btn" onClick={() => setShowScan(true)} aria-label="Scan business card">
              <ScanLine size={16} strokeWidth={1.9} />
              <span className="crm-btn-label">Scan card</span>
            </button>
            <button type="button" className="crm-btn crm-btn--primary" onClick={() => setShowForm(true)}>
              <Plus size={16} strokeWidth={2.2} />
              New contact
            </button>
          </div>
        </div>

        <div className="crm-filterrow">
          <div className="crm-chips crm-chips--fade" role="group" aria-label="Filter by type and tag">
            <button type="button" className="crm-chip" aria-pressed={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
              All <span className="crm-chip-count">{counts.all || 0}</span>
            </button>
            {CONTACT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className="crm-chip"
                aria-pressed={typeFilter === t.value}
                onClick={() => setTypeFilter(typeFilter === t.value ? "all" : t.value)}
              >
                <span className={`crm-dot crm-dot--${t.value}`} aria-hidden="true" />
                {t.label} <span className="crm-chip-count">{counts[t.value] || 0}</span>
              </button>
            ))}
            {tags.length > 0 && <span className="crm-chips-sep" aria-hidden="true" />}
            {tags.map((t) => (
              <button
                key={t.tag}
                type="button"
                className="crm-chip"
                aria-pressed={tagFilter === t.tag}
                onClick={() => setTagFilter(tagFilter === t.tag ? null : t.tag)}
                aria-label={`Tag ${t.tag}, ${t.count}`}
              >
                <Tag size={12} strokeWidth={2} aria-hidden="true" />
                {t.tag} <span className="crm-chip-count">{t.count}</span>
              </button>
            ))}
          </div>
          <div className="crm-filterrow-end">
            <select className="crm-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort contacts">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <AssigneeFilter value={assigneeFilter} onChange={setAssigneeFilter} align="right" />
          </div>
        </div>

        {(selectedFolderId || tagFilter || activeFiltersCount > 0) && (
          <div className="crm-active">
            <span className="crm-active-label">Showing</span>
            {selectedFolderId && (
              <ActiveChip onRemove={() => setSelectedFolderId(null)} label={`folder ${folderName}`}>
                <Folder size={12} strokeWidth={2} aria-hidden="true" /> {folderName}
              </ActiveChip>
            )}
            {tagFilter && (
              <ActiveChip onRemove={() => setTagFilter(null)} label={`tag ${tagFilter}`}>#{tagFilter}</ActiveChip>
            )}
            {Object.entries(advancedFilters).map(([k, v]) => {
              if (!v || (k === "type" && v === "all")) return null;
              return (
                <ActiveChip key={k} label={filterLabel(k, v)} onRemove={() => setAdvancedFilters({ ...advancedFilters, [k]: k === "type" ? "all" : "" })}>
                  {filterLabel(k, v)}
                </ActiveChip>
              );
            })}
            <button
              type="button"
              className="crm-btn crm-btn--quiet crm-btn--sm"
              onClick={() => { setSelectedFolderId(null); setTagFilter(null); setAdvancedFilters({}); }}
            >
              Clear all
            </button>
          </div>
        )}

        {refreshing && !loading && (
          <div className="crm-refresh" role="status">
            <Loader2 size={12} className="crm-spin" aria-hidden="true" /> Updating…
          </div>
        )}

        <div className="crm-listrow">
          <div className="crm-panel">
            {loading ? (
              <div aria-busy="true" aria-label="Loading contacts">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="crm-sk-row">
                    <span className="crm-sk" style={{ width: 34, height: 34, borderRadius: "50%" }} />
                    <span className="crm-sk" style={{ height: 12, width: `${55 + ((i * 17) % 35)}%` }} />
                    <span className="crm-sk" style={{ height: 12 }} />
                    <span className="crm-sk" style={{ height: 12 }} />
                    <span className="crm-sk" style={{ height: 12 }} />
                    <span className="crm-sk" style={{ height: 12 }} />
                  </div>
                ))}
              </div>
            ) : filteredContacts.length === 0 ? (
              <EmptyState
                hasFilter={hasFilter}
                onCreate={() => setShowForm(true)}
                onScan={() => setShowScan(true)}
                onClear={() => {
                  setSearch(""); setTypeFilter("all"); setTagFilter(null);
                  setSelectedFolderId(null); setAdvancedFilters({});
                }}
              />
            ) : (
              <>
                <table className="crm-table hidden md:table">
                  <thead>
                    <tr>
                      <th className="crm-col-check">
                        <input
                          type="checkbox"
                          className="crm-check"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected; }}
                          onChange={selectAll}
                          aria-label={allSelected ? "Deselect all" : `Select all ${filteredContacts.length}`}
                        />
                      </th>
                      <th>Name</th>
                      <th className="crm-col-card hidden xl:table-cell">Card</th>
                      <th>Type</th>
                      <th className="hidden 2xl:table-cell">Tags</th>
                      <th>Phone</th>
                      <th className="hidden xl:table-cell">Email</th>
                      <th className="hidden 2xl:table-cell">Last contact</th>
                      <th className="crm-r" style={{ paddingRight: 16 }}>Won</th>
                    </tr>
                  </thead>
                  {/* One tbody per letter: a sticky header row is held inside
                      its own section, so the next letter pushes it out. */}
                  {rowGroups.map((g) => (
                      <tbody key={g.letter}>
                        {showSectionHeaders && (
                          <tr className="crm-letter-row" data-letter-section={g.letter}>
                            <th colSpan={9} scope="rowgroup" className="crm-letter">{g.letter}</th>
                          </tr>
                        )}
                        {g.items.map((c) => {
                          const isSel = selected.has(c.id);
                          const meta = metaLine(c);
                          const contacted = lastContactLabel(c.last_contact_at);
                          const tagList = Array.isArray(c.tags) ? c.tags : [];
                          return (
                            <tr key={c.id} className="crm-row" aria-selected={isSel} onClick={() => setDrawerId(String(c.id))}>
                              <td className="crm-col-check" onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}>
                                <input
                                  type="checkbox"
                                  className="crm-check"
                                  checked={isSel}
                                  onChange={() => toggleSelect(c.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Select ${c.name}`}
                                />
                              </td>
                              <td>
                                <div className="crm-person">
                                  <span className="crm-avatar" data-tone={avatarTone(c.name)} aria-hidden="true">{initials(c.name)}</span>
                                  <div className="crm-person-text">
                                    <div className="crm-name-line">
                                      <span className="crm-name">{c.name}</span>
                                      {c.source === "dna_lead" && <DnaBadge />}
                                      {showTeam && (
                                        <MemberAvatar
                                          member={assignee(c)}
                                          size="xs"
                                          ring={false}
                                          tooltip={c.assigned_to ? `Assigned to ${assignee(c)?.name || "team member"}` : "Unassigned"}
                                        />
                                      )}
                                    </div>
                                    {c.source === "dna_lead" && c.dna_sku ? (
                                      <span className="crm-meta crm-meta--accent">From DNA · {c.dna_sku}</span>
                                    ) : meta ? (
                                      <span className="crm-meta">{meta}</span>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              <td className="crm-col-card hidden xl:table-cell">
                                <CardThumb contact={c} thumb={thumbCache[c.id]} onOpen={() => openCard(c)} onAdd={() => setAttachCardContact(c)} />
                              </td>
                              <td>
                                <span className="crm-type">
                                  <span className={`crm-dot crm-dot--${c.type}`} aria-hidden="true" />
                                  {c.type}
                                </span>
                              </td>
                              <td className="hidden 2xl:table-cell">
                                {tagList.length > 0 ? (
                                  <span className="crm-tags">
                                    {tagList.slice(0, 2).map((t) => <span key={t} className="crm-tag">{t}</span>)}
                                    {tagList.length > 2 && <span className="crm-more">+{tagList.length - 2}</span>}
                                  </span>
                                ) : <span className="crm-muted">—</span>}
                              </td>
                              <td>
                                {c.phone ? (
                                  <a className="crm-link" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} onClick={(e) => e.stopPropagation()}>{c.phone}</a>
                                ) : <span className="crm-muted">—</span>}
                              </td>
                              <td className="hidden xl:table-cell">
                                {c.email ? (
                                  <a className="crm-link crm-ellipsis" href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} title={c.email}>{c.email}</a>
                                ) : <span className="crm-muted">—</span>}
                              </td>
                              <td className="hidden 2xl:table-cell">
                                {contacted || <span className="crm-muted">Never</span>}
                              </td>
                              <td className="crm-r" style={{ paddingRight: 16 }}>
                                {Number(c.total_won) > 0 ? <span className="crm-money">{money(c.total_won)}</span> : <span className="crm-muted">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                  ))}
                </table>

                {/* Phone list. Letter dividers scroll with the rows here:
                    pinned, they covered the first contact of each section. */}
                <div className="md:hidden">
                  {rowGroups.map((g) => (
                    <Fragment key={g.letter}>
                      {showSectionHeaders && (
                        <div className="crm-letter" data-letter-section={g.letter}>{g.letter}</div>
                      )}
                      {g.items.map((c) => {
                        const isSel = selected.has(c.id);
                        const meta = metaLine(c);
                        return (
                          <div
                            key={c.id}
                            className="crm-mrow"
                            role="button"
                            tabIndex={0}
                            data-selected={isSel}
                            onClick={() => (selected.size > 0 ? toggleSelect(c.id) : setDrawerId(String(c.id)))}
                            onKeyDown={(e) => { if (e.key === "Enter") setDrawerId(String(c.id)); }}
                          >
                            <button
                              type="button"
                              className="crm-avatar-btn"
                              onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                              aria-label={isSel ? `Deselect ${c.name}` : `Select ${c.name}`}
                              aria-pressed={isSel}
                            >
                              <span className={`crm-avatar${isSel ? " crm-avatar--on" : ""}`} data-tone={avatarTone(c.name)}>
                                {isSel ? <Check size={18} strokeWidth={2.6} /> : initials(c.name)}
                              </span>
                            </button>
                            <div className="crm-person-text">
                              <div className="crm-name-line">
                                <span className="crm-name">{c.name}</span>
                                {c.source === "dna_lead" && <DnaBadge />}
                                {showTeam && <MemberAvatar member={assignee(c)} size="xs" ring={false} />}
                              </div>
                              {meta && <span className="crm-meta">{meta}</span>}
                              <span className="crm-meta">
                                <span className="crm-type">
                                  <span className={`crm-dot crm-dot--${c.type}`} aria-hidden="true" />
                                  {c.type}
                                </span>
                                {Array.isArray(c.tags) && c.tags.length > 0 && <> · {c.tags.slice(0, 2).join(", ")}</>}
                              </span>
                            </div>
                            <div className="crm-mrow-end">
                              {Number(c.total_won) > 0 && <span className="crm-money crm-num">{money(c.total_won)}</span>}
                              <CardThumb contact={c} thumb={thumbCache[c.id]} onOpen={() => openCard(c)} onAdd={() => setAttachCardContact(c)} />
                            </div>
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </>
            )}
          </div>
          {!loading && filteredContacts.length > 0 && showAlphabetIndex && (
            <AlphabetIndex letters={alphabetLetters} present={alphabetPresent} onJump={scrollToLetter} />
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="crm-selbar" role="toolbar" aria-label="Selected contacts">
          <button type="button" className="crm-icon-btn" onClick={clearSelection} aria-label="Clear selection">
            <X size={16} strokeWidth={2.2} />
          </button>
          <span className="crm-selbar-count"><b>{selected.size}</b> selected</span>
          {!allSelected && (
            <button type="button" className="crm-btn crm-btn--quiet crm-btn--sm crm-hide-sm" onClick={selectAll}>
              Select all {filteredContacts.length}
            </button>
          )}
          <span className="crm-selbar-sep" aria-hidden="true" />
          <button type="button" className="crm-btn crm-btn--quiet crm-btn--sm" onClick={() => setShowTagModal(true)} aria-label="Tag">
            <Tag size={15} strokeWidth={1.9} /><span className="crm-btn-label">Tag</span>
          </button>
          <button type="button" className="crm-btn crm-btn--quiet crm-btn--sm" onClick={() => setShowMoveFolder(true)} aria-label="Move to folder">
            <FolderInput size={15} strokeWidth={1.9} /><span className="crm-btn-label">Move</span>
          </button>
          <button type="button" className="crm-btn crm-btn--quiet crm-btn--sm" onClick={() => setShowBroadcast(true)} aria-label="Email">
            <Mail size={15} strokeWidth={1.9} /><span className="crm-btn-label">Email</span>
          </button>
          <button type="button" className="crm-btn crm-btn--danger crm-btn--sm" onClick={handleBulkDelete} aria-label="Delete">
            <Trash2 size={15} strokeWidth={1.9} /><span className="crm-btn-label">Delete</span>
          </button>
        </div>
      )}

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
      {attachCardContact && (
        <AttachCardModal
          contact={attachCardContact}
          onClose={() => setAttachCardContact(null)}
          onSaved={({ contact: updated, thumb }) => {
            // Optimistic local update: flip the contact's flags so the
            // thumb cell switches from "+" to a real image immediately,
            // and feed the thumbnail straight into the cache (also
            // persists it for the next page load).
            const targetId = attachCardContact.id;
            setContacts((prev) =>
              prev.map((c) =>
                c.id === targetId
                  ? {
                      ...c,
                      has_card_front: !!updated?.card_image_front || c.has_card_front,
                      has_card_back: !!updated?.card_image_back || c.has_card_back,
                      has_card_thumb: !!thumb || !!updated?.card_image_thumb || c.has_card_thumb,
                    }
                  : c
              )
            );
            if (thumb) {
              setThumbCache((prev) => {
                const next = { ...prev, [targetId]: thumb };
                if (user?.id) saveCache(thumbsCacheKey(user.id), next);
                return next;
              });
            }
          }}
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

const ActiveChip = ({ children, label, onRemove }) => (
  <button type="button" className="crm-chip crm-chip--sm" aria-pressed="true" onClick={onRemove} aria-label={`Remove ${label}`}>
    {children}
    <span className="crm-chip-x" aria-hidden="true"><X size={12} strokeWidth={2.4} /></span>
  </button>
);

const EmptyState = ({ hasFilter, onCreate, onScan, onClear }) => (
  <div className="crm-state">
    <Users size={40} strokeWidth={1.4} className="crm-state-icon" aria-hidden="true" />
    <h3 className="crm-state-title">{hasFilter ? "No matching contacts" : "No contacts yet"}</h3>
    <p className="crm-state-text">
      {hasFilter
        ? "Nothing matches this search and these filters."
        : "Add your first lead, buyer or supplier, or scan a business card."}
    </p>
    <div className="crm-state-actions">
      {hasFilter ? (
        <button type="button" className="crm-btn" onClick={onClear}>Clear search and filters</button>
      ) : (
        <>
          <button type="button" className="crm-btn" onClick={onScan}><ScanLine size={16} strokeWidth={1.9} /> Scan card</button>
          <button type="button" className="crm-btn crm-btn--primary" onClick={onCreate}><Plus size={16} strokeWidth={2.2} /> New contact</button>
        </>
      )}
    </div>
  </div>
);

function CardThumb({ contact, thumb, onOpen, onAdd }) {
  const hasFront = contact.has_card_front || contact.has_card_thumb || !!thumb;
  if (!hasFront) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onAdd?.(); }}
        className="crm-card-thumb crm-card-thumb--empty"
        title="Add business card"
        aria-label={`Add business card for ${contact.name}`}
      >
        <Camera size={14} strokeWidth={1.8} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className="crm-card-thumb"
      title="View business card"
      aria-label={`View business card for ${contact.name}`}
    >
      {thumb ? <img src={thumb} alt="" /> : <ScanLine size={14} strokeWidth={1.8} />}
      {contact.has_card_back && <span className="crm-card-thumb-2" title="Has back side">2</span>}
    </button>
  );
}

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function Dialog({ title, onClose, children, footer }) {
  useEscape(onClose);
  return (
    <div className="crm-scrim" onClick={onClose}>
      <div className="crm-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="crm-dialog-head">
          <h3 className="crm-dialog-title">{title}</h3>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Close"><X size={18} strokeWidth={2} /></button>
        </div>
        <div className="crm-dialog-body">{children}</div>
        <div className="crm-dialog-foot">{footer}</div>
      </div>
    </div>
  );
}

function BulkTagModal({ existingTags, onClose, onApply, count }) {
  const [tag, setTag] = useState("");
  const [mode, setMode] = useState("add");
  const value = tag.trim();
  const submit = () => { if (value) onApply(value, mode); };

  return (
    <Dialog
      title={`Tag ${count} contact${count > 1 ? "s" : ""}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="crm-btn crm-btn--quiet" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={`crm-btn ${mode === "add" ? "crm-btn--primary" : "crm-btn--danger"}`}
            onClick={submit}
            disabled={!value}
          >
            {mode === "add" ? "Add tag" : "Remove tag"}
          </button>
        </>
      )}
    >
      <div className="crm-seg" role="radiogroup" aria-label="Action">
        <button type="button" role="radio" aria-checked={mode === "add"} onClick={() => setMode("add")}>Add tag</button>
        <button type="button" role="radio" aria-checked={mode === "remove"} onClick={() => setMode("remove")}>Remove tag</button>
      </div>
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="e.g. VIP, Tucson 2026, Hot lead"
        aria-label="Tag"
        className="crm-input"
        style={{ marginTop: 14 }}
        autoFocus
      />
      {existingTags.length > 0 && (
        <>
          <div className="crm-dialog-label">Existing tags</div>
          <div className="crm-chips" style={{ flexWrap: "wrap" }}>
            {existingTags.map((t) => (
              <button key={t} type="button" className="crm-chip crm-chip--sm" aria-pressed={value === t} onClick={() => setTag(t)}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}

function MoveToFolderModal({ folders, count, onClose, onApply }) {
  const [folderId, setFolderId] = useState(null);
  return (
    <Dialog
      title={`Move ${count} contact${count > 1 ? "s" : ""}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="crm-btn crm-btn--quiet" onClick={onClose}>Cancel</button>
          <button type="button" className="crm-btn crm-btn--primary" onClick={() => onApply(folderId)}>Move</button>
        </>
      )}
    >
      <div className="crm-pick-list" role="radiogroup" aria-label="Folder">
        <button type="button" role="radio" aria-checked={folderId === null} className="crm-pick" onClick={() => setFolderId(null)}>
          <Users size={16} strokeWidth={1.9} /> No folder
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={folderId === f.id}
            className="crm-pick"
            onClick={() => setFolderId(f.id)}
            style={{ paddingLeft: 12 + countDepth(f.id, folders) * 16 }}
          >
            <Folder size={16} strokeWidth={1.9} /> {f.name}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function MobileFoldersDrawer({ folders, contacts, selectedFolderId, onSelect, userId, onChange, onClose }) {
  useEscape(onClose);
  return (
    <>
      <div className="crm-drawer-scrim" onClick={onClose} />
      <div className="crm-drawer" role="dialog" aria-modal="true" aria-label="Folders">
        <FolderTree
          folders={folders}
          contacts={contacts}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          userId={userId}
          onChange={onChange}
        />
      </div>
    </>
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
