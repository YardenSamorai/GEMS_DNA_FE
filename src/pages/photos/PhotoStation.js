import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BarcodeScanner from "../inventory/components/BarcodeScanner";
import { fetchQueue, fetchStatus, fetchStone, prepareShot, uploadCapture } from "../../services/photoStationApi";
import { groupingHint, issueText, stoneLine } from "./photoText";

const BigButton = ({ children, onClick, tone = "primary", disabled, className = "" }) => {
  const tones = {
    primary: "bg-app-ink text-app-surface",
    good: "bg-brand-emerald text-white",
    plain: "bg-app-surface text-app-ink border-2 border-app-line",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-[64px] rounded-2xl px-6 text-xl font-bold shadow-sm active:scale-[0.99] disabled:opacity-50 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
};

const Notice = ({ tone = "info", children }) => {
  const tones = {
    info: "bg-sky-50 text-sky-900 border-sky-200",
    warn: "bg-amber-50 text-amber-900 border-amber-300",
    bad: "bg-red-50 text-red-900 border-red-300",
    good: "bg-emerald-50 text-emerald-900 border-emerald-300",
  };
  return <div className={`rounded-xl border-2 px-4 py-3 text-lg leading-snug ${tones[tone]}`}>{children}</div>;
};

const StoneHeader = ({ stone }) => (
  <div className="rounded-2xl bg-app-surface border border-app-line p-5 text-center">
    <div className="text-sm text-app-muted">מק״ט</div>
    <div className="text-4xl font-black tracking-wide text-app-ink break-all" dir="ltr">{stone.sku}</div>
    <div className="mt-2 text-lg text-app-graphite" dir="ltr">{stoneLine(stone)}</div>
  </div>
);

export default function PhotoStation() {
  const [screen, setScreen] = useState("home");
  const [queue, setQueue] = useState(null);
  const [status, setStatus] = useState(null);
  const [stone, setStone] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [typedSku, setTypedSku] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const loadQueue = useCallback(() => {
    fetchQueue(12).then(setQueue).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadQueue();
    fetchStatus().then(setStatus).catch(() => {});
  }, [loadQueue]);

  const openStone = async (sku) => {
    const clean = String(sku || "").trim();
    if (!clean) return;
    setError("");
    setBusy(true);
    try {
      setStone(await fetchStone(clean));
      setScreen("stone");
    } catch (e) {
      setError(e.status === 404 ? `המק״ט ${clean} לא נמצא במלאי. בדוק את המדבקה ונסה שוב.` : e.message);
    } finally {
      setBusy(false);
    }
  };

  const onScan = (code) => {
    setScanOpen(false);
    openStone(code);
  };

  const onPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file || !stone) return;
    setError("");
    setScreen("processing");
    try {
      const shot = await prepareShot(file);
      setResult(await uploadCapture(stone.sku, shot));
      setScreen("result");
    } catch (err) {
      if (err.status === 422) {
        setResult({ rejected: true, quality: err.body && err.body.quality });
        setScreen("result");
      } else {
        setError(`ההעלאה נכשלה: ${err.message}. נסה שוב.`);
        setScreen("stone");
      }
    }
  };

  const takePhoto = () => fileRef.current && fileRef.current.click();

  const backHome = () => {
    setStone(null);
    setResult(null);
    setError("");
    setTypedSku("");
    setScreen("home");
    loadQueue();
  };

  const issues = (result && result.quality && result.quality.issues) || [];
  const good = result && !result.rejected && issues.length === 0;
  const last = stone && stone.lastCapture;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-xl px-4 py-5 space-y-5 text-right">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
      <BarcodeScanner isOpen={scanOpen} onClose={() => setScanOpen(false)} onScan={onScan} />

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-app-ink">עמדת צילום</h1>
        {status && status.canReview && (
          <Link to="/photos/review" className="rounded-xl border border-app-line px-4 py-2 text-base font-semibold text-app-ink">
            אישור תמונות{queue && queue.awaitingReview ? ` (${queue.awaitingReview})` : ""}
          </Link>
        )}
      </div>

      {error && <Notice tone="bad">{error}</Notice>}

      {screen === "home" && (
        <>
          {queue && (
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-app-surface border border-app-line p-4">
                <div className="text-4xl font-black text-app-ink">{queue.mineToday}</div>
                <div className="text-base text-app-muted">צילמת היום</div>
              </div>
              <div className="rounded-2xl bg-app-surface border border-app-line p-4">
                <div className="text-4xl font-black text-app-ink">{queue.remaining}</div>
                <div className="text-base text-app-muted">אבנים בלי תמונה</div>
              </div>
            </div>
          )}

          <BigButton onClick={() => setScanOpen(true)} disabled={busy}>סרוק מדבקה של אבן</BigButton>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              openStone(typedSku);
            }}
          >
            <input
              value={typedSku}
              onChange={(e) => setTypedSku(e.target.value)}
              placeholder="או הקלד מק״ט"
              dir="ltr"
              className="min-w-0 flex-1 rounded-xl border-2 border-app-line bg-app-surface px-4 py-3 text-xl text-app-ink"
            />
            <button type="submit" disabled={busy || !typedSku.trim()} className="rounded-xl bg-app-ink px-5 text-lg font-bold text-app-surface disabled:opacity-40">
              פתח
            </button>
          </form>

          <div>
            <h2 className="mb-2 text-xl font-bold text-app-ink">הבאות בתור לצילום</h2>
            <p className="mb-3 text-base text-app-muted">האבנים החשובות ביותר ראשונות. לחץ על אבן כדי לצלם אותה.</p>
            {!queue && <div className="text-app-muted">טוען…</div>}
            {queue && queue.items.length === 0 && <Notice tone="good">אין אבנים שמחכות לצילום. כל הכבוד!</Notice>}
            <div className="space-y-2">
              {queue &&
                queue.items.map((s) => (
                  <button
                    key={s.sku}
                    type="button"
                    onClick={() => openStone(s.sku)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-app-line bg-app-surface px-4 py-4 text-right active:bg-app-canvas2"
                  >
                    <span className="text-2xl font-black text-app-muted">{s.rank}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-2xl font-bold text-app-ink break-all" dir="ltr">{s.sku}</span>
                      <span className="block text-base text-app-graphite" dir="ltr">{stoneLine(s)}</span>
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </>
      )}

      {screen === "stone" && stone && (
        <>
          <StoneHeader stone={stone} />
          <Notice tone="info">בדוק שהמק״ט על המדבקה זהה למק״ט שעל המסך.</Notice>
          {groupingHint(stone.groupingType, stone.stones) && <Notice tone="warn">{groupingHint(stone.groupingType, stone.stones)}</Notice>}
          {stone.hasPhoto && <Notice tone="warn">לאבן הזאת כבר יש תמונה במערכת. צלם רק אם ביקשו ממך.</Notice>}
          {stone.onMemo && <Notice tone="warn">האבן רשומה כנמצאת בממו אצל לקוח. ודא שהיא באמת כאן.</Notice>}
          {last && last.status === "pending" && <Notice tone="warn">כבר צילמו את האבן והתמונה מחכה לאישור. צילום חדש יחליף אותה.</Notice>}
          {last && last.status === "uploaded" && <Notice tone="warn">תמונה של האבן הזאת כבר נשלחה לברק.</Notice>}
          <div className="rounded-2xl border border-app-line bg-app-surface p-4 text-lg text-app-graphite space-y-1">
            <div>1. שים את האבן במרכז הלייטבוקס.</div>
            <div>2. החזק את הטלפון ישר מעל האבן.</div>
            <div>3. לחץ על הכפתור וצלם.</div>
          </div>
          <BigButton tone="good" onClick={takePhoto}>צלם את האבן</BigButton>
          <BigButton tone="plain" onClick={backHome}>חזרה</BigButton>
        </>
      )}

      {screen === "processing" && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-app-line border-t-app-ink" />
          <div className="text-2xl font-bold text-app-ink">מסדר את התמונה…</div>
          <div className="text-lg text-app-muted">זה לוקח כמה שניות. אל תסגור את המסך.</div>
        </div>
      )}

      {screen === "result" && stone && result && (
        <>
          <StoneHeader stone={stone} />
          {result.cleanUrl && (
            <img src={result.cleanUrl} alt={stone.sku} className="w-full rounded-2xl border border-app-line bg-white" />
          )}
          {good ? (
            <Notice tone="good">
              <div className="text-2xl font-bold">התמונה טובה ✓</div>
              <div>היא נשלחה למנהל לאישור.</div>
            </Notice>
          ) : (
            <Notice tone={result.rejected ? "bad" : "warn"}>
              <div className="text-2xl font-bold mb-1">{result.rejected ? "צריך לצלם שוב" : "כדאי לצלם שוב"}</div>
              {issues.map((code) => (
                <div key={code}>• {issueText(code)}</div>
              ))}
            </Notice>
          )}
          {good ? (
            <>
              <BigButton tone="good" onClick={backHome}>לאבן הבאה</BigButton>
              <BigButton tone="plain" onClick={takePhoto}>צלם שוב בכל זאת</BigButton>
            </>
          ) : (
            <>
              <BigButton tone="good" onClick={takePhoto}>צלם שוב</BigButton>
              {!result.rejected && <BigButton tone="plain" onClick={backHome}>השאר את התמונה ועבור לאבן הבאה</BigButton>}
              {result.rejected && <BigButton tone="plain" onClick={backHome}>חזרה</BigButton>}
            </>
          )}
        </>
      )}
    </div>
  );
}
