import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { changeJewelryStatus, JEWELRY_STATUSES } from "../../../services/jewelryApi";
import StatusBadge from "./StatusBadge";

// Kanban columns - exclude archived
const COLUMNS = JEWELRY_STATUSES.filter((s) => s.value !== "archived");

const JewelryKanban = ({ items, onStatusChanged }) => {
  const { user } = useUser();
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [updating, setUpdating] = useState(false);

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.value] = items.filter((i) => i.status === col.value);
    return acc;
  }, {});

  const handleDrop = async (newStatus) => {
    setDragOverCol(null);
    if (!draggedId) return;
    const item = items.find((i) => i.id === draggedId);
    setDraggedId(null);
    if (!item || item.status === newStatus) return;
    setUpdating(true);
    try {
      await changeJewelryStatus(item.id, { newStatus, userId: user?.id });
      if (onStatusChanged) await onStatusChanged();
    } catch (err) {
      alert(err.message || "Failed to change status");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className={`overflow-x-auto pb-4 ${updating ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="flex gap-3" style={{ minWidth: `${COLUMNS.length * 220}px` }}>
        {COLUMNS.map((col) => {
          const colItems = grouped[col.value];
          const isOver = dragOverCol === col.value;
          return (
            <div
              key={col.value}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col.value);
              }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.value)}
              className={`flex w-52 shrink-0 flex-col rounded-xl border ${
                isOver ? "border-emerald-400 bg-emerald-50" : "border-stone-200 bg-stone-50"
              } transition`}
            >
              <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
                <StatusBadge status={col.value} size="sm" />
                <span className="text-xs font-semibold text-stone-500">{colItems.length}</span>
              </div>

              <div className="flex flex-col gap-2 p-2 max-h-[70vh] overflow-y-auto">
                {colItems.map((item) => (
                  <Link
                    key={item.id}
                    to={`/jewelry/items/${item.id}`}
                    draggable
                    onDragStart={() => setDraggedId(item.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={`group cursor-grab rounded-lg border border-stone-200 bg-white shadow-sm hover:shadow ${
                      draggedId === item.id ? "opacity-40" : ""
                    }`}
                  >
                    {item.cover_image_url && (
                      <div className="aspect-square overflow-hidden rounded-t-lg bg-stone-100">
                        <img src={item.cover_image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="p-2">
                      <div className="truncate text-sm font-medium text-stone-900">{item.name}</div>
                      <div className="text-[10px] font-mono text-stone-500">{item.sku}</div>
                      {item.contact_name && (
                        <div className="mt-0.5 truncate text-xs text-stone-500">{item.contact_name}</div>
                      )}
                    </div>
                  </Link>
                ))}
                {colItems.length === 0 && (
                  <div className="py-6 text-center text-xs text-stone-400">Drop items here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JewelryKanban;
