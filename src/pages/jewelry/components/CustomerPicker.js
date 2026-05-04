import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchContacts } from "../../../services/crmApi";

const CustomerPicker = ({ value, onChange, placeholder = "Search customer..." }) => {
  const { user } = useUser();
  const userId = user?.id;
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    fetchContacts(userId, { search, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        const list = res?.contacts || res?.items || res || [];
        setContacts(Array.isArray(list) ? list : []);
      })
      .catch(() => setContacts([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [userId, search]);

  const selected = useMemo(
    () => contacts.find((c) => c.id === value) || null,
    [contacts, value]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-stone-300 bg-white px-3 py-2 text-left text-sm hover:border-stone-400"
      >
        <span className={selected ? "text-stone-900" : "text-stone-400"}>
          {selected ? `${selected.name}${selected.company ? ` · ${selected.company}` : ""}` : placeholder}
        </span>
        {selected ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="ml-2 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            ×
          </span>
        ) : (
          <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-lg">
          <div className="border-b border-stone-100 p-2">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, email..."
              className="w-full rounded border border-stone-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading && <div className="px-3 py-2 text-xs text-stone-500">Loading...</div>}
            {!loading && contacts.length === 0 && (
              <div className="px-3 py-2 text-xs text-stone-500">No contacts found</div>
            )}
            {contacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50 ${
                  c.id === value ? "bg-emerald-50 text-emerald-700" : "text-stone-700"
                }`}
              >
                <div className="min-w-0 flex-1 truncate">
                  <div className="truncate font-medium">{c.name}</div>
                  {c.company && <div className="truncate text-xs text-stone-500">{c.company}</div>}
                </div>
                {c.email && <div className="ml-2 truncate text-xs text-stone-400">{c.email}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPicker;
