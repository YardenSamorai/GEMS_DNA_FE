import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowUpRight, ChevronDown, ChevronUp, Copy, Expand, Mail, Printer, Share, Tag } from "lucide-react";
import ItemTierManager from "../../../components/catalog/ItemTierManager";
import StoneUsagePanel from "../../../components/StoneUsagePanel";
import { getDisplayColor, getDisplayShape } from "../helpers/constants";
import { createEmailHtml, createEmailText } from "../helpers/emailTemplates";
import { shareToWhatsApp } from "../helpers/whatsappHelpers";
import { dnaPathFor, formatCarat, isJewelryItem, scaledPrice, formatMoney, shareUrlFor } from "../model/inventoryModel";
import Sheet from "./Sheet";
import Thumb from "./Thumb";
import { Segmented } from "./InventoryHeader";
import { AssignmentChip, StoneStatus, WhatsAppIcon } from "./bits";
import { cleanValue as clean, gradingLine, itemTitle } from "./format";

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

const Specs = ({ rows }) => {
  const visible = rows.filter(([, v]) => v !== "" && v != null);
  if (!visible.length) return null;
  return (
    <dl className="inv-specs">
      {visible.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
};

/* Photo / 360° / certificate for a stone; image gallery and video for jewelry. */
const Media = ({ item, onImage }) => {
  const jewelry = isJewelryItem(item);
  const images = jewelry ? (item.allImages?.length ? item.allImages : item.imageUrl ? [item.imageUrl] : []) : item.imageUrl ? [item.imageUrl] : [];
  const video = jewelry ? item.videoLink : item.videoUrl;
  const certImg = !jewelry && item.certificateImageJpg ? item.certificateImageJpg : null;
  const tabs = [
    images.length && { id: "photo", label: "Photo" },
    video && { id: "video", label: jewelry ? "Video" : "360°" },
    certImg && { id: "cert", label: "Certificate" },
  ].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.id || "photo");
  const [imgIdx, setImgIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = tab === "cert" ? certImg : images[imgIdx];

  return (
    <>
      <div className="inv-ql-media">
        {tab === "video" && video ? (
          <iframe src={video} title={`${item.sku} video`} allow="autoplay; fullscreen" allowFullScreen loading="lazy" />
        ) : src && !failed ? (
          <>
            <img src={src} alt={tab === "cert" ? `Certificate for ${item.sku}` : itemTitle(item)} onError={() => setFailed(true)} />
            <button type="button" className="inv-icon-btn inv-icon-btn--sm inv-ql-expand" onClick={() => onImage(src)} aria-label="View larger">
              <Expand size={15} strokeWidth={1.75} />
            </button>
          </>
        ) : (
          <Thumb src={null} shape={item.shape} jewelry={jewelry} size="fill" alt="" />
        )}
        {tabs.length > 1 && (
          <div className="inv-ql-media-tabs">
            <Segmented
              label="Media"
              value={tab}
              onChange={(t) => {
                setTab(t);
                setFailed(false);
              }}
              options={tabs}
            />
          </div>
        )}
      </div>
      {tab === "photo" && images.length > 1 && (
        <div className="inv-ql-thumbs">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              aria-pressed={i === imgIdx}
              aria-label={`Image ${i + 1} of ${images.length}`}
              onClick={() => {
                setImgIdx(i);
                setFailed(false);
              }}
            >
              <Thumb src={img} jewelry size="md" alt="" />
            </button>
          ))}
        </div>
      )}
    </>
  );
};

const stoneSpecs = (s) => [
  ["Shape", getDisplayShape(s.shape)],
  ["Weight", formatCarat(s.weightCt)],
  ["Color", clean(getDisplayColor(s))],
  ["Clarity", clean(s.clarity)],
  ["Treatment", clean(s.treatment)],
  ["Origin", clean(s.origin)],
  ["Lab", clean(s.lab)],
  ["Measurements", clean(s.measurements)],
  ["Ratio", s.ratio != null && Number.isFinite(Number(s.ratio)) ? Number(s.ratio).toFixed(2) : ""],
  ["Luster", clean(s.luster)],
  ["Fluorescence", clean(s.fluorescence)],
  ["Grouping", clean(s.groupingType)],
  ["Pair SKU", clean(s.pairSku)],
  ["Location", clean(s.location)],
  ["Box", clean(s.box)],
  ["Certificate #", clean(s.certificateNumber)],
];

