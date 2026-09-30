// Hebrew copy shared by the photo station and its review screen. The station
// is used by office staff who work in Hebrew, so both screens are RTL.

// One plain instruction per quality problem the server can report: what to
// fix, not what went wrong.
export const ISSUE_TEXT = {
  no_stone: "לא זיהינו אבן בתמונה. שים את האבן במרכז הלייטבוקס.",
  stone_cut_off: "האבן נחתכה בקצה התמונה. הזז אותה למרכז.",
  stone_too_small: "האבן קטנה מדי בתמונה. קרב את הטלפון או השתמש בזום.",
  blurry: "התמונה מטושטשת. החזק את הטלפון יציב ונסה שוב.",
  too_dark: "התמונה חשוכה מדי. בדוק שהתאורה דולקת.",
  too_bright: "יש השתקפות חזקה מדי על האבן.",
  dark_background: "הרקע כהה. ודא שהלייטבוקס דולק.",
  uneven_background: "הרקע לא אחיד. ודא שאין צל או חפצים ליד האבן.",
};

export const issueText = (code) => ISSUE_TEXT[code] || code;

// What to put in front of the camera, by the parcel's grouping type.
export const groupingHint = (groupingType, stones) => {
  const t = String(groupingType || "").toLowerCase();
  if (t === "pair") return "זוג: צלם את שתי האבנים יחד באותה תמונה.";
  if (t === "set") return `סט: צלם את כל ${stones > 1 ? stones + " " : ""}האבנים יחד באותה תמונה.`;
  if (t === "parcel") return "פרצל: צלם את כל הפרצל יחד באותה תמונה.";
  return null;
};

export const stoneLine = (s) =>
  [s.category, s.shape, s.weightCt ? `${s.weightCt}ct` : null, s.stones > 1 ? `${s.stones} אבנים` : null]
    .filter(Boolean)
    .join(" · ");
