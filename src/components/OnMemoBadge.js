import React from "react";
import { Link } from "react-router-dom";
import { useMemoForSku } from "../context/MemoSkusContext";

/**
 * Tiny chip shown next to inventory items that are currently on an
 * active memo. Links straight to the memo so the rep can see who has
 * the stone, when it's due back, and at what memo price.
 *
 * Usage:
 *   <OnMemoBadge sku={stone.sku} type="stone"  size="sm" />
 *   <OnMemoBadge sku={item.sku}  type="jewelry" />
 */
export default function OnMemoBadge({ sku, type = "auto", size = "md", className = "" }) {
  const memo = useMemoForSku(sku, type);
  if (!memo) return null;

  const sizing = size === "sm"
    ? "text-[9px] px-1.5 py-0.5"
    : "text-[10px] px-2 py-0.5";

  return (
    <Link
      to={`/crm/memos/${memo.memoId}`}
      onClick={(e) => e.stopPropagation()}
      title={`On memo ${memo.memoNumber} — ${memo.companyName}`}
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider bg-blue-100 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-200 transition ${sizing} ${className}`}
    >
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5h3V8h4v4h3l-5 5z" />
      </svg>
      On memo
    </Link>
  );
}
