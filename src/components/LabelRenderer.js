import QRCode from "qrcode";
import { getMappedCategories } from "../utils/categoryMap";

export const LABEL_W = 176;
export const LABEL_H = 96;

export const LABEL_SIZE_PRESETS = [
  { id: "40x19",    label: "40×19",          w: 320, h: 152 },
];

const LABEL_SIZE_KEY = "gems_label_size";

export const loadLabelSize = () => {
  try {
    const stored = localStorage.getItem(LABEL_SIZE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.w && parsed.h && parsed.w % 8 === 0) return parsed;
    }
  } catch {}
  return { w: 320, h: 152, id: "40x19" };
};

export const saveLabelSize = (size) => {
  try {
    localStorage.setItem(LABEL_SIZE_KEY, JSON.stringify(size));
  } catch {}
};

let cachedLogo = null;

const loadLogo = () => {
  if (cachedLogo) return Promise.resolve(cachedLogo);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { cachedLogo = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = "/gemstar-logo-footer.png";
  });
};

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const encodePriceB = (price) => {
  if (!price || price <= 0) return "B-";
  const rounded = Math.round(price);
  const priceStr = rounded.toString();
  const digitToLetter = { '1': 'H', '2': 'A', '3': 'R', '4': 'E', '5': 'L', '6': 'O', '7': 'V', '8': 'S', '9': 'K' };
  let encoded = 'B';
  let i = 0;
  while (i < priceStr.length) {
    if (priceStr[i] === '0') {
      let zeroCount = 0;
      while (i < priceStr.length && priceStr[i] === '0') { zeroCount++; i++; }
      const remainder = zeroCount % 3;
      const zCount = Math.floor(zeroCount / 3);
      if (remainder === 1) encoded += 'I';
      if (remainder === 2) encoded += 'Y';
      for (let j = 0; j < zCount; j++) encoded += 'Z';
    } else {
      encoded += digitToLetter[priceStr[i]];
      i++;
    }
  }
  return encoded;
};

export const FONT_FAMILIES = [
  { id: "markazi",    label: "Markazi Text",   css: "'Markazi Text', serif",    minWeight: 400 },
  { id: "cormorant",  label: "Cormorant",      css: "'Cormorant', serif",       minWeight: 300 },
  { id: "inter",      label: "Inter",          css: "'Inter', sans-serif",      minWeight: 100 },
  { id: "lora",       label: "Lora",           css: "'Lora', serif",            minWeight: 400 },
  { id: "arial",      label: "Arial",          css: "Arial, sans-serif",        minWeight: 400 },
  { id: "helvetica",  label: "Helvetica",      css: "Helvetica, Arial, sans-serif", minWeight: 400 },
  { id: "verdana",    label: "Verdana",        css: "Verdana, sans-serif",      minWeight: 400 },
  { id: "tahoma",     label: "Tahoma",         css: "Tahoma, sans-serif" },
  { id: "trebuchet",  label: "Trebuchet MS",   css: "'Trebuchet MS', sans-serif" },
  { id: "georgia",    label: "Georgia",        css: "Georgia, serif" },
  { id: "times",      label: "Times New Roman",css: "'Times New Roman', serif" },
  { id: "courier",    label: "Courier New",    css: "'Courier New', monospace" },
  { id: "lucida",     label: "Lucida Console", css: "'Lucida Console', monospace" },
  { id: "impact",     label: "Impact",         css: "Impact, sans-serif" },
];

export const ELEMENT_TYPES = [
  { id: "qr",        label: "QR Code",    icon: "qr"   },
  { id: "weight",    label: "Weight",     icon: "text"  },
  { id: "lab",       label: "Lab",        icon: "text"  },
  { id: "clarity",   label: "Clarity",    icon: "text"  },
  { id: "color",     label: "Color",      icon: "text"  },
  { id: "priceCode", label: "Price Code", icon: "text"  },
  { id: "sku",       label: "SKU",        icon: "text"  },
  { id: "shape",     label: "Shape",      icon: "text"  },
  { id: "price",     label: "Price ($)",  icon: "text"  },
  { id: "origin",    label: "Origin",     icon: "text"  },
  { id: "logo",      label: "Logo",       icon: "img"   },
];

