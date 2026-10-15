import React, { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import { ChevronRight, EyeOff, Folder, FolderOpen, FolderPlus, Inbox, Pencil, Plus, Trash2, Users } from "lucide-react";
import { createFolder, updateFolder, deleteFolder } from "../../../services/crmApi";

// Per-user UI prefs for the virtual "Unfiled" pseudo-folder.
// Stored in localStorage because it's purely a display preference.
const unfiledPrefsKey = (userId) => `crm.unfiledPrefs.${userId || "anon"}`;
const loadUnfiledPrefs = (userId) => {
  try {
    const raw = localStorage.getItem(unfiledPrefsKey(userId));
    if (!raw) return { label: "Unfiled", hidden: false };
    const parsed = JSON.parse(raw);
    return { label: parsed.label || "Unfiled", hidden: !!parsed.hidden };
  } catch { return { label: "Unfiled", hidden: false }; }
};
const saveUnfiledPrefs = (userId, prefs) => {
  try { localStorage.setItem(unfiledPrefsKey(userId), JSON.stringify(prefs)); } catch {}
};

/**
 * Hierarchical folder tree.
 * Props:
 *   folders: [{ id, name, parent_id, direct_count }]
 *   selectedFolderId: number | 'unfiled' | null
 *   onSelect: (id|null|'unfiled') => void
 *   userId
 *   onChange: () => void  (called after create/rename/delete to refresh)
 */
export default function FolderTree({ folders, contacts = [], selectedFolderId, onSelect, userId, onChange }) {
  const tree = useMemo(() => buildTree(folders), [folders]);
  // Total = real contacts list length (preferred). Falls back to summing folder counts
  // if for some reason contacts weren't passed.
  const totalContacts = useMemo(() => {
    if (Array.isArray(contacts) && contacts.length > 0) return contacts.length;
    return folders.reduce((s, f) => s + (f.direct_count || 0), 0);
  }, [contacts, folders]);
  const unfiledCount = useMemo(
    () => contacts.filter((c) => !c.folder_id).length,
    [contacts]
  );

  // Per-user "Unfiled" label/visibility prefs
  const [unfiledPrefs, setUnfiledPrefs] = useState(() => loadUnfiledPrefs(userId));
  useEffect(() => { setUnfiledPrefs(loadUnfiledPrefs(userId)); }, [userId]);

  const handleUnfiledRename = () => {
    const next = prompt("Rename this group", unfiledPrefs.label || "Unfiled");
    if (next == null) return;
    const trimmed = next.trim() || "Unfiled";
    const updated = { ...unfiledPrefs, label: trimmed };
    setUnfiledPrefs(updated);
    saveUnfiledPrefs(userId, updated);
    toast.success("Renamed");
  };

  const handleUnfiledHide = () => {
    if (!window.confirm(`Hide "${unfiledPrefs.label || "Unfiled"}" from the sidebar?\n\nContacts without a folder will still be visible under "All contacts". You can show this row again from the Folders menu.`)) return;
    const updated = { ...unfiledPrefs, hidden: true };
    setUnfiledPrefs(updated);
    saveUnfiledPrefs(userId, updated);
    if (selectedFolderId === "unfiled") onSelect(null);
    toast.success("Hidden");
  };

  const handleUnfiledShow = () => {
    const updated = { ...unfiledPrefs, hidden: false };
    setUnfiledPrefs(updated);
    saveUnfiledPrefs(userId, updated);
  };

  const handleCreate = async (parentId) => {
    const name = prompt(parentId ? "New sub-folder name" : "New folder name");
    if (!name?.trim()) return;
    try {
      await createFolder({ userId, name: name.trim(), parentId: parentId || null });
      toast.success("Folder created");
      onChange?.();
    } catch (e) { toast.error(e.message); }
  };

  const handleRename = async (folder) => {
    const name = prompt("Rename folder", folder.name);
    if (!name?.trim() || name === folder.name) return;
    try {
      await updateFolder(folder.id, { name: name.trim() });
      toast.success("Renamed");
      onChange?.();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (folder) => {
    if (!window.confirm(`Delete "${folder.name}"? Contacts inside will move to root. Sub-folders will be deleted.`)) return;
    try {
      await deleteFolder(folder.id);
      toast.success("Folder deleted");
      onChange?.();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <nav aria-label="Contact lists">
      <div className="crm-side-section">Contacts</div>
      <FolderRow
        active={!selectedFolderId}
        onClick={() => onSelect(null)}
        label="All contacts"
        count={totalContacts}
        Icon={Users}
      />
      {!unfiledPrefs.hidden && (
        <FolderRow
          active={selectedFolderId === "unfiled"}
          onClick={() => onSelect("unfiled")}
          label={unfiledPrefs.label || "Unfiled"}
          count={unfiledCount}
          Icon={Inbox}
          actions={
            <>
              <RowAction label="Rename" Icon={Pencil} onClick={handleUnfiledRename} />
              <RowAction label="Hide from sidebar" Icon={EyeOff} onClick={handleUnfiledHide} />
            </>
          }
        />
      )}

      <div className="crm-side-section">
        <span>Folders</span>
        <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {unfiledPrefs.hidden && (
            <button type="button" onClick={handleUnfiledShow} className="crm-side-link">
              Show {unfiledPrefs.label || "Unfiled"}
            </button>
          )}
          <button type="button" onClick={() => handleCreate(null)} className="crm-icon-btn crm-icon-btn--sm" aria-label="New folder" title="New folder">
            <FolderPlus size={15} strokeWidth={1.9} />
          </button>
        </span>
      </div>
      {tree.length === 0 && <div className="crm-side-empty">No folders yet</div>}
      {tree.map((node) => (
          <FolderNode
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedFolderId}
            onSelect={onSelect}
            onCreate={handleCreate}
            onRename={handleRename}
          onDelete={handleDelete}
        />
      ))}
    </nav>
  );
}

function FolderNode({ node, depth, selectedId, onSelect, onCreate, onRename, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <FolderRow
        active={selectedId === node.id}
        onClick={() => onSelect(node.id)}
        label={node.name}
        count={node.direct_count > 0 ? node.direct_count : null}
        Icon={expanded && hasChildren ? FolderOpen : Folder}
        indent={depth * 14}
        twisty={
          hasChildren ? (
            <button
              type="button"
              className="crm-side-twisty"
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            >
              <ChevronRight size={12} strokeWidth={2.4} />
            </button>
          ) : (
            <span style={{ width: 12, flex: "none" }} />
          )
        }
        actions={
          <>
            <RowAction label="Add sub-folder" Icon={Plus} onClick={() => onCreate(node.id)} />
            <RowAction label="Rename" Icon={Pencil} onClick={() => onRename(node)} />
            <RowAction label="Delete" Icon={Trash2} onClick={() => onDelete(node)} danger />
          </>
        }
      />
      {hasChildren && expanded && node.children.map((child) => (
        <FolderNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

/* One source-list row. A div with role="button" so the hover actions can be real buttons inside it. */
const FolderRow = ({ active, onClick, label, count, Icon, actions, twisty, indent = 0 }) => (
  <div
    role="button"
    tabIndex={0}
    aria-current={active ? "true" : undefined}
    className="crm-side-row"
    style={indent ? { paddingLeft: 10 + indent } : undefined}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
    }}
  >
    {twisty}
    <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
    <span className="crm-side-label">{label}</span>
    {count != null && <span className="crm-side-count">{count}</span>}
    {actions && <span className="crm-side-actions">{actions}</span>}
  </div>
);

const RowAction = ({ label, Icon, onClick, danger }) => (
  <button
    type="button"
    className={`crm-icon-btn crm-icon-btn--sm${danger ? " crm-icon-btn--danger" : ""}`}
    aria-label={label}
    title={label}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
  >
    <Icon size={13} strokeWidth={2} />
  </button>
);

function buildTree(folders) {
  const byId = new Map();
  for (const f of folders) byId.set(f.id, { ...f, children: [] });
  const roots = [];
  for (const f of byId.values()) {
    if (f.parent_id && byId.has(f.parent_id)) {
      byId.get(f.parent_id).children.push(f);
    } else {
      roots.push(f);
    }
  }
  const sortRec = (arr) => {
    arr.sort((a, b) => a.name.localeCompare(b.name));
    for (const a of arr) sortRec(a.children);
  };
  sortRec(roots);
  return roots;
}
