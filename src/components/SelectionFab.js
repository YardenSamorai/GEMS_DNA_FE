import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelection } from "../context/SelectionContext";

/* Floating "selection" button — bottom-right counterpart to the catalog's
 * bottom-left filter FAB. Appears only once at least one stone is picked, shows
 * the running count, and opens the review page. Hidden on the review page
 * itself (you're already there). Sits above the mobile dock on phones, and
 * drops to a normal bottom margin on desktop where there is no dock. */
const SelectionFab = () => {
  const { count } = useSelection();
  const navigate = useNavigate();
  const location = useLocation();

  if (count === 0) return null;
  if (location.pathname === "/sales/selection") return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/sales/selection")}
      aria-label={`Review ${count} selected ${count === 1 ? "stone" : "stones"}`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
      className="fixed right-4 z-40 flex items-center gap-2.5 rounded-full bg-emerald-600 px-5 py-3.5 text-white shadow-[0_10px_30px_-8px_rgba(5,150,105,0.7)] transition-all duration-200 hover:bg-emerald-700 active:scale-95 md:!bottom-6"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M5 8h14l-1 11a2 2 0 01-2 1.8H8A2 2 0 016 19L5 8z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 8V6a3 3 0 016 0v2"
        />
      </svg>
      <span className="text-[14px] font-semibold tracking-tight">Selected</span>
      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-white px-1.5 text-[12.5px] font-bold tabular-nums text-emerald-700">
        {count}
      </span>
    </button>
  );
};

export default SelectionFab;
