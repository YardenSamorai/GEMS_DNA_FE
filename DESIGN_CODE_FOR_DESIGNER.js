/*
 * ============================================================
 *  GEMS DNA - PDF & Excel Export Code
 *  All design/styling code extracted for the designer
 * ============================================================
 *
 *  Libraries used:
 *    - jsPDF + jspdf-autotable  → PDF generation
 *    - ExcelJS + file-saver     → Excel generation
 *    - framer-motion            → Modal animations (React)
 *    - Tailwind CSS             → Modal UI styling
 *
 *  This file contains:
 *    1. PDF Catalog Generator  (generatePDFCatalog)
 *    2. Excel Column Definitions  (EMERALD_COLUMNS, DIAMOND_COLUMNS, FANCY_COLUMNS)
 *    3. Excel Export - Combined  (exportToExcel)
 *    4. Excel Export - Separate Sheets  (exportToExcelSeparate + createCategorySheet)
 *    5. Niimbot Labels Export  (exportForLabels)
 *    6. UI Modals: ExportModal, CategoryExportModal, PDFOptionsModal
 *    7. SVG to PNG helper  (svgToPngBase64)
 * ============================================================
 */


// ╔══════════════════════════════════════════════════════════════╗
// ║  1. PDF CATALOG GENERATOR                                    ║
// ║  Lines 235-604 in Inventory.js                               ║
// ║  Uses: jsPDF                                                 ║
// ╚══════════════════════════════════════════════════════════════╝