export const DEFAULT_ELEMENTS = [
  { id: "weight",    visible: true,  x: 6,   y: 6,   w: 55,  h: 18, fontSize: 14, fontFamily: "markazi", letterSpacing: 0, bold: false, textAlign: "left", verticalAlign: "top" },
  { id: "lab",       visible: true,  x: 6,   y: 26,  w: 55,  h: 16, fontSize: 12, fontFamily: "markazi", letterSpacing: 0, bold: false, textAlign: "left", verticalAlign: "top" },
  { id: "clarity",   visible: true,  x: 6,   y: 44,  w: 55,  h: 16, fontSize: 12, fontFamily: "markazi", letterSpacing: 0, bold: false, textAlign: "left", verticalAlign: "top" },
  { id: "color",     visible: false, x: 6,   y: 62,  w: 55,  h: 16, fontSize: 12, fontFamily: "markazi", letterSpacing: 0, bold: false, textAlign: "left", verticalAlign: "top" },
  { id: "priceCode", visible: true,  x: 6,   y: 64,  w: 70,  h: 18, fontSize: 13, fontFamily: "markazi", letterSpacing: 0, bold: true,  textAlign: "left", verticalAlign: "top" },
  { id: "qr",        visible: true,  x: 96,  y: 8,   w: 72,  h: 72, fontSize: 12, fontFamily: "markazi", letterSpacing: 0, bold: false, textAlign: "left", verticalAlign: "top" },
  { id: "sku",       visible: false, x: 6,   y: 82,  w: 80,  h: 12, fontSize: 9,  fontFamily: "markazi", letterSpacing: 0, bold: true,  textAlign: "left", verticalAlign: "top" },
  { id: "shape",     visible: false, x: 64,  y: 6,   w: 30,  h: 14, fontSize: 10, fontFamily: "markazi", letterSpacing: 0, bold: false, textAlign: "right", verticalAlign: "top" },
  { id: "price",     visible: false, x: 64,  y: 26,  w: 30,  h: 14, fontSize: 10, fontFamily: "markazi", letterSpacing: 0, bold: false, textAlign: "right", verticalAlign: "top" },
  { id: "origin",    visible: false, x: 64,  y: 44,  w: 30,  h: 14, fontSize: 9,  fontFamily: "markazi", letterSpacing: 0, bold: false, textAlign: "right", verticalAlign: "top" },
  { id: "logo",      visible: false, x: 96,  y: 80,  w: 50,  h: 12, fontSize: 12, fontFamily: "markazi", letterSpacing: 0, bold: false, textAlign: "left", verticalAlign: "top" },
];

const STORAGE_KEY = "gems_label_templates_v3";
const ACTIVE_KEY = "gems_label_active_template";

const defaultId = () => `tpl_${Date.now()}`;

export const sanitizeElements = (elements) => {
  const knownIds = new Set(DEFAULT_ELEMENTS.map(e => e.id));
  const seen = new Set();
  const result = [];
  (elements || []).forEach(e => {
    if (knownIds.has(e.id) && !seen.has(e.id)) {
      seen.add(e.id);
      const def = DEFAULT_ELEMENTS.find(d => d.id === e.id);
      result.push({
        ...def,
        ...e,
        fontFamily: e.fontFamily || def.fontFamily,
        letterSpacing: e.letterSpacing ?? def.letterSpacing,
        bold: e.bold ?? def.bold,
        fontWeight: e.fontWeight ?? (e.bold ? 700 : 400),
        textAlign: e.textAlign || def.textAlign,
        verticalAlign: e.verticalAlign || def.verticalAlign,
      });
    }
  });
  DEFAULT_ELEMENTS.forEach(def => {
    if (!seen.has(def.id)) result.push({ ...def });
  });
  return result;
};

export const loadAllTemplates = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(t => ({
          ...t,
          elements: sanitizeElements(t.elements),
        }));
      }
    }
  } catch {}
  const migratedSingle = migrateSingleTemplate();
  return [migratedSingle];
};

const migrateSingleTemplate = () => {
  try {
    const old = localStorage.getItem("gems_label_template");
    if (old) {
      const parsed = JSON.parse(old);
      if (Array.isArray(parsed)) {
        return {
          id: defaultId(),
          name: "My Template",
          elements: sanitizeElements(parsed),
        };
      }
    }
  } catch {}
  return {
    id: defaultId(),
    name: "Default",
    elements: DEFAULT_ELEMENTS.map(e => ({ ...e })),
  };
};

export const saveAllTemplates = (templates) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {}
};

export const getActiveTemplateId = () => {
  try {
    return localStorage.getItem(ACTIVE_KEY) || null;
  } catch {}
  return null;
};

export const setActiveTemplateId = (id) => {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {}
};

export const getActiveTemplate = (templates) => {
  const activeId = getActiveTemplateId();
  const found = templates.find(t => t.id === activeId);
  return found || templates[0];
};

export const createNewTemplate = (name) => ({
  id: defaultId(),
  name: name || "New Template",
  elements: DEFAULT_ELEMENTS.map(e => ({ ...e })),
});

export const duplicateTemplate = (source, newName) => ({
  id: defaultId(),
  name: newName || `${source.name} (copy)`,
  elements: source.elements.map(e => ({ ...e })),
});

export const DEFAULT_TEMPLATE = DEFAULT_ELEMENTS;
export const loadTemplate = () => {
  const all = loadAllTemplates();
  const active = getActiveTemplate(all);
  return active.elements;
};
export const saveTemplate = (elements) => {
  const all = loadAllTemplates();
  const active = getActiveTemplate(all);
  active.elements = elements;
  saveAllTemplates(all);
};

const getFontCSS = (fontFamily) => {
  const f = FONT_FAMILIES.find(ff => ff.id === fontFamily);
  return f ? f.css : "Arial, sans-serif";
};

