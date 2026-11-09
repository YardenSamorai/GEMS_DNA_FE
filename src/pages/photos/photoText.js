// Hebrew copy shared by the photo station and its review screen. The station
// is used by office staff who work in Hebrew, so both screens are RTL.

// One plain instruction per quality problem the server can report: what to
// fix, not what went wrong.
// What the server's quality check found, in the order that matters: the
// first one is the headline, and its `fix` is the one thing to do next.
// `no_stone` comes with a second code saying why, which supplies the fix.
const ISSUES = {
  no_stone: { title: "לא מצאנו אבן בתמונה", fix: "שים את האבן במרכז הלייטבוקס וצלם מלמעלה." },
  stone_cut_off: {
    title: "האבן נחתכה בקצה התמונה",
    fix: "הרחק מעט את הטלפון, כך שכל האבן תיכנס עם רווח לבן מכל הצדדים.",
  },
  box_cut_off: {
    title: "הקופסה נחתכה בקצה התמונה",
    fix: "הרחק מעט את הטלפון, כך שכל הקופסה, כולל המסגרת, תיכנס לתמונה עם קצת רקע מכל הצדדים.",
  },
  tool_in_photo: {
    title: "יש פינצטה או יד בתמונה",
    fix: "הנח את האבן על הלייטבוקס בלי פינצטה. איפה שהפינצטה מסתירה את האבן אי אפשר לנקות.",
  },
  blurry: {
    title: "התמונה לא חדה",
    fix: "הקש על האבן במסך כדי למקד, הישען עם המרפקים על השולחן וצלם.",
  },
  stone_too_small: {
    title: "האבן קטנה מדי בתמונה",
    fix: "התקרב, או עבור לזום 2x, עד שהאבן ממלאת בערך שליש מרוחב המסך.",
  },
  low_resolution: {
    title: "התמונה ברזולוציה נמוכה",
    fix: "צלם מכאן ישירות. תמונה שעברה בוואטסאפ או נחתכה מאבדת חדות.",
  },
  dark_background: { title: "הרקע כהה מדי", fix: "הדלק את הלייטבוקס והנח את האבן על המשטח הלבן." },
  lightbox_off: {
    title: "הלייטבוקס נראה כבוי",
    fix: "הדלק את הלייטבוקס והנח את האבן ישירות על המשטח המואר. האור מלמטה עובר דרך האבן, והיא יוצאת בהירה ושקופה במקום כהה.",
  },
  low_contrast: {
    title: "האבן כמעט בצבע של הרקע",
    fix: "ודא שהלייטבוקס דולק ושהאבן מונחת על המשטח הלבן, לא על נייר או על קופסה.",
  },
  too_dark: { title: "האבן חשוכה מדי", fix: "ודא שהתאורה דולקת ושהטלפון או היד לא מטילים צל על האבן." },
  too_bright: { title: "בוהק חזק על האבן", fix: "הטה מעט את הטלפון עד שהנקודה הלבנה על האבן נעלמת." },
  uneven_background: { title: "הרקע לא אחיד", fix: "נקה את המשטח והרחק חפצים וצללים מהאבן." },
};
const ORDER = Object.keys(ISSUES);

export const issueInfo = (code) => ISSUES[code] || { title: "בעיה באיכות התמונה", fix: "צלם שוב." };
export const issueText = (code) => issueInfo(code).title;

export const rankIssues = (codes = []) =>
  [...new Set(codes)].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));

// Upload failures that are not about the photo itself.
export const uploadFailure = (err) => {
  if (!navigator.onLine || err instanceof TypeError) return "אין חיבור לאינטרנט. בדוק את ה־Wi‑Fi ונסה שוב.";
  if (err.name === "AbortError") return "השרת לא ענה בזמן. נסה לשלוח שוב.";
  if (err.status === 401) return "פג תוקף ההתחברות. רענן את הדף והתחבר מחדש.";
  if (err.status === 403) return "אין לך הרשאה לצלם אבנים. פנה למנהל.";
  if (err.status === 404) return "המק״ט לא נמצא במלאי האבנים או התכשיטים. בדוק את המדבקה.";
  if (err.status === 413) return "התמונה גדולה מדי. צלם שוב מהמצלמה.";
  return "משהו השתבש בשרת. התמונה לא אבדה, נסה לשלוח שוב.";
};

// What to put in front of the camera, by the parcel's grouping type.
const IN_BOX = " אם הן בקופסת תצוגה, צלם את הקופסה ישר מלמעלה, כולה בתמונה, והיא תיחתך ותיושר אוטומטית.";
export const groupingHint = (groupingType, stones) => {
  const t = String(groupingType || "").toLowerCase();
  if (t === "pair") return "זוג: צלם את שתי האבנים יחד באותה תמונה.";
  if (t === "set") return `סט: צלם את כל ${stones > 1 ? stones + " " : ""}האבנים יחד באותה תמונה.${IN_BOX}`;
  if (t === "parcel") return `פרצל: צלם את כל הפרצל יחד באותה תמונה.${IN_BOX}`;
  return null;
};

export const KIND_LABELS = [
  ["all", "הכל"],
  ["single", "בודדות"],
  ["pair", "זוגות"],
  ["set", "סטים"],
  ["parcel", "פרצלים"],
];

export const kindLabel = (groupingType) =>
  ({ single: "אבן בודדת", pair: "זוג", set: "סט", parcel: "פרצל" })[String(groupingType || "").toLowerCase()] || "פרצל";

export const itemKind = (item) => (item.itemType === "jewelry" ? "תכשיט" : kindLabel(item.groupingType));

export const STATUS = {
  pending: { label: "ממתינה לאישור", tone: "pending" },
  approved: { label: "נשמרה ב־DNA", tone: "uploaded" },
  uploading: { label: "נשלחת לברק", tone: "pending" },
  uploaded: { label: "נשלחה לברק", tone: "uploaded" },
  rejected: { label: "נדחתה", tone: "rejected" },
};

// One tap for the reasons managers actually give; anything else is typed.
export const REJECT_REASONS = ["מטושטשת", "האבן לא במרכז", "רקע לא נקי", "השתקפות חזקה", "אבן לא נכונה"];

export const when = (iso) =>
  iso ? new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export const stoneLine = (s) =>
  (s.itemType === "jewelry"
    ? [s.category, s.metal, s.weightCt ? `${s.weightCt}ct` : null]
    : [s.category, s.shape, s.weightCt ? `${s.weightCt}ct` : null, s.stones > 1 ? `${s.stones} אבנים` : null]
  )
    .filter(Boolean)
    .join(" · ");
