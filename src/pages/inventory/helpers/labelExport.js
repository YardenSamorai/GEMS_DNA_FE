import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { getMappedCategories } from "../../../utils/categoryMap";
import { PRICE_MODES, scaleInventoryPrice } from "../../../utils/pricing";
import { getDisplayColor } from "./constants";

/* ---------------- Price Encoding (BARELOVSK) ---------------- */
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
      // Order: I(0) Γזע Y(00) Γזע Z(000)
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

/* ---------------- Export for Niimbot Labels ---------------- */
export const exportForLabels = async (selectedStones, shareMode = false) => {
  if (!selectedStones || selectedStones.length === 0) {
    alert("Please select stones to export");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gemstar Labels";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Labels");

  // Set column widths
  worksheet.columns = [
    { key: "details", width: 25 },
    { key: "qr", width: 35 },
  ];

  // Add header row
  const headerRow = worksheet.addRow(["Details", "QR Code URL"]);
  headerRow.font = { bold: true, size: 12 };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  headerRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" };

  // Add data rows
  selectedStones.forEach((stone) => {
    /* The code on a tag is the Bruto price per carat — that is what its
     * leading B means — and it stays Bruto whichever way the screen's
     * Neto/Bruto toggle happens to be set, so the same stone never leaves the
     * office wearing two different tags. Callers therefore hand this export
     * unscaled stones and the Bruto figure is derived here. */
    const priceCode = encodePriceBARELOVSK(
      scaleInventoryPrice(stone.pricePerCt, stone, PRICE_MODES.BRUTO)
    );
    const mapped = getMappedCategories(stone.category);
    const sku = (stone.sku || '').toUpperCase();
    
    const isDiamondOrFancy = mapped.includes('Diamond') || sku.startsWith('T');
    
    // Clarity: "insignificant" Γזע "Ins."
    const clarity = (stone.clarity || '').toLowerCase() === 'insignificant' 
      ? 'Ins' 
      : (stone.clarity || '');
    
    // Treatment: "insignificant" Γזע "Ins.", default to "Minor" if empty
    const rawTreatment = stone.treatment || 'Minor';
    const treatment = rawTreatment.toLowerCase() === 'insignificant' ? 'Ins' : rawTreatment;
    
    // Hide price if ΓיÑ50K per carat
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
    
    // Style the row - centered
    row.height = 80; // Taller rows for multi-line content
    
    // Center the details column
    row.getCell(1).alignment = { 
      horizontal: "center", 
      vertical: "middle",
      wrapText: true
    };
    
    // Center the QR URL column
    row.getCell(2).alignment = { 
      horizontal: "center", 
      vertical: "middle"
    };
  });

  // Generate file
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `Labels_${new Date().toISOString().split("T")[0]}_${selectedStones.length}pcs.xlsx`;
  
  // Share mode - use Web Share API
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
          return; // User cancelled
        }
      }
    }
  }
  
  // Fallback: Download
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, filename);
};