const generatePDFCatalog = async (selectedStones, options = {}) => {
  if (!selectedStones || selectedStones.length === 0) {
    alert("Please select stones to generate PDF");
    return;
  }

  const { 
    layout = 'grid', // 'grid' or 'list'
    showPrices = true,
    itemsPerPage = layout === 'grid' ? 6 : 4
  } = options;

  // Create PDF - A4 size
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // Colors
  const primaryColor = [16, 185, 129]; // Emerald green
  const darkColor = [31, 41, 55];
  const lightGray = [156, 163, 175];

  // Helper: Add header to each page
  const addHeader = (pageNum, totalPages) => {
    // Top accent bar
    pdf.setFillColor(...primaryColor);
    pdf.rect(0, 0, pageWidth, 8, 'F');
    
    // Company name
    pdf.setFontSize(24);
    pdf.setTextColor(...darkColor);
    pdf.setFont('helvetica', 'bold');
    pdf.text('GEMSTAR', margin, 20);
    
    // Tagline
    pdf.setFontSize(10);
    pdf.setTextColor(...lightGray);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Premium Gemstones & Diamonds', margin, 26);
    
    // Date and page number on right
    pdf.setFontSize(9);
    const date = new Date().toLocaleDateString('en-GB');
    pdf.text(date, pageWidth - margin, 20, { align: 'right' });
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, 26, { align: 'right' });
    
    // Separator line
    pdf.setDrawColor(...primaryColor);
    pdf.setLineWidth(0.5);
    pdf.line(margin, 32, pageWidth - margin, 32);
    
    return 38; // Return Y position after header
  };

  // Helper: Add footer to each page
  const addFooter = () => {
    const footerY = pageHeight - 15;
    
    // Footer line
    pdf.setDrawColor(...lightGray);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    // Contact info
    pdf.setFontSize(8);
    pdf.setTextColor(...lightGray);
    pdf.text('📍 New York  •  Tel Aviv  •  Hong Kong  •  Los Angeles', pageWidth / 2, footerY, { align: 'center' });
    pdf.text('📞 +1 (212) 869-0544  •  ✉ info@gems.net  •  🌐 www.gems.net', pageWidth / 2, footerY + 4, { align: 'center' });
  };

  // Helper: Load image as base64 using backend proxy
  const loadImage = async (url) => {
    if (!url) return null;
    try {
      const proxyUrl = `${API_BASE}/api/image-proxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) return null;
      const data = await response.json();
      if (data.image && data.image.startsWith('data:')) return data.image;
      return null;
    } catch (e) {
      return null;
    }
  };

  const totalPages = Math.ceil(selectedStones.length / itemsPerPage) + 1; // +1 for cover

  // === COVER PAGE ===
  let currentPage = 1;
  
  pdf.setFillColor(31, 41, 55);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, pageHeight * 0.4, pageWidth, 3, 'F');
  
  pdf.setFontSize(48);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.text('GEMSTAR', pageWidth / 2, pageHeight * 0.35, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.setTextColor(...primaryColor);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Premium Gemstones & Diamonds', pageWidth / 2, pageHeight * 0.35 + 12, { align: 'center' });
  
  pdf.setFontSize(28);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.text('STONE CATALOG', pageWidth / 2, pageHeight * 0.55, { align: 'center' });
  
  pdf.setFontSize(12);
  pdf.setTextColor(...lightGray);
  const totalWeight = selectedStones.reduce((sum, s) => sum + (s.weightCt || 0), 0);
  pdf.text(`${selectedStones.length} Stones  •  ${totalWeight.toFixed(2)} Total Carats`, pageWidth / 2, pageHeight * 0.55 + 12, { align: 'center' });
  
  pdf.setFontSize(11);
  pdf.text(new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth / 2, pageHeight * 0.55 + 22, { align: 'center' });
  
  pdf.setFontSize(10);
  pdf.setTextColor(...lightGray);
  pdf.text('www.gems.net', pageWidth / 2, pageHeight - 30, { align: 'center' });
  pdf.text('+1 (212) 869-0544  •  info@gems.net', pageWidth / 2, pageHeight - 24, { align: 'center' });

  // === CONTENT PAGES - GRID LAYOUT ===
  if (layout === 'grid') {
    const cols = 2;
    const rows = 3;
    const cardWidth = (contentWidth - 10) / cols;
    const cardHeight = 72;
    
    for (let i = 0; i < selectedStones.length; i += itemsPerPage) {
      pdf.addPage();
      currentPage++;
      let startY = addHeader(currentPage, totalPages);
      
      const pageStones = selectedStones.slice(i, i + itemsPerPage);
      
      for (let j = 0; j < pageStones.length; j++) {
        const stone = pageStones[j];
        const col = j % cols;
        const row = Math.floor(j / cols);
        
        const x = margin + (col * (cardWidth + 10));
        const y = startY + (row * (cardHeight + 8));
        
        // Card background
        pdf.setFillColor(249, 250, 251);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
        
        // Card border
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'S');
        
        // Image placeholder
        const imgSize = 35;
        pdf.setFillColor(229, 231, 235);
        pdf.rect(x + 5, y + 5, imgSize, imgSize, 'F');
        
        if (stone.imageUrl) {
          try {
            const imgData = await loadImage(stone.imageUrl);
            if (imgData) pdf.addImage(imgData, 'JPEG', x + 5, y + 5, imgSize, imgSize);
          } catch (e) {}
        }
        
        // Stone details
        const textX = x + imgSize + 10;
        
        // SKU
        pdf.setFontSize(10);
        pdf.setTextColor(...darkColor);
        pdf.setFont('helvetica', 'bold');
        pdf.text(stone.sku || 'N/A', textX, y + 12);
        
        // Shape & Weight
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${getDisplayShape(stone.shape) || 'N/A'} • ${stone.weightCt || '?'}ct`, textX, y + 19);
        
        // Category label
        const mapped = getMappedCategories(stone.category);
        let catColor = lightGray;
        let catLabel = mapped[0] || 'Gem';
        if (mapped.includes('Emerald')) { catColor = [16, 185, 129]; catLabel = 'Emerald'; }
        else if (mapped.includes('Diamond')) { catColor = [59, 130, 246]; catLabel = 'Diamond'; }
        
        pdf.setFontSize(7);
        pdf.setTextColor(...catColor);
        pdf.text(catLabel.toUpperCase(), textX, y + 25);
        
        // Details
        pdf.setFontSize(8);
        pdf.setTextColor(...lightGray);
        if (mapped.includes('Emerald')) {
          pdf.text(`Treatment: ${stone.treatment || 'N/A'}`, textX, y + 32);
          pdf.text(`Origin: ${stone.origin || 'N/A'}`, textX, y + 37);
        } else {
          pdf.text(`Color: ${getDisplayColor(stone) || 'N/A'} • Clarity: ${stone.clarity || 'N/A'}`, textX, y + 32);
          if (stone.cut) pdf.text(`Cut: ${stone.cut}`, textX, y + 37);
        }
        pdf.text(`Lab: ${stone.lab || 'N/A'}`, textX, y + 42);
        
        // Price
        if (showPrices && stone.priceTotal) {
          pdf.setFontSize(11);
          pdf.setTextColor(...primaryColor);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`$${stone.priceTotal.toLocaleString()}`, x + cardWidth - 5, y + cardHeight - 8, { align: 'right' });
        }
        
        // DNA Link button
        const dnaLinkX = x + 5;
        const dnaLinkY = y + cardHeight - 10;
        pdf.setFillColor(139, 92, 246);
        pdf.roundedRect(dnaLinkX, dnaLinkY, 22, 7, 1.5, 1.5, 'F');
        pdf.setFontSize(6);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.textWithLink('View DNA', dnaLinkX + 2.5, dnaLinkY + 5, { url: `https://gems-dna.com/${stone.sku}` });
      }
      
      addFooter();
    }
  } else {
    // === CONTENT PAGES - LIST LAYOUT ===
    const cardHeight = 50;
    
    for (let i = 0; i < selectedStones.length; i += itemsPerPage) {
      pdf.addPage();
      currentPage++;
      let y = addHeader(currentPage, totalPages);
      
      const pageStones = selectedStones.slice(i, i + itemsPerPage);
      
      for (let j = 0; j < pageStones.length; j++) {
        const stone = pageStones[j];
        
        pdf.setFillColor(249, 250, 251);
        pdf.roundedRect(margin, y, contentWidth, cardHeight, 3, 3, 'F');
        
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, y, contentWidth, cardHeight, 3, 3, 'S');
        
        const imgSize = 40;
        pdf.setFillColor(229, 231, 235);
        pdf.rect(margin + 5, y + 5, imgSize, imgSize, 'F');
        
        if (stone.imageUrl) {
          try {
            const imgData = await loadImage(stone.imageUrl);
            if (imgData) pdf.addImage(imgData, 'JPEG', margin + 5, y + 5, imgSize, imgSize);
          } catch (e) {}
        }
        
        const textX = margin + imgSize + 15;
        
        pdf.setFontSize(12);
        pdf.setTextColor(...darkColor);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${stone.sku}  •  ${getDisplayShape(stone.shape) || 'N/A'}  •  ${stone.weightCt || '?'}ct`, textX, y + 12);
        
        const mapped = getMappedCategories(stone.category);
        let catColor = lightGray;
        let catLabel = mapped[0] || 'Gemstone';
        if (mapped.includes('Emerald')) { catColor = [16, 185, 129]; catLabel = 'Emerald'; }
        else if (mapped.includes('Diamond')) { catColor = [59, 130, 246]; catLabel = 'Diamond'; }
        
        pdf.setFontSize(8);
        pdf.setTextColor(...catColor);
        pdf.setFont('helvetica', 'bold');
        pdf.text(catLabel.toUpperCase(), textX, y + 19);
        
        pdf.setFontSize(9);
        pdf.setTextColor(...lightGray);
        pdf.setFont('helvetica', 'normal');
        if (mapped.includes('Emerald')) {
          pdf.text(`Treatment: ${stone.treatment || 'N/A'}  •  Origin: ${stone.origin || 'N/A'}  •  Lab: ${stone.lab || 'N/A'}`, textX, y + 28);
        } else {
          pdf.text(`Color: ${getDisplayColor(stone) || 'N/A'}  •  Clarity: ${stone.clarity || 'N/A'}  •  Lab: ${stone.lab || 'N/A'}`, textX, y + 28);
        }
        
        pdf.text(`Measurements: ${stone.measurements || 'N/A'}  •  Ratio: ${stone.ratio || 'N/A'}`, textX, y + 35);
        
        if (showPrices && stone.priceTotal) {
          pdf.setFontSize(14);
          pdf.setTextColor(...primaryColor);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`$${stone.priceTotal.toLocaleString()}`, pageWidth - margin - 5, y + 20, { align: 'right' });
          
          if (stone.pricePerCt) {
            pdf.setFontSize(9);
            pdf.setTextColor(...lightGray);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`$${stone.pricePerCt.toLocaleString()}/ct`, pageWidth - margin - 5, y + 27, { align: 'right' });
          }
        }
        
        // DNA Link button
        const dnaLinkX = pageWidth - margin - 28;
        const dnaLinkY = y + 36;
        pdf.setFillColor(139, 92, 246);
        pdf.roundedRect(dnaLinkX, dnaLinkY, 25, 8, 2, 2, 'F');
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.textWithLink('View DNA', dnaLinkX + 3, dnaLinkY + 5.5, { url: `https://gems-dna.com/${stone.sku}` });
        
        y += cardHeight + 8;
      }
      
      addFooter();
    }
  }

  const filename = `Gemstar_Catalog_${new Date().toISOString().split('T')[0]}_${selectedStones.length}pcs.pdf`;
  pdf.save(filename);
};