const jewelryCenter = (j) => [
  ["Stone type", clean(j.stoneType)],
  ["Carat", j.centerStoneCarat ? `${j.centerStoneCarat} ct` : ""],
  ["Shape", getDisplayShape(j.shape)],
  ["Color", clean(j.color)],
  ["Clarity", clean(j.clarity)],
];

const jewelryGeneral = (j) => [
  ["Type", clean(j.jewelryType)],
  ["Collection", clean(j.collection)],
  ["Total carat", j.weightCt ? `${j.weightCt} ct` : ""],
  ["Jewelry weight", clean(j.jewelryWeight)],
  ["Size", clean(j.jewelrySize)],
  ["Metal", clean(j.metalType)],
  ["Style", clean(j.style)],
  ["Availability", clean(j.availability)],
  ["Certificate #", clean(j.certificateNumber)],
];

const QuickLookBody = ({
  item, priceMode, status, allTags, itemTags, onToggleTag, onManageTags, onAssign, assigning,
  onOpenDna, onPrintLabel, onImage,
}) => {
  const jewelry = isJewelryItem(item);
  const path = dnaPathFor(item);
  const shareUrl = shareUrlFor(item);
  const total = scaledPrice(item, "priceTotal", priceMode);
  const ppc = jewelry ? null : scaledPrice(item, "pricePerCt", priceMode);
  const certUrl = jewelry ? item.certificateLink : item.certificateUrl;
  const tagIds = new Set((itemTags || []).map((t) => t.id));

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: jewelry ? "Check out this jewelry!" : "Check out this gem!",
          text: "View the full DNA:",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const copyWithImages = async () => {
    const html = createEmailHtml(item);
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }) })]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      toast.success("Copied with images");
    } catch {
      toast.error("Couldn’t copy");
    }
  };

  return (
    <>
      <Media key={item.id} item={item} onImage={onImage} />

      <div className="inv-ql-top">
        <h3 className="inv-ql-title">{itemTitle(item)}</h3>
        {gradingLine(item) && <p className="inv-ql-sub">{gradingLine(item)}</p>}
        {(status || !jewelry) && (
          <div className="inv-ql-meta">
            <StoneStatus row={status} />
            {!jewelry && <AssignmentChip stone={item} onAssign={onAssign} busy={assigning} />}
          </div>
        )}
      </div>

      <div className="inv-ql-cta">
        {path && (
          <a
            className="inv-btn inv-btn--primary"
            href={path}
            onClick={(e) => {
              if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              onOpenDna(item);
            }}
          >
            {jewelry && item.source === "workshop" ? "Open in Production" : "Open DNA"}
            <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </a>
        )}
        <button type="button" className="inv-btn" onClick={share} aria-label="Share link">
          <Share size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>Share</span>
        </button>
      </div>

      <div className="inv-ql-actions">
        {!jewelry && (
          <>
            <button type="button" className="inv-btn inv-btn--quiet inv-btn--sm" onClick={() => shareToWhatsApp(item)}>
              <WhatsAppIcon size={15} />
              <span>WhatsApp</span>
            </button>
            <a
              className="inv-btn inv-btn--quiet inv-btn--sm"
              href={`mailto:?subject=${encodeURIComponent(`Stone ${item.sku} details`)}&body=${encodeURIComponent(createEmailText(item))}`}
            >
              <Mail size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>Outlook</span>
            </a>
            <button type="button" className="inv-btn inv-btn--quiet inv-btn--sm" onClick={copyWithImages}>
              <Copy size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>Copy with images</span>
            </button>
          </>
        )}
        <button type="button" className="inv-btn inv-btn--quiet inv-btn--sm" onClick={() => onPrintLabel(item)}>
          <Printer size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>Print label</span>
        </button>
        {certUrl && (
          <a className="inv-btn inv-btn--quiet inv-btn--sm" href={certUrl} target="_blank" rel="noopener noreferrer">
            <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true" />
            <span>Certificate</span>
          </a>
        )}
      </div>

      {(total || ppc) && (
        <dl className="inv-ql-price inv-ql-section">
          {total ? (
            <div>
              <dt>Total{!jewelry && priceMode === "bruto" ? " · Bruto" : ""}</dt>
              <dd>{formatMoney(total, item.currency)}</dd>
            </div>
          ) : null}
          {ppc ? (
            <div>
              <dt>Per carat</dt>
              <dd className="inv-ql-price-sm">{formatMoney(ppc)}</dd>
            </div>
          ) : null}
        </dl>
      )}

      {jewelry ? (
        <>
          {jewelryCenter(item).some(([, v]) => v) && (
            <section className="inv-ql-section" aria-labelledby="ql-center">
              <h4 id="ql-center" className="inv-ql-h">Center stone</h4>
              <Specs rows={jewelryCenter(item)} />
            </section>
          )}
          <section className="inv-ql-section" aria-labelledby="ql-details">
            <h4 id="ql-details" className="inv-ql-h">Details</h4>
            <Specs rows={jewelryGeneral(item)} />
          </section>
          {item.fullDescription && (
            <section className="inv-ql-section" aria-labelledby="ql-desc">
              <h4 id="ql-desc" className="inv-ql-h">Description</h4>
              <p className="inv-ql-desc">{item.fullDescription}</p>
            </section>
          )}
        </>
      ) : (
        <section className="inv-ql-section" aria-labelledby="ql-details">
          <h4 id="ql-details" className="inv-ql-h">Details</h4>
          <Specs rows={stoneSpecs(item)} />
        </section>
      )}

      {!jewelry && item.sku && (
        <section className="inv-ql-section" aria-labelledby="ql-tags">
          <div className="inv-fgroup-row">
            <h4 id="ql-tags" className="inv-ql-h">Tags</h4>
            <button type="button" className="inv-btn inv-btn--plain inv-btn--sm" onClick={onManageTags}>
              Manage
            </button>
          </div>
          {allTags.length ? (
            <div className="inv-chips">
              {allTags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="inv-chip"
                  aria-pressed={tagIds.has(t.id)}
                  onClick={() => onToggleTag(item.sku, t.id, tagIds.has(t.id))}
                >
                  <span className="inv-tag-dot" style={{ background: t.color }} aria-hidden="true" />
                  {t.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="inv-fnote">
              <Tag size={13} strokeWidth={1.75} aria-hidden="true" /> No tags yet.
            </p>
          )}
        </section>
      )}

      {item.sku && (
        <section className="inv-ql-section">
          <ItemTierManager type={jewelry ? "jewelry" : "stone"} sku={item.sku} />
        </section>
      )}
      {!jewelry && item.sku && (
        <section className="inv-ql-section">
          <StoneUsagePanel sku={item.sku} compact />
        </section>
      )}
    </>
  );
};

/* Remounted per stone: brings the sheet body back to the top on ↑/↓. */
const ScrollTop = () => {
  const ref = React.useRef(null);
  useEffect(() => {
    const body = ref.current?.closest(".inv-sheet-body");
    if (body) body.scrollTop = 0;
  }, []);
  return <span ref={ref} hidden />;
};

const QuickLook = ({ item, variant, onClose, index, total, onStep, ...bodyProps }) => {
  const canPrev = index > 0;
  const canNext = index >= 0 && index < total - 1;

  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (document.querySelector("[data-inv-layer='menu']")) return;
      if (e.key === "ArrowDown" && canNext) {
        e.preventDefault();
        onStep(1);
      } else if (e.key === "ArrowUp" && canPrev) {
        e.preventDefault();
        onStep(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, canNext, canPrev, onStep]);

  const copySku = async () => {
    try {
      await navigator.clipboard.writeText(item.sku);
      toast.success(`${item.sku} copied`);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <Sheet
      open={Boolean(item)}
      variant={variant}
      onClose={onClose}
      titleId="inv-ql-title"
      tall={variant === "bottom"}
      closeLabel="Close quick look"
      title={
        item ? (
          <button type="button" className="inv-ql-sku" onClick={copySku} title="Copy SKU" aria-label={`${item.sku}, copy SKU`}>
            {item.sku}
            <Copy size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null
      }
      headerExtra={
        item && total > 1 ? (
          <span className="inv-ql-nav">
            <button type="button" className="inv-icon-btn" onClick={() => onStep(-1)} disabled={!canPrev} aria-label="Previous stone" title="Previous (↑)">
              <ChevronUp size={18} strokeWidth={1.75} />
            </button>
            <button type="button" className="inv-icon-btn" onClick={() => onStep(1)} disabled={!canNext} aria-label="Next stone" title="Next (↓)">
              <ChevronDown size={18} strokeWidth={1.75} />
            </button>
          </span>
        ) : null
      }
    >
      {item && <ScrollTop key={item.id} />}
      {item && <QuickLookBody item={item} {...bodyProps} />}
    </Sheet>
  );
};

export default QuickLook;
