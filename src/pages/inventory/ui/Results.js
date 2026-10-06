import React, { memo } from "react";
import { ChevronDown, ChevronUp, Play } from "lucide-react";
import { getMappedCategories } from "../../../utils/categoryMap";
import { inventoryPriceScale } from "../../../utils/pricing";
import { getDisplayColor, getDisplayShape, shortTreatment } from "../helpers/constants";
import { formatCarat, isJewelryItem, scaledPrice, formatMoney } from "../model/inventoryModel";
import Thumb from "./Thumb";
import { AssignmentChip, StoneStatus, TagDots, WhatsAppIcon } from "./bits";
import { cleanValue as clean, gradingLine, itemTitle, pricePerCtText, priceTotalText } from "./format";

const NUMERIC = new Set(["qty", "weight", "ratio", "ppc", "total"]);

const ratioText = (r) => (r == null || r === "" ? "" : Number.isFinite(Number(r)) ? Number(r).toFixed(2) : String(r));

const cellValue = (colId, item, priceMode) => {
  switch (colId) {
    case "category":
      return getMappedCategories(item.category).filter((c) => c !== "Empty").join(", ");
    case "type":
      return clean(item.groupingType);
    case "shape":
      return getDisplayShape(item.shape);
    case "color":
      return clean(getDisplayColor(item));
    case "clarity":
      return clean(item.clarity);
    case "qty":
      return item.stones ?? "";
    case "weight":
      return formatCarat(item.weightCt);
    case "measurements":
      return clean(item.measurements);
    case "ratio":
      return ratioText(item.ratio);
    case "treatment":
      return item.treatment ? shortTreatment(item.treatment) : "";
    case "origin":
      return clean(item.origin);
    case "fluorescence":
      return clean(item.fluorescence);
    case "lab":
      return clean(item.lab);
    case "ppc": {
      const v = scaledPrice(item, "pricePerCt", priceMode);
      return v ? formatMoney(v) : "";
    }
    case "total": {
      const v = scaledPrice(item, "priceTotal", priceMode);
      return v ? formatMoney(v, item.currency) : "";
    }
    case "location":
      return clean(item.location);
    case "title":
      return clean(item.title);
    case "jewelryType":
      return clean(item.jewelryType);
    case "style":
      return clean(item.style);
    case "collection":
      return clean(item.collection);
    case "stoneType":
      return clean(item.stoneType);
    case "metalType":
      return clean(item.metalType);
    case "availability":
      return clean(item.availability);
    default:
      return "";
  }
};

/* Stops the row's own click (which opens the quick look). */
const stop = (e) => e.stopPropagation();

const RowCheck = ({ id, checked, onToggle, label }) => (
  <label className="inv-check" onClick={stop}>
    <input type="checkbox" checked={checked} onChange={() => onToggle(id)} aria-label={label} />
  </label>
);

/* ---------------- desktop table ---------------- */

const PlayButton = ({ sku, video, onVideo, className }) => (
  <button
    type="button"
    className={className}
    onClick={(e) => {
      e.stopPropagation();
      onVideo(video);
    }}
    aria-label={`Play video for ${sku}`}
    title="Video"
  >
    <Play size={className === "inv-thumb-play" ? 11 : 15} strokeWidth={2} fill={className === "inv-thumb-play" ? "currentColor" : "none"} />
  </button>
);