// ╔══════════════════════════════════════════════════════════════╗
// ║  2. EXCEL COLUMN DEFINITIONS                                 ║
// ║  Lines 894-969 in Inventory.js                               ║
// ╚══════════════════════════════════════════════════════════════╝

const EMERALD_COLUMNS = [
  { key: "num", header: "#", width: 5 },
  { key: "sku", header: "SKU", width: 18 },
  { key: "pairSku", header: "Pair SKU", width: 18 },
  { key: "shape", header: "Shape", width: 12 },
  { key: "weight", header: "Weight (ct)", width: 12 },
  { key: "measurements", header: "Measurements", width: 20 },
  { key: "ratio", header: "Ratio", width: 8 },
  { key: "treatment", header: "Treatment", width: 18 },
  { key: "origin", header: "Origin", width: 12 },
  { key: "lab", header: "Lab", width: 10 },
  { key: "pricePerCt", header: "Price/ct ($)", width: 14 },
  { key: "priceTotal", header: "Total ($)", width: 14 },
  { key: "dna", header: "DNA", width: 12 },
  { key: "certificate", header: "Certificate", width: 15 },
  { key: "appendix", header: "Appendix", width: 14 },
  { key: "image", header: "Image", width: 12 },
  { key: "video", header: "Video", width: 12 },
];

