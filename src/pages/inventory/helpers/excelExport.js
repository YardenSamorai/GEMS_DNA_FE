import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { getMappedCategories } from "../../../utils/categoryMap";
import { getDisplayColor, EMERALD_COLUMNS, DIAMOND_COLUMNS } from "./constants";
import { imageToBase64 } from "./imageData";
import { getOfficeContact } from "./pdfCatalog";

// Determine category of stones
export const getCategoryBreakdown = (stonesArray) => {
  return stonesArray.reduce((acc, stone) => {
    const mapped = getMappedCategories(stone.category);
    if (mapped.includes('Emerald')) {
      acc.emeralds = (acc.emeralds || 0) + 1;
    } else if (mapped.includes('Diamond')) {
      acc.diamonds = (acc.diamonds || 0) + 1;
    } else {
      acc.other = (acc.other || 0) + 1;
    }
    return acc;
  }, {});
};

// Export to Excel with separate sheets per category
export const exportToExcelSeparate = async (customStones, options = {}, user = null) => {
  const selectedData = customStones || [];
  
  // Separate by mapped category
  const emeralds = selectedData.filter(s => getMappedCategories(s.category).includes('Emerald'));
  const diamonds = selectedData.filter(s => getMappedCategories(s.category).includes('Diamond'));
  const others = selectedData.filter(s => {
    const mapped = getMappedCategories(s.category);
    return !mapped.includes('Emerald') && !mapped.includes('Diamond');
  });

  console.log('Export Separate Sheets:', {
    total: selectedData.length,
    emeralds: emeralds.length,
    diamonds: diamonds.length,
    others: others.length,
    categories: [...new Set(selectedData.map(s => getMappedCategories(s.category).join(', ')))]
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GEMS DNA";
  workbook.created = new Date();

  let logoImageId = null;
  try {
    const logoBase64 = await imageToBase64('/gemstar-logo-footer.png');
    logoImageId = workbook.addImage({ base64: logoBase64, extension: 'png' });
  } catch (e) {
    console.log('Could not load logo image:', e.message);
  }

  const { includeAppendix = true, hidePrices = false } = options;

  // Create sheet for Emeralds
  if (emeralds.length > 0) {
    console.log('Creating Emeralds sheet with', emeralds.length, 'stones');
    createCategorySheet(workbook, "Emeralds", emeralds, EMERALD_COLUMNS, "FF00A86B", logoImageId, includeAppendix, hidePrices, user);
  }

  // Create sheet for Diamonds
  if (diamonds.length > 0) {
    console.log('Creating Diamonds sheet with', diamonds.length, 'stones');
    createCategorySheet(workbook, "Diamonds", diamonds, DIAMOND_COLUMNS, "FF3B82F6", logoImageId, includeAppendix, hidePrices, user);
  }

  // Create sheet for Others (use Emerald columns as default)
  if (others.length > 0) {
    console.log('Creating Other Gems sheet with', others.length, 'stones');
    createCategorySheet(workbook, "Other Gems", others, EMERALD_COLUMNS, "FF8B5CF6", logoImageId, includeAppendix, hidePrices, user);
  }

  console.log('Total sheets in workbook:', workbook.worksheets.length);

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const exportDate = new Date().toISOString().split("T")[0];
  const filename = `Gemstar_Export_${exportDate}.xlsx`;
  saveAs(new Blob([buffer]), filename);
};

// Helper: Create a category-specific sheet (designer template v2)
export const createCategorySheet = (workbook, sheetName, data, columns, accentColor, logoImageId = null, includeAppendix = true, hidePrices = false, user = null) => {
  let effectiveColumns = includeAppendix ? columns : columns.filter(c => c.key !== 'appendix');
  if (hidePrices) {
    effectiveColumns = effectiveColumns.filter(c => !['pricePerCt', 'priceTotal', 'rapPrice'].includes(c.key));
  }
  const worksheet = workbook.addWorksheet(sheetName);
  const colCount = effectiveColumns.length;

  const getColLetter = (num) => {
    let letter = '';
    while (num > 0) { const r = (num - 1) % 26; letter = String.fromCharCode(65 + r) + letter; num = Math.floor((num - 1) / 26); }
    return letter;
  };
  const lastCol = getColLetter(colCount);

  worksheet.columns = effectiveColumns.map(col => ({ key: col.key, width: col.width }));

  const totalWeight = data.reduce((sum, s) => sum + (s.weightCt || 0), 0);
  const totalPrice = hidePrices ? 0 : data.reduce((sum, s) => sum + (s.priceTotal || 0), 0);
  const now = new Date();
  const date = now.toLocaleDateString("en-GB");
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const greenAccent = "FF00A86B";
  const darkBorder = { style: "thin", color: { argb: "FF444444" } };
  const greenBorderBottom = { style: "medium", color: { argb: greenAccent } };
  const blackBorderMedium = { style: "medium", color: { argb: "FF000000" } };
  const whiteFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" }, bgColor: { argb: "FFFFFFFF" } };
  const grayFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  const darkFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };

  // Helper: style a full-width row without merge (uses centerContinuous)
  const fillRow = (rowNum, value, font, fill, border, height) => {
    const row = worksheet.getRow(rowNum);
    row.height = height;
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      if (c === 1 && value !== undefined) cell.value = value;
      if (font) cell.font = font;
      if (fill) cell.fill = fill;
      cell.alignment = { horizontal: "centerContinuous", vertical: "middle" };
      if (border) cell.border = border;
    }
  };

  // === ROW 1: Title ===
  fillRow(1,
    `SELECTED STONES  \u00B7  ${data.length} stones  \u00B7  ${totalWeight.toFixed(2)} cts  \u00B7  ${date}`,
    { bold: true, size: 16, color: { argb: "FF000000" }, name: "Lato" },
    whiteFill,
    { left: blackBorderMedium, right: blackBorderMedium, top: blackBorderMedium, bottom: greenBorderBottom },
    26
  );

  // === ROW 2: Subtitle ===
  fillRow(2,
    "STONE CATALOG",
    { italic: true, size: 12, color: { argb: "FF000000" }, name: "Lato" },
    whiteFill,
    { left: blackBorderMedium, right: blackBorderMedium, top: blackBorderMedium, bottom: greenBorderBottom },
    20
  );

  // === ROW 3: Spacer ===
  fillRow(3, undefined, null, whiteFill, null, 6);

  // === ROW 4: Category label ===
  fillRow(4,
    sheetName.toUpperCase(),
    { size: 11, color: { argb: "FF000000" }, name: "Lato", bold: true },
    whiteFill,
    null,
    18
  );

  // === ROW 5: Column headers ===
  const headerRow = worksheet.getRow(5);
  effectiveColumns.forEach((col, i) => { headerRow.getCell(i + 1).value = col.header; });
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill = darkFill;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { left: darkBorder, right: darkBorder, top: darkBorder, bottom: greenBorderBottom };
  });

  // === AUTO FILTER on header + data range ===
  const lastDataRow = 5 + data.length;
  worksheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: lastDataRow, column: colCount } };

  // === DATA ROWS (starting from row 6) ===
  const dataStartRow = 6;
  const dnaBaseUrl = "https://gems-dna.com";

  const pairColorMap = {};
  let pairColorToggle = false;
  data.forEach(stone => {
    if (stone.pairSku) {
      const pairKey = [stone.sku, stone.pairSku].sort().join('|');
      if (!(pairKey in pairColorMap)) {
        pairColorMap[pairKey] = pairColorToggle ? "FFFFFFFF" : "FFF3FBF7";
        pairColorToggle = !pairColorToggle;
      }
    }
  });

  data.forEach((stone, index) => {
    const rowData = {};
    effectiveColumns.forEach(col => {
      switch (col.key) {
        case 'num': rowData.num = index + 1; break;
        case 'sku': rowData.sku = stone.sku || ''; break;
        case 'shape': rowData.shape = stone.shape || ''; break;
        case 'weight': rowData.weight = stone.weightCt || ''; break;
        case 'measurements': rowData.measurements = stone.measurements || ''; break;
        case 'ratio': rowData.ratio = stone.ratio != null && stone.ratio !== '' ? Number(Number(stone.ratio).toFixed(2)) : ''; break;
        case 'treatment': rowData.treatment = stone.treatment || ''; break;
        case 'origin': rowData.origin = (stone.origin && stone.origin.toUpperCase() !== 'N/A') ? stone.origin : ''; break;
        case 'location': rowData.location = stone.location || ''; break;
        case 'lab': rowData.lab = (stone.lab && stone.lab.toUpperCase() !== 'N/A') ? stone.lab : ''; break;
        case 'pricePerCt': rowData.pricePerCt = stone.pricePerCt || ''; break;
        case 'priceTotal': rowData.priceTotal = stone.priceTotal || ''; break;
        case 'color': rowData.color = getDisplayColor(stone) || ''; break;
        case 'clarity': rowData.clarity = stone.clarity || ''; break;
        case 'fluorescence': rowData.fluorescence = stone.fluorescence || ''; break;
        case 'rapPrice': rowData.rapPrice = stone.rapPrice || ''; break;
        case 'cut': rowData.cut = stone.cut || ''; break;
        case 'polish': rowData.polish = stone.polish || ''; break;
        case 'symmetry': rowData.symmetry = stone.symmetry || ''; break;
        case 'tablePercent': rowData.tablePercent = stone.tablePercent || ''; break;
        case 'depthPercent': rowData.depthPercent = stone.depthPercent || ''; break;
        case 'fancyIntensity': rowData.fancyIntensity = stone.fancyIntensity || ''; break;
        case 'fancyColor': rowData.fancyColor = stone.fancyColor || ''; break;
        case 'fancyOvertone': rowData.fancyOvertone = stone.fancyOvertone || ''; break;
        case 'fancyColor2': rowData.fancyColor2 = stone.fancyColor2 || ''; break;
        case 'fancyOvertone2': rowData.fancyOvertone2 = stone.fancyOvertone2 || ''; break;
        case 'pairSku': rowData.pairSku = stone.pairSku || ''; break;
        case 'dna': rowData.dna = stone.sku || ''; break;
        case 'certificate': rowData.certificate = stone.certificateUrl || ''; break;
        case 'appendix': rowData.appendix = ''; break;
        case 'image': rowData.image = stone.imageUrl || ''; break;
        case 'video': rowData.video = stone.videoUrl || stone.videoLink || ''; break;
        default: rowData[col.key] = '';
      }
    });

    const row = worksheet.addRow(rowData);
    row.height = 20;

    const pairKey = stone.pairSku ? [stone.sku, stone.pairSku].sort().join('|') : null;
    const pairFillColor = pairKey ? pairColorMap[pairKey] : null;
    const isEvenRow = index % 2 === 0;
    const fillArgb = pairFillColor || (isEvenRow ? "FFF3FBF7" : "FFFFFFFF");
    const rowFill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb }, bgColor: { argb: fillArgb } };
    row.eachCell((cell) => {
      cell.fill = rowFill;
      cell.font = { size: 10, color: { argb: "FF000000" }, name: "Lato" };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { left: darkBorder, right: darkBorder, top: darkBorder, bottom: darkBorder };
    });

    const ratioCol = effectiveColumns.findIndex(c => c.key === 'ratio');
    if (ratioCol >= 0 && rowData.ratio !== '') row.getCell(ratioCol + 1).numFmt = '0.00';

    const pricePerCtCol = effectiveColumns.findIndex(c => c.key === 'pricePerCt');
    const priceTotalCol = effectiveColumns.findIndex(c => c.key === 'priceTotal');
    const rapPriceCol = effectiveColumns.findIndex(c => c.key === 'rapPrice');
    if (pricePerCtCol >= 0 && stone.pricePerCt) row.getCell(pricePerCtCol + 1).numFmt = '"$"#,##0';
    if (priceTotalCol >= 0 && stone.priceTotal) {
      row.getCell(priceTotalCol + 1).numFmt = '"$"#,##0';
      row.getCell(priceTotalCol + 1).font = { size: 10, color: { argb: "FF000000" }, name: "Lato", bold: true };
    }
    if (rapPriceCol >= 0 && stone.rapPrice != null) row.getCell(rapPriceCol + 1).numFmt = '0"%"';

    const dnaCol = effectiveColumns.findIndex(c => c.key === 'dna');
    const certCol = effectiveColumns.findIndex(c => c.key === 'certificate');
    const appendixCol = effectiveColumns.findIndex(c => c.key === 'appendix');
    const imgCol = effectiveColumns.findIndex(c => c.key === 'image');
    const vidCol = effectiveColumns.findIndex(c => c.key === 'video');
    const pairSkuCol = effectiveColumns.findIndex(c => c.key === 'pairSku');

    if (dnaCol >= 0 && stone.sku) {
      row.getCell(dnaCol + 1).value = { text: "DNA", hyperlink: `${dnaBaseUrl}/${stone.sku}` };
      row.getCell(dnaCol + 1).font = { color: { argb: "FF8B5CF6" }, underline: true, size: 10, bold: true, name: "Lato" };
    }
    if (pairSkuCol >= 0 && stone.pairSku) {
      row.getCell(pairSkuCol + 1).value = { text: stone.pairSku, hyperlink: `${dnaBaseUrl}/${stone.pairSku}` };
      row.getCell(pairSkuCol + 1).font = { color: { argb: "FF8B5CF6" }, underline: true, size: 10, name: "Lato" };
    }
    if (certCol >= 0 && stone.certificateUrl) {
      row.getCell(certCol + 1).value = { text: "Cert", hyperlink: stone.certificateUrl };
      row.getCell(certCol + 1).font = { color: { argb: greenAccent }, underline: true, size: 10, name: "Lato" };
    }
    if (appendixCol >= 0 && stone.lab && stone.lab.toUpperCase() === "GRS" && stone.certificateUrl) {
      const certMatch = stone.certificateUrl.match(/\/([^/]+)\.pdf$/i);
      if (certMatch) {
        const appendixUrl = `https://app.barakdiamonds.com/Gemstones/Output/StoneImages/${certMatch[1]}-ap.pdf`;
        row.getCell(appendixCol + 1).value = { text: "Appendix", hyperlink: appendixUrl };
        row.getCell(appendixCol + 1).font = { color: { argb: greenAccent }, underline: true, size: 10, name: "Lato" };
      }
    }
    if (imgCol >= 0 && stone.imageUrl) {
      row.getCell(imgCol + 1).value = { text: "Image", hyperlink: stone.imageUrl };
      row.getCell(imgCol + 1).font = { color: { argb: greenAccent }, underline: true, size: 10, name: "Lato" };
    }
    if (vidCol >= 0 && (stone.videoUrl || stone.videoLink)) {
      row.getCell(vidCol + 1).value = { text: "Video", hyperlink: stone.videoUrl || stone.videoLink };
      row.getCell(vidCol + 1).font = { color: { argb: greenAccent }, underline: true, size: 10, name: "Lato" };
    }
  });

  // === FOOTER SECTION ===
  const footerStartRow = dataStartRow + data.length;

  // Footer message row (no merge)
  fillRow(footerStartRow,
    `${sheetName} \u2014 ${data.length} stones exported on ${date}`,
    { italic: true, size: 10, color: { argb: "FF333333" }, name: "Lato" },
    whiteFill,
    { top: { style: "thin", color: { argb: greenAccent } }, bottom: darkBorder },
    22
  );

  // Spacer
  const r1 = footerStartRow + 1;
  fillRow(r1, undefined, null, whiteFill, null, 8);

  // Summary section (no merged cells to allow Excel Sort & Filter)
  const sumRow = footerStartRow + 2;
  const sumBorder = { left: darkBorder, right: darkBorder, top: darkBorder, bottom: darkBorder };

  // "Total Records" label spans A-C visually but without merge
  ['A','B','C'].forEach(col => {
    const cell = worksheet.getCell(`${col}${sumRow}`);
    cell.fill = grayFill;
    cell.border = sumBorder;
  });
  worksheet.getCell(`A${sumRow}`).value = "Total Records";
  worksheet.getCell(`A${sumRow}`).font = { bold: true, size: 10, color: { argb: "FF000000" }, name: "Lato" };
  worksheet.getCell(`A${sumRow}`).alignment = { horizontal: "left", vertical: "middle" };

  worksheet.getCell(`D${sumRow}`).value = "CTS";
  worksheet.getCell(`D${sumRow}`).font = { bold: true, size: 10, color: { argb: "FF000000" }, name: "Lato" };
  worksheet.getCell(`D${sumRow}`).fill = grayFill;
  worksheet.getCell(`D${sumRow}`).alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell(`D${sumRow}`).border = sumBorder;

  worksheet.getCell(`E${sumRow}`).value = "PCS";
  worksheet.getCell(`E${sumRow}`).font = { bold: true, size: 10, color: { argb: "FF000000" }, name: "Lato" };
  worksheet.getCell(`E${sumRow}`).fill = grayFill;
  worksheet.getCell(`E${sumRow}`).alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell(`E${sumRow}`).border = sumBorder;

  if (!hidePrices) {
    worksheet.getCell(`F${sumRow}`).value = "TOTAL PRICE";
    worksheet.getCell(`F${sumRow}`).font = { bold: true, size: 10, color: { argb: "FF000000" }, name: "Lato" };
    worksheet.getCell(`F${sumRow}`).fill = grayFill;
    worksheet.getCell(`F${sumRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`F${sumRow}`).border = sumBorder;
  }

  // Date/Time info on right side (no merge)
  if (colCount >= 10) {
    const dtCol1 = getColLetter(colCount - 2);
    const dtCol2 = getColLetter(colCount - 1);
    const dtCol3 = getColLetter(colCount);
    worksheet.getCell(`${dtCol1}${sumRow}`).value = "Date";
    worksheet.getCell(`${dtCol1}${sumRow}`).font = { bold: true, size: 9, color: { argb: "FF000000" }, name: "Lato" };
    worksheet.getCell(`${dtCol1}${sumRow}`).fill = grayFill;
    worksheet.getCell(`${dtCol1}${sumRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`${dtCol2}${sumRow}`).value = date;
    worksheet.getCell(`${dtCol2}${sumRow}`).font = { size: 9, color: { argb: "FF000000" }, name: "Lato" };
    worksheet.getCell(`${dtCol2}${sumRow}`).fill = grayFill;
    worksheet.getCell(`${dtCol2}${sumRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`${dtCol3}${sumRow}`).fill = grayFill;
  }
  worksheet.getRow(sumRow).height = 21;

  // Summary values row (no merged cells)
  const valRow = sumRow + 1;
  ['A','B','C'].forEach(col => {
    const cell = worksheet.getCell(`${col}${valRow}`);
    cell.fill = whiteFill;
    cell.border = sumBorder;
  });
  worksheet.getCell(`A${valRow}`).value = "Total";
  worksheet.getCell(`A${valRow}`).font = { bold: true, size: 10, color: { argb: "FF000000" }, name: "Lato" };
  worksheet.getCell(`A${valRow}`).alignment = { horizontal: "left", vertical: "middle" };

  worksheet.getCell(`D${valRow}`).value = totalWeight.toFixed(2);
  worksheet.getCell(`D${valRow}`).font = { bold: true, size: 10, color: { argb: "FF000000" }, name: "Lato" };
  worksheet.getCell(`D${valRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: greenAccent } };
  worksheet.getCell(`D${valRow}`).alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell(`D${valRow}`).border = sumBorder;

  worksheet.getCell(`E${valRow}`).value = data.length;
  worksheet.getCell(`E${valRow}`).font = { bold: true, size: 10, color: { argb: "FF000000" }, name: "Lato" };
  worksheet.getCell(`E${valRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: greenAccent } };
  worksheet.getCell(`E${valRow}`).alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell(`E${valRow}`).border = sumBorder;

  if (!hidePrices && totalPrice > 0) {
    worksheet.getCell(`F${valRow}`).value = totalPrice;
    worksheet.getCell(`F${valRow}`).numFmt = '$#,##0';
    worksheet.getCell(`F${valRow}`).font = { bold: true, size: 10, color: { argb: "FF000000" }, name: "Lato" };
    worksheet.getCell(`F${valRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: greenAccent } };
    worksheet.getCell(`F${valRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`F${valRow}`).border = sumBorder;
    const colF = worksheet.getColumn('F');
    if (colF.width < 16) colF.width = 16;
  }

  if (colCount >= 10) {
    const dtCol1 = getColLetter(colCount - 2);
    const dtCol2 = getColLetter(colCount - 1);
    const dtCol3 = getColLetter(colCount);
    worksheet.getCell(`${dtCol1}${valRow}`).value = "Time";
    worksheet.getCell(`${dtCol1}${valRow}`).font = { bold: true, size: 9, color: { argb: "FF000000" }, name: "Lato" };
    worksheet.getCell(`${dtCol1}${valRow}`).fill = grayFill;
    worksheet.getCell(`${dtCol1}${valRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`${dtCol2}${valRow}`).value = time;
    worksheet.getCell(`${dtCol2}${valRow}`).font = { size: 9, color: { argb: "FF000000" }, name: "Lato" };
    worksheet.getCell(`${dtCol2}${valRow}`).fill = grayFill;
    worksheet.getCell(`${dtCol2}${valRow}`).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(`${dtCol3}${valRow}`).fill = grayFill;
  }
  worksheet.getRow(valRow).height = 21;

  // Spacer
  const r2 = valRow + 1;
  fillRow(r2, undefined, null, whiteFill, null, 10);

  // Logo row (no merge)
  const logoRowNum = r2 + 1;
  fillRow(logoRowNum, undefined, null, whiteFill, null, 60);
  if (logoImageId !== null) {
    const centerCol = Math.max(0, Math.floor(colCount / 2) - 2);
    worksheet.addImage(logoImageId, {
      tl: { col: centerCol, row: logoRowNum - 1 - 0.45 },
      ext: { width: 240, height: 90 },
    });
  }

  // Contact bar (dark background, no merge)
  const contactRow = logoRowNum + 1;
  const userEmailExcel = user?.primaryEmailAddress?.emailAddress || "";
  const userLocationExcel = user?.publicMetadata?.location;
  const officeExcel = getOfficeContact({ location: userLocationExcel, email: userEmailExcel });
  fillRow(contactRow,
    `${officeExcel.site}     \u2502     ${officeExcel.phone}     \u2502     ${officeExcel.email}`,
    { size: 14, color: { argb: "FFFFFFFF" }, name: "Lato", bold: true },
    darkFill,
    null,
    36
  );

  // Disclaimer row (no merge)
  const disclaimerRow = contactRow + 1;
  fillRow(disclaimerRow,
    "All prices are subject to change. Stones are certified and guaranteed authentic.",
    { italic: true, size: 10, color: { argb: "FF333333" }, name: "Lato" },
    grayFill,
    { top: { style: "thin", color: { argb: greenAccent } }, bottom: blackBorderMedium },
    24
  );
};

// Export selected stones to Excel with styling (combined - all columns)
export const exportToExcel = async (customStones, options = {}, user = null) => {
  let selectedData = customStones || [];
  
  if (selectedData.length === 0) {
    alert("Please select at least one stone to export.");
    return;
  }

  // Reorder: place paired stones adjacent to each other
  const ordered = [];
  const visited = new Set();
  const skuMap = {};
  selectedData.forEach(s => { skuMap[s.sku] = s; });
  
  selectedData.forEach(stone => {
    if (visited.has(stone.sku)) return;
    visited.add(stone.sku);
    ordered.push(stone);
    if (stone.pairSku && skuMap[stone.pairSku] && !visited.has(stone.pairSku)) {
      visited.add(stone.pairSku);
      ordered.push(skuMap[stone.pairSku]);
    }
  });
  selectedData = ordered;

  const breakdown = getCategoryBreakdown(selectedData);
  const isOnlyEmeralds = breakdown.emeralds > 0 && !breakdown.diamonds && !breakdown.other;
  const isOnlyDiamonds = breakdown.diamonds > 0 && !breakdown.emeralds && !breakdown.other;
  
  let columnsToUse;
  let sheetName;
  let accentColor = "FF00A86B";
  
  if (isOnlyEmeralds) {
    columnsToUse = EMERALD_COLUMNS;
    sheetName = "Emeralds";
    accentColor = "FF00A86B";
  } else if (isOnlyDiamonds) {
    columnsToUse = DIAMOND_COLUMNS;
    sheetName = "Diamonds";
    accentColor = "FF3B82F6";
  } else {
    columnsToUse = [
      { key: "num", header: "#", width: 5 },
      { key: "sku", header: "SKU", width: 18 },
      { key: "pairSku", header: "Pair SKU", width: 18 },
      { key: "shape", header: "Shape", width: 12 },
      { key: "weight", header: "Weight (ct)", width: 12 },
      { key: "color", header: "Color", width: 8 },
      { key: "clarity", header: "Clarity", width: 10 },
      { key: "measurements", header: "Measurements", width: 20 },
      { key: "ratio", header: "Ratio", width: 8 },
      { key: "treatment", header: "Clarity", width: 18 },
      { key: "origin", header: "Origin", width: 12 },
      { key: "lab", header: "Lab", width: 10 },
      { key: "fluorescence", header: "Fluor.", width: 10 },
      { key: "pricePerCt", header: "Price/ct ($)", width: 14 },
      { key: "priceTotal", header: "Total ($)", width: 14 },
      { key: "dna", header: "DNA", width: 12 },
      { key: "certificate", header: "Certificate", width: 15 },
      { key: "appendix", header: "Appendix", width: 14 },
      { key: "image", header: "Image", width: 12 },
      { key: "video", header: "Video", width: 12 },
    ];
    sheetName = "Selected Stones";
    accentColor = "FF8B5CF6";
  }

  const { includeAppendix = true, hidePrices = false } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gemstar";
  workbook.created = new Date();

  let logoImageId = null;
  try {
    const logoBase64 = await imageToBase64('/gemstar-logo-footer.png');
    logoImageId = workbook.addImage({ base64: logoBase64, extension: 'png' });
  } catch (e) {
    console.log('Could not load logo image:', e.message);
  }

  createCategorySheet(workbook, sheetName, selectedData, columnsToUse, accentColor, logoImageId, includeAppendix, hidePrices, user);

  const buffer = await workbook.xlsx.writeBuffer();
  const exportDate = new Date().toISOString().split("T")[0];
  const filename = `Gemstar_Export_${exportDate}.xlsx`;
  saveAs(new Blob([buffer]), filename);
};

/* Internal Excel — no logo, no branding, just the columns the user picked.
 * Built for back-office use (inventory audits, broker memos, accounting),
 * which is why the data layer is intentionally plain: header row, body
 * rows, autofilter, frozen header. Pricing is shown in raw form (no
 * "$ N/A" placeholders), URL columns are written as clickable hyperlinks. */
/* =========================================================================
 *  Internal Excel — multi-sheet exporter
 * =========================================================================
 *
 * Splits the user's selection into Diamond / Gemstone / Jewelry buckets and
 * produces ONE workbook with up to three sheets. Each sheet uses the column
 * set the user picked for that type in InternalExcelModal — so a mixed
 * export ("4 diamonds + 3 emeralds + 2 rings") gets each item rendered with
 * the columns appropriate to it.
 *
 * `selections` shape: { diamond?: { sheetName, columns }, gemstone?: {...},
 * jewelry?: {...} }. Empty types are simply skipped.
 */

// Tag each item with the bucket it belongs to. We treat anything coming
// from /api/jewelry as a jewelry item (those have category === "Jewelry"
// because of fetchJewelry); the rest are split via getMappedCategories.
const _bucketFor = (item) => {
  if ((item?.category || "").toLowerCase() === "jewelry" || item?.jewelryType) {
    return "jewelry";
  }
  const mapped = getMappedCategories(item?.category);
  if (mapped.includes("Diamond")) return "diamond";
  return "gemstone";
};

const _renderStoneCell = (key, stone, idx) => {
  const DNA_BASE = "https://gems-dna.com";
  switch (key) {
    case "num": return idx + 1;
    case "sku": return stone.sku || "";
    case "pairSku": return stone.pairSku || "";
    case "shape": return stone.shape || "";
    case "category": return stone.category || stone.stoneType || "";
    case "type": return stone.type || "";
    case "weight":
      return stone.weightCt != null && stone.weightCt !== "" ? Number(stone.weightCt) : "";
    case "color": return getDisplayColor(stone) || "";
    case "clarity": return stone.clarity || "";
    case "measurements": return stone.measurements || "";
    case "ratio":
      return stone.ratio != null && stone.ratio !== "" ? Number(Number(stone.ratio).toFixed(2)) : "";
    case "fancyIntensity": return stone.fancyIntensity || "";
    case "fancyColor": return stone.fancyColor || "";
    case "fancyOvertone": return stone.fancyOvertone || "";
    case "fancyColor2": return stone.fancyColor2 || "";
    case "fancyOvertone2": return stone.fancyOvertone2 || "";
    case "cut": return stone.cut || "";
    case "polish": return stone.polish || "";
    case "symmetry": return stone.symmetry || "";
    case "tablePercent":
      return stone.tablePercent != null && stone.tablePercent !== "" ? Number(stone.tablePercent) : "";
    case "depthPercent":
      return stone.depthPercent != null && stone.depthPercent !== "" ? Number(stone.depthPercent) : "";
    case "treatment": return stone.treatment || "";
    case "certComments": return stone.certComments || "";
    case "origin":
      return stone.origin && String(stone.origin).toUpperCase() !== "N/A" ? stone.origin : "";
    case "lab":
      return stone.lab && String(stone.lab).toUpperCase() !== "N/A" ? stone.lab : "";
    case "fluorescence": return stone.fluorescence || "";
    case "pricePerCt":
      return stone.pricePerCt != null && stone.pricePerCt !== "" ? Number(stone.pricePerCt) : "";
    case "priceTotal":
      return stone.priceTotal != null && stone.priceTotal !== "" ? Number(stone.priceTotal) : "";
    case "rapPrice": return stone.rapPrice != null && stone.rapPrice !== "" ? Number(stone.rapPrice) : "";
    case "rapListPrice":
      return stone.rapListPrice != null && stone.rapListPrice !== "" ? Number(stone.rapListPrice) : "";
    case "branch": return stone.branch || "";
    case "exactLocation": return stone.exactLocation || "";
    case "box": return stone.box || "";
    case "groupingType": return stone.groupingType || "";
    case "stonesCount":
      return stone.stones != null && stone.stones !== "" ? Number(stone.stones) : "";
    case "homePage": return stone.homePage || "";
    case "tradeShow": return stone.tradeShow || "";
    case "certificateNumber": return stone.certificateNumber || "";
    case "certificate": return stone.certificateUrl || "";
    case "certificateImageJpg": return stone.certificateImageJpg || "";
    case "image": return stone.imageUrl || "";
    case "additionalPictures": return stone.additionalPictures || "";
    case "video": return stone.videoUrl || stone.videoLink || "";
    case "updatedAt": return stone.updatedAt || "";
    case "dna":
      return stone.sku
        ? { text: `View DNA · ${stone.sku}`, hyperlink: `${DNA_BASE}/${stone.sku}` }
        : "";
    // Jewelry-specific
    case "stockNumber": return stone.stockNumber || "";
    case "title": return stone.title || "";
    case "jewelryType": return stone.jewelryType || "";
    case "style": return stone.style || "";
    case "collection": return stone.collection || "";
    case "metalType": return stone.metalType || "";
    case "jewelryWeight":
      return stone.jewelryWeight != null && stone.jewelryWeight !== "" ? Number(stone.jewelryWeight) : "";
    case "jewelrySize": return stone.jewelrySize || "";
    case "totalCarat":
      return stone.weightCt != null && stone.weightCt !== "" ? Number(stone.weightCt) : "";
    case "stoneType": return stone.stoneType || "";
    case "centerStoneCarat":
      return stone.centerStoneCarat != null && stone.centerStoneCarat !== "" ? Number(stone.centerStoneCarat) : "";
    case "currency": return stone.currency || "";
    case "availability": return stone.availability || "";
    case "shippingFrom": return stone.shippingFrom || "";
    default: return "";
  }
};

const _writeSheet = (workbook, sheetName, columns, items) => {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = columns.map((c) => ({
    key: c.key,
    header: c.header,
    width: c.width || 14,
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF374151" } } };
  });

  const urlKeys = new Set([
    "certificate", "certificateImageJpg", "image", "additionalPictures", "video",
  ]);
  const moneyKeys = new Set(["pricePerCt", "priceTotal", "rapListPrice"]);

  items.forEach((stone, idx) => {
    const rowObj = {};
    columns.forEach((col) => {
      rowObj[col.key] = _renderStoneCell(col.key, stone, idx);
    });
    const r = sheet.addRow(rowObj);
    r.alignment = { vertical: "middle" };
    r.eachCell((cell, colNumber) => {
      const colKey = columns[colNumber - 1]?.key;
      if (urlKeys.has(colKey) && cell.value) {
        cell.value = { text: String(cell.value), hyperlink: String(cell.value) };
        cell.font = { color: { argb: "FF2563EB" }, underline: true };
      }
      if (colKey === "dna" && cell.value && typeof cell.value === "object") {
        cell.font = { color: { argb: "FF2563EB" }, underline: true };
      }
      if (moneyKeys.has(colKey)) {
        cell.numFmt = '"$"#,##0.00';
      }
      if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    });
  });

  if (columns.length && items.length) {
    // ExcelJS uses 1-based column indices; convert to letter (A..Z, AA, AB…)
    const colToLetter = (n) => {
      let s = "";
      let x = n;
      while (x > 0) {
        const r = (x - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        x = Math.floor((x - 1) / 26);
      }
      return s;
    };
    const lastCol = colToLetter(columns.length);
    sheet.autoFilter = `A1:${lastCol}${items.length + 1}`;
  }
};

export const exportToInternalExcel = async (selections, customStones) => {
  const data = customStones || [];
  if (!data.length) {
    alert("Please select at least one stone to export.");
    return;
  }
  if (!selections || typeof selections !== "object" || !Object.keys(selections).length) {
    alert("Please pick at least one column for at least one category.");
    return;
  }

  // Bucket items by type so each goes into its own sheet
  const buckets = { diamond: [], gemstone: [], jewelry: [] };
  data.forEach((item) => {
    const b = _bucketFor(item);
    if (buckets[b]) buckets[b].push(item);
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gemstar (Internal)";
  workbook.created = new Date();

  let totalRows = 0;
  let sheetsWritten = 0;
  for (const typeId of ["diamond", "gemstone", "jewelry"]) {
    const sel = selections[typeId];
    const items = buckets[typeId] || [];
    if (!sel || !sel.columns?.length || !items.length) continue;
    _writeSheet(workbook, sel.sheetName || typeId, sel.columns, items);
    totalRows += items.length;
    sheetsWritten += 1;
  }

  if (!sheetsWritten) {
    alert("No matching items for the selected column sets.");
    return;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const exportDate = new Date().toISOString().split("T")[0];
  const filename = `Internal_Export_${exportDate}_${totalRows}pcs.xlsx`;
  saveAs(new Blob([buffer]), filename);
};
