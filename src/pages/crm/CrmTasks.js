import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  fetchContacts,
  TASK_PRIORITIES,
} from "../../services/crmApi";

const fmt = (d) => (d ? new Date(d).toLocaleString() : "");

export default function CrmTasks() {
  const { user } = useUser();
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [showForm, setShowForm] = useState(false);

  const reload = () => {
    if (!user?.id) return;
    setLoading(true);
    fetchTasks(user.id, { status: filter })
      .then(setTasks)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user?.id) return;
    reload();
    fetchContacts(user.id).then(setContacts).catch(() => {});
    // eslint-disable-next-line
  }, [user?.id, filter]);

  const groups = useMemo(() => {
    const overdue = [];
    const today = [];
    const upcoming = [];
    const noDate = [];
    const done = [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    tasks.forEach((t) => {
      if (t.status === "done") return done.push(t);
      if (!t.due_date) return noDate.push(t);
      const dueStr = new Date(t.due_date).toISOString().slice(0, 10);
      if (dueStr < todayStr) overdue.push(t);
      else if (dueStr === todayStr) today.push(t);
      else upcoming.push(t);
    });
    return { overdue, today, upcoming, noDate, done };
  }, [tasks]);

  const toggle = async (task) => {
    try {
      await updateTask(task.id, { status: task.status === "done" ? "pending" : "done" });
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete task?")) return;
    try {
      await deleteTask(id);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs">
          {[
            { v: "all", l: "All" },
            { v: "pending", l: "Open" },
            { v: "done", l: "Done" },
          ].map((f) => (
            <button key={f.v} onClick={() => setFilter(f.v)} className={`px-3 py-1.5 rounded-md font-medium ${filter === f.v ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>{f.l}</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span>New task</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500 text-sm">Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <p className="text-sm text-stone-500">No tasks yet</p>
          <button onClick={() => setShowForm(true)} className="mt-3 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800">Create first task</button>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.overdue.length > 0 && <Group title="Overdue" tone="rose" tasks={groups.overdue} onToggle={toggle} onRemove={remove} />}
          {groups.today.length > 0 && <Group title="Today" tone="amber" tasks={groups.today} onToggle={toggle} onRemove={remove} />}
          {groups.upcoming.length > 0 && <Group title="Upcoming" tasks={groups.upcoming} onToggle={toggle} onRemove={remove} />}
          {groups.noDate.length > 0 && <Group title="No due date" tasks={groups.noDate} onToggle={toggle} onRemove={remove} />}
          {groups.done.length > 0 && <Group title="Completed" muted tasks={groups.done} onToggle={toggle} onRemove={remove} />}
        </div>
      )}

      {showForm && (
        <NewTaskModal
          contacts={contacts}
          onClose={() => setShowForm(false)}
          onSubmit={async (payload) => {
            try {
              await createTask({ userId: user.id, ...payload });
              toast.success("Task created");
              setShowForm(false);
              reload();
            } catch (e) { toast.error(e.message); }
          }}
        />
      )}
    </div>
  );
}

function Group({ title, tone, muted, tasks, onToggle, onRemove }) {
  const titleColor = tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-600" : "text-stone-700";
  return (
    <div>
      <h3 className={`text-xs uppercase tracking-wider font-semibold mb-2 ${titleColor}`}>{title} ({tasks.length})</h3>
      <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
        {tasks.map((t) => {
          const prio = TASK_PRIORITIES.find((p) => p.value === t.priority);
          return (
            <div key={t.id} className={`flex items-start gap-3 p-3 ${muted ? "opacity-60" : ""}`}>
              <button onClick={() => onToggle(t)} className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                t.status === "done" ? "bg-emerald-500 border-emerald-500" : "border-stone-300 hover:border-stone-500"
              }`}>
                {t.status === "done" && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${t.status === "done" ? "line-through text-stone-400" : "text-stone-900"}`}>{t.title}</div>
                {t.description && <div className="text-xs text-stone-500 mt-0.5 whitespace-pre-line">{t.description}</div>}
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                  {t.due_date && <span className="text-stone-500">Due {fmt(t.due_date)}</span>}
                  {t.contact_name && (
                    <Link to={`/crm/contacts/${t.contact_id}`} className="text-stone-700 hover:underline">@ {t.contact_name}</Link>
                  )}
                  {t.deal_title && <span className="text-stone-500">· {t.deal_title}</span>}
                  {prio && t.priority !== "normal" && (
                    <span className={`px-1.5 py-0.5 rounded ${prio.color}`}>{prio.label}</span>
                  )}
                </div>
              </div>
              <button onClick={() => onRemove(t.id)} className="text-stone-400 hover:text-rose-600 p-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewTaskModal({ contacts, onClose, onSubmit }) {
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", priority: "normal", contactId: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handle = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description || null,
        dueDate: form.dueDate || null,
        priority: form.priority,
        contactId: form.contactId ? Number(form.contactId) : null,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handle} onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-semibold text-stone-900">New task</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Title *">
            <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} required autoFocus />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} min-h-[60px]`} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due">
              <input type="datetime-local" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={inputCls}>
                {TASK_PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
              </select>
            </Field>
          </div>
          <Field label="Linked contact (optional)">
            <select value={form.contactId} onChange={(e) => set("contactId", e.target.value)} className={inputCls}>
              <option value="">— None —</option>
              {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </Field>
        </div>
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50">{saving ? "Creating…" : "Create"}</button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400";
const Field = ({ label, children }) => (
  <label className="block">
    <div className="text-xs font-medium text-stone-600 mb-1">{label}</div>
    {children}
  </label>
);