const TableRow = memo(function TableRow({
  item, columns, videoInThumb, selected, active, priceMode, status, tags, onToggle, onOpen, onVideo, onWhatsApp, onAssign, assigning,
}) {
  const jewelry = isJewelryItem(item);
  const video = item.videoUrl || item.videoLink;
  return (
    <tr aria-selected={selected} data-active={active || undefined} data-id={item.id} onClick={() => onOpen(item)}>
      <td className="inv-col-check">
        <RowCheck id={item.id} checked={selected} onToggle={onToggle} label={`Select ${item.sku}`} />
      </td>
      {columns.map((colId) => {
        if (colId === "sku") {
          return (
            <td key={colId} className="inv-col-sku">
              <div className="inv-sku-cell">
                <button
                  type="button"
                  className="inv-sku"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(item);
                  }}
                  aria-label={`${item.sku}, ${itemTitle(item)}. Open quick look`}
                >
                  {item.sku || "—"}
                </button>
                <StoneStatus row={status} />
              </div>
            </td>
          );
        }
        if (colId === "img") {
          return (
            <td key={colId} className="inv-col-img">
              <span className="inv-thumb-wrap">
                <Thumb src={item.imageUrl} shape={item.shape} jewelry={jewelry} alt="" />
                {videoInThumb && video && <PlayButton sku={item.sku} video={video} onVideo={onVideo} className="inv-thumb-play" />}
              </span>
            </td>
          );
        }
        if (colId === "video") {
          return (
            <td key={colId} className="inv-col-img">
              {video && <PlayButton sku={item.sku} video={video} onVideo={onVideo} className="inv-icon-btn inv-icon-btn--sm" />}
            </td>
          );
        }
        const v = cellValue(colId, item, priceMode);
        const cls = [
          NUMERIC.has(colId) ? "inv-num-col" : "",
          colId === "total" ? "inv-cell-strong" : "",
          colId === "title" ? "inv-cell-wrap" : "",
        ].filter(Boolean).join(" ");
        return (
          <td key={colId} className={cls || undefined} title={colId === "shape" ? item.shape : undefined}>
            {v}
          </td>
        );
      })}
      <td className="inv-col-act">
        <span className="inv-row-actions">
          <TagDots tags={tags} />
          {!jewelry && <AssignmentChip stone={item} onAssign={onAssign} busy={assigning} />}
          {!jewelry && (
            <button
              type="button"
              className="inv-icon-btn inv-icon-btn--sm"
              onClick={(e) => {
                e.stopPropagation();
                onWhatsApp(item);
              }}
              aria-label={`Share ${item.sku} on WhatsApp`}
              title="WhatsApp"
            >
              <WhatsAppIcon size={16} />
            </button>
          )}
        </span>
      </td>
    </tr>
  );
});

export const ResultsTable = ({
  items, columns: configured, colMeta, sortConfig, onSortField, selectedIds, activeId, priceMode, statusMap, stoneTags,
  onToggle, onOpen, onVideo, onWhatsApp, onAssign, assigningSku, selectAll,
}) => {
  // With both on, the video is a badge on the photo rather than its own column.
  const videoInThumb = configured.includes("img") && configured.includes("video");
  const columns = videoInThumb ? configured.filter((c) => c !== "video") : configured;
  return (
  <div className="inv-table-wrap">
    <table className="inv-table">
      <thead>
        <tr>
          <th className="inv-col-check" scope="col">{selectAll}</th>
          {columns.map((colId) => {
            const meta = colMeta[colId];
            if (!meta) return null;
            const field = meta.sortField;
            const label = colId === "img" || colId === "video" ? <span className="inv-sr">{meta.label}</span> : meta.label;
            const isActive = field && sortConfig.field === field;
            return (
              <th
                key={colId}
                scope="col"
                className={colId === "sku" ? "inv-col-sku" : NUMERIC.has(colId) ? "inv-num-col" : undefined}
                aria-sort={isActive ? (sortConfig.direction === "asc" ? "ascending" : "descending") : undefined}
              >
                {field ? (
                  <button type="button" className="inv-th-sort" data-active={isActive || undefined} onClick={() => onSortField(field)}>
                    {label}
                    <span className="inv-th-arrow" aria-hidden="true">
                      {isActive && (sortConfig.direction === "asc" ? <ChevronUp size={12} strokeWidth={2.25} /> : <ChevronDown size={12} strokeWidth={2.25} />)}
                    </span>
                  </button>
                ) : (
                  label
                )}
              </th>
            );
          })}
          <th scope="col" className="inv-col-act"><span className="inv-sr">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <TableRow
            key={item.id}
            item={item}
            columns={columns}
            videoInThumb={videoInThumb}
            selected={selectedIds.has(item.id)}
            active={activeId === item.id}
            priceMode={priceMode}
            status={item.sku ? statusMap[item.sku] : null}
            tags={stoneTags[item.sku]}
            onToggle={onToggle}
            onOpen={onOpen}
            onVideo={onVideo}
            onWhatsApp={onWhatsApp}
            onAssign={onAssign}
            assigning={assigningSku === item.sku}
          />
        ))}
      </tbody>
    </table>
  </div>
  );
};

