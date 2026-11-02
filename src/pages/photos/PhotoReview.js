import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ChevronRight, ExternalLink, Info, Sparkles } from "lucide-react";
import { approveCapture, fetchCaptures, fetchStatus, rejectCapture, requestAiVersion } from "../../services/photoStationApi";
import { REJECT_REASONS, issueText, rankIssues, stoneLine, when } from "./photoText";
import "./photos.css";

/* =============================================================================
 * Photo review — a manager looks at each shot from the station, picks the
 * cleaned or the AI version, and approves it (uploaded to Barak's
 * picture FTP) or rejects it with a reason the photographer will see.
 * Shots the automatic check had no complaint about can be approved together.
 * ========================================================================== */

const TABS = [
  ["pending", "ממתינות"],
  ["uploaded", "נשלחו לברק"],
  ["rejected", "נדחו"],
];

const isClean = (item) => !(item.quality?.issues || []).length && !item.filenameWarning;

const Note = ({ tone, children }) => (
  <div className={`ph-note ph-note--${tone}`}>
    <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
    <div>{children}</div>
  </div>
);

const ReviewCard = ({ item, variant, onVariant, onDone, onUpdate, aiAvailable, locked }) => {
  const [busy, setBusy] = useState(false);
  const [aiAsked, setAiAsked] = useState(false);
  const [aiProblem, setAiProblem] = useState("");
  const [error, setError] = useState(item.uploadError || "");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const pending = item.status === "pending";
  const shown = pending ? variant : item.chosenVariant || "clean";
  const url = { clean: item.cleanUrl, cutout: item.cutoutUrl, ai: item.aiUrl }[shown];
  const issues = rankIssues(item.quality?.issues);
  const stone = { sku: item.sku, ...(item.stone || {}) };

  // Show the AI version as soon as the one this reviewer asked for is ready.
  useEffect(() => {
    if (aiAsked && item.aiUrl) {
      onVariant("ai");
      setAiAsked(false);
    }
  }, [aiAsked, item.aiUrl, onVariant]);

  const askAi = async () => {
    setAiProblem("");
    setAiAsked(true);
    try {
      onUpdate(await requestAiVersion(item.id));
    } catch (e) {
      setAiAsked(false);
      setAiProblem(e.message);
    }
  };

  const approve = async () => {
    setBusy(true);
    setError("");
    try {
      await approveCapture(item.id, variant);
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await rejectCapture(item.id, reason.trim());
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <article className="ph-card ph-review">
      <div className="ph-shot">
        {url ? <img src={url} alt={item.sku} loading="lazy" /> : <div className="ph-empty">אין גרסה כזאת</div>}
        {item.originalUrl && (
          <a className="ph-open" href={item.originalUrl} target="_blank" rel="noreferrer">
            מקור
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>

      <div className="ph-review-body">
        {pending && (item.aiUrl || item.cutoutUrl) && (
          <div className="ph-seg" role="group" aria-label="גרסה">
            <button type="button" aria-pressed={variant === "clean"} onClick={() => onVariant("clean")}>
              ניקוי
            </button>
            {item.aiUrl && (
              <button type="button" aria-pressed={variant === "ai"} onClick={() => onVariant("ai")}>
                AI
              </button>
            )}
            {item.cutoutUrl && (
              <button type="button" aria-pressed={variant === "cutout"} onClick={() => onVariant("cutout")}>
                חיתוך
              </button>
            )}
          </div>
        )}
        {pending && aiAvailable && !item.aiUrl && item.cleanUrl && (
          <div className="ph-ai-ask">
            <button
              type="button"
              className="ph-btn ph-btn--sm"
              onClick={askAi}
              disabled={item.aiStatus === "working" || locked}
            >
              <Sparkles size={15} aria-hidden="true" />
              {item.aiStatus === "working" ? "יוצר גרסת AI…" : item.aiStatus === "failed" ? "נסה שוב גרסת AI" : "צור גרסת AI"}
            </button>
            <span>
              {item.aiStatus === "working"
                ? "כדקה וחצי. אפשר להמשיך לעבוד"
                : item.aiStatus === "failed"
                ? `נכשל: ${item.aiError || "שגיאה לא ידועה"}`
                : "מנקה רקע ופינצטה · כ־$0.28"}
            </span>
          </div>
        )}
        {aiProblem && <Note tone="bad">לא הצלחנו לבקש גרסת AI: {aiProblem}</Note>}
        {pending && variant === "ai" && (
          <p className="ph-review-hint">רקע, פינצטה ומיקום טופלו ב־AI. הצבע הוחזר לזה שנמדד בצילום המקורי, אבל פרטים קטנים באבן מצוירים. השווה ל״ניקוי״ לפני שליחה.</p>
        )}

        <div className="ph-review-top">
          <div style={{ minWidth: 0 }}>
            <div className="ph-review-sku">{item.sku}</div>
            <div className="ph-review-meta">{[stoneLine(stone), stone.location].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="ph-review-meta" style={{ textAlign: "left", flex: "none" }}>
            {item.capturedBy || "?"}
            <br />
            {when(item.capturedAt)}
          </div>
        </div>

        {issues.length > 0 && (
          <ul className="ph-issues">
            {issues.map((c) => (
              <li key={c}>{issueText(c)}</li>
            ))}
          </ul>
        )}
        {pending && item.filenameWarning && (
          <Note tone="warn">יש נקודה במק״ט. אחרי הרצת Picture Mapping בברק, ודא שהתמונה התחברה לאבן.</Note>
        )}
        {error && <Note tone="bad">ההעלאה לברק נכשלה: {error}</Note>}

        {pending && !rejecting && (
          <div className="ph-review-actions">
            <button type="button" className="ph-btn ph-btn--primary" onClick={approve} disabled={busy || locked}>
              {busy ? "שולח…" : "אשר ושלח לברק"}
            </button>
            <button type="button" className="ph-btn ph-btn--danger" onClick={() => setRejecting(true)} disabled={busy || locked}>
              דחה
            </button>
          </div>
        )}

        {pending && rejecting && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="ph-reasons">
              {REJECT_REASONS.map((r) => (
                <button key={r} type="button" className="ph-chip" aria-pressed={reason === r} onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
            <input
              className="ph-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="סיבה אחרת (לא חובה)"
              maxLength={300}
            />
            <div className="ph-review-actions">
              <button type="button" className="ph-btn ph-btn--danger" style={{ flex: 1 }} onClick={reject} disabled={busy}>
                {busy ? "דוחה…" : "דחה את הצילום"}
              </button>
              <button type="button" className="ph-btn" onClick={() => setRejecting(false)} disabled={busy}>
                ביטול
              </button>
            </div>
          </div>
        )}

        {item.status === "uploaded" && (
          <div className="ph-review-meta">
            <span className="ph-pill ph-pill--uploaded">
              <Check size={12} strokeWidth={3} aria-hidden="true" />
              נשלחה
            </span>{" "}
            אושר ע״י {item.reviewedBy || "?"} · {when(item.uploadedAt)} ·{" "}
            <span className="ph-ltr" style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{item.ftpFilename}</span>
          </div>
        )}
        {item.status === "rejected" && (
          <div className="ph-review-meta">
            <span className="ph-pill ph-pill--rejected">נדחתה</span> {item.reviewedBy || "?"} · {when(item.reviewedAt)}
            {item.rejectReason ? ` · ${item.rejectReason}` : ""}
          </div>
        )}
      </div>
    </article>
  );
};

export default function PhotoReview() {
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [variants, setVariants] = useState({});
  const [bulk, setBulk] = useState(null);

  const load = useCallback(() => {
    setError("");
    fetchCaptures(tab)
      .then((r) => setItems(r.items))
      .catch((e) => {
        setItems([]);
        setError(e.status === 403 ? "רק מנהלים יכולים לאשר תמונות." : e.message);
      });
  }, [tab]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  useEffect(() => {
    fetchStatus(true).then(setStatus).catch(() => {});
  }, []);

  const aiWorking = tab === "pending" && (items || []).some((i) => i.aiStatus === "working");
  useEffect(() => {
    if (!aiWorking) return undefined;
    const t = setInterval(() => {
      fetchCaptures(tab).then((r) => setItems(r.items)).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [aiWorking, tab]);

  const variantOf = (item) => variants[item.id] || (item.cleanUrl ? "clean" : "cutout");
  const ready = tab === "pending" && items ? items.filter(isClean) : [];

  const approveAll = async () => {
    if (!window.confirm(`לשלוח לברק ${ready.length} תמונות שהבדיקה האוטומטית לא מצאה בהן בעיה?`)) return;
    let failed = 0;
    for (let i = 0; i < ready.length; i += 1) {
      setBulk({ done: i, total: ready.length });
      try {
        await approveCapture(ready[i].id, variantOf(ready[i]));
      } catch {
        failed += 1;
      }
    }
    setBulk(null);
    if (failed) setError(`${failed} תמונות לא נשלחו. הן נשארו ברשימה עם פירוט השגיאה.`);
    load();
  };

  const conn = status?.ftpConnection;

  return (
    <div className="ph" dir="rtl">
      <div className="ph-page ph-page--wide">
        <Link to="/photos" className="ph-back" style={{ textDecoration: "none" }}>
          <ChevronRight size={20} aria-hidden="true" />
          עמדת הצילום
        </Link>

        <header className="ph-head" style={{ marginTop: 4 }}>
          <div>
            <h1 className="ph-title">אישור תמונות</h1>
            <p className="ph-sub">בחר גרסה ואשר. התמונה עולה ל־FTP של ברק, ומשם מקשרים אותה לאבן.</p>
          </div>
        </header>

        <div className="ph-card ph-status">
          {!status ? (
            <span>בודק חיבורים…</span>
          ) : (
            <>
              <span>
                <i className={`ph-dot ${status.ftp && (!conn || conn.ok) ? "ph-dot--good" : "ph-dot--bad"}`} />
                {!status.ftp
                  ? "ה־FTP של ברק לא מוגדר בשרת. אי אפשר לשלוח תמונות."
                  : conn && !conn.ok
                  ? `אין חיבור ל־FTP של ברק: ${conn.error}`
                  : "מחובר ל־FTP של ברק"}
              </span>
              <span>
                <i className={`ph-dot ${status.ai ? "ph-dot--good" : ""}`} />
                {status.ai ? "גרסת AI זמינה לפי בקשה בכל תמונה" : "גרסת AI כבויה. זמינה רק גרסת הניקוי"}
              </span>
            </>
          )}
        </div>

        <div className="ph-toolbar">
          <div className="ph-seg" role="group" aria-label="סטטוס">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>
                {label}
                {tab === id && items && <small>{items.length}</small>}
              </button>
            ))}
          </div>
          {ready.length > 0 && (
            <button type="button" className="ph-btn ph-btn--primary" onClick={approveAll} disabled={Boolean(bulk)}>
              <Check size={18} strokeWidth={2.5} aria-hidden="true" />
              {bulk ? `שולח ${bulk.done + 1} מתוך ${bulk.total}…` : `אשר את כל התקינות (${ready.length})`}
            </button>
          )}
        </div>

        {tab === "uploaded" && (
          <details className="ph-card ph-help" style={{ marginBottom: 16 }}>
            <summary>
              <Info size={16} aria-hidden="true" style={{ verticalAlign: "-3px", marginInlineEnd: 6 }} />
              איך מקשרים את התמונות לאבנים בברק
            </summary>
            <ol>
              <li>בברק פותחים Picture Mapping.</li>
              <li>
                בוחרים <code>Non-Linked</code> ו־<code>Parcel Name</code>.
              </li>
              <li>
                Suffix: <code>{status?.suffix || "_DNA"}</code>, Extension: <code>jpg</code>, ומריצים.
              </li>
              <li>התמונה תופיע ב־DNA אחרי הסנכרון הבא מברק.</li>
            </ol>
          </details>
        )}

        {error && (
          <div className="ph-notes" style={{ marginTop: 0, marginBottom: 16 }}>
            <Note tone="bad">{error}</Note>
          </div>
        )}

        {!items ? (
          <div className="ph-grid" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="ph-card ph-review">
                <div className="ph-skel" style={{ aspectRatio: "1", borderRadius: 0 }} />
                <div className="ph-review-body">
                  <div className="ph-skel" style={{ width: "45%", height: 18 }} />
                  <div className="ph-skel" style={{ width: "70%", height: 12 }} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="ph-card ph-empty">
            <b>{tab === "pending" ? "אין תמונות שמחכות לאישור" : "אין תמונות כאן"}</b>
            {tab === "pending" ? "כל הצילומים טופלו." : ""}
          </div>
        ) : (
          <div className="ph-grid">
            {items.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                variant={variantOf(item)}
                onVariant={(v) => setVariants((m) => ({ ...m, [item.id]: v }))}
                onUpdate={(next) => setItems((list) => list.map((i) => (i.id === next.id ? { ...i, ...next } : i)))}
                aiAvailable={Boolean(status?.ai)}
                onDone={load}
                locked={Boolean(bulk)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