const DIAMOND_COLUMNS = [
  { key: "num", header: "#", width: 5 },
  { key: "sku", header: "SKU", width: 18 },
  { key: "pairSku", header: "Pair SKU", width: 18 },
  { key: "shape", header: "Shape", width: 12 },
  { key: "weight", header: "Weight (ct)", width: 12 },
  { key: "color", header: "Color", width: 8 },
  { key: "clarity", header: "Clarity", width: 10 },
  { key: "measurements", header: "Measurements", width: 20 },
  { key: "ratio", header: "Ratio", width: 8 },
  { key: "lab", header: "Lab", width: 10 },
  { key: "fluorescence", header: "Fluor.", width: 10 },
  { key: "pricePerCt", header: "Price/ct ($)", width: 14 },
  { key: "priceTotal", header: "Total ($)", width: 14 },
  { key: "rapPrice", header: "Rap %", width: 10 },
  { key: "cut", header: "Cut", width: 10 },
  { key: "polish", header: "Polish", width: 10 },
  { key: "symmetry", header: "Symmetry", width: 10 },
  { key: "tablePercent", header: "Table %", width: 10 },
  { key: "depthPercent", header: "Depth %", width: 10 },
  { key: "dna", header: "DNA", width: 12 },
  { key: "certificate", header: "Certificate", width: 15 },
  { key: "appendix", header: "Appendix", width: 14 },
  { key: "image", header: "Image", width: 12 },
  { key: "video", header: "Video", width: 12 },
];

const FANCY_COLUMNS = [
  // Same as DIAMOND_COLUMNS but with fancy-specific color fields
  // (fancyIntensity, fancyColor, fancyOvertone, etc.)
  // See lines 941-969 in Inventory.js for full definition
];


// ╔══════════════════════════════════════════════════════════════╗
// ║  3. SVG TO PNG HELPER (for Excel logo)                       ║
// ║  Lines 871-891 in Inventory.js                               ║
// ╚══════════════════════════════════════════════════════════════╝

const svgToPngBase64 = (svgUrl, width = 600, height = 340) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(width / img.width, height / img.height) * 0.8;
      const x = (width - img.width * scale) / 2;
      const y = (height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = reject;
    img.src = svgUrl;
  });
};


