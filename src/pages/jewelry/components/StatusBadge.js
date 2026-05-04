import React from "react";

const STATUS_STYLES = {
  draft:     { bg: "bg-stone-100",   text: "text-stone-700",   dot: "bg-stone-400",   label: "Draft" },
  design:    { bg: "bg-blue-50",     text: "text-blue-700",    dot: "bg-blue-500",    label: "Design" },
  cad:       { bg: "bg-indigo-50",   text: "text-indigo-700",  dot: "bg-indigo-500",  label: "CAD" },
  wax:       { bg: "bg-purple-50",   text: "text-purple-700",  dot: "bg-purple-500",  label: "Wax / Mold" },
  casting:   { bg: "bg-orange-50",   text: "text-orange-700",  dot: "bg-orange-500",  label: "Casting" },
  setting:   { bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-500",   label: "Stone Setting" },
  polishing: { bg: "bg-yellow-50",   text: "text-yellow-700",  dot: "bg-yellow-500",  label: "Polishing" },
  qc:        { bg: "bg-cyan-50",     text: "text-cyan-700",    dot: "bg-cyan-500",    label: "QC" },
  ready:     { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500", label: "Ready" },
  sold:      { bg: "bg-green-100",   text: "text-green-800",   dot: "bg-green-600",   label: "Sold" },
  archived:  { bg: "bg-gray-100",    text: "text-gray-500",    dot: "bg-gray-400",    label: "Archived" },
};

const StatusBadge = ({ status, size = "md" }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft;
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${s.bg} ${s.text} ${padding}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

export default StatusBadge;
