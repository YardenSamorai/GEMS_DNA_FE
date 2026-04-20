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
    if (!window.confirm("Delete this contact and all their data?")) return;
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

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full sm:w-[560px] bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {loading || !contact ? (
          <div className="flex-1 flex items-center justify-center text-sm text-stone-500">Loading…</div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-stone-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-stone-900 truncate">{contact.name}</h2>
                  {contact.company && <div className="text-sm text-stone-500 truncate">{contact.company}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge type={contact.type} />
                    {contact.country && (
                      <span className="text-xs text-stone-500">{[contact.city, contact.country].filter(Boolean).join(", ")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton onClick={() => setEditing(true)} title="Edit">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </IconButton>
                  <IconButton onClick={handleDelete} title="Delete" danger>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                  </IconButton>
                  <IconButton onClick={onClose} title="Close">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </IconButton>
                </div>
              </div>

              {/* Quick actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium hover:bg-stone-200">
                    Call {contact.phone}
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`https://wa.me/${contact.phone.replace(/[^\d]/g, "")}`}
                    target="_blank" rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium hover:bg-emerald-200"
                  >WhatsApp</a>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200">
                    Email
                  </a>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-stone-200 px-3">
              <nav className="flex gap-1 overflow-x-auto">
                <Tab active={tab === "activity"} onClick={() => setTab("activity")}>Activity</Tab>
                <Tab active={tab === "deals"} onClick={() => setTab("deals")}>Deals ({contact.deals?.length || 0})</Tab>
                <Tab active={tab === "tasks"} onClick={() => setTab("tasks")}>Tasks ({contact.tasks?.filter(t => t.status === "pending").length || 0})</Tab>
                <Tab active={tab === "info"} onClick={() => setTab("info")}>Info</Tab>
              </nav>
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === "activity" && (
                <ActivityTab contact={contact} onChanged={reload} userId={user?.id} />
              )}
              {tab === "deals" && (
                <DealsTab contact={contact} />
              )}
              {tab === "tasks" && (
                <TasksTab contact={contact} userId={user?.id} onChanged={reload} />
              )}
              {tab === "info" && (
                <InfoTab contact={contact} />
              )}
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
      <form onSubmit={handleAdd} className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quick task…" className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="px-2 py-2 text-sm rounded-lg border border-stone-200 bg-white" />
        <button type="submit" className="px-3 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800">Add</button>
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
  return (
    <div className="p-4 space-y-3 text-sm">
      <Row label="Phone" value={contact.phone} />
      <Row label="Email" value={contact.email} />
      <Row label="Country" value={contact.country} />
      <Row label="City" value={contact.city} />
      <Row label="Address" value={contact.address} />
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
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex items-start gap-3">
    <div className="w-28 shrink-0 text-xs uppercase tracking-wider text-stone-500 font-medium pt-0.5">{label}</div>
    <div className="flex-1 text-stone-800">{value || <span className="text-stone-400">—</span>}</div>
  </div>
);
