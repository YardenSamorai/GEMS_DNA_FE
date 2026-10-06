import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Cake, ChevronRight, Circle, FileText, Folder, Gem, Handshake, Hourglass, ListChecks,
  MessageSquare, PackageCheck, UserPlus, UserRound,
} from "lucide-react";
import { ensureOccasionTasks } from "../../services/crmApi";
import { activityRowLink, timeAgo } from "../../utils/activity";
import { useTeam } from "../../context/TeamContext";
import { useIdentity } from "../../shell/useIdentity";
import SyncStatus from "./SyncStatus";
import {
  ACTIVITY_LIMIT, QUEUE_LIMIT, buildMetrics, greeting, queueMeta, todayLabel,
} from "./overviewModel";

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

/* Dashboard overview — answers "what needs me now" (Today), "how do things
 * stand" (At a glance) and "what changed" (Recent activity). Everything comes
 * from GET /api/dashboard/overview. */

const QUEUE_ICONS = { task: ListChecks, occasion: Cake, ready_item: PackageCheck, stale_deal: Hourglass, new_lead: UserPlus };
const ENTITY_ICONS = {
  contact: UserRound,
  deal: Handshake,
  stone: Gem,
  jewelry_item: Gem,
  task: ListChecks,
  interaction: MessageSquare,
  invoice: FileText,
  folder: Folder,
};

const Glyph = ({ icon: Icon }) => (
  <span className="gd-glyph" aria-hidden="true">
    <Icon size={16} strokeWidth={1.75} />
  </span>
);

const SectionHead = ({ id, title, action }) => (
  <div className="gd-sec-head">
    <h2 id={id} className="gd-sec-title">{title}</h2>
    {action}
  </div>
);

const SkeletonRows = ({ count, glyph = true }) => (
  <ul className="gd-panel gd-rows" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <li key={i} className="gd-row gd-row--skeleton">
        {glyph && <span className="gd-sk gd-sk--glyph" />}
        <span className="gd-row-main">
          <span className="gd-sk" style={{ width: `${48 + ((i * 17) % 34)}%` }} />
          <span className="gd-sk gd-sk--sub" style={{ width: `${28 + ((i * 11) % 20)}%` }} />
        </span>
      </li>
    ))}
  </ul>
);