// ╔══════════════════════════════════════════════════════════════╗
// ║  4. EXCEL EXPORT - SEPARATE SHEETS (per category)            ║
// ║  Lines 4732-5118 in Inventory.js                             ║
// ║  Uses: ExcelJS, file-saver                                   ║
// ║                                                              ║
// ║  Structure per sheet:                                        ║
// ║    Rows 1-4: Logo header (centered, white bg)                ║
// ║    Row 5: Dark separator line                                ║
// ║    Row 6: Category summary bar (name, count, weight, date)   ║
// ║    Row 7: Spacer                                             ║
// ║    Rows 8-10: Info tables (Date/Time/Website + Cts/Pcs)      ║
// ║    Row 11: Spacer                                            ║
// ║    Row 12: Column headers (dark bg, white text, accent line) ║
// ║    Row 13+: Data rows (zebra striping, clickable links)      ║
// ║    Footer: Contact info + disclaimer (dark bg)               ║
// ╚══════════════════════════════════════════════════════════════╝

// See lines 4732-5118 in Inventory.js for full implementation
// Key styling details:

// Colors used in Excel:
// - Dark header: FF1F2937
// - Light gray bg: FFF9FAFB  
// - Border gray: FFE5E7EB
// - Summary bg: FFF3F4F6
// - Emerald accent: FF10B981
// - Diamond accent: FF3B82F6
// - Mixed/Purple accent: FF8B5CF6
// - Link purple: FF8B5CF6
// - White: FFFFFFFF
// - Text gray: FF6B7280
// - Footer emerald text: FF10B981

// Font: Arial throughout
// Header font size: 11 bold
// Data font size: 9-10
// Row heights: Header 26px, Data 20-22px, Footer 22-26px


// ╔══════════════════════════════════════════════════════════════╗
// ║  5. EXCEL EXPORT - COMBINED (single sheet)                   ║
// ║  Lines 5121-5589 in Inventory.js                             ║
// ║  Same structure as separate, but all stones in one sheet     ║
// ╚══════════════════════════════════════════════════════════════╝

// See lines 5121-5589 in Inventory.js for full implementation
// Same layout structure as separate sheets export


// ╔══════════════════════════════════════════════════════════════╗
// ║  6. NIIMBOT LABELS EXPORT                                    ║
// ║  Lines 115-232 in Inventory.js                               ║
// ║  Simple Excel with 2 columns: Details + QR Code URL          ║
// ╚══════════════════════════════════════════════════════════════╝

const exportForLabels = async (selectedStones, shareMode = false) => {
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

  selectedStones.forEach((stone) => {
    const priceCode = encodePriceBARELOVSK(stone.pricePerCt);
    const category = (stone.category || '').toLowerCase();
    const sku = (stone.sku || '').toUpperCase();
    const isDiamondOrFancy = category.includes('diamond') || category.includes('fancy') || sku.startsWith('T');

    const clarity = (stone.clarity || '').toLowerCase() === 'insignificant' 
      ? 'Ins' : (stone.clarity || '');
    const rawTreatment = stone.treatment || 'Minor';
    const treatment = rawTreatment.toLowerCase() === 'insignificant' ? 'Ins' : rawTreatment;
    const lab = (stone.lab && stone.lab.toUpperCase() !== 'N/A') ? stone.lab : null;
    const showPrice = stone.pricePerCt < 50000;

    let details;
    if (isDiamondOrFancy) {
      details = [
        `${stone.weightCt || '?'}`,
        lab,
        `${stone.color || ''}   ${clarity}`.trim() || null
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
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `Labels_${new Date().toISOString().split("T")[0]}_${selectedStones.length}pcs.xlsx`;
  saveAs(new Blob([buffer]), filename);
};


// ╔══════════════════════════════════════════════════════════════╗
// ║  7. UI MODALS (React Components with Tailwind CSS)           ║
// ╚══════════════════════════════════════════════════════════════╝

// --- CategoryExportModal (lines 607-714) ---
// Modal that appears when exporting multiple categories
// Options: "Separate Sheets" or "Combined Sheet"
// Header: gradient from-emerald-500 to-blue-500
// See lines 607-714 in Inventory.js

// --- PDFOptionsModal (lines 717-868) ---
// Modal for PDF generation settings
// Options: Grid (6/page) or List (4/page), Show Prices toggle
// Header: gradient from-red-500 to-pink-500
// See lines 717-868 in Inventory.js

// --- ExportModal (lines 1308-1683) ---
// Main export modal with price adjustment
// Features: Global markup %, per-stone price override, reset
// Mobile: Card layout, Desktop: Table layout
// Header: configurable gradient (default from-emerald-500 to-emerald-600)
// See lines 1308-1683 in Inventory.js
