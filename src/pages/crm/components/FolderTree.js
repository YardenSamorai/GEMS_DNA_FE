import React, { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { createFolder, updateFolder, deleteFolder } from "../../../services/crmApi";

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
    <div className="space-y-0.5">
      {/* All */}
      <FolderRow
        active={!selectedFolderId}
        onClick={() => onSelect(null)}
        label="All contacts"
        count={totalContacts}
        icon={(
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        )}
      />
      <FolderRow
        active={selectedFolderId === "unfiled"}
        onClick={() => onSelect("unfiled")}
        label="Unfiled"
        count={unfiledCount}
        muted
        icon={(
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14-7H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z" /></svg>
        )}
      />

      <div className="pt-1.5 mt-1.5 border-t border-stone-200">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-500">Folders</span>
          <button onClick={() => handleCreate(null)} className="text-stone-500 hover:text-stone-900 p-1 rounded hover:bg-stone-100" title="New folder">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        {tree.length === 0 && (
          <div className="px-3 py-3 text-xs text-stone-400 italic">No folders yet</div>
        )}
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
      </div>
    </div>
  );
}

function FolderNode({ node, depth, selectedId, onSelect, onCreate, onRename, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const active = selectedId === node.id;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 pr-2 rounded-md cursor-pointer ${active ? "bg-stone-900 text-white" : "hover:bg-stone-100 text-stone-700"}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className={`p-0.5 rounded ${active ? "hover:bg-white/20" : "hover:bg-stone-200"}`}
          >
            <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20"><path d="M6 4l8 6-8 6V4z" /></svg>
          </button>
        ) : (
          <div className="w-4" />
        )}
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
        <div className="flex-1 py-1 text-sm truncate">{node.name}</div>
        {node.direct_count > 0 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-stone-200 text-stone-600"}`}>{node.direct_count}</span>
        )}
        <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${active ? "" : ""}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onCreate(node.id); }}
            title="Add sub-folder"
            className={`p-0.5 rounded ${active ? "hover:bg-white/20" : "hover:bg-stone-200"}`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRename(node); }}
            title="Rename"
            className={`p-0.5 rounded ${active ? "hover:bg-white/20" : "hover:bg-stone-200"}`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node); }}
            title="Delete"
            className={`p-0.5 rounded ${active ? "hover:bg-white/20 text-rose-200" : "hover:bg-rose-100 text-rose-600"}`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
          </button>
        </div>
      </div>
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

const FolderRow = ({ active, onClick, label, count, icon, muted }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
      active ? "bg-stone-900 text-white" : muted ? "text-stone-500 hover:bg-stone-100" : "text-stone-700 hover:bg-stone-100"
    }`}
  >
    {icon}
    <span className="flex-1 text-left truncate">{label}</span>
    {count != null && (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-stone-200 text-stone-600"}`}>{count}</span>
    )}
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