/* ---------------- phone list ---------------- */

const ListRow = memo(function ListRow({ item, selected, active, priceMode, status, tags, onToggle, onOpen, onAssign, assigning }) {
  const jewelry = isJewelryItem(item);
  const grade = gradingLine(item);
  const ppc = pricePerCtText(item, priceMode);
  return (
    <li
      className="inv-mrow"
      data-selected={selected || undefined}
      data-active={active || undefined}
      data-id={item.id}
      onClick={() => onOpen(item)}
    >
      <RowCheck id={item.id} checked={selected} onToggle={onToggle} label={`Select ${item.sku}`} />
      <Thumb src={item.imageUrl} shape={item.shape} jewelry={jewelry} size="lg" alt="" />
      <div className="inv-mrow-main">
        <div className="inv-mrow-top">
          <button
            type="button"
            className="inv-sku inv-mrow-sku"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(item);
            }}
            aria-label={`${item.sku}, ${itemTitle(item)}. Open quick look`}
          >
            {item.sku}
          </button>
          <span className="inv-mrow-price">{priceTotalText(item, priceMode)}</span>
        </div>
        <div className="inv-mrow-title">{itemTitle(item)}</div>
        {(grade || ppc) && (
          <div className="inv-mrow-line">
            <span>{grade}</span>
            {ppc && <span className="inv-num">{ppc}</span>}
          </div>
        )}
        {(status || tags?.length || (!jewelry && onAssign)) && (
          <div className="inv-mrow-meta">
            <StoneStatus row={status} />
            <TagDots tags={tags} />
            {!jewelry && <AssignmentChip stone={item} onAssign={onAssign} busy={assigning} />}
          </div>
        )}
      </div>
    </li>
  );
});

export const ResultsList = ({ items, selectedIds, activeId, priceMode, statusMap, stoneTags, onToggle, onOpen, onAssign, assigningSku }) => (
  <ul className="inv-mlist">
    {items.map((item) => (
      <ListRow
        key={item.id}
        item={item}
        selected={selectedIds.has(item.id)}
        active={activeId === item.id}
        priceMode={priceMode}
        status={item.sku ? statusMap[item.sku] : null}
        tags={stoneTags[item.sku]}
        onToggle={onToggle}
        onOpen={onOpen}
        onAssign={onAssign}
        assigning={assigningSku === item.sku}
      />
    ))}
  </ul>
);

/* ---------------- gallery ---------------- */

const Card = memo(function Card({ item, selected, active, priceMode, onToggle, onOpen }) {
  const jewelry = isJewelryItem(item);
  const grade = gradingLine(item);
  const ppc = pricePerCtText(item, priceMode);
  return (
    <article
      className="inv-card"
      data-selected={selected || undefined}
      data-active={active || undefined}
      data-id={item.id}
      onClick={() => onOpen(item)}
    >
      <span className="inv-card-check">
        <RowCheck id={item.id} checked={selected} onToggle={onToggle} label={`Select ${item.sku}`} />
      </span>
      <Thumb src={item.imageUrl} shape={item.shape} jewelry={jewelry} size="fill" alt="" />
      <div className="inv-card-body">
        <button
          type="button"
          className="inv-sku inv-card-sku"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item);
          }}
          aria-label={`${item.sku}, ${itemTitle(item)}. Open quick look`}
        >
          {item.sku}
        </button>
        <div className="inv-card-title">{itemTitle(item)}</div>
        {grade && <div className="inv-card-line">{grade}</div>}
        <div className="inv-card-price">
          <b>{priceTotalText(item, priceMode)}</b>
          {ppc && <span>{ppc}</span>}
        </div>
      </div>
    </article>
  );
});

