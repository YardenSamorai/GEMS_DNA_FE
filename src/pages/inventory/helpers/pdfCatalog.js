import jsPDF from "jspdf";
import { getMappedCategories } from "../../../utils/categoryMap";
import { API_BASE, getDisplayShape, getDisplayColor } from "./constants";
import { imageToBase64 } from "./imageData";
import "jspdf-autotable";

/* ---------------- PDF Catalog Helper: Fonts ---------------- */
const _fetchFontAsBase64 = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font not found: ${url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

let _catalogFontsCache = null;
export const loadCatalogFonts = async () => {
  if (_catalogFontsCache) return _catalogFontsCache;
  try {
    const [playfair, latoLight] = await Promise.all([
      _fetchFontAsBase64('/fonts/PlayfairDisplay-Regular.ttf'),
      _fetchFontAsBase64('/fonts/Lato-Light.ttf'),
    ]);
    _catalogFontsCache = { playfair, latoLight };
    return _catalogFontsCache;
  } catch (e) {
    console.warn('[PDF] Custom fonts could not be loaded, falling back to Helvetica.', e);
    return null;
  }
};

export const registerCatalogFonts = (pdf, fonts) => {
  if (!fonts) return { title: 'helvetica', body: 'helvetica', titleStyle: 'normal', bodyStyle: 'normal' };
  pdf.addFileToVFS('PlayfairDisplay-Regular.ttf', fonts.playfair);
  pdf.addFont('PlayfairDisplay-Regular.ttf', 'PlayfairDisplay', 'normal');
  pdf.addFileToVFS('Lato-Light.ttf', fonts.latoLight);
  pdf.addFont('Lato-Light.ttf', 'LatoLight', 'normal');
  return { title: 'PlayfairDisplay', body: 'LatoLight', titleStyle: 'normal', bodyStyle: 'normal' };
};

/* ---------------- Office Contacts (by Clerk publicMetadata.location) ----------------
 * To assign a user to a specific office: Clerk Dashboard -> Users -> open user ->
 * Metadata -> Public metadata -> { "location": "IL" }   (or "NY", "HK", "LA")
 *
 * The catalog and exports will pick the matching phone / email / website.
 * If no location is set, we fall back to the legacy email-based detection
 * (so existing users keep working until you migrate them).
 */
export const OFFICE_CONTACTS_BY_LOCATION = {
  IL: { phone: '+972-3-575-1137',  email: 'info@gems.net', site: 'www.gems.net', label: 'Tel Aviv' },
  NY: { phone: '+1.917.309.2523',  email: 'info@gems.net', site: 'www.gems.net', label: 'New York' },
  HK: { phone: '+852-3568-7021',   email: 'info@gems.net', site: 'www.gems.net', label: 'Hong Kong' },
  LA: { phone: '+1-213-622-9819',  email: 'info@gems.net', site: 'www.gems.net', label: 'Los Angeles' },
};
// Backward compatibility - "US" used to be the default code; map it to NY.
OFFICE_CONTACTS_BY_LOCATION.US = OFFICE_CONTACTS_BY_LOCATION.NY;
export const DEFAULT_OFFICE_CONTACT = OFFICE_CONTACTS_BY_LOCATION.NY;

export const LEGACY_ISRAEL_EMAILS = [
  'yarden@eshed.com',
  'eyal@eshed.com',
  'meirav@eshed.com',
  'le@gems.net',
];

export const getOfficeContact = ({ location, email } = {}) => {
  if (location && OFFICE_CONTACTS_BY_LOCATION[location]) {
    return OFFICE_CONTACTS_BY_LOCATION[location];
  }
  if (email && LEGACY_ISRAEL_EMAILS.includes(String(email).toLowerCase())) {
    return OFFICE_CONTACTS_BY_LOCATION.IL;
  }
  return DEFAULT_OFFICE_CONTACT;
};

/* ---------------- PDF Catalog Generator ---------------- */
export const generatePDFCatalog = async (selectedStones, options = {}) => {
  if (!selectedStones || selectedStones.length === 0) {
    alert("Please select stones to generate PDF");
    return;
  }

  const {
    layout = 'grid',
    showPrices = true,
    itemsPerPage = 4,
    userLocation,
    userEmail,
  } = options;

  const office = getOfficeContact({ location: userLocation, email: userEmail });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const green = [0, 168, 107];
  const dark = [24, 24, 24];
  const black = [0, 0, 0];
  const gray = [140, 140, 140];
  const lightGray = [200, 200, 200];

  const fonts = await loadCatalogFonts();
  const PDF_FONTS = registerCatalogFonts(pdf, fonts);
  console.log('[PDF Catalog] Fonts:', fonts ? 'loaded ✓' : 'fallback (Helvetica)');

  let logoBase64 = null;
  let logoCoverBase64 = null;
  let coverBgBase64 = null;
  try { logoBase64 = await imageToBase64('/gemstar-logo-footer.png'); } catch (e) { /* no logo */ }
  try {
    logoCoverBase64 = await imageToBase64('/images/Gemstar_logo%201.png');
    console.log('[PDF Catalog] Cover logo: loaded ✓');
  } catch (e) {
    console.warn('[PDF Catalog] Cover logo failed to load:', e);
  }
  try {
    coverBgBase64 = await imageToBase64('/images/A4_cover_bg.png');
    console.log('[PDF Catalog] Cover background: loaded ✓');
  } catch (e) {
    console.warn('[PDF Catalog] Cover background failed to load:', e);
  }

  const loadImage = async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(`${API_BASE}/api/image-proxy?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return (data.image && data.image.startsWith('data:')) ? data.image : null;
    } catch (e) { return null; }
  };

  const isJewelryItem = (stone) => stone.category === 'Jewelry';

  const getCategoryLabel = (stone) => {
    if (isJewelryItem(stone)) return (stone.jewelryType || 'Jewelry').toUpperCase();
    const mapped = getMappedCategories(stone.category);
    if (mapped.includes('Emerald')) return 'EMERALD';
    if (mapped.includes('Diamond')) return 'DIAMOND';
    const label = mapped.find(m => m !== 'Empty' && m !== 'Fancy');
    return (label || 'GEMSTONE').toUpperCase();
  };

  const getStoneDetails = (stone) => {
    const mapped = getMappedCategories(stone.category);
    const isEmeraldType = !mapped.includes('Diamond');
    return {
      shape: getDisplayShape(stone.shape) || '-',
      color: getDisplayColor(stone) || '-',
      clarity: isEmeraldType ? (stone.treatment || '-') : (stone.clarity || '-'),
      lab: stone.lab || '-',
      sku: stone.sku || '-',
    };
  };

  // Compact metal label so it fits a narrow cell: "18K White Gold" -> "18K WG".
  const shortMetal = (m) => {
    if (!m) return '-';
    return String(m)
      .replace(/\bWhite Gold\b/i, 'WG')
      .replace(/\bYellow Gold\b/i, 'YG')
      .replace(/\bRose Gold\b/i, 'RG')
      .replace(/\bPlatinum\b/i, 'Plat')
      .replace(/\bGold\b/i, 'Gold')
      .replace(/\s+/g, ' ')
      .trim() || '-';
  };

  // Per-card spec columns. Stones show Shape/Color/Clarity/Lab; jewelry shows
  // the data that actually matters for a piece: metal, center stone shape +
  // carat, and center colour (clarity/lab are dropped — almost always empty).
  const getSpecFields = (stone) => {
    if (isJewelryItem(stone)) {
      const center = getDisplayShape(stone.shape) || stone.stoneType || '-';
      const ctrCt = stone.centerStoneCarat ? `${Number(stone.centerStoneCarat)}ct` : '-';
      return {
        cols: ['Metal', 'Center', 'Ctr ct', 'Color'],
        vals: [shortMetal(stone.metalType), center, ctrCt, stone.color || '-'],
      };
    }
    const d = getStoneDetails(stone);
    return {
      cols: ['Shape', 'Color', 'Clarity', 'Lab'],
      vals: [d.shape, d.color, shortenClarity(d.clarity), d.lab],
    };
  };

  // Shorten long multi-word Clarity values so they don't overflow the cell.
  // Example: "Insignificant to Minor" -> "Ins - Min"
  // Rule: take the first 3 chars of each meaningful word, joined with " - ".
  // Connector words (to / and / & / or / of / the) are dropped.
  // Single-word or already-short values are returned unchanged.
  const shortenClarity = (clarity) => {
    if (!clarity) return '-';
    const text = String(clarity).trim();
    if (!text || text === '-') return '-';
    const STOP = new Set(['to', 'and', '&', 'or', 'of', 'the']);
    const words = text.split(/\s+/).filter((w) => !STOP.has(w.toLowerCase()));
    if (words.length <= 1) return text;
    if (text.length <= 12) return text;
    return words.map((w) => (w.length > 3 ? w.substring(0, 3) : w)).join(' - ');
  };

  const addFooter = (pageNum, totalContentPages) => {
    const footerY = pageHeight - 12;
    pdf.setDrawColor(...lightGray);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
    pdf.setFontSize(8);
    pdf.setTextColor(...gray);
    pdf.setFont('helvetica', 'normal');
    const dateStr = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    pdf.text(dateStr, margin, footerY);
    pdf.text(`Page ${pageNum} of ${totalContentPages}`, pageWidth - margin, footerY, { align: 'right' });
  };

  const totalContentPages = Math.ceil(selectedStones.length / itemsPerPage);
  const totalWeight = selectedStones.reduce((sum, s) => sum + (s.weightCt || 0), 0);

  // ==================== COVER PAGE ====================
  if (coverBgBase64) {
    try {
      pdf.addImage(coverBgBase64, 'PNG', 0, 0, pageWidth, pageHeight);
    } catch (e) {
      pdf.setFillColor(...dark);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    }
  } else {
    pdf.setFillColor(...dark);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  const coverLogo = logoCoverBase64 || logoBase64;
  if (coverLogo) {
    try {
      const props = pdf.getImageProperties(coverLogo);
      const logoW = 45;
      const logoH = logoW * (props.height / props.width);
      pdf.addImage(
        coverLogo,
        'PNG',
        pageWidth / 2 - logoW / 2,
        40,
        logoW,
        logoH
      );
    } catch (e) { /* skip */ }
  }

  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.4);
  pdf.line(pageWidth / 2 - 32, 86, pageWidth / 2 + 32, 86);

  pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.text('Premium Gemstones & Diamonds', pageWidth / 2, 93, { align: 'center' });

  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.4);
  pdf.line(pageWidth / 2 - 32, 98, pageWidth / 2 + 32, 98);

  pdf.setFont(PDF_FONTS.title, PDF_FONTS.titleStyle);
  pdf.setFontSize(30);
  pdf.setTextColor(255, 255, 255);
  pdf.text('STONE CATALOG', pageWidth / 2, pageHeight * 0.55, { align: 'center' });

  pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
  pdf.setFontSize(15);
  pdf.setTextColor(220, 220, 220);
  pdf.text(
    `${selectedStones.length} Stones   |   ${totalWeight.toFixed(2)} Total Carats`,
    pageWidth / 2,
    pageHeight * 0.55 + 10,
    { align: 'center' }
  );

  pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
  pdf.setFontSize(9);
  pdf.setTextColor(200, 200, 200);
  const dateStr = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  pdf.text(dateStr, pageWidth / 2, pageHeight - 30, { align: 'center' });

  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.3);
  pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

  pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
  pdf.setFontSize(8);
  pdf.setTextColor(220, 220, 220);
  const footerY = pageHeight - 12;
  const sepLeft = pageWidth / 2 - 32;
  const sepRight = pageWidth / 2 + 32;
  pdf.text(office.site, sepLeft - 4, footerY, { align: 'right' });
  pdf.setTextColor(150, 150, 150);
  pdf.text('|', sepLeft, footerY, { align: 'center' });
  pdf.setTextColor(220, 220, 220);
  pdf.text(office.phone, pageWidth / 2, footerY, { align: 'center' });
  pdf.setTextColor(150, 150, 150);
  pdf.text('|', sepRight, footerY, { align: 'center' });
  pdf.setTextColor(220, 220, 220);
  pdf.text(office.email, sepRight + 4, footerY, { align: 'left' });

  // ==================== CONTENT PAGES ====================
  const coverLogoForHeader = logoCoverBase64 || logoBase64;
  const drawInnerHeader = () => {
    const HEADER_H = 28;
    if (coverBgBase64) {
      try { pdf.addImage(coverBgBase64, 'PNG', 0, 0, pageWidth, HEADER_H); } catch (e) {
        pdf.setFillColor(...dark);
        pdf.rect(0, 0, pageWidth, HEADER_H, 'F');
      }
    } else {
      pdf.setFillColor(...dark);
      pdf.rect(0, 0, pageWidth, HEADER_H, 'F');
    }
    if (coverLogoForHeader) {
      try {
        const lp = pdf.getImageProperties(coverLogoForHeader);
        const lh = 16;
        const lw = lh * (lp.width / lp.height);
        pdf.addImage(coverLogoForHeader, 'PNG', margin, (HEADER_H - lh) / 2, lw, lh);
      } catch (e) { /* skip */ }
    }
    pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
    pdf.setFontSize(7.5);
    pdf.setTextColor(255, 255, 255);
    pdf.text(
      'N e w   Y o r k   |   T e l   A v i v   |   H o n g   K o n g   |   L o s   A n g e l e s',
      pageWidth - margin,
      HEADER_H / 2 - 1,
      { align: 'right' }
    );
    pdf.setFontSize(7);
    pdf.setTextColor(220, 220, 220);
    pdf.text(
      `${office.site}   |   ${office.phone}   |   ${office.email}`,
      pageWidth - margin,
      HEADER_H / 2 + 5,
      { align: 'right' }
    );
    return HEADER_H;
  };

  const drawInnerFooter = (pageNum) => {
    const fY = pageHeight - 10;
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(margin, fY - 5, pageWidth - margin, fY - 5);
    pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    const fDate = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    pdf.text(fDate, margin, fY);
    pdf.text(`Page ${pageNum} of ${totalContentPages}`, pageWidth - margin, fY, { align: 'right' });
  };

  if (layout === 'list') {
    const HEADER_H = 28;
    const FOOTER_RESERVE = 20;
    const startY = HEADER_H + 6;
    const cardSlot = (pageHeight - startY - FOOTER_RESERVE) / itemsPerPage;
    const cardHeight = Math.min(cardSlot - 4, 55);
    const imgSize = Math.min(cardHeight - 4, 50);
    let pageNum = 0;

    for (let i = 0; i < selectedStones.length; i += itemsPerPage) {
      pdf.addPage();
      pageNum++;
      drawInnerHeader();

      const pageStones = selectedStones.slice(i, i + itemsPerPage);

      for (let j = 0; j < pageStones.length; j++) {
        const stone = pageStones[j];
        const details = getStoneDetails(stone);
        const catLabel = getCategoryLabel(stone);

        const y = startY + j * cardSlot;

        // ---------- Image (left, square with thin frame) ----------
        const imgY = y + (cardHeight - imgSize) / 2;
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.rect(margin, imgY, imgSize, imgSize, 'S');

        if (stone.imageUrl) {
          try {
            const imgData = await loadImage(stone.imageUrl);
            if (imgData) {
              pdf.addImage(imgData, 'JPEG', margin + 1.5, imgY + 1.5, imgSize - 3, imgSize - 3);
            }
          } catch (e) { /* skip */ }
        }

        // ---------- Right side text area ----------
        const textX = margin + imgSize + 10;
        const rightEdge = pageWidth - margin;
        const textWidth = rightEdge - textX;

        // Specs row — stones: Shape | Color | Clarity | Lab | SKU;
        // jewelry: Metal | Center | Ctr ct | Color | SKU (labels gray, values black)
        const baseSpec = getSpecFields(stone);
        const specCols = [...baseSpec.cols, 'SKU'];
        const specVals = [...baseSpec.vals, details.sku];
        const sColW = textWidth / specCols.length;
        const labelY = y + 5;
        const valY = labelY + 5.5;

        pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        specCols.forEach((label, ci) => {
          pdf.text(label, textX + ci * sColW, labelY);
        });

        pdf.setFont(PDF_FONTS.title, PDF_FONTS.titleStyle);
        pdf.setFontSize(10);
        pdf.setTextColor(20, 20, 20);
        specVals.forEach((val, ci) => {
          pdf.text(String(val), textX + ci * sColW, valY);
        });

        // Category name (large serif, left-aligned)
        const catY = valY + 9;
        pdf.setFont(PDF_FONTS.title, PDF_FONTS.titleStyle);
        pdf.setFontSize(15);
        pdf.setTextColor(20, 20, 20);
        pdf.text(catLabel, textX, catY);

        // Divider between category and weight/price row
        const divY = catY + 4;
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.2);
        pdf.line(textX, divY, rightEdge, divY);

        // ---------- Weight + Price + View DNA button ----------
        const bottomY = divY + 7;

        pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
        pdf.setFontSize(9);
        pdf.setTextColor(120, 120, 120);
        pdf.text('WEIGHT:', textX, bottomY);
        pdf.setFont(PDF_FONTS.title, PDF_FONTS.titleStyle);
        pdf.setFontSize(10);
        pdf.setTextColor(...green);
        pdf.text(`${stone.weightCt || '?'}ct`, textX + 18, bottomY);

        if (showPrices && stone.priceTotal) {
          pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
          pdf.setFontSize(9);
          pdf.setTextColor(120, 120, 120);
          pdf.text('PRICE:', textX + 44, bottomY);
          pdf.setFont(PDF_FONTS.title, PDF_FONTS.titleStyle);
          pdf.setFontSize(10);
          pdf.setTextColor(...green);
          pdf.text(`$${Math.round(stone.priceTotal).toLocaleString()}`, textX + 58, bottomY);
        }

        // View DNA pill button (right-aligned)
        const btnW = 32;
        const btnH = 7.5;
        const btnX = rightEdge - btnW;
        const btnY = bottomY - 5.5;
        pdf.setFillColor(...green);
        pdf.roundedRect(btnX, btnY, btnW, btnH, 1, 1, 'F');
        pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.textWithLink('View DNA', btnX + btnW / 2, btnY + 5, {
          url: `https://gems-dna.com/${stone.sku}`,
          align: 'center',
        });

        // Divider between cards
        if (j < pageStones.length - 1) {
          const sepY = y + cardSlot - 2;
          pdf.setDrawColor(230, 230, 230);
          pdf.setLineWidth(0.2);
          pdf.line(margin, sepY, pageWidth - margin, sepY);
        }
      }

      drawInnerFooter(pageNum);
    }
  } else {
    // Grid layout: 2x2 = 4 per page
    const HEADER_H = 28;
    const FOOTER_H = 18;
    const GUTTER = 8;
    const colWidth = (contentWidth - GUTTER) / 2;
    const cardHeight = (pageHeight - HEADER_H - FOOTER_H - GUTTER - 6) / 2;
    let pageNum = 0;

    for (let i = 0; i < selectedStones.length; i += itemsPerPage) {
      pdf.addPage();
      pageNum++;

      // ---------- Header (dark rocky band) ----------
      if (coverBgBase64) {
        try { pdf.addImage(coverBgBase64, 'PNG', 0, 0, pageWidth, HEADER_H); } catch (e) {
          pdf.setFillColor(...dark);
          pdf.rect(0, 0, pageWidth, HEADER_H, 'F');
        }
      } else {
        pdf.setFillColor(...dark);
        pdf.rect(0, 0, pageWidth, HEADER_H, 'F');
      }

      // Header logo (left)
      if (coverLogo) {
        try {
          const lp = pdf.getImageProperties(coverLogo);
          const lh = 16;
          const lw = lh * (lp.width / lp.height);
          pdf.addImage(coverLogo, 'PNG', margin, (HEADER_H - lh) / 2, lw, lh);
        } catch (e) { /* skip */ }
      }

      // Header right column (locations + contact)
      pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
      pdf.setFontSize(7.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(
        'N e w   Y o r k   |   T e l   A v i v   |   H o n g   K o n g   |   L o s   A n g e l e s',
        pageWidth - margin,
        HEADER_H / 2 - 1,
        { align: 'right' }
      );
      pdf.setFontSize(7);
      pdf.setTextColor(220, 220, 220);
      pdf.text(
        `${office.site}   |   ${office.phone}   |   ${office.email}`,
        pageWidth - margin,
        HEADER_H / 2 + 5,
        { align: 'right' }
      );

      const startY = HEADER_H + 8;
      const pageStones = selectedStones.slice(i, i + itemsPerPage);

      for (let j = 0; j < pageStones.length; j++) {
        const stone = pageStones[j];
        const details = getStoneDetails(stone);
        const catLabel = getCategoryLabel(stone);
        const col = j % 2;
        const row = Math.floor(j / 2);
        const x = margin + col * (colWidth + GUTTER);
        const y = startY + row * (cardHeight + GUTTER);

        // ---------- Image area (top of card, square) ----------
        const imgPad = 2;
        const imgH = Math.min(colWidth - 4, cardHeight * 0.55);
        const imgW = imgH;
        const imgX = x + (colWidth - imgW) / 2;
        const imgY = y;

        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.rect(imgX, imgY, imgW, imgH, 'S');

        if (stone.imageUrl) {
          try {
            const imgData = await loadImage(stone.imageUrl);
            if (imgData) {
              pdf.addImage(imgData, 'JPEG', imgX + imgPad, imgY + imgPad, imgW - imgPad * 2, imgH - imgPad * 2);
            }
          } catch (e) { /* skip */ }
        }

        // ---------- Specs row (Shape | Color | Clarity | Lab) ----------
        const specsY = imgY + imgH + 8;
        const { cols: specCols, vals: specVals } = getSpecFields(stone);
        const sColW = colWidth / specCols.length;

        pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        specCols.forEach((label, ci) => {
          pdf.text(label, x + ci * sColW + sColW / 2, specsY, { align: 'center' });
        });

        pdf.setFont(PDF_FONTS.title, PDF_FONTS.titleStyle);
        pdf.setFontSize(10);
        pdf.setTextColor(20, 20, 20);
        specVals.forEach((val, ci) => {
          pdf.text(String(val), x + ci * sColW + sColW / 2, specsY + 5, { align: 'center' });
        });

        // Divider 1
        const div1Y = specsY + 10;
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.line(x, div1Y, x + colWidth, div1Y);

        // ---------- Category (centered, serif) ----------
        const catY = div1Y + 6;
        pdf.setFont(PDF_FONTS.title, PDF_FONTS.titleStyle);
        pdf.setFontSize(11);
        pdf.setTextColor(20, 20, 20);
        pdf.text(catLabel, x + colWidth / 2, catY, { align: 'center' });

        // ---------- Weight + Price ----------
        const wpY = catY + 8;
        pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
        pdf.setFontSize(10);
        pdf.setTextColor(120, 120, 120);
        pdf.text('WEIGHT:', x + 2, wpY);
        pdf.setFont(PDF_FONTS.title, PDF_FONTS.titleStyle);
        pdf.setFontSize(11.5);
        pdf.setTextColor(...green);
        pdf.text(`${stone.weightCt || '?'}ct`, x + 20, wpY);

        if (showPrices && stone.priceTotal) {
          pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
          pdf.setFontSize(10);
          pdf.setTextColor(120, 120, 120);
          pdf.text('PRICE:', x + colWidth / 2, wpY);
          pdf.setFont(PDF_FONTS.title, PDF_FONTS.titleStyle);
          pdf.setFontSize(11.5);
          pdf.setTextColor(...green);
          pdf.text(`$${Math.round(stone.priceTotal).toLocaleString()}`, x + colWidth / 2 + 15, wpY);
        }

        // Divider 2
        const div2Y = wpY + 4;
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.2);
        pdf.line(x, div2Y, x + colWidth, div2Y);

        // ---------- SKU + View DNA button ----------
        const btnY = div2Y + 6;
        pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
        pdf.setFontSize(8);
        pdf.setTextColor(140, 140, 140);
        pdf.text(details.sku, x + 2, btnY + 0.5);

        const btnW = 36;
        const btnH = 7;
        const btnX = x + colWidth - btnW;
        const btnTopY = btnY - 4;
        pdf.setFillColor(...green);
        pdf.roundedRect(btnX, btnTopY, btnW, btnH, 1, 1, 'F');
        pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.textWithLink('View DNA', btnX + btnW / 2, btnTopY + 4.7, {
          url: `https://gems-dna.com/${stone.sku}`,
          align: 'center',
        });
      }

      // ---------- Footer ----------
      const fY = pageHeight - 10;
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.3);
      pdf.line(margin, fY - 5, pageWidth - margin, fY - 5);

      pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      const fDate = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(fDate, margin, fY);
      pdf.text(`Page ${pageNum} of ${totalContentPages}`, pageWidth - margin, fY, { align: 'right' });
    }
  }

  const filename = `Gemstar_Catalog_${new Date().toISOString().split('T')[0]}_${selectedStones.length}pcs.pdf`;
  pdf.save(filename);
};
