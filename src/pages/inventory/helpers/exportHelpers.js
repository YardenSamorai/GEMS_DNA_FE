import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getMappedCategories } from '../../../utils/categoryMap';
import { getDisplayShape, getDisplayColor, API_BASE } from './constants';

export const encodePriceBARELOVSK = (price) => {
  if (!price || price <= 0) return "B-";
  
  const rounded = Math.round(price);
  const priceStr = rounded.toString();
  
  const digitToLetter = {
    '1': 'H', '2': 'A', '3': 'R', '4': 'E', '5': 'L',
    '6': 'O', '7': 'V', '8': 'S', '9': 'K'
  };
  
  let encoded = 'B';
  let i = 0;
  
  while (i < priceStr.length) {
    if (priceStr[i] === '0') {
      let zeroCount = 0;
      while (i < priceStr.length && priceStr[i] === '0') {
        zeroCount++;
        i++;
      }
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

export const svgToPngBase64 = (svgUrl, width = 600, height = 340) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const scale = Math.min(width / img.width, height / img.height) * 0.85;
      const x = (width - img.width * scale) / 2;
      const y = (height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      resolve(base64);
    };
    img.onerror = () => reject(new Error('Failed to load SVG'));
    img.src = svgUrl;
  });
};

export const imageToBase64 = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
};