const RowLink = ({ to, children }) => {
  if (!to) return <div className="gd-row">{children}</div>;
  if (/^https?:\/\//.test(to)) return <a className="gd-row" href={to}>{children}</a>;
  return <Link className="gd-row" to={to}>{children}</Link>;
};

const MoreToggle = ({ shown, total, limit, onToggle }) =>
  total > limit ? (
    <button type="button" className="gd-more-toggle" onClick={onToggle} aria-expanded={shown > limit}>
      {shown > limit ? "Show less" : `Show all ${total}`}
    </button>
  ) : null;

const Today = ({ queue }) => {
  const [all, setAll] = useState(false);
  if (!queue.length) {
    return (
      <div className="gd-panel gd-empty">
        <p className="gd-empty-title">Nothing needs you right now</p>
        <p className="gd-empty-sub">No tasks due, customer occasions or deals waiting on you.</p>
      </div>
    );
  }
  const shown = all ? queue : queue.slice(0, QUEUE_LIMIT);
  return (
    <>
      <ul className="gd-panel gd-rows">
        {shown.map((q) => {
          const meta = queueMeta(q);
          return (
            <li key={`${q.type}-${q.id}`}>
              <RowLink to={q.link}>
                {q.image ? <img className="gd-thumb" src={q.image} alt="" loading="lazy" /> : <Glyph icon={QUEUE_ICONS[q.type] || Circle} />}
                <span className="gd-row-main">
                  <span className="gd-row-title">{q.title}</span>
                  {q.sub && <span className="gd-row-sub">{q.sub}</span>}
                </span>
                {meta && <span className="gd-row-meta" data-tone={meta.tone}>{meta.text}</span>}
                {q.link && <ChevronRight className="gd-row-chev" size={16} strokeWidth={2} aria-hidden="true" />}
              </RowLink>
            </li>
          );
        })}
      </ul>
      <MoreToggle shown={shown.length} total={queue.length} limit={QUEUE_LIMIT} onToggle={() => setAll((v) => !v)} />
    </>
  );
};

const Activity = ({ items }) => {
  const [all, setAll] = useState(false);
  if (!items.length) {
    return (
      <div className="gd-panel gd-empty">
        <p className="gd-empty-sub">No activity in the last 14 days.</p>
      </div>
    );
  }
  const shown = all ? items : items.slice(0, ACTIVITY_LIMIT);
  return (
    <>
      <ul className="gd-panel gd-rows">
        {shown.map((a) => (
          <li key={a.id}>
            <RowLink to={activityRowLink(a)}>
              <Glyph icon={ENTITY_ICONS[a.entity_type] || Circle} />
              <span className="gd-row-main">
                <span className="gd-row-title">{a.label}</span>
                {a.sub && <span className="gd-row-sub">{a.sub}</span>}
              </span>
              <time className="gd-row-time" dateTime={a.ts}>{timeAgo(a.ts)}</time>
            </RowLink>
          </li>
        ))}
      </ul>
      <MoreToggle shown={shown.length} total={items.length} limit={ACTIVITY_LIMIT} onToggle={() => setAll((v) => !v)} />
    </>
  );
};

const Metrics = ({ rows }) => (
  <ul className="gd-panel gd-rows">
    {rows.map((m) => (
      <li key={m.id}>
        <Link className="gd-row gd-metric" to={m.to}>
          <span className="gd-row-main">
            <span className="gd-metric-label">{m.label}</span>
            <span className="gd-row-sub" data-tone={m.tone}>{m.detail}</span>
          </span>
          <span className="gd-metric-value">{m.value}</span>
        </Link>
      </li>
    ))}
  </ul>
);

const OverviewTab = () => {
  const identity = useIdentity();
  const team = useTeam();
  const isRep = team?.isOwner === false;
  const userId = identity.userId;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    setError(null);
    // Idempotently materialise tasks for occasions in the next 30 days.
    ensureOccasionTasks(userId).catch(() => {});
    fetch(`${API_BASE}/api/dashboard/overview?userId=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Failed (${r.status})`))))
      .then((res) => alive && setData(res))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [userId, attempt]);

  if (!userId) return null;

  const loading = !data && !error;
  const queue = data?.queue || [];
  const activity = data?.activity || [];

  return (
    <div className="gd-overview">
      <header className="gd-hello">
        <h1>{greeting()}{identity.firstName ? `, ${identity.firstName}` : ""}</h1>
        <p>{todayLabel()}</p>
      </header>

      {error && !data ? (
        <div className="gd-panel gd-empty" role="alert">
          <p className="gd-empty-title">Couldn't load your overview</p>
          <p className="gd-empty-sub">The server didn't respond. Try again in a moment.</p>
          <button type="button" className="gd-btn" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      ) : (
        <div className="gd-overview-grid" aria-busy={loading || undefined}>
          <section className="gd-sec gd-sec--today" aria-labelledby="gd-today">
            <SectionHead
              id="gd-today"
              title="Today"
              action={<Link to="/crm/tasks" className="gd-sec-link">All tasks</Link>}
            />
            {loading ? <SkeletonRows count={4} /> : <Today queue={queue} />}
          </section>

          <div className="gd-overview-side">
            <section className="gd-sec gd-sec--glance" aria-labelledby="gd-glance">
              <SectionHead id="gd-glance" title={isRep ? "Your numbers" : "At a glance"} />
              {loading ? <SkeletonRows count={isRep ? 4 : 5} glyph={false} /> : <Metrics rows={buildMetrics(data?.kpis, { isRep })} />}
            </section>

            {!isRep && (
              <section className="gd-sec gd-sec--sync" aria-labelledby="gd-sync">
                <SyncStatus headingId="gd-sync" />
              </section>
            )}
          </div>

          <section className="gd-sec gd-sec--activity" aria-labelledby="gd-activity">
            <SectionHead id="gd-activity" title="Recent activity" />
            {loading ? <SkeletonRows count={5} /> : <Activity items={activity} />}
          </section>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
