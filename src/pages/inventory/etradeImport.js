import Papa from "papaparse";

export const skusFromEtradeCsv = (text) => {
  const { data, meta } = Papa.parse(String(text || "").replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: true,
  });
  const key = (meta.fields || []).find((f) => f.trim().toLowerCase() === "sku");
  if (!key) throw new Error("This file has no SKU column. Use the eTrade CSV from Barak.");
  return [...new Set(data.map((row) => String(row[key] ?? "").trim()).filter(Boolean))];
};

export const planImport = (fileSkus, listSkus) => {
  const inFile = new Set(fileSkus);
  const inList = new Set(listSkus);
  return {
    toAdd: fileSkus.filter((s) => !inList.has(s)),
    already: fileSkus.filter((s) => inList.has(s)),
    notInFile: listSkus.filter((s) => !inFile.has(s)),
  };
};