const fetchFontAsBase64 = async (url) => {
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
const loadCatalogFonts = async () => {
  if (_catalogFontsCache) return _catalogFontsCache;
  try {
    const [playfair, latoLight] = await Promise.all([
      fetchFontAsBase64('/fonts/PlayfairDisplay-Regular.ttf'),
      fetchFontAsBase64('/fonts/Lato-Light.ttf'),
    ]);
    _catalogFontsCache = { playfair, latoLight };
    return _catalogFontsCache;
  } catch (e) {
    console.warn('[PDF] Custom fonts could not be loaded, falling back to Helvetica.', e);
    return null;
  }
};

const registerCatalogFonts = (pdf, fonts) => {
  if (!fonts) return { title: 'helvetica', body: 'helvetica', titleStyle: 'normal', bodyStyle: 'normal' };
  pdf.addFileToVFS('PlayfairDisplay-Regular.ttf', fonts.playfair);
  pdf.addFont('PlayfairDisplay-Regular.ttf', 'PlayfairDisplay', 'normal');
  pdf.addFileToVFS('Lato-Light.ttf', fonts.latoLight);
  pdf.addFont('Lato-Light.ttf', 'LatoLight', 'normal');
  return { title: 'PlayfairDisplay', body: 'LatoLight', titleStyle: 'normal', bodyStyle: 'normal' };
};

export const exportForLabels = async (selectedStones, shareMode = false) => {
  if (!selectedStones || selectedStones.length === 0) {
    alert("Please select stones to export");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gemstar Labels";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Labels");

  worksheet.columns = [
    { key: "details", width: 25 },
    { key: "qr", width: 35 },
  ];

  const headerRow = worksheet.addRow(["Details", "QR Code URL"]);
  headerRow.font = { bold: true, size: 12 };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  headerRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" };

  selectedStones.forEach((stone) => {
    const priceCode = encodePriceBARELOVSK(stone.pricePerCt);
    const mapped = getMappedCategories(stone.category);
    const sku = (stone.sku || '').toUpperCase();
    
    const isDiamondOrFancy = mapped.includes('Diamond') || sku.startsWith('T');
    
    const clarity = (stone.clarity || '').toLowerCase() === 'insignificant' 
      ? 'Ins' 
      : (stone.clarity || '');
    
    const rawTreatment = stone.treatment || 'Minor';
    const treatment = rawTreatment.toLowerCase() === 'insignificant' ? 'Ins' : rawTreatment;
    
    const showPrice = stone.pricePerCt < 50000;
    
    const lab = (stone.lab && stone.lab.toUpperCase() !== 'N/A') ? stone.lab : null;
    
    let details;
    if (isDiamondOrFancy) {
      details = [
        `${stone.weightCt || '?'}`,
        lab,
        `${getDisplayColor(stone) || ''}   ${clarity}`.trim() || null
      ].filter(Boolean).join('\n');
    } else {
      details = [
        `${stone.weightCt || '?'}`,
        lab,
        treatment,
        showPrice ? priceCode : null
      ].filter(Boolean).join('\n');
    }

    const qrUrl = `https://gems-dna.com/${stone.sku}`;

    const row = worksheet.addRow([details, qrUrl]);
    
    row.height = 80;
    
    row.getCell(1).alignment = { 
      horizontal: "center", 
      vertical: "middle",
      wrapText: true
    };
    
    row.getCell(2).alignment = { 
      horizontal: "center", 
      vertical: "middle"
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `Labels_${new Date().toISOString().split("T")[0]}_${selectedStones.length}pcs.xlsx`;
  
  if (shareMode && navigator.canShare) {
    const file = new File([buffer], filename, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Niimbot Labels",
          text: `${selectedStones.length} stone labels for printing`,
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.log("Share failed, falling back to download");
        } else {
          return;
        }
      }
    }
  }
  
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, filename);
};

export const generatePDFCatalog = async (selectedStones, options = {}) => {
  if (!selectedStones || selectedStones.length === 0) {
    alert("Please select stones to generate PDF");
    return;
  }

  const {
    layout = 'grid',
    showPrices = true,
    itemsPerPage = 4,
  } = options;

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

  const getCategoryLabel = (stone) => {
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

  if (logoCoverBase64) {
    try {
      const props = pdf.getImageProperties(logoCoverBase64);
      const logoW = 70;
      const logoH = logoW * (props.height / props.width);
      pdf.addImage(
        logoCoverBase64,
        'PNG',
        pageWidth / 2 - logoW / 2,
        pageHeight * 0.30 - logoH / 2,
        logoW,
        logoH
      );
    } catch (e) { /* skip */ }
  }

  pdf.setFont(PDF_FONTS.title, PDF_FONTS.titleStyle);
  pdf.setFontSize(40);
  pdf.setTextColor(255, 255, 255);
  pdf.text('STONE CATALOG', pageWidth / 2, pageHeight * 0.55, { align: 'center' });

  pdf.setFont(PDF_FONTS.body, PDF_FONTS.bodyStyle);
  pdf.setFontSize(24);
  pdf.setTextColor(220, 220, 220);
  pdf.text(
    `${selectedStones.length} Stones  |  ${totalWeight.toFixed(2)} Total Carats`,
    pageWidth / 2,
    pageHeight * 0.55 + 14,
    { align: 'center' }
  );

  if (layout === 'list') {
    const cardHeight = 58;
    const imgSize = 45;
    let pageNum = 0;

    for (let i = 0; i < selectedStones.length; i += itemsPerPage) {
      pdf.addPage();
      pageNum++;
      let y = 15;
      const pageStones = selectedStones.slice(i, i + itemsPerPage);

      for (let j = 0; j < pageStones.length; j++) {
        const stone = pageStones[j];
        const details = getStoneDetails(stone);
        const catLabel = getCategoryLabel(stone);

        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, y, imgSize, imgSize, 2, 2, 'S');
        pdf.setFillColor(248, 248, 248);
        pdf.roundedRect(margin + 0.15, y + 0.15, imgSize - 0.3, imgSize - 0.3, 2, 2, 'F');

        if (stone.imageUrl) {
          try {
            const imgData = await loadImage(stone.imageUrl);
            if (imgData) pdf.addImage(imgData, 'JPEG', margin + 1, y + 1, imgSize - 2, imgSize - 2);
          } catch (e) { /* skip */ }
        }

        const textX = margin + imgSize + 8;
        const rightEdge = pageWidth - margin;

        const labelY = y + 5;
        const valY = labelY + 5;
        const cols = ['Shape', 'Color', 'Clarity', 'Lab', 'SKU'];
        const vals = [details.shape, details.color, details.clarity, details.lab, details.sku];
        const colWidth = (rightEdge - textX) / cols.length;

        pdf.setFontSize(7);
        pdf.setTextColor(...gray);
        pdf.setFont('helvetica', 'normal');
        cols.forEach((label, ci) => { pdf.text(label, textX + ci * colWidth, labelY); });

        pdf.setFontSize(9);
        pdf.setTextColor(...black);
        pdf.setFont('helvetica', 'bold');
        vals.forEach((val, ci) => { pdf.text(val, textX + ci * colWidth, valY); });

        pdf.setFontSize(14);
        pdf.setTextColor(...black);
        pdf.setFont('helvetica', 'bold');
        pdf.text(catLabel, textX, valY + 10);

        const bottomY = valY + 18;
        pdf.setFontSize(9);
        pdf.setTextColor(...black);
        pdf.setFont('helvetica', 'bold');
        pdf.text('WEIGHT:', textX, bottomY);
        pdf.setTextColor(...green);
        pdf.text(`${stone.weightCt || '?'}ct`, textX + 18, bottomY);

        if (showPrices && stone.priceTotal) {
          pdf.setFontSize(9);
          pdf.setTextColor(...black);
          pdf.setFont('helvetica', 'bold');
          pdf.text('PRICE:', textX + 42, bottomY);
          pdf.setFontSize(10);
          pdf.text(`$${Math.round(stone.priceTotal).toLocaleString()}`, textX + 56, bottomY);
        }

        const btnW = 22; const btnH = 7;
        const btnX = rightEdge - btnW;
        const btnY = bottomY - 5;
        pdf.setFillColor(...green);
        pdf.roundedRect(btnX, btnY, btnW, btnH, 1.5, 1.5, 'F');
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.textWithLink('View DNA', btnX + 3, btnY + 5, { url: `https://gems-dna.com/${stone.sku}` });

        y += cardHeight;

        if (j < pageStones.length - 1) {
          pdf.setDrawColor(230, 230, 230);
          pdf.setLineWidth(0.2);
          pdf.line(margin, y - 3, pageWidth - margin, y - 3);
        }
      }

      addFooter(pageNum, totalContentPages);
    }
  } else {
    const cols = 2;
    const colWidth = (contentWidth - 8) / cols;
    const imgH = 55;
    const cardHeight = 105;
    let pageNum = 0;

    for (let i = 0; i < selectedStones.length; i += itemsPerPage) {
      pdf.addPage();
      pageNum++;

      let headerY = 10;
      if (logoBase64) {
        try { pdf.addImage(logoBase64, 'PNG', margin, headerY - 2, 35, 13); } catch (e) { /* skip */ }
      }
      pdf.setFontSize(7);
      pdf.setTextColor(...green);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Premium Gemstones & Diamonds', margin, headerY + 15);

      pdf.setFontSize(7);
      pdf.setTextColor(...black);
      pdf.setFont('helvetica', 'bold');
      pdf.text('N e w  Y o r k  |  T e l  A v i v  |  H o n g  K o n g  |  L o s  A n g e l e s', pageWidth - margin, headerY + 3, { align: 'right' });
      pdf.setFontSize(7);
      pdf.setTextColor(...gray);
      pdf.setFont('helvetica', 'normal');
      pdf.text('www.gems.net   |   +1 (212) 869-0544   |   info@gems.net', pageWidth - margin, headerY + 9, { align: 'right' });

      const startY = headerY + 22;
      const pageStones = selectedStones.slice(i, i + itemsPerPage);

      for (let j = 0; j < pageStones.length; j++) {
        const stone = pageStones[j];
        const details = getStoneDetails(stone);
        const catLabel = getCategoryLabel(stone);
        const col = j % cols;
        const row = Math.floor(j / cols);
        const x = margin + col * (colWidth + 8);
        const y = startY + row * (cardHeight + 8);

        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, colWidth, imgH, 2, 2, 'S');
        pdf.setFillColor(250, 250, 250);
        pdf.roundedRect(x + 0.15, y + 0.15, colWidth - 0.3, imgH - 0.3, 2, 2, 'F');

        if (stone.imageUrl) {
          try {
            const imgData = await loadImage(stone.imageUrl);
            if (imgData) {
              const imgW = Math.min(colWidth - 10, imgH - 6);
              const imgX = x + (colWidth - imgW) / 2;
              pdf.addImage(imgData, 'JPEG', imgX, y + 3, imgW, imgH - 6);
            }
          } catch (e) { /* skip */ }
        }

        const detailY = y + imgH + 5;
        const detailCols = ['Shape', 'Color', 'Clarity', 'Lab'];
        const detailVals = [details.shape, details.color, details.clarity, details.lab];
        const dColW = colWidth / detailCols.length;

        pdf.setFontSize(7);
        pdf.setTextColor(...gray);
        pdf.setFont('helvetica', 'normal');
        detailCols.forEach((label, ci) => { pdf.text(label, x + ci * dColW, detailY); });

        pdf.setFontSize(8);
        pdf.setTextColor(...black);
        pdf.setFont('helvetica', 'bold');
        detailVals.forEach((val, ci) => { pdf.text(val, x + ci * dColW, detailY + 5); });

        pdf.setFontSize(12);
        pdf.setTextColor(...black);
        pdf.setFont('helvetica', 'bold');
        pdf.text(catLabel, x, detailY + 14);

        const bottomY = detailY + 22;
        pdf.setFontSize(8);
        pdf.setTextColor(...black);
        pdf.setFont('helvetica', 'bold');
        pdf.text('WEIGHT:', x, bottomY);
        pdf.setTextColor(...green);
        pdf.text(`${stone.weightCt || '?'}ct`, x + 17, bottomY);

        if (showPrices && stone.priceTotal) {
          pdf.setTextColor(...black);
          pdf.text('PRICE:', x + 35, bottomY);
          pdf.setFontSize(9);
          pdf.text(`$${Math.round(stone.priceTotal).toLocaleString()}`, x + 49, bottomY);
        }

        const skuY = bottomY + 7;
        pdf.setFontSize(8);
        pdf.setTextColor(...gray);
        pdf.setFont('helvetica', 'normal');
        pdf.text(details.sku, x, skuY);

        const btnW = 22; const btnH = 7;
        const btnX = x + colWidth - btnW;
        const btnY = skuY - 5;
        pdf.setFillColor(...green);
        pdf.roundedRect(btnX, btnY, btnW, btnH, 1.5, 1.5, 'F');
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.textWithLink('View DNA', btnX + 3, btnY + 5, { url: `https://gems-dna.com/${stone.sku}` });
      }

      addFooter(pageNum, totalContentPages);
    }
  }

  const filename = `Gemstar_Catalog_${new Date().toISOString().split('T')[0]}_${selectedStones.length}pcs.pdf`;
  pdf.save(filename);
};

