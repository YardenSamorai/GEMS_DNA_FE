import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { fetchCrmStats, CONTACT_TYPES } from "../../services/crmApi";

const StatCard = ({ label, value, sub, accent = "stone", icon }) => (
  <div className="bg-white rounded-xl border border-stone-200 p-3 sm:p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] sm:text-xs uppercase tracking-wider text-stone-500 font-medium truncate">{label}</div>
        <div className="mt-0.5 sm:mt-1 text-lg sm:text-2xl font-bold text-stone-900 truncate">{value}</div>
        {sub && <div className="text-[10px] sm:text-xs text-stone-500 mt-0.5 sm:mt-1 truncate">{sub}</div>}
      </div>
      {icon && (
        <div className={`p-1.5 sm:p-2 rounded-lg bg-${accent}-100 text-${accent}-600 shrink-0`}>{icon}</div>
      )}
    </div>
  </div>
);

const formatCurrency = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function CrmDashboard() {
  const { user } = useUser();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchCrmStats(user.id)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-28 bg-white rounded-xl border border-stone-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>;
  }

  const c = stats?.contacts || {};
  const d = stats?.deals || {};
  const t = stats?.tasks || {};
  const monthly = stats?.monthlyWon || [];
  const maxMonthly = Math.max(1, ...monthly.map((m) => Number(m.value || 0)));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <StatCard
          label="Contacts"
          value={c.total || 0}
          sub={`${c.leads || 0} leads · ${c.buyers || 0} buyers`}
          accent="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <StatCard
          label="Active Deals"
          value={d.active || 0}
          sub={`${d.total || 0} total`}
          accent="blue"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
        />
        <StatCard
          label="Pipeline Value"
          value={formatCurrency(d.pipeline_value)}
          sub="Open deals"
          accent="amber"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>}
        />
        <StatCard
          label="Won"
          value={formatCurrency(d.won_value)}
          sub={`${d.won || 0} closed`}
          accent="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Tasks bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-stone-900">Tasks</h3>
            <Link to="/crm/tasks" className="text-xs text-stone-500 hover:text-stone-800">View all →</Link>
          </div>
          <div className="space-y-3">
            <TaskRow label="Pending" value={t.pending || 0} color="stone" />
            <TaskRow label="Due today" value={t.today || 0} color="amber" />
            <TaskRow label="Overdue" value={t.overdue || 0} color="rose" />
          </div>
        </div>

        {/* Contact mix */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="font-semibold text-stone-900">Contact mix</h3>
            <Link to="/crm/contacts" className="text-xs text-stone-500 hover:text-stone-800">Manage →</Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
            {CONTACT_TYPES.map((t) => (
              <div key={t.value} className={`rounded-lg border ${t.color} px-2 sm:px-3 py-2 sm:py-2.5`}>
                <div className="text-[9px] sm:text-[10px] uppercase tracking-wider opacity-70">{t.label}</div>
                <div className="text-lg sm:text-xl font-bold mt-0.5">{c[t.value === "lead" ? "leads" : `${t.value}s`] || 0}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly won + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 lg:col-span-2">
          <h3 className="font-semibold text-stone-900 mb-4">Won deals — last 12 months</h3>
          {monthly.length === 0 ? (
            <div className="text-sm text-stone-500 py-8 text-center">No closed deals yet</div>
          ) : (
            <div className="flex items-end gap-2 h-44">
              {monthly.map((m) => {
                const h = Math.max(4, (Number(m.value) / maxMonthly) * 100);
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="text-[10px] text-stone-500 font-semibold">{formatCurrency(m.value)}</div>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-emerald-400 to-emerald-500" style={{ height: `${h}%` }} />
                    <div className="text-[10px] text-stone-400">{m.month.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5">
          <h3 className="font-semibold text-stone-900 mb-3 sm:mb-4">Recent activity</h3>
          {(stats?.recentInteractions || []).length === 0 ? (
            <div className="text-sm text-stone-500 py-8 text-center">No activity yet</div>
          ) : (
            <ul className="space-y-3 max-h-72 overflow-y-auto">
              {stats.recentInteractions.map((i) => (
                <li key={i.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-stone-800 truncate">{i.contact_name || "Unknown"}</span>
                    <span className="text-[10px] text-stone-400 whitespace-nowrap">{timeAgo(i.occurred_at)}</span>
                  </div>
                  <div className="text-xs text-stone-500 truncate">
                    <span className="inline-block uppercase tracking-wider mr-1.5 text-[9px] font-bold text-stone-400">{i.type}</span>
                    {i.subject || i.content || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Top contacts */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5">
        <h3 className="font-semibold text-stone-900 mb-3 sm:mb-4">Top contacts by revenue</h3>
        {(stats?.topContacts || []).length === 0 ? (
          <div className="text-sm text-stone-500 py-8 text-center">No closed deals to rank yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Deals won</th>
                  <th className="py-2 pr-4 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.topContacts.map((tc) => (
                  <tr key={tc.id} className="border-b border-stone-100 last:border-0">
                    <td className="py-3 pr-4">
                      <Link to={`/crm/contacts/${tc.id}`} className="text-stone-900 font-medium hover:underline">
                        {tc.name}
                      </Link>
                      {tc.company && <div className="text-xs text-stone-500">{tc.company}</div>}
                    </td>
                    <td className="py-3 pr-4 text-stone-600 capitalize">{tc.type}</td>
                    <td className="py-3 pr-4 text-stone-700">{tc.deals_won}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-emerald-600">{formatCurrency(tc.total_won)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const TaskRow = ({ label, value, color }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-stone-700">{label}</span>
    <span className={`text-lg font-bold ${
      color === "rose" ? "text-rose-600" : color === "amber" ? "text-amber-600" : "text-stone-700"
    }`}>{value}</span>
  </div>
);
