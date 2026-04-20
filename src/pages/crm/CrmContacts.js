import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchContacts,
  createContact,
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [drawerId, setDrawerId] = useState(null);

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
  };

  useEffect(() => {
    if (!user?.id) return;
    const t = setTimeout(reload, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, search, typeFilter]);

  const counts = useMemo(() => {
    const c = { all: contacts.length };
    CONTACT_TYPES.forEach((t) => (c[t.value] = 0));
    contacts.forEach((x) => {
      if (c[x.type] != null) c[x.type] += 1;
    });
    return c;
  }, [contacts]);

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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, phone, email…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowScan(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-stone-300 text-stone-800 text-sm font-medium hover:border-stone-500 transition-colors"
            title="Scan business card"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">Scan card</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">New contact</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Type chips */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
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

      {/* List */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-stone-500 text-sm">Loading…</div>
        ) : contacts.length === 0 ? (
          <EmptyState onCreate={() => setShowForm(true)} />
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Phone</th>
                  <th className="py-3 px-4 font-medium">Email</th>
                  <th className="py-3 px-4 font-medium">Deals</th>
                  <th className="py-3 px-4 font-medium text-right">Won</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setDrawerId(String(c.id))}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-stone-900">{c.name}</div>
                      {c.company && <div className="text-xs text-stone-500">{c.company}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${typeStyle(c.type)}`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-700">{c.phone || "—"}</td>
                    <td className="py-3 px-4 text-stone-700">{c.email || "—"}</td>
                    <td className="py-3 px-4 text-stone-700">{c.deals_count || 0}</td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                      ${Number(c.total_won || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-stone-100">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setDrawerId(String(c.id))}
                  className="p-4 hover:bg-stone-50 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-stone-900 truncate">{c.name}</div>
                      {c.company && <div className="text-xs text-stone-500 truncate">{c.company}</div>}
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeStyle(c.type)}`}>
                          {c.type}
                        </span>
                        {c.phone && <span className="text-xs text-stone-500">{c.phone}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-stone-400">{c.deals_count || 0} deals</div>
                      <div className="text-sm font-semibold text-emerald-600">
                        ${Number(c.total_won || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showForm && (
        <ContactFormModal
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
        />
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
        <ContactDrawer
          contactId={drawerId}
          onClose={handleClose}
          onChanged={reload}
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

const EmptyState = ({ onCreate }) => (
  <div className="p-12 text-center">
    <div className="mx-auto w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
      <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    </div>
    <h3 className="font-semibold text-stone-800">No contacts yet</h3>
    <p className="text-sm text-stone-500 mt-1">Add your first lead, buyer or supplier to get started.</p>
    <button onClick={onCreate} className="mt-4 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800">
      New contact
    </button>
  </div>
);
