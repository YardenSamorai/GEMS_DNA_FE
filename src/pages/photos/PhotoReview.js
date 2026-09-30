import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { approveCapture, fetchCaptures, fetchStatus, rejectCapture } from "../../services/photoStationApi";
import { issueText, stoneLine } from "./photoText";

const TABS = [
  { key: "pending", label: "ממתינות לאישור" },
  { key: "uploaded", label: "נשלחו לברק" },
  { key: "rejected", label: "נדחו" },
];

const when = (iso) => (iso ? new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "");

const Variant = ({ label, url, selected, onSelect, note }) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={!onSelect}
    className={`flex flex-col gap-1 rounded-xl border-2 p-1.5 text-center transition ${
      selected ? "border-brand-emerald ring-2 ring-brand-emerald/30" : "border-app-line"
    } ${onSelect ? "" : "cursor-default"}`}
  >
    {url ? (
      <img src={url} alt={label} className="aspect-square w-full rounded-lg bg-white object-contain" loading="lazy" />
    ) : (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-app-canvas2 p-2 text-xs text-app-muted">{note || "אין"}</div>
    )}
    <span className="text-sm font-semibold text-app-ink">
      {selected ? "✓ " : ""}
      {label}
    </span>
  </button>
);

const CaptureCard = ({ item, onDone }) => {
  const [variant, setVariant] = useState("clean");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(item.uploadError || "");
  const pending = item.status === "pending";
  const issues = (item.quality && item.quality.issues) || [];

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
    const reason = window.prompt("סיבת הדחייה (לא חובה):", "");
    if (reason === null) return;
    setBusy(true);
    try {
      await rejectCapture(item.id, reason);
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-app-line bg-app-surface p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-2xl font-black text-app-ink" dir="ltr">{item.sku}</div>
          <div className="text-sm text-app-graphite" dir="ltr">{stoneLine({ sku: item.sku, ...(item.stone || {}) })}</div>
        </div>
        <div className="text-sm text-app-muted">
          צולם ע״י {item.capturedBy || "?"} · {when(item.capturedAt)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Variant label="מקור" url={item.originalUrl} />
        <Variant
          label="ניקוי"
          url={item.cleanUrl}
          selected={pending ? variant === "clean" : item.chosenVariant === "clean"}
          onSelect={pending ? () => setVariant("clean") : null}
        />
        <Variant
          label="חיתוך AI"
          url={item.cutoutUrl}
          note={item.cutoutError ? "חיתוך AI לא זמין" : null}
          selected={pending ? variant === "cutout" : item.chosenVariant === "cutout"}
          onSelect={pending && item.cutoutUrl ? () => setVariant("cutout") : null}
        />
      </div>

      {issues.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="font-semibold">הבדיקה האוטומטית מצאה:</div>
          {issues.map((c) => (
            <div key={c}>• {issueText(c)}</div>
          ))}
        </div>
      )}
      {item.filenameWarning && pending && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" dir="ltr">
          {item.filenameWarning}
        </div>
      )}
      {error && <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">ההעלאה לברק נכשלה: {error}</div>}

      {pending && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={approve}
            disabled={busy}
            className="flex-1 rounded-xl bg-brand-emerald px-4 py-3 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? "שולח…" : "אשר ושלח לברק"}
          </button>
          <button
            type="button"
            onClick={reject}
            disabled={busy}
            className="rounded-xl border-2 border-app-line px-5 py-3 text-lg font-semibold text-app-ink disabled:opacity-50"
          >
            דחה
          </button>
        </div>
      )}
      {item.status === "uploaded" && (
        <div className="text-sm text-app-graphite">
          אושר ע״י {item.reviewedBy || "?"} · נשלח כ-<span dir="ltr" className="font-mono">{item.ftpFilename}</span> · {when(item.uploadedAt)}
        </div>
      )}
      {item.status === "rejected" && (
        <div className="text-sm text-app-graphite">
          נדחה ע״י {item.reviewedBy || "?"} · {when(item.reviewedAt)}
          {item.rejectReason ? ` · ${item.rejectReason}` : ""}
        </div>
      )}
    </div>
  );
};

export default function PhotoReview() {
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

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

  const conn = status && status.ftpConnection;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl px-4 py-5 space-y-4 text-right">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-app-ink">אישור תמונות</h1>
        <Link to="/photos" className="rounded-xl border border-app-line px-4 py-2 text-sm font-semibold text-app-ink">
          לעמדת הצילום
        </Link>
      </div>

      {status && !status.ftp && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-900">חיבור ה-FTP של ברק לא מוגדר בשרת. אי אפשר לשלוח תמונות.</div>
      )}
      {conn && !conn.ok && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-900">
          אין חיבור ל-FTP של ברק כרגע: <span dir="ltr">{conn.error}</span>
        </div>
      )}
      {status && !status.cutout && (
        <div className="rounded-xl border border-app-line bg-app-canvas2 px-4 py-2 text-sm text-app-graphite">
          חיתוך AI כבוי (לא הוגדר מפתח remove.bg). זמינה רק גרסת הניקוי.
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === t.key ? "bg-app-ink text-app-surface" : "border border-app-line text-app-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "uploaded" && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          התמונות נמצאות ב-FTP של ברק. כדי לקשר אותן לאבנים: בברק פותחים Picture Mapping, בוחרים Non-Linked, Parcel Name,
          Suffix <span dir="ltr" className="font-mono">{(status && status.suffix) || "_DNA"}</span>, Extension{" "}
          <span dir="ltr" className="font-mono">jpg</span>, ומריצים. התמונה תופיע ב-DNA אחרי הייצוא הבא מברק.
        </div>
      )}

      {error && <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-900">{error}</div>}
      {!items && <div className="text-app-muted">טוען…</div>}
      {items && items.length === 0 && !error && <div className="py-10 text-center text-app-muted">אין תמונות כאן.</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {items && items.map((item) => <CaptureCard key={item.id} item={item} onDone={load} />)}
      </div>
    </div>
  );
}
