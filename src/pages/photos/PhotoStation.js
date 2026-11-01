import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Box,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudOff,
  ImagePlus,
  Info,
  MapPin,
  RotateCcw,
  ScanLine,
  Search,
  User,
  X,
} from "lucide-react";
import BarcodeScanner from "../inventory/components/BarcodeScanner";
import {
  fetchMine,
  fetchQueue,
  fetchStatus,
  fetchStone,
  prepareShot,
  searchStones,
  uploadCapture,
} from "../../services/photoStationApi";
import { KIND_LABELS, STATUS, groupingHint, issueInfo, kindLabel, rankIssues, stoneLine, uploadFailure } from "./photoText";
import "./photos.css";

/* =============================================================================
 * Photo station — office staff photograph stones that have no picture yet.
 * Scan the sticker (or type the SKU), shoot on the lightbox, and the server
 * cleans the shot and checks its quality. A manager approves it on the review
 * screen, which uploads it to Barak's picture FTP.
 *
 * Built for a long run at the lightbox: after each shot the next stone is one
 * tap away, the queue only shows what is physically at the chosen location,
 * and every shot's fate (waiting, sent, rejected and why) stays visible.
 * ========================================================================== */

const PAGE = 30;
const KIND_KEY = "photos.kind";
const LOCATION_KEY = "photos.location";

const buzz = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
};

const Note = ({ tone, icon: Icon = Info, children }) => (
  <div className={`ph-note${tone ? ` ph-note--${tone}` : ""}`}>
    <Icon size={18} strokeWidth={2} aria-hidden="true" />
    <div>{children}</div>
  </div>
);

const Pill = ({ status }) => {
  const s = STATUS[status];
  return s ? <span className={`ph-pill ph-pill--${s.tone}`}>{s.label}</span> : null;
};

/* ---------------------------------------------------------------- SKU finder */

