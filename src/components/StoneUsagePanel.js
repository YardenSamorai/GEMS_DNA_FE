import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStoneUsage, STONE_STATUS_LABELS, STONE_STATUS_PILL } from "../services/stonesApi";

/* Cross-system "where is this stone?" panel.
 * Used inside the public DiamondCard (staff-only render) and inside the
 * inventory drawer. Anything that touches the same SKU should bubble up here
 * so the workshop, sales pipeline and DNA inquiries stop feeling like
 * separate apps.
 *
 * Compact mode (`compact={true}`) shrinks paddings/typography for use inside
 * a side drawer where vertical space is tight.
 */
const StoneUsagePanel = ({ sku, compact = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!sku) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    fetchStoneUsage(sku)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((e) => {
        if (alive) setErr(e.message || "Failed to load");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sku]);

  if (!sku) return null;

  const pad = compact ? "p-3" : "p-4 sm:p-5";
  const title = compact ? "text-sm font-semibold" : "text-base font-semibold";

  if (loading) {
    return (
      <div className={`rounded-xl glass-surface ${pad}`}>
        <div className="text-xs text-stone-500">Loading stone usage…</div>
      </div>
    );
  }
  if (err) {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 ${pad}`}>
        <div className="text-xs text-red-700">Couldn't load usage: {err}</div>
      </div>
    );
  }
  if (!data) return null;

  const status = data.current_status || "available";
  const pillCls = STONE_STATUS_PILL[status] || STONE_STATUS_PILL.available;
  const jewelry = data.jewelry_items || [];
  const inquiries = data.dna_inquiries || [];
  const deals = data.deals || [];

  const empty =
    jewelry.length === 0 && inquiries.length === 0 && deals.length === 0;

  return (
    <div className={`rounded-xl glass-surface ${pad}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={`${title} text-stone-900`}>Cross-system usage</h3>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${pillCls}`}
          title="Current inventory status across the app"
        >
          {STONE_STATUS_LABELS[status] || status}
        </span>
      </div>

      {empty ? (
        <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-4 text-center text-xs text-stone-500">
          This stone hasn't been touched yet — no jewelry pieces, deals, or DNA inquiries.
        </div>
      ) : (
        <div className="space-y-4">
          {jewelry.length > 0 && (
            <Section title="In jewelry pieces" count={jewelry.length}>
              {jewelry.map((j) => {
                const consumeStatus = j.consume_from_inventory
                  ? j.inventory_status || "reserved"
                  : null;
                return (
                  <Row
                    key={j.link_id}
                    leftIcon={
                      j.cover_image_url ? (
                        <img
                          src={j.cover_image_url}
                          alt=""
                          className="h-9 w-9 flex-none rounded object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="h-9 w-9 flex-none rounded bg-stone-100" />
                      )
                    }
                    title={
                      <Link
                        to={`/jewelry/items/${j.jewelry_item_id}`}
                        className="text-emerald-700 hover:underline"
                      >
                        {j.jewelry_sku || j.jewelry_name || `Job #${j.jewelry_item_id}`}
                      </Link>
                    }
                    subtitle={
                      <>
                        {j.jewelry_name && j.jewelry_sku ? `${j.jewelry_name} · ` : ""}
                        {j.role && <span className="capitalize">{j.role}</span>}
                        {j.role && j.quantity ? " · " : ""}
                        {j.quantity ? `qty ${j.quantity}` : ""}
                        {j.contact_id && j.contact_name ? (
                          <>
                            {" · "}
                            <Link
                              to={`/crm/customers/${j.contact_id}`}
                              className="text-stone-700 hover:underline"
                            >
                              {j.contact_name}
                            </Link>
                          </>
                        ) : null}
                      </>
                    }
                    right={
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-600">
                          {j.jewelry_status}
                        </span>
                        {consumeStatus ? (
                          <span
                            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                              STONE_STATUS_PILL[consumeStatus] || STONE_STATUS_PILL.reserved
                            }`}
                          >
                            {STONE_STATUS_LABELS[consumeStatus] || consumeStatus}
                          </span>
                        ) : (
                          <span className="rounded-full border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-500">
                            snapshot
                          </span>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </Section>
          )}

          {deals.length > 0 && (
            <Section title="In deals" count={deals.length}>
              {deals.map((d) => (
                <Row
                  key={d.id}
                  title={
                    <Link
                      to={`/crm/deals?focus=${d.id}`}
                      className="text-emerald-700 hover:underline"
                    >
                      {d.title || `Deal #${d.id}`}
                    </Link>
                  }
                  subtitle={
                    <>
                      {d.contact_id && d.contact_name ? (
                        <Link
                          to={`/crm/customers/${d.contact_id}`}
                          className="text-stone-700 hover:underline"
                        >
                          {d.contact_name}
                        </Link>
                      ) : (
                        d.contact_name || ""
                      )}
                      {d.contact_shared ? (
                        <span className="ml-1 rounded bg-violet-50 px-1 text-[9px] font-semibold uppercase tracking-wide text-violet-700">
                          DNA
                        </span>
                      ) : null}
                    </>
                  }
                  right={
                    <div className="flex items-center gap-1.5">
                      {d.value != null && (
                        <span className="text-xs font-semibold text-stone-700">
                          ${Number(d.value).toLocaleString()}
                        </span>
                      )}
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-600">
                        {d.stage}
                      </span>
                    </div>
                  }
                />
              ))}
            </Section>
          )}

          {inquiries.length > 0 && (
            <Section title="DNA inquiries" count={inquiries.length}>
              {inquiries.map((i) => (
                <Row
                  key={i.id}
                  title={
                    i.contact_id ? (
                      <Link
                        to={`/crm/customers/${i.contact_id}`}
                        className="text-emerald-700 hover:underline"
                      >
                        {i.contact_name || `Lead #${i.contact_id}`}
                      </Link>
                    ) : (
                      <span className="text-stone-700">{i.contact_name || "Anonymous"}</span>
                    )
                  }
                  subtitle={
                    <>
                      {i.subject || i.type}
                      {i.contact_shared ? (
                        <span className="ml-1 rounded bg-violet-50 px-1 text-[9px] font-semibold uppercase tracking-wide text-violet-700">
                          DNA
                        </span>
                      ) : null}
                    </>
                  }
                  right={
                    i.occurred_at && (
                      <span className="text-[10px] text-stone-500">
                        {new Date(i.occurred_at).toLocaleDateString()}
                      </span>
                    )
                  }
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
};

const Section = ({ title, count, children }) => (
  <div>
    <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
      <span>{title}</span>
      <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">
        {count}
      </span>
    </div>
    <div className="divide-y divide-app-line rounded-xl glass-surface">
      {children}
    </div>
  </div>
);

const Row = ({ leftIcon, title, subtitle, right }) => (
  <div className="flex items-center gap-3 px-3 py-2 text-xs">
    {leftIcon}
    <div className="min-w-0 flex-1">
      <div className="truncate font-medium text-stone-900">{title}</div>
      {subtitle && <div className="truncate text-[11px] text-stone-500">{subtitle}</div>}
    </div>
    {right && <div className="flex-none">{right}</div>}
  </div>
);

export default StoneUsagePanel;
