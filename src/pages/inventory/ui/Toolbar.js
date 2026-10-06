import React, { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Columns3, LayoutGrid, List, Rows2, SlidersHorizontal } from "lucide-react";
import { Menu, MenuItem } from "./Menu";
import { Segmented } from "./InventoryHeader";

const VIEW_ICONS = {
  list: <List size={17} strokeWidth={1.75} aria-hidden="true" />,
  gallery: <LayoutGrid size={16} strokeWidth={1.75} aria-hidden="true" />,
  pairs: <Rows2 size={16} strokeWidth={1.75} aria-hidden="true" />,
};
const VIEW_LABELS = { list: "List", gallery: "Gallery", pairs: "Pairs" };

export const SelectAll = ({ checked, indeterminate, onChange, disabled, label }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return (
    <label className="inv-check" title={label}>
      <input ref={ref} type="checkbox" checked={checked} onChange={onChange} disabled={disabled} aria-label={label} />
    </label>
  );
};

const Toolbar = ({
  selectAll,
  count,
  refreshing,
  sortOptions,
  sortConfig,
  sortLabel,
  onSort,
  views,
  view,
  onView,
  onColumns,
  filterCount,
  onFilters,
  filtersActive,
  filtersIcon: FiltersIcon = SlidersHorizontal,
  compact,
}) => {
  const sortRef = useRef(null);
  const [sortOpen, setSortOpen] = useState(false);
  const sentinelRef = useRef(null);
  const barRef = useRef(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return undefined;
    const top = parseFloat(getComputedStyle(barRef.current).top) || 0;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < top + 1),
      { rootMargin: `${-(top + 1)}px 0px 0px 0px` }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  return (
    <>
    <span ref={sentinelRef} className="inv-toolbar-sentinel" aria-hidden="true" />
    <div ref={barRef} className="inv-toolbar" data-stuck={stuck}>
      {selectAll && <SelectAll {...selectAll} />}
      <div className="inv-count" aria-live="polite">{count}</div>
      {refreshing && <span className="inv-refreshing">Updating…</span>}
      <span className="inv-toolbar-spacer" />

      {onSort && (
        <>
          <button
            ref={sortRef}
            type="button"
            className="inv-btn inv-btn--quiet inv-btn--sm"
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            onClick={() => setSortOpen((o) => !o)}
            aria-label={`Sort: ${sortLabel}`}
          >
            <ArrowUpDown size={15} strokeWidth={1.75} aria-hidden="true" />
            {!compact && <span className="inv-sort-label">{sortLabel}</span>}
          </button>
          <Menu anchorRef={sortRef} open={sortOpen} onClose={() => setSortOpen(false)} label="Sort by">
            {sortOptions.map((o) => (
              <MenuItem
                key={o.id}
                radio
                checked={o.field === sortConfig.field && o.direction === sortConfig.direction}
                onSelect={() => {
                  onSort(o);
                  setSortOpen(false);
                  sortRef.current?.focus();
                }}
              >
                {o.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}

      {views && views.length > 1 && (
        <Segmented
          label="View"
          className="inv-seg--icons"
          value={view}
          onChange={onView}
          options={views.map((v) => ({ id: v, icon: VIEW_ICONS[v], ariaLabel: VIEW_LABELS[v], title: VIEW_LABELS[v] }))}
        />
      )}

      {onColumns && (
        <button type="button" className="inv-icon-btn" onClick={onColumns} aria-label="Choose columns" title="Columns">
          <Columns3 size={17} strokeWidth={1.75} />
        </button>
      )}

      {onFilters && (
        <button
          type="button"
          className="inv-btn inv-btn--sm"
          onClick={onFilters}
          aria-pressed={filtersActive ?? undefined}
          aria-label={filterCount ? `Filters, ${filterCount} active` : "Filters"}
          title={filtersActive ? "Hide filters" : "Show filters"}
        >
          <FiltersIcon size={15} strokeWidth={1.75} aria-hidden="true" />
          {!compact && <span>Filters</span>}
          {filterCount > 0 && <span className="inv-badge">{filterCount}</span>}
        </button>
      )}
    </div>
    </>
  );
};

export default Toolbar;
