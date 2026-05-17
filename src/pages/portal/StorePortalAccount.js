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

  const storeInitials    = (store?.name    || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  const supplierInitials = (supplier?.name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="glass-surface rounded-2xl sm:rounded-[28px] px-6 sm:px-9 py-7 sm:py-9">
        <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium mb-3">
          Account
        </div>
        <h1 className="text-[28px] sm:text-[36px] leading-[1.1] text-glass-ink font-semibold tracking-tight truncate">
          {me?.name || "Store user"}
        </h1>
        <div className="text-[14px] text-glass-muted mt-3 break-all">{me?.email}</div>
      </section>

      <div className="grid sm:grid-cols-2 gap-5">
        {/* Store card */}
        <section className="glass-surface rounded-2xl sm:rounded-[24px] p-6">
          <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium mb-4">
            Your store
          </div>
          <div className="flex items-start gap-4">
            {store?.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="w-12 h-12 rounded-xl object-cover bg-glass-canvas2 border border-glass-line shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-glass-ink text-white flex items-center justify-center shrink-0 text-[15px] font-semibold leading-none tracking-tight shadow-[0_4px_12px_-4px_rgba(20,22,28,0.30)] relative">
                {storeInitials}
                <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/15 pointer-events-none" aria-hidden />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold tracking-tight text-glass-ink truncate leading-tight">
                {store?.name}
              </div>
              {address && <div className="text-[12.5px] text-glass-muted break-words mt-1 leading-relaxed">{address}</div>}
              <div className="mt-3 space-y-1 text-[12.5px] text-glass-graphite">
                {store?.email   && <div className="break-all">{store.email}</div>}
                {store?.phone   && <div className="tabular-nums">{store.phone}</div>}
                {store?.website && (
                  <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-glass-ink hover:text-black transition-colors break-all block underline decoration-glass-line underline-offset-2">
                    {store.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="text-[11.5px] text-glass-soft mt-6 pt-5 border-t border-glass-line/70 leading-relaxed">
            Store details are managed by your supplier
          </div>
        </section>

        {/* Supplier card */}
        <section className="glass-surface rounded-2xl sm:rounded-[24px] p-6">
          <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium mb-4">
            Supplier
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-glass-ink text-white flex items-center justify-center shrink-0 text-[15px] font-semibold leading-none tracking-tight shadow-[0_4px_12px_-4px_rgba(20,22,28,0.30)] relative">
              {supplierInitials}
              <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/15 pointer-events-none" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold tracking-tight text-glass-ink truncate leading-tight">
                {supplier?.name || "Supplier"}
              </div>
              {supplier?.email && <div className="text-[12.5px] text-glass-graphite break-all mt-1">{supplier.email}</div>}
              <div className="text-[12.5px] text-glass-muted mt-3 leading-relaxed">
                Reach out by email for a memo extension, or with questions about a specific piece.
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Help / how it works */}
      <section className="glass-surface rounded-2xl sm:rounded-[24px] p-6 sm:p-7">
        <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium mb-4">
          How the portal works
        </div>
        <ul className="text-[13.5px] text-glass-graphite space-y-2.5 leading-relaxed">
          <li className="flex gap-3"><span className="text-portal-champagne mt-1.5 shrink-0 text-[10px]">●</span><span><span className="text-glass-ink font-medium">Memos</span> lists every active consignment from your supplier.</span></li>
          <li className="flex gap-3"><span className="text-portal-champagne mt-1.5 shrink-0 text-[10px]">●</span><span>Open an item, then choose <span className="text-glass-ink font-medium">Mark as sold</span> or <span className="text-glass-ink font-medium">Request return</span>.</span></li>
          <li className="flex gap-3"><span className="text-portal-champagne mt-1.5 shrink-0 text-[10px]">●</span><span>Your action goes to the supplier for approval — until confirmed, the item is shown as <span className="text-portal-champagne2 font-medium">pending</span>.</span></li>
          <li className="flex gap-3"><span className="text-portal-champagne mt-1.5 shrink-0 text-[10px]">●</span><span><span className="text-glass-ink font-medium">History</span> keeps a record of every memo that's been closed.</span></li>
        </ul>
      </section>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-32 rounded-2xl bg-glass-canvas2" />
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="h-44 rounded-2xl bg-glass-canvas2" />
        <div className="h-44 rounded-2xl bg-glass-canvas2" />
      </div>
      <div className="h-44 rounded-2xl bg-glass-canvas2" />
    </div>
  );
}