export const createEmailText = (stone) => `Stone Details

SKU: ${stone.sku}
Shape: ${getDisplayShape(stone.shape)}
Weight: ${stone.weightCt} ct
Measurements: ${stone.measurements || 'N/A'}
Clarity: ${stone.clarity || 'N/A'}
Treatment: ${stone.treatment || 'N/A'}
Lab: ${stone.lab || 'N/A'}
Origin: ${stone.origin || 'N/A'}

Photo: ${stone.imageUrl || 'N/A'}
Video: ${stone.videoUrl || 'N/A'}
Certificate: ${stone.certificateUrl || 'N/A'}

Best regards,
Gemstar`;

export const createEmailHtml = (stone) => `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f5f5f4; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e7e5e4;">
<div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; text-align: center;">
<h1 style="color: white; margin: 0; font-size: 24px;">Stone Details</h1>
</div>
<div style="padding: 24px;">
${stone.imageUrl ? `<img src="${stone.imageUrl}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 8px; display: block; margin: 0 auto 20px;" />` : ''}
<table style="width: 100%; border-collapse: collapse;">
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>SKU:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.sku}</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Shape:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${getDisplayShape(stone.shape)}</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Weight:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.weightCt} ct</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Measurements:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.measurements || 'N/A'}</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Treatment:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.treatment || 'N/A'}</td></tr>
<tr><td style="padding: 8px 0;"><strong>Origin:</strong></td><td style="padding: 8px 0;">${stone.origin || 'N/A'}</td></tr>
</table>
<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e7e5e4; text-align: center;">
${stone.videoUrl ? `<a href="${stone.videoUrl}" style="color: #10b981; margin-right: 16px;">View Video</a>` : ''}
${stone.certificateUrl ? `<a href="${stone.certificateUrl}" style="color: #10b981;">View Certificate</a>` : ''}
</div>
</div>
<div style="background: #f5f5f4; padding: 16px; text-align: center; font-size: 12px; color: #78716c;">
Best regards, Gemstar
</div>
</div>
</body>
</html>`;
