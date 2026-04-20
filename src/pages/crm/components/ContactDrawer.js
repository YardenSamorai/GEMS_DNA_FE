import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchContact,
  updateContact,
  deleteContact,
  createInteraction,
  createTask,
  updateTask,
  verifyBusiness,
  CONTACT_TYPES,
  INTERACTION_TYPES,
  DEAL_STAGES,
} from "../../../services/crmApi";
import ContactFormModal from "./ContactFormModal";

const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "—");
const timeAgo = (d) => {
  if (!d) return "";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function ContactDrawer({ contactId, onClose, onChanged }) {
  const { user } = useUser();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("activity");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = async () => {
    if (!user?.id || !contactId) return;
    setLoading(true);
    try {
      const data = await fetchContact(user.id, contactId);
      setContact(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [contactId, user?.id]);

  const handleDelete = async () => {
    try {
      await deleteContact(contactId);
      toast.success("Contact deleted");
      onChanged?.();
      onClose();
    } catch (e) { toast.error(e.message); }
  };

  const handleSaveEdit = async (data) => {
    try {
      await updateContact(contactId, data);
      toast.success("Updated");
      setEditing(false);
      reload();
      onChanged?.();
    } catch (e) { toast.error(e.message); }
  };

  const handleAddTag = async (tag) => {
    if (!tag) return;
    const newTags = Array.from(new Set([...(contact.tags || []), tag]));
    try {
      await updateContact(contactId, { tags: newTags });
      reload();
      onChanged?.();
    } catch (e) { toast.error(e.message); }
  };

  const handleRemoveTag = async (tag) => {
    const newTags = (contact.tags || []).filter((t) => t !== tag);
    try {
      await updateContact(contactId, { tags: newTags });
      reload();
      onChanged?.();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex">
      <div className="hidden sm:block flex-1 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full sm:w-[560px] bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {loading || !contact ? (
          <div className="flex-1 flex items-center justify-center text-sm text-stone-500">Loading…</div>
        ) : (
          <>
            {/* Header */}
            <div
              className="px-4 sm:px-5 pt-3 pb-4 border-b border-stone-200 bg-white sticky top-0 z-10"
              style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 12px)" }}
            >
              <div className="flex items-center gap-2 mb-3 sm:hidden">
                <button onClick={onClose} className="p-1.5 -ml-1.5 rounded-lg hover:bg-stone-100">
                  <svg className="w-5 h-5 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="flex-1 text-sm font-semibold text-stone-700 truncate">Contact</div>
                <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-stone-100">
                  <svg className="w-5 h-5 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                </button>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="hidden sm:flex w-12 h-12 rounded-full bg-gradient-to-br from-stone-700 to-stone-900 text-white items-center justify-center font-bold text-lg shrink-0">
                    {(contact.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-stone-900 truncate">{contact.name}</h2>
                    {contact.title && <div className="text-xs text-stone-600 font-medium truncate">{contact.title}</div>}
                    {contact.company && <div className="text-sm text-stone-500 truncate">{contact.company}</div>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge type={contact.type} />
                      {contact.country && (
                        <span className="text-xs text-stone-500 inline-flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {[contact.city, contact.country].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {contact.folder_name && (
                        <span className="text-xs text-stone-500 inline-flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                          {contact.folder_name}
                        </span>
                      )}
                      {normaliseWebsite(contact.website) && (
                        <a href={normaliseWebsite(contact.website)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 truncate max-w-[200px]">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          <span className="truncate">{contact.website}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1">
                  <IconButton onClick={() => setEditing(true)} title="Edit">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </IconButton>
                  <IconButton onClick={() => setConfirmDelete(true)} title="Delete" danger>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                  </IconButton>
                  <IconButton onClick={onClose} title="Close">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </IconButton>
                </div>
              </div>

              {/* Tags */}
              <TagsRow tags={contact.tags || []} onAdd={handleAddTag} onRemove={handleRemoveTag} />

              {/* Quick actions */}
              <div className="mt-3 grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 py-2 sm:py-1.5 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium hover:bg-stone-200">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    Call
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`https://wa.me/${contact.phone.replace(/[^\d]/g, "")}`}
                    target="_blank" rel="noreferrer"
                    className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 py-2 sm:py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium hover:bg-emerald-200"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </a>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 py-2 sm:py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Email
                  </a>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-stone-200 px-2 sm:px-3 sticky top-0 bg-white z-[5]">
              <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
                <Tab active={tab === "activity"} onClick={() => setTab("activity")}>Activity</Tab>
                <Tab active={tab === "deals"} onClick={() => setTab("deals")}>Deals ({contact.deals?.length || 0})</Tab>
                <Tab active={tab === "tasks"} onClick={() => setTab("tasks")}>Tasks ({contact.tasks?.filter(t => t.status === "pending").length || 0})</Tab>
                <Tab active={tab === "info"} onClick={() => setTab("info")}>Info</Tab>
                <Tab active={tab === "verify"} onClick={() => setTab("verify")}>
                  <span className="inline-flex items-center gap-1">
                    Verify
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </span>
                </Tab>
              </nav>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              {tab === "activity" && <ActivityTab contact={contact} onChanged={reload} userId={user?.id} />}
              {tab === "deals" && <DealsTab contact={contact} />}
              {tab === "tasks" && <TasksTab contact={contact} userId={user?.id} onChanged={reload} />}
              {tab === "info" && <InfoTab contact={contact} />}
              {tab === "verify" && <VerifyTab contact={contact} onUpdate={(patch) => { updateContact(contactId, patch).then(() => { toast.success("Updated"); reload(); onChanged?.(); }).catch(e => toast.error(e.message)); }} />}
            </div>
          </>
        )}
      </div>

      {editing && (
        <ContactFormModal
          initial={contact}
          onClose={() => setEditing(false)}
          onSubmit={handleSaveEdit}
          title="Edit contact"
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete contact?"
          message={`This will permanently delete ${contact?.name} and all related deals, tasks and activity. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

const Badge = ({ type }) => {
  const t = CONTACT_TYPES.find((x) => x.value === type);
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${t?.color || ""}`}>
      {t?.label || type}
    </span>
  );
};

const IconButton = ({ onClick, title, children, danger }) => (
  <button
    onClick={onClick} title={title}
    className={`p-2 rounded-lg hover:bg-stone-100 ${danger ? "text-rose-600 hover:bg-rose-50" : "text-stone-600"}`}
  >
    {children}
  </button>
);

const Tab = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      active ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
    }`}
  >{children}</button>
);

function TagsRow({ tags, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState("");

  const handleAdd = (e) => {
    e?.preventDefault();
    if (!newTag.trim()) return;
    onAdd(newTag.trim());
    setNewTag("");
    setAdding(false);
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium border border-blue-200">
          #{t}
          <button onClick={() => onRemove(t)} className="opacity-50 group-hover:opacity-100">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={handleAdd} className="inline-flex items-center gap-1">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onBlur={() => { if (!newTag.trim()) setAdding(false); }}
            placeholder="tag…"
            autoFocus
            className="px-2 py-0.5 rounded-full text-[11px] border border-stone-300 focus:outline-none focus:border-stone-500 w-24"
          />
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[11px] font-medium hover:bg-stone-200 border border-dashed border-stone-300">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Tag
        </button>
      )}
    </div>
  );
}

/* ---------- Activity tab ---------- */
function ActivityTab({ contact, onChanged, userId }) {
  const [type, setType] = useState("note");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!content.trim() && !subject.trim()) return;
    setAdding(true);
    try {
      await createInteraction({
        userId,
        contactId: contact.id,
        type,
        direction: "outgoing",
        subject: subject.trim() || null,
        content: content.trim() || null,
      });
      setContent(""); setSubject("");
      onChanged?.();
    } catch (e) { toast.error(e.message); }
    finally { setAdding(false); }
  };

  return (
    <div className="p-4 space-y-4">
      <form onSubmit={handleAdd} className="bg-stone-50 rounded-xl border border-stone-200 p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {INTERACTION_TYPES.map((t) => (
            <button
              key={t.value} type="button" onClick={() => setType(t.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                type === t.value ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
              }`}
            >{t.label}</button>
          ))}
        </div>
        <input
          value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
        />
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="What happened? notes, summary…"
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white min-h-[70px] focus:outline-none focus:border-stone-400"
        />
        <div className="flex justify-end">
          <button type="submit" disabled={adding} className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 disabled:opacity-50">
            {adding ? "Logging…" : "Log activity"}
          </button>
        </div>
      </form>

      {contact.interactions?.length === 0 ? (
        <div className="text-sm text-stone-500 text-center py-8">No activity yet</div>
      ) : (
        <ol className="relative pl-4 border-l-2 border-stone-200 space-y-3">
          {contact.interactions.map((i) => (
            <li key={i.id} className="relative">
              <div className="absolute -left-[22px] top-1 w-3 h-3 rounded-full bg-stone-300 ring-4 ring-white" />
              <div className="bg-white border border-stone-200 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{i.type}</span>
                  <span className="text-[11px] text-stone-400">{timeAgo(i.occurred_at)}</span>
                </div>
                {i.subject && <div className="font-medium text-sm text-stone-900 mt-1">{i.subject}</div>}
                {i.content && <div className="text-sm text-stone-700 whitespace-pre-line mt-0.5">{i.content}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---------- Deals tab ---------- */
function DealsTab({ contact }) {
  const stageOf = (s) => DEAL_STAGES.find((x) => x.value === s);

  if (!contact.deals?.length) {
    return <div className="p-6 text-sm text-stone-500 text-center">No deals yet for this contact.</div>;
  }
  return (
    <div className="p-4 space-y-2">
      {contact.deals.map((d) => {
        const s = stageOf(d.stage);
        return (
          <a key={d.id} href={`/crm/deals?focus=${d.id}`} className="block bg-white border border-stone-200 rounded-lg p-3 hover:border-stone-400">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-stone-900 truncate">{d.title}</div>
                <div className="text-xs text-stone-500 mt-0.5">Updated {timeAgo(d.updated_at)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-stone-900">${Number(d.value || 0).toLocaleString()}</div>
                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${s?.color}`}>{s?.label || d.stage}</span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

/* ---------- Tasks tab ---------- */
function TasksTab({ contact, userId, onChanged }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createTask({ userId, contactId: contact.id, title: title.trim(), dueDate: due || null });
      setTitle(""); setDue("");
      onChanged?.();
    } catch (e) { toast.error(e.message); }
  };

  const toggleTask = async (task) => {
    try {
      await updateTask(task.id, { status: task.status === "done" ? "pending" : "done" });
      onChanged?.();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="p-4 space-y-3">
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quick task…" className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400" />
        <div className="flex gap-2">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="flex-1 sm:flex-initial px-2 py-2 text-sm rounded-lg border border-stone-200 bg-white" />
          <button type="submit" className="px-3 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800">Add</button>
        </div>
      </form>
      {contact.tasks?.length === 0 ? (
        <div className="text-sm text-stone-500 text-center py-6">No tasks yet</div>
      ) : (
        <ul className="space-y-2">
          {contact.tasks.map((t) => {
            const overdue = t.status === "pending" && t.due_date && new Date(t.due_date) < new Date();
            return (
              <li key={t.id} className={`flex items-start gap-3 p-3 rounded-lg border ${overdue ? "border-rose-200 bg-rose-50" : "border-stone-200 bg-white"}`}>
                <button onClick={() => toggleTask(t)} className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                  t.status === "done" ? "bg-emerald-500 border-emerald-500" : "border-stone-300 hover:border-stone-500"
                }`}>
                  {t.status === "done" && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${t.status === "done" ? "line-through text-stone-400" : "text-stone-900"}`}>{t.title}</div>
                  {t.due_date && (
                    <div className={`text-xs mt-0.5 ${overdue ? "text-rose-600 font-medium" : "text-stone-500"}`}>
                      Due {fmtDate(t.due_date)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- Info tab ---------- */
function InfoTab({ contact }) {
  const websiteHref = normaliseWebsite(contact.website);
  return (
    <div className="p-4 space-y-3 text-sm">
      <Row label="Title" value={contact.title} />
      <Row label="Company" value={contact.company} />
      <Row label="Phone" value={contact.phone} />
      {contact.phone_alt && <Row label="Alt phone" value={contact.phone_alt} />}
      <Row label="Email" value={contact.email ? <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a> : null} />
      <Row label="Website" value={websiteHref ? (
        <a href={websiteHref} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 break-all">
          {contact.website}
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </a>
      ) : null} />
      <Row label="Country" value={contact.country} />
      <Row label="City" value={contact.city} />
      <Row label="Address" value={contact.address} />
      <Row label="Folder" value={contact.folder_name} />
      <Row label="Source" value={contact.source} />
      <Row label="Status" value={contact.status} />
      <Row label="Created" value={fmtDate(contact.created_at)} />
      <Row label="Last contact" value={fmtDate(contact.last_contact_at)} />
      {contact.notes && (
        <div className="pt-3 border-t border-stone-200">
          <div className="text-xs font-medium text-stone-500 mb-1">Notes</div>
          <div className="text-sm text-stone-700 whitespace-pre-line bg-stone-50 rounded-lg p-3">{contact.notes}</div>
        </div>
      )}
      {contact.card_back_notes && (
        <div className="pt-3 border-t border-stone-200">
          <div className="text-xs font-medium text-stone-500 mb-1">Back of card</div>
          <div className="text-sm text-stone-700 whitespace-pre-line bg-stone-50 rounded-lg p-3">{contact.card_back_notes}</div>
        </div>
      )}
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex items-start gap-3">
    <div className="w-24 sm:w-28 shrink-0 text-xs uppercase tracking-wider text-stone-500 font-medium pt-0.5">{label}</div>
    <div className="flex-1 text-stone-800 break-words min-w-0">{value || <span className="text-stone-400">—</span>}</div>
  </div>
);

function normaliseWebsite(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/* ---------- Verify tab ---------- */
function VerifyTab({ contact, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await verifyBusiness({
        name: contact.name,
        company: contact.company,
        email: contact.email,
        phone: contact.phone,
        country: contact.country,
        city: contact.city,
        website: contact.website,
      });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const applyField = (field, value) => {
    if (!value) return;
    const map = {
      website: "address",
      linkedin: "address",
      instagram: "address",
      industry: "source",
      yearsActive: "notes",
      notes: "notes",
    };
    const targetField = ["company","email","phone","country","city","address","notes"].includes(field) ? field : map[field];
    if (!targetField) {
      onUpdate({ notes: `${contact.notes || ""}\n${field}: ${value}`.trim() });
      return;
    }
    if (targetField === "notes") {
      onUpdate({ notes: `${contact.notes ? contact.notes + "\n" : ""}${field}: ${value}` });
    } else if (!contact[targetField]) {
      onUpdate({ [targetField]: value });
    } else {
      onUpdate({ [targetField]: value });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 11l3 3L22 4" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-stone-900">Verify business online</h4>
            <p className="text-xs text-stone-600 mt-0.5">
              We'll search the public web (LinkedIn, official site, trade directories) to confirm details and find what's missing.
            </p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              Searching the web…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {result ? "Verify again" : "Verify online"}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className={`rounded-lg p-3 border ${
            result.verified
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            <div className="flex items-center gap-2 font-semibold text-sm">
              {result.verified ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              )}
              {result.verified ? "Verified" : "Could not fully verify"}
              {result.confidence && (
                <span className="ml-auto text-[11px] uppercase tracking-wider opacity-80">{result.confidence} confidence</span>
              )}
            </div>
            <p className="text-sm mt-1.5 opacity-90">{result.summary}</p>
          </div>

          {result.warnings && result.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Warnings</div>
              <ul className="text-sm text-amber-800 list-disc list-inside space-y-0.5">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {result.discoveredFields && Object.keys(result.discoveredFields).length > 0 && (
            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 text-xs uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200 bg-stone-50">
                Discovered details
              </div>
              <div className="divide-y divide-stone-100">
                {Object.entries(result.discoveredFields).map(([k, v]) => v ? (
                  <div key={k} className="flex items-start gap-2 p-3 text-sm">
                    <div className="w-24 shrink-0 text-xs uppercase tracking-wider text-stone-500 font-medium pt-0.5">{k}</div>
                    <div className="flex-1 text-stone-800 break-words min-w-0">{v}</div>
                    <button
                      onClick={() => applyField(k, v)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                ) : null)}
              </div>
            </div>
          )}

          {result.sources && result.sources.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Sources</div>
              <div className="space-y-1">
                {result.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 hover:underline truncate">
                    {s.label || s.url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {result._searchUsed === false && (
            <div className="text-[11px] text-stone-500 italic">
              Note: live web search was unavailable, so this result is based on the model's general knowledge only.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Confirm modal ---------- */
function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-stone-900/60 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="p-5">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h3 className="text-center font-semibold text-stone-900">{title}</h3>
          <p className="text-center text-sm text-stone-600 mt-1">{message}</p>
        </div>
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-white ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-stone-900 hover:bg-stone-800"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
