import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { fetchPortalMe } from "../../services/portalApi";

/**
 * StorePortalAccount — read-only account & supplier info for the
 * store user. Mirrors the MemoDetail design language: white cards
 * on stone-50, stone-200 borders, subtle stone-400 labels.
 *
 * The store user can't edit anything here — the supplier owns the
 * record. Edits happen on the supplier's StoreProfile page.
 */
export default function StorePortalAccount() {
  const { user } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setLoading(true);
    fetchPortalMe(user.id)
      .then((d) => active && setData(d))
      .catch((e) => active && toast.error(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user?.id]);

  if (loading) return <AccountSkeleton />;
  if (!data) return null;

  const { user: me, store, supplier } = data;
  const address = [store?.address, store?.city, store?.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="bg-white border border-stone-200 rounded-2xl px-4 sm:px-6 py-4 sm:py-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-bold">Account</div>
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 mt-0.5 truncate">{me?.name || "Store user"}</h1>
        <div className="text-xs sm:text-sm text-stone-500 mt-0.5 break-all">{me?.email}</div>
      </div>

      {/* Store card */}
      <div className="bg-white border-l-4 border-stone-900 border border-stone-200 rounded-xl p-4 sm:p-5">
        <div className="text-[10px] uppercase tracking-[0.15em] text-stone-400 font-bold mb-2">Your store</div>
        <div className="flex items-start gap-3">
          {store?.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="w-12 h-12 rounded-lg object-cover bg-stone-100 ring-1 ring-stone-200 shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-stone-700 to-stone-900 text-white flex items-center justify-center font-bold shrink-0">
              {(store?.name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-stone-900 truncate">{store?.name}</div>
            {address && <div className="text-xs text-stone-500 break-words">{address}</div>}
            <div className="mt-1.5 space-y-0.5 text-xs text-stone-600">
              {store?.email   && <div className="break-all">✉ {store.email}</div>}
              {store?.phone   && <div>☎ {store.phone}</div>}
              {store?.website && (
                <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900 break-all block">
                  ◷ {store.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-stone-400 mt-3 pt-3 border-t border-stone-100">
          To update store details, contact your supplier — they manage the master record.
        </div>
      </div>

      {/* Supplier card */}
      <div className="bg-white border-l-4 border-stone-300 border border-stone-200 rounded-xl p-4 sm:p-5">
        <div className="text-[10px] uppercase tracking-[0.15em] text-stone-400 font-bold mb-2">Supplier</div>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
            {(supplier?.name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-stone-900 truncate">{supplier?.name || "Supplier"}</div>
            {supplier?.email && <div className="text-xs text-stone-500 break-all mt-0.5">{supplier.email}</div>}
            <div className="text-[11px] text-stone-400 mt-2">
              Reach out by email if you need a memo extension or have questions about an item.
            </div>
          </div>
        </div>
      </div>

      {/* Help / how it works */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-bold mb-2">How the portal works</div>
        <ul className="text-sm text-stone-700 space-y-2 list-disc pl-5">
          <li><span className="font-semibold">Memos</span> shows every active consignment from your supplier.</li>
          <li>Tap an item, then choose <span className="font-semibold">Mark as sold</span> or <span className="font-semibold">Request return</span>.</li>
          <li>Your request goes to the supplier for approval — until it's confirmed, the item is shown as <span className="text-amber-700 font-semibold">pending</span>.</li>
          <li><span className="font-semibold">History</span> keeps a record of every memo that's been closed.</li>
        </ul>
      </div>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 bg-white border border-stone-200 rounded-2xl" />
      <div className="h-28 bg-white border border-stone-200 rounded-xl" />
      <div className="h-28 bg-white border border-stone-200 rounded-xl" />
      <div className="h-44 bg-white border border-stone-200 rounded-xl" />
    </div>
  );
}