const shortenClarity = (val) => {
  if (!val) return "";
  const lower = val.toLowerCase().trim();
  if (/insignifi\w*\s*[-–]\s*mod/i.test(val)) return "I - M";
  if (/^insignifi/i.test(val)) return "Ins.";
  if (/^mod/i.test(val)) return "Mod.";
  if (lower === "minor") return "Minor";
  if (lower === "no oil") return "No Oil";
  return val;
};

const getTextForElement = (id, stone) => {
  switch (id) {
    case "sku":       return stone.sku || "";
    case "weight":    return stone.weightCt ? parseFloat(stone.weightCt).toFixed(2) : "";
    case "shape":     return stone.shape || "";
    case "lab":       return stone.lab || "";
    case "clarity":   return shortenClarity(stone.clarity || stone.treatment || "Minor");
    case "color": {
      const mapped = getMappedCategories(stone.category);
      if (mapped.includes('Fancy')) return [stone.fancyIntensity, stone.fancyColor].filter(Boolean).join(' ') || stone.color || "";
      return stone.color || "";
    }
    case "price":     return stone.priceTotal ? `$${Math.round(stone.priceTotal).toLocaleString()}` : "";
    case "priceCode": {
      if (stone.pricePerCt && stone.pricePerCt > 50000) return "";
      const mapped = getMappedCategories(stone.category);
      const isDiamond = mapped.includes('Diamond') || mapped.includes('Fancy');
      const price = isDiamond ? (stone.pricePerCt / 2) : stone.pricePerCt;
      return encodePriceB(price);
    }
    case "origin":    return stone.origin || "";
    default: return "";
  }
};

const measureTextWithSpacing = (ctx, text, letterSpacing) => {
  if (!letterSpacing) return ctx.measureText(text).width;
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += ctx.measureText(text[i]).width + (i < text.length - 1 ? letterSpacing : 0);
  }
  return w;
};

const drawTextWithSpacing = (ctx, text, x, y, letterSpacing, maxWidth) => {
  if (!letterSpacing || letterSpacing === 0) {
    ctx.fillText(text, x, y, maxWidth);
    return;
  }
  let curX = x;
  for (let i = 0; i < text.length; i++) {
    if (curX > x + maxWidth) break;
    ctx.fillText(text[i], curX, y);
    curX += ctx.measureText(text[i]).width + letterSpacing;
  }
};

export const renderLabel = async (stone, options = {}) => {
  await document.fonts.ready;
  const { template, labelSize } = options;
  const elements = template || loadTemplate();
  const lw = labelSize?.w || LABEL_W;
  const lh = labelSize?.h || LABEL_H;
  const scaleX = lw / LABEL_W;
  const scaleY = lh / LABEL_H;

  const canvas = document.createElement("canvas");
  canvas.width = lw;
  canvas.height = lh;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, lw, lh);

  for (const el of elements) {
    if (!el.visible) continue;

    const sx = el.x * scaleX;
    const sy = el.y * scaleY;
    const sw = el.w * scaleX;
    const sh = el.h * scaleY;

    if (el.id === "qr") {
      const dnaUrl = stone.category === "Jewelry"
        ? `https://gems-dna.com/jewelry/${stone.sku}`
        : `https://gems-dna.com/${stone.sku}`;
      try {
        const size = Math.min(sw, sh);
        const qrDataURL = await QRCode.toDataURL(dnaUrl, {
          width: Math.round(size),
          margin: 0,
          errorCorrectionLevel: "L",
          color: { dark: "#000000", light: "#ffffff" },
        });
        const qrImg = await loadImage(qrDataURL);
        if (qrImg) ctx.drawImage(qrImg, sx, sy, size, size);
      } catch {}
    } else if (el.id === "logo") {
      const logo = await loadLogo();
      if (logo) {
        const logoH = sh;
        const logoW = Math.min((logo.width / logo.height) * logoH, sw);
        ctx.drawImage(logo, sx, sy, logoW, logoH);
      }
    } else {
      const text = getTextForElement(el.id, stone);
      if (!text) continue;
      ctx.fillStyle = "#000000";
      const weight = el.fontWeight || (el.bold ? 700 : 400);
      const fontCSS = getFontCSS(el.fontFamily);
      const fs = Math.round((el.fontSize || 10) * Math.min(scaleX, scaleY));
      ctx.font = `${weight} ${fs}px ${fontCSS}`;

      const spacing = (el.letterSpacing || 0) * scaleX;
      const textW = measureTextWithSpacing(ctx, text, spacing);
      let drawX = sx;
      if (el.textAlign === "center") drawX = sx + (sw - textW) / 2;
      else if (el.textAlign === "right") drawX = sx + sw - textW;

      let drawY = sy;
      const vAlign = el.verticalAlign || "top";
      if (vAlign === "middle") { ctx.textBaseline = "middle"; drawY = sy + sh / 2; }
      else if (vAlign === "bottom") { ctx.textBaseline = "bottom"; drawY = sy + sh; }
      else { ctx.textBaseline = "top"; }

      drawTextWithSpacing(ctx, text, drawX, drawY, spacing, sw);
    }
  }

  return canvas;
};

export const renderLabels = async (stones, options = {}) => {
  const canvases = [];
  for (const stone of stones) {
    canvases.push(await renderLabel(stone, options));
  }
  return canvases;
};