const SkuFinder = ({ onOpen, busy }) => {
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setItems([]);
      return undefined;
    }
    const id = ++seq.current;
    const t = setTimeout(() => {
      searchStones(q)
        .then((r) => id === seq.current && setItems(r.items || []))
        .catch(() => id === seq.current && setItems([]));
    }, 180);
    return () => clearTimeout(t);
  }, [text]);

  const pick = (sku) => {
    setOpen(false);
    setText("");
    onOpen(sku);
  };

  return (
    <form
      className="ph-find"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = text.trim();
        if (!q) return;
        const exact = items.find((s) => s.sku.toUpperCase() === q.toUpperCase());
        pick(exact ? exact.sku : items.length === 1 ? items[0].sku : q);
      }}
    >
      <label className="ph-field">
        <Search size={18} strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="או הקלד מק״ט"
          aria-label="מק״ט"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck="false"
          enterKeyHint="go"
          disabled={busy}
        />
        {text && (
          <button type="button" className="ph-clear" aria-label="נקה" onClick={() => setText("")}>
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </label>
      {open && items.length > 0 && (
        <ul className="ph-suggest">
          {items.map((s) => (
            <li key={s.sku}>
              <button type="button" className="ph-row" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s.sku)}>
                <span className="ph-row-main">
                  <span className="ph-row-sku">{s.sku}</span>
                  <span className="ph-row-meta">
                    {[stoneLine(s), s.location].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="ph-row-side">
                  {s.hasPhoto && <span className="ph-pill ph-pill--neutral">יש תמונה</span>}
                  <ChevronLeft size={18} aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
};

/* ---------------------------------------------------------------- home */

const Stats = ({ queue }) => (
  <div className="ph-card ph-stats">
    <div className="ph-stat ph-stat--accent">
      <b>{queue ? queue.mineToday : "–"}</b>
      <span>צילמת היום</span>
    </div>
    <div className="ph-stat">
      <b>{queue ? queue.mineWeek : "–"}</b>
      <span>השבוע</span>
    </div>
    <div className="ph-stat">
      <b>{queue ? queue.awaitingReview : "–"}</b>
      <span>ממתינות לאישור</span>
    </div>
    <div className="ph-stat">
      <b>{queue ? Number(queue.remaining || 0).toLocaleString("he-IL") : "–"}</b>
      <span>בלי תמונה</span>
    </div>
  </div>
);

const Recent = ({ items, onOpen }) =>
  items.length > 0 ? (
    <>
      <div className="ph-section">
        <h2>הצילומים שלך</h2>
        <span>הקש כדי לצלם שוב</span>
      </div>
      <div className="ph-recent">
        {items.map((c) => (
          <button key={c.id} type="button" className="ph-thumb" onClick={() => onOpen(c.sku)}>
            <span className="ph-thumb-img">
              {c.cleanUrl && <img src={c.cleanUrl} alt="" loading="lazy" />}
              <Pill status={c.status} />
            </span>
            <span className="ph-thumb-sku">{c.sku}</span>
          </button>
        ))}
      </div>
    </>
  ) : null;

const QueueRow = ({ s, onOpen }) => (
  <li>
    <button type="button" className="ph-row" onClick={() => onOpen(s.sku)}>
      <span className="ph-row-rank">{s.rank}</span>
      <span className="ph-row-main">
        <span className="ph-row-sku">{s.sku}</span>
        <span className="ph-row-meta">{[stoneLine(s), s.location].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="ph-row-side">
        {s.lastRejected && (
          <span className="ph-pill ph-pill--rejected" title={s.lastRejected.reason || ""}>
            נדחתה
          </span>
        )}
        <ChevronLeft size={18} aria-hidden="true" />
      </span>
    </button>
  </li>
);

const Queue = ({ queue, loading, kind, location, onKind, onLocation, onOpen, onMore }) => {
  const kinds = queue?.kinds || {};
  const locations = queue?.locations || [];
  return (
    <>
      <div className="ph-section">
        <h2>הבאות בתור</h2>
        {queue && <span>{Number(queue.matching ?? queue.items?.length ?? 0).toLocaleString("he-IL")} אבנים · היקרות ראשונות</span>}
      </div>

      {locations.length > 1 && (
        <div className="ph-chips" role="group" aria-label="מיקום">
          <button type="button" className="ph-chip" aria-pressed={location === "all"} onClick={() => onLocation("all")}>
            <MapPin size={14} strokeWidth={2} aria-hidden="true" />
            כל המקומות
          </button>
          {locations.slice(0, 6).map((l) => (
            <button
              key={l.name}
              type="button"
              className="ph-chip"
              aria-pressed={location === l.name}
              onClick={() => onLocation(l.name)}
            >
              {l.name} <small>{l.n.toLocaleString("he-IL")}</small>
            </button>
          ))}
        </div>
      )}

      <div className="ph-seg" role="group" aria-label="סוג" style={{ marginBottom: 12 }}>
        {KIND_LABELS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={kind === id} onClick={() => onKind(id)} disabled={id !== "all" && !kinds[id]}>
            {label}
          </button>
        ))}
      </div>

      {!queue ? (
        <ul className="ph-list" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} style={{ padding: "14px 16px" }}>
              <div className="ph-skel" style={{ width: "40%", height: 16 }} />
              <div className="ph-skel" style={{ width: "65%", height: 12, marginTop: 8 }} />
            </li>
          ))}
        </ul>
      ) : queue.items.length === 0 ? (
        <div className="ph-card ph-empty">
          <b>אין כאן אבנים שמחכות לצילום</b>
          נסה מיקום או סוג אחר.
        </div>
      ) : (
        <>
          <ul className="ph-list" style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
            {queue.items.map((s) => (
              <QueueRow key={s.sku} s={s} onOpen={onOpen} />
            ))}
          </ul>
          {queue.items.length < queue.matching && (
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button type="button" className="ph-btn ph-btn--sm" onClick={onMore} disabled={loading}>
                הצג עוד
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
};

/* ---------------------------------------------------------------- stone */

const StoneCard = ({ stone }) => (
  <div className="ph-card">
    <div className="ph-hero">
      <div className="ph-hero-kind">{kindLabel(stone.groupingType)}</div>
      <h1 className="ph-hero-sku">{stone.sku}</h1>
      <div className="ph-hero-line ph-ltr">{stoneLine(stone)}</div>
    </div>
    {(stone.location || stone.box || stone.holder) && (
      <dl className="ph-facts">
        {stone.location && (
          <div className="ph-fact">
            <dt>
              <MapPin size={16} aria-hidden="true" />
              מיקום
            </dt>
            <dd>{stone.location}</dd>
          </div>
        )}
        {stone.box && (
          <div className="ph-fact">
            <dt>
              <Box size={16} aria-hidden="true" />
              קופסה
            </dt>
            <dd className="ph-ltr">{stone.box}</dd>
          </div>
        )}
        {stone.holder && (
          <div className="ph-fact">
            <dt>
              <User size={16} aria-hidden="true" />
              אצל
            </dt>
            <dd>{stone.holder}</dd>
          </div>
        )}
      </dl>
    )}
  </div>
);

const StoneNotes = ({ stone }) => {
  const last = stone.lastCapture;
  const hint = groupingHint(stone.groupingType, stone.stones);
  return (
    <div className="ph-notes">
      <Note>בדוק שהמק״ט על המדבקה זהה למק״ט שעל המסך.</Note>
      {hint && <Note tone="warn" icon={AlertTriangle}>{hint}</Note>}
      {stone.onMemo && (
        <Note tone="warn" icon={AlertTriangle}>
          האבן רשומה בממו אצל לקוח. ודא שהיא באמת כאן.
        </Note>
      )}
      {stone.hasPhoto && (
        <Note tone="warn" icon={AlertTriangle}>
          לאבן הזאת כבר יש תמונה במערכת. צלם רק אם ביקשו ממך.
        </Note>
      )}
      {last?.status === "pending" && (
        <Note tone="warn" icon={Clock}>
          כבר יש צילום שמחכה לאישור. צילום חדש יחליף אותו.
        </Note>
      )}
      {last?.status === "uploaded" && (
        <Note tone="good" icon={Check}>
          תמונה של האבן כבר נשלחה לברק.
        </Note>
      )}
      {last?.status === "rejected" && (
        <Note tone="bad" icon={RotateCcw}>
          <b>הצילום הקודם נדחה</b>
          {last.rejectReason ? `: ${last.rejectReason}.` : "."} צלם שוב.
        </Note>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------- page */

export default function PhotoStation() {
  const [screen, setScreen] = useState("home");
  const [status, setStatus] = useState(null);
  const [queue, setQueue] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [mine, setMine] = useState([]);
  const [limit, setLimit] = useState(PAGE);
  const [kind, setKind] = useState(() => localStorage.getItem(KIND_KEY) || "all");
  const [location, setLocation] = useState(() => localStorage.getItem(LOCATION_KEY));
  const [stone, setStone] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const shotThisVisit = useRef(new Set());
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);
  const lastShot = useRef(null);

  const loadQueue = useCallback(() => {
    setQueueLoading(true);
    fetchQueue({ limit, kind, location: location || "all" })
      .then((q) => {
        setQueue(q);
        // First visit: start where most of the stones are — the office.
        if (location == null && q.locations?.[0]) {
          localStorage.setItem(LOCATION_KEY, q.locations[0].name);
          setLocation(q.locations[0].name);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setQueueLoading(false));
  }, [limit, kind, location]);

  const loadMine = useCallback(() => {
    fetchMine(12).then((r) => setMine(r.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    loadMine();
    fetchStatus().then(setStatus).catch(() => {});
  }, [loadMine]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const chooseKind = (k) => {
    localStorage.setItem(KIND_KEY, k);
    setLimit(PAGE);
    setKind(k);
  };
  const chooseLocation = (l) => {
    localStorage.setItem(LOCATION_KEY, l);
    setLimit(PAGE);
    setLocation(l);
  };

  const openStone = async (sku) => {
    const code = String(sku || "").trim();
    if (!code) return;
    setError("");
    setBusy(true);
    try {
      setStone(await fetchStone(code));
      setResult(null);
      setScreen("stone");
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e.status === 404 ? `המק״ט ${code} לא נמצא במלאי. בדוק את המדבקה ונסה שוב.` : e.message);
    } finally {
      setBusy(false);
    }
  };

  const send = async (shot) => {
    setScreen("processing");
    window.scrollTo(0, 0);
    try {
      const r = await uploadCapture(stone.sku, shot);
      shotThisVisit.current.add(stone.sku);
      setResult(r);
      buzz((r.quality?.issues || []).length ? [60, 50, 60] : 30);
      loadQueue();
      loadMine();
    } catch (err) {
      if (err.status === 422) setResult({ rejected: true, quality: err.body && err.body.quality });
      else setResult({ failed: uploadFailure(err), canResend: true });
      buzz([80, 60, 80]);
    }
    setScreen("result");
  };

  const onPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file || !stone) return;
    setError("");
    setPreview(URL.createObjectURL(file));
    setScreen("processing");
    window.scrollTo(0, 0);
    try {
      lastShot.current = await prepareShot(file);
    } catch {
      lastShot.current = null;
      setResult({ failed: "לא הצלחנו לקרוא את התמונה. צלם אותה שוב מכאן." });
      setScreen("result");
      return;
    }
    send(lastShot.current);
  };

  const backHome = () => {
    setStone(null);
    setResult(null);
    setError("");
    setScreen("home");
    window.scrollTo(0, 0);
  };

  const next = useMemo(
    () => (queue?.items || []).find((s) => s.sku !== stone?.sku && !shotThisVisit.current.has(s.sku)) || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, stone, result]
  );

  const issues = rankIssues(result?.quality?.issues);
  const verdict = !result ? null : result.failed ? "error" : result.rejected ? "bad" : issues.length ? "warn" : "good";
  // A missing stone names its likely cause second; that cause is what to fix.
  const headline = verdict === "bad" ? issueInfo("no_stone") : issueInfo(issues[0]);
  const fix = verdict === "bad" ? issueInfo(issues[1] || "no_stone").fix : headline.fix;
  const others = verdict === "warn" ? issues.slice(1) : [];
  const shoot = () => cameraRef.current?.click();

  return (
    <div className="ph" dir="rtl">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
      <input ref={libraryRef} type="file" accept="image/*" hidden onChange={onPhoto} />
      <BarcodeScanner isOpen={scanOpen} onClose={() => setScanOpen(false)} onScan={(code) => openStone(code)} />

      {screen === "home" && (
        <div className="ph-page">
          <header className="ph-head">
            <div>
              <h1 className="ph-title">צילום אבנים</h1>
              <p className="ph-sub">צלם אבן. אחרי אישור מנהל היא עולה לברק.</p>
            </div>
            {status?.canReview && (
              <Link to="/photos/review" className="ph-btn ph-btn--sm">
                אישור תמונות
                {queue?.awaitingReview ? <span className="ph-pill ph-pill--pending">{queue.awaitingReview}</span> : null}
              </Link>
            )}
          </header>

          {error && (
            <div className="ph-notes" style={{ marginTop: 0, marginBottom: 12 }}>
              <Note tone="bad" icon={AlertTriangle}>{error}</Note>
            </div>
          )}

          <Stats queue={queue} />

          <div style={{ marginTop: 16 }}>
            <button type="button" className="ph-btn ph-btn--primary ph-btn--lg ph-btn--block" onClick={() => setScanOpen(true)} disabled={busy}>
              <ScanLine size={22} strokeWidth={2} aria-hidden="true" />
              סרוק מדבקה של אבן
            </button>
            <SkuFinder onOpen={openStone} busy={busy} />
          </div>

          <Recent items={mine} onOpen={openStone} />

          <Queue
            queue={queue}
            loading={queueLoading}
            kind={kind}
            location={location || "all"}
            onKind={chooseKind}
            onLocation={chooseLocation}
            onOpen={openStone}
            onMore={() => setLimit((n) => n + PAGE)}
          />
        </div>
      )}

      {screen === "stone" && stone && (
        <div className="ph-page ph-page--bar">
          <button type="button" className="ph-back" onClick={backHome}>
            <ChevronRight size={20} aria-hidden="true" />
            רשימה
          </button>

          {error && (
            <div className="ph-notes">
              <Note tone="bad" icon={AlertTriangle}>{error}</Note>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <StoneCard stone={stone} />
          </div>
          <StoneNotes stone={stone} />

          <ol className="ph-card ph-steps">
            <li>הנח את האבן על המשטח הלבן, בלי פינצטה</li>
            <li>החזק את הטלפון ישר מעליה והקש עליה כדי למקד</li>
            <li>צלם. הרקע מתנקה והאבן ממורכזת אוטומטית</li>
          </ol>

          <div className="ph-bar">
            <div className="ph-bar-inner">
              <button type="button" className="ph-btn ph-btn--primary ph-btn--lg ph-btn--block" onClick={shoot}>
                <Camera size={22} strokeWidth={2} aria-hidden="true" />
                צלם את האבן
              </button>
              <button type="button" className="ph-btn ph-btn--quiet ph-btn--sm" onClick={() => libraryRef.current?.click()}>
                <ImagePlus size={16} aria-hidden="true" />
                בחר תמונה קיימת
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "processing" && stone && (
        <div className="ph-page">
          <div className="ph-hero" style={{ paddingTop: 4 }}>
            <div className="ph-hero-kind">מעבד</div>
            <h1 className="ph-hero-sku" style={{ fontSize: 28 }}>{stone.sku}</h1>
          </div>
          <div className="ph-shot">
            {preview && <img src={preview} alt="" />}
            <div className="ph-shot-veil" role="status">
              <span className="ph-spin" aria-hidden="true" />
              מנקה רקע ובודק איכות
              <small>כמה שניות. אל תסגור את המסך.</small>
            </div>
          </div>
        </div>
      )}

      {screen === "result" && stone && result && (
        <div className="ph-page ph-page--bar">
          <button type="button" className="ph-back" onClick={backHome}>
            <ChevronRight size={20} aria-hidden="true" />
            רשימה
          </button>

          <div className={`ph-shot${verdict === "good" ? "" : " ph-shot--compact"}`} style={{ marginTop: 8 }}>
            {(result.cleanUrl || preview) && <img src={result.cleanUrl || preview} alt={stone.sku} />}
          </div>

          <div className="ph-verdict">
            <div className={`ph-verdict-icon ph-verdict-icon--${verdict === "error" ? "bad" : verdict}`}>
              {verdict === "good" ? (
                <Check size={28} strokeWidth={2.5} />
              ) : verdict === "warn" ? (
                <AlertTriangle size={26} />
              ) : verdict === "error" ? (
                <CloudOff size={26} />
              ) : (
                <RotateCcw size={26} />
              )}
            </div>
            <h2>
              {verdict === "good" ? "התמונה נשלחה לאישור" : verdict === "error" ? "התמונה לא נשלחה" : headline.title}
            </h2>
            <p className="ph-ltr" style={{ fontWeight: 600 }}>{stone.sku}</p>
            {verdict === "good" && <p>אחרי אישור מנהל היא תעלה לברק.</p>}
            {verdict === "warn" && <p>התמונה נשמרה ותגיע לאישור, אבל עדיף לצלם שוב.</p>}
            {verdict === "error" && <p>{result.failed}</p>}
          </div>

          {(verdict === "warn" || verdict === "bad") && (
            <div className="ph-card ph-fix">
              <span className="ph-fix-label">איך לתקן</span>
              <p>{fix}</p>
              {others.length > 0 && (
                <ul>
                  {others.map((code) => (
                    <li key={code}>גם: {issueInfo(code).title}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(verdict === "good" || verdict === "warn") && next && (
            <button type="button" className="ph-next" onClick={() => openStone(next.sku)}>
              <span className="ph-row-main">
                <span className="ph-next-label">הבאה בתור</span>
                <span className="ph-row-sku">{next.sku}</span>
                <span className="ph-row-meta">{[stoneLine(next), next.location].filter(Boolean).join(" · ")}</span>
              </span>
              <ChevronLeft size={20} aria-hidden="true" style={{ color: "var(--dna-text-4)" }} />
            </button>
          )}

          <div className="ph-bar">
            <div className="ph-bar-inner">
              {verdict === "good" ? (
                <>
                  <button type="button" className="ph-btn ph-btn--primary ph-btn--lg ph-btn--block" onClick={() => setScanOpen(true)}>
                    <ScanLine size={22} strokeWidth={2} aria-hidden="true" />
                    סרוק את האבן הבאה
                  </button>
                  <button type="button" className="ph-btn ph-btn--quiet ph-btn--sm" onClick={shoot}>
                    <Camera size={16} aria-hidden="true" />
                    צלם שוב בכל זאת
                  </button>
                </>
              ) : verdict === "error" && result.canResend && lastShot.current ? (
                <>
                  <button
                    type="button"
                    className="ph-btn ph-btn--primary ph-btn--lg ph-btn--block"
                    onClick={() => send(lastShot.current)}
                  >
                    <RotateCcw size={20} strokeWidth={2} aria-hidden="true" />
                    שלח שוב את אותה תמונה
                  </button>
                  <button type="button" className="ph-btn ph-btn--quiet ph-btn--sm" onClick={shoot}>
                    <Camera size={16} aria-hidden="true" />
                    צלם מחדש
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="ph-btn ph-btn--primary ph-btn--lg ph-btn--block" onClick={shoot}>
                    <Camera size={22} strokeWidth={2} aria-hidden="true" />
                    צלם שוב
                  </button>
                  <button type="button" className="ph-btn ph-btn--quiet ph-btn--sm" onClick={backHome}>
                    {verdict === "warn" ? "השאר את התמונה וחזור לרשימה" : "חזרה לרשימה"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