export const ResultsGallery = ({ items, selectedIds, activeId, priceMode, onToggle, onOpen }) => (
  <div className="inv-grid">
    {items.map((item) => (
      <Card
        key={item.id}
        item={item}
        selected={selectedIds.has(item.id)}
        active={activeId === item.id}
        priceMode={priceMode}
        onToggle={onToggle}
        onOpen={onOpen}
      />
    ))}
  </div>
);

/* ---------------- pairs ---------------- */

const PairStone = ({ stone, priceMode, onOpen }) => (
  <button type="button" className="inv-pair-stone" onClick={() => onOpen(stone)} aria-label={`${stone.sku}, ${itemTitle(stone)}. Open quick look`}>
    <Thumb src={stone.imageUrl} shape={stone.shape} size="fill" alt="" />
    <span className="inv-card-body">
      <span className="inv-card-sku">{stone.sku}</span>
      <span className="inv-card-title">{itemTitle(stone)}</span>
      <span className="inv-card-line">{[clean(stone.measurements), gradingLine(stone)].filter(Boolean).join(" · ")}</span>
      <span className="inv-card-price">
        <b>{priceTotalText(stone, priceMode)}</b>
        <span>{pricePerCtText(stone, priceMode)}</span>
      </span>
    </span>
  </button>
);

const PairCard = memo(function PairCard({ pair, selected, priceMode, onTogglePair, onOpen }) {
  const { stoneA, stoneB } = pair;
  const weight = (stoneA.weightCt || 0) + (stoneB ? stoneB.weightCt || 0 : 0);
  const price =
    (stoneA.priceTotal || 0) * inventoryPriceScale(stoneA, priceMode) +
    (stoneB ? (stoneB.priceTotal || 0) * inventoryPriceScale(stoneB, priceMode) : 0);
  return (
    <article className="inv-pair" data-selected={selected || undefined}>
      <header className="inv-pair-head">
        <label className="inv-check">
          <input type="checkbox" checked={selected} onChange={() => onTogglePair(pair)} aria-label={`Select pair ${stoneA.sku}${stoneB ? ` and ${stoneB.sku}` : ""}`} />
        </label>
        <span className="inv-pair-head-title">Pair</span>
        <span className="inv-pair-head-sum">
          <b>{weight.toFixed(2)} ct</b>
          {price > 0 && <> · <b>{formatMoney(Math.round(price))}</b></>}
        </span>
      </header>
      <div className="inv-pair-stones">
        <PairStone stone={stoneA} priceMode={priceMode} onOpen={onOpen} />
        {stoneB ? (
          <PairStone stone={stoneB} priceMode={priceMode} onOpen={onOpen} />
        ) : (
          <div className="inv-pair-missing">
            <b>Pair stone not in inventory</b>
            <span>{stoneA.pairSku}</span>
          </div>
        )}
      </div>
    </article>
  );
});

export const PairResults = ({ pairs, selectedIds, priceMode, onTogglePair, onOpen }) => (
  <div className="inv-pairs">
    {pairs.map((pair) => {
      const ids = [pair.stoneA.id, ...(pair.stoneB ? [pair.stoneB.id] : [])];
      return (
        <PairCard
          key={`${pair.stoneA.sku}-${pair.stoneB?.sku || "missing"}`}
          pair={pair}
          selected={ids.every((id) => selectedIds.has(id))}
          priceMode={priceMode}
          onTogglePair={onTogglePair}
          onOpen={onOpen}
        />
      );
    })}
  </div>
);
