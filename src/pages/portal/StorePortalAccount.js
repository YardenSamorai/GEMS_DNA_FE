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
    <div className="space-y-10 sm:space-y-12">
      <section className="border-t border-portal-champagne/60 pt-8 sm:pt-12 pb-6">
        <div className="text-[10px] tracking-[0.32em] uppercase text-portal-champagne font-medium mb-4">
          Account
        </div>
        <h1 className="font-serif-display text-[32px] sm:text-[40px] leading-[1.05] text-portal-ink tracking-tight truncate">
          {me?.name || "Store user"}
        </h1>
        <div className="text-[13px] text-portal-muted mt-4 break-all tracking-wide">{me?.email}</div>
      </section>

      <div className="grid sm:grid-cols-2 gap-5">
        {/* Store card */}
        <section className="bg-portal-canvas border border-portal-line p-6">
          <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-5">
            Your store
          </div>
          <div className="flex items-start gap-4">
            {store?.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="w-12 h-12 object-cover bg-portal-pearl border border-portal-line shrink-0" />
            ) : (
              <div className="w-12 h-12 bg-portal-ink text-portal-bone flex items-center justify-center shrink-0 font-serif-display italic text-[18px] leading-none">
                {storeInitials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-serif-display text-[20px] text-portal-ink truncate leading-tight">
                {store?.name}
              </div>
              {address && <div className="text-[12px] text-portal-muted break-words mt-1.5 leading-relaxed">{address}</div>}
              <div className="mt-3 space-y-1 text-[12px] text-portal-graphite">
                {store?.email   && <div className="break-all">{store.email}</div>}
                {store?.phone   && <div className="tabular-nums">{store.phone}</div>}
                {store?.website && (
                  <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-portal-ink hover:text-portal-champagne transition-colors break-all block underline decoration-portal-line2 underline-offset-2">
                    {store.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="text-[10.5px] tracking-[0.22em] uppercase text-portal-soft mt-6 pt-5 border-t border-portal-line leading-relaxed">
            Store details are managed by your supplier
          </div>
        </section>

        {/* Supplier card */}
        <section className="bg-portal-canvas border border-portal-line p-6">
          <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-5">
            Supplier
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-portal-ink text-portal-bone flex items-center justify-center shrink-0 font-serif-display italic text-[18px] leading-none">
              {supplierInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-serif-display text-[20px] text-portal-ink truncate leading-tight">
                {supplier?.name || "Supplier"}
              </div>
              {supplier?.email && <div className="text-[12px] text-portal-graphite break-all mt-1.5">{supplier.email}</div>}
              <div className="text-[11.5px] text-portal-muted mt-3 leading-relaxed">
                Reach out by email for a memo extension, or with questions about a specific piece.
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Help / how it works */}
      <section className="bg-portal-canvas border border-portal-line p-6 sm:p-7">
        <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-5">
          How the portal works
        </div>
        <ul className="text-[13px] text-portal-graphite space-y-3 leading-relaxed">
          <li className="flex gap-3"><span className="text-portal-champagne mt-1.5">·</span><span><span className="text-portal-ink">Memos</span> lists every active consignment from your supplier.</span></li>
          <li className="flex gap-3"><span className="text-portal-champagne mt-1.5">·</span><span>Open an item, then choose <span className="text-portal-ink">Mark as sold</span> or <span className="text-portal-ink">Request return</span>.</span></li>
          <li className="flex gap-3"><span className="text-portal-champagne mt-1.5">·</span><span>Your action goes to the supplier for approval — until confirmed, the item is shown as <span className="text-portal-champagne2">pending</span>.</span></li>
          <li className="flex gap-3"><span className="text-portal-champagne mt-1.5">·</span><span><span className="text-portal-ink">History</span> keeps a record of every memo that's been closed.</span></li>
        </ul>
      </section>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="h-24 bg-portal-pearl" />
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="h-44 bg-portal-pearl" />
        <div className="h-44 bg-portal-pearl" />
      </div>
      <div className="h-44 bg-portal-pearl" />
    </div>
  );
}
