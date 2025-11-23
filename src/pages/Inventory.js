// StoneSearchPage.jsx
import { useState, useMemo, useEffect } from "react";

// ⚠️ כל הקומפוננטות והפונקציות Arrow Functions בלבד

const ITEMS_PER_PAGE = 100;

const treatmentOptions = [
  "All treatments",
  "No oil",
  "Insignificant",
  "Minor",
  "Moderate",
  "Significant",
];

/* ---------------- Progress Bar (top global) ---------------- */

const LoadingBar = ({ active, progress }) => {
  if (!active) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-sky-100">
      <div
        className="h-full bg-sky-500 transition-all duration-200"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

/* ---------------- Filters ---------------- */

const StoneFilters = ({
  filters,
  onChange,
  shapesOptions,
  categoriesOptions,
}) => {
  const handleChange = (field) => (e) => {
    onChange({
      ...filters,
      [field]: e.target.value,
    });
  };

  const handleClear = () => {
    onChange({
      sku: "",
      minPrice: "",
      maxPrice: "",
      minCarat: "",
      maxCarat: "",
      shape: "All shapes",
      treatment: "All treatments",
      category: "All categories",
    });
  };

  return (
    <div className="rounded-2xl bg-white/90 shadow-sm border border-slate-200 p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800">Filters</h2>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs font-medium text-sky-600 hover:text-sky-700"
        >
          Clear all
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-8">
        {/* SKU search */}
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Search by SKU
          </label>
          <input
            type="text"
            value={filters.sku}
            onChange={handleChange("sku")}
            placeholder="e.g. T9548"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        {/* Price range */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Min price ($)
          </label>
          <input
            type="number"
            value={filters.minPrice}
            onChange={handleChange("minPrice")}
            placeholder="From"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Max price ($)
          </label>
          <input
            type="number"
            value={filters.maxPrice}
            onChange={handleChange("maxPrice")}
            placeholder="To"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        {/* Carat range */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Min carat (ct)
          </label>
          <input
            type="number"
            value={filters.minCarat}
            onChange={handleChange("minCarat")}
            placeholder="From"
            step="0.01"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Max carat (ct)
          </label>
          <input
            type="number"
            value={filters.maxCarat}
            onChange={handleChange("maxCarat")}
            placeholder="To"
            step="0.01"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        {/* Shape */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Shape
          </label>
          <select
            value={filters.shape}
            onChange={handleChange("shape")}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            {shapesOptions.map((shape) => (
              <option key={shape} value={shape}>
                {shape}
              </option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Category
          </label>
          <select
            value={filters.category}
            onChange={handleChange("category")}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            {categoriesOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Treatment / Oil */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Treatment (oil)
          </label>
          <select
            value={filters.treatment}
            onChange={handleChange("treatment")}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            {treatmentOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

/* ---------------- Email layout helper (Plain text + HTML) ---------------- */

const createEmailBodies = (stone) => {
  const plainTextBody = `Dear Customer,

Please find below the details of the stone:

${stone.shape || ""} ${stone.weightCt || ""} ct ${stone.lab || ""} ${
    stone.treatment || ""
  }

Stone ID: ${stone.sku || ""}
Shape: ${stone.shape || "N/A"}
Carat: ${stone.weightCt != null ? stone.weightCt : "N/A"}
Clarity: ${stone.clarity || "N/A"}
Enhancement: ${stone.treatment || "N/A"}
Lab: ${stone.lab || "N/A"}
Origin: ${stone.origin || "N/A"}
Ratio: ${stone.ratio != null ? stone.ratio : "N/A"}
Measurements: ${stone.measurements || "N/A"}
Fluorescence: ${stone.fluorescence || "N/A"}

Photo: ${stone.imageUrl || "Available upon request"}
Video: ${stone.videoUrl || "Available upon request"}
Certificate: ${stone.certificateUrl || "Available upon request"}

Best regards,
Eshed Diamonds`;

  const logoUrl1 =
    "https://www.eshed.com/wp-content/uploads/media/other/EshedLogo.png";

  const title = `${stone.shape || ""} ${stone.weightCt || ""} ct ${
    stone.lab || ""
  } ${stone.treatment || ""}`.trim();

  const caratText = stone.weightCt != null ? stone.weightCt : "N/A";
  const ratioText = stone.ratio != null ? stone.ratio : "N/A";
  const measurementsText = stone.measurements || "N/A";
  const clarityText = stone.clarity || "N/A";
  const originText = stone.origin || "N/A";
  const treatmentText = stone.treatment || "N/A";
  const labText = stone.lab || "N/A";
  const certificateNumberText = stone.certificateNumber || "N/A";
  const fluorescenceText = stone.fluorescence || "N/A";

  const renderDetailsColumn = (items) =>
    items
      .filter(
        (item) =>
          item.value !== undefined &&
          item.value !== null &&
          item.value !== "" &&
          item.value !== "N/A"
      )
      .map(
        (item) =>
          `<div style="margin:0 0 2px 0;"><strong>${item.label}:</strong> ${item.value}</div>`
      )
      .join("");

  const leftColumnItems = [
    { label: "Stone ID", value: stone.sku || "" },
    { label: "Carat", value: caratText },
    { label: "Shape", value: stone.shape || "N/A" },
    { label: "Lab", value: labText },
    { label: "Origin", value: originText },
  ];

  const rightColumnItems = [
    { label: "Measurements", value: measurementsText },
    { label: "Ratio", value: ratioText },
    { label: "Enhancement", value: treatmentText },
    { label: "Clarity", value: clarityText },
    { label: "Fluorescence", value: fluorescenceText },
    { label: "Certificate #", value: certificateNumberText },
  ];

  const imageBlock = stone.imageUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
       <tr>
         <td align="center">
           <img src="${stone.imageUrl}" alt="${stone.sku || "Stone image"}"
             style="max-width:100%; max-height:350px; height:auto; border-radius:6px; border:1px solid #e5e7eb; display:block;" />
         </td>
       </tr>
     </table>`
    : "";

  const videoRow = stone.videoUrl
    ? `<tr>
         <td style="padding-bottom:4px;">
           <strong>Video:</strong>
           <a href="${stone.videoUrl}" style="color:#0ea5e9;text-decoration:none;">Open video</a>
         </td>
       </tr>`
    : "";

  const certRow = stone.certificateUrl
    ? `<tr>
         <td>
           <strong>Certificate:</strong>
           <a href="${stone.certificateUrl}" style="color:#0ea5e9;text-decoration:none;">Open certificate</a>
         </td>
       </tr>`
    : "";

  const linksBlock =
    stone.videoUrl || stone.certificateUrl
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;font-size:13px;">
           ${videoRow}
           ${certRow}
         </table>`
      : "";

  const htmlBody = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f3f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;border:1px solid #e5e7eb;font-family:Arial, sans-serif;color:#111827;">
            <tr>
              <td align="center" style="padding:16px 24px;border-bottom:1px solid #e5e7eb;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px auto;">
                  <tr>
                    <td align="center">
                      <img src="${logoUrl1}" alt="Eshed" style="max-height:50px;display:block;" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px;font-size:14px;line-height:1.5;direction:ltr;text-align:left;">

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                  <tr>
                    <td valign="top" width="50%" style="padding-right:12px;font-size:13px;line-height:1.6;direction:ltr;text-align:left;">
                      ${renderDetailsColumn(leftColumnItems)}
                    </td>
                    <td valign="top" width="50%" style="padding-left:12px;font-size:13px;line-height:1.6;direction:ltr;text-align:left;">
                      ${renderDetailsColumn(rightColumnItems)}
                    </td>
                  </tr>
                </table>

                ${imageBlock}
                ${linksBlock}

                <p style="margin:16px 0 0 0;">
                  Best regards<br/>
                  Eshed-Gemstar
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { plainTextBody, htmlBody };
};

/* ---------------- Table ---------------- */

const StonesTable = ({
  stones,
  onToggle,
  selectedStone,
  loading,
  error,
  sortConfig,
  onSort,
}) => {
  if (loading) {
    return <div className="mt-6 text-sm text-slate-500">Loading stones…</div>;
  }

  if (error) {
    return <div className="mt-6 text-sm text-red-500">Error: {error}</div>;
  }

  if (!stones.length) {
    return (
      <div className="mt-6 text-sm text-slate-500">
        No stones found. Try adjusting your filters.
      </div>
    );
  }

  const isExpandedStone = (stone) =>
    selectedStone && selectedStone.id === stone.id;

  const renderSortIcon = (field) => {
    if (!sortConfig || sortConfig.field !== field) return null;
    return (
      <span className="ml-1 text-[10px]">
        {sortConfig.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const headerButtonClass =
    "flex items-center gap-1 w-full text-left focus:outline-none";

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-50">
            <tr>
              {/* SKU */}
              <th className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => onSort("sku")}
                  className={headerButtonClass}
                >
                  <span>SKU</span>
                  {renderSortIcon("sku")}
                </button>
              </th>

              {/* Image */}
              <th className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-600">
                Image
              </th>

              {/* Shape */}
              <th className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => onSort("shape")}
                  className={headerButtonClass}
                >
                  <span>Shape</span>
                  {renderSortIcon("shape")}
                </button>
              </th>

              {/* Weight */}
              <th className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => onSort("weightCt")}
                  className={headerButtonClass}
                >
                  <span>Weight (ct)</span>
                  {renderSortIcon("weightCt")}
                </button>
              </th>

              {/* Measurements – מוסתר במובייל */}
              <th className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-600 hidden sm:table-cell">
                <button
                  type="button"
                  onClick={() => onSort("measurements")}
                  className={headerButtonClass}
                >
                  <span>Measurements</span>
                  {renderSortIcon("measurements")}
                </button>
              </th>

              {/* Price per carat */}
              <th className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => onSort("pricePerCt")}
                  className={headerButtonClass}
                >
                  <span>Price/ct ($)</span>
                  {renderSortIcon("pricePerCt")}
                </button>
              </th>

              {/* Total price */}
              <th className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => onSort("priceTotal")}
                  className={headerButtonClass}
                >
                  <span>Total price ($)</span>
                  {renderSortIcon("priceTotal")}
                </button>
              </th>

              {/* Treatment – רק ב-lg ומעלה */}
              <th className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-600 hidden lg:table-cell">
                <button
                  type="button"
                  onClick={() => onSort("treatment")}
                  className={headerButtonClass}
                >
                  <span>Treatment</span>
                  {renderSortIcon("treatment")}
                </button>
              </th>

              {/* Category – גם ככה רק ב-lg ומעלה, אז לא יופיע במובייל */}
              <th className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-600 hidden lg:table-cell">
                <button
                  type="button"
                  onClick={() => onSort("category")}
                  className={headerButtonClass}
                >
                  <span>Category</span>
                  {renderSortIcon("category")}
                </button>
              </th>

              {/* Actions */}
              <th className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-600 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {stones.map((stone) => {
              const expanded = isExpandedStone(stone);

              const { plainTextBody: emailBody, htmlBody: emailHtml } =
                createEmailBodies(stone);

              const mailtoHref = `mailto:?subject=${encodeURIComponent(
                `Stone ${stone.sku || ""} details`
              )}&body=${encodeURIComponent(emailBody)}`;

              const handleCopyHtmlToClipboard = async () => {
                try {
                  if (navigator.clipboard && window.ClipboardItem) {
                    const type = "text/html";
                    const blob = new Blob([emailHtml], { type });
                    const data = [new ClipboardItem({ [type]: blob })];
                    await navigator.clipboard.write(data);
                  } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(emailHtml);
                  } else {
                    alert("Clipboard API is not available in this browser.");
                  }
                } catch (err) {
                  console.error("Failed to copy HTML:", err);
                }
              };

              return (
                <>
                  <tr
                    key={stone.id}
                    className={`border-t border-slate-100 hover:bg-slate-50 ${
                      expanded ? "bg-slate-50" : ""
                    }`}
                  >
                    {/* SKU */}
                    <td className="px-3 sm:px-4 py-2 sm:py-3 font-mono text-[11px] sm:text-xs">
                      {stone.sku}
                    </td>

                    {/* Image */}
                    <td className="px-3 sm:px-4 py-2 sm:py-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden border border-slate-200 bg-slate-100">
                        {stone.imageUrl ? (
                          <img
                            src={stone.imageUrl}
                            alt={stone.sku}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                            No image
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Shape */}
                    <td className="px-3 sm:px-4 py-2 sm:py-3">
                      {stone.shape}
                    </td>

                    {/* Weight */}
                    <td className="px-3 sm:px-4 py-2 sm:py-3">
                      {stone.weightCt}
                    </td>

                    {/* Measurements – מוסתר במובייל */}
                    <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap hidden sm:table-cell">
                      {stone.measurements}
                    </td>

                    {/* Price per carat */}
                    <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                      {stone.pricePerCt != null
                        ? `${stone.pricePerCt.toLocaleString("en-US")}`
                        : "-"}
                    </td>

                    {/* Total price */}
                    <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                      {stone.priceTotal != null
                        ? `${stone.priceTotal.toLocaleString("en-US")}`
                        : "-"}
                    </td>

                    {/* Treatment – רק ב-lg */}
                    <td className="px-3 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">
                      {stone.treatment || ""}
                    </td>

                    {/* Category – רק ב-lg */}
                    <td className="px-3 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">
                      {stone.category || ""}
                    </td>

                    {/* Actions */}
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-right">
                      <button
                        onClick={() => onToggle(stone)}
                        className="inline-flex w-full sm:w-auto justify-center items-center rounded-full bg-sky-600 px-3 py-1.5 text-[11px] sm:text-xs font-medium text-white hover:bg-sky-700"
                      >
                        {expanded ? "Hide details" : "Show details"}
                      </button>
                    </td>
                  </tr>

                  {expanded && (
                    <tr>
                      <td
                        colSpan={10}
                        className="bg-slate-50 border-t border-slate-100"
                      >
                        <div className="p-3 sm:p-4 lg:p-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                          {/* Selected stone info */}
                          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 sm:p-4 shadow-sm">
                            <h2 className="mb-2 text-sm sm:text-base font-semibold text-slate-800">
                              Selected stone
                            </h2>
                            <div className="mb-3 flex items-center gap-3">
                              <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                {stone.imageUrl ? (
                                  <img
                                    src={stone.imageUrl}
                                    alt={stone.sku}
                                    className="w-full h-full object-cover"
                                  />
                                ) : null}
                              </div>
                              <div className="text-xs sm:text-sm text-slate-600 space-y-1.5">
                                <div>
                                  <span className="font-medium">SKU:</span>{" "}
                                  {stone.sku}
                                </div>
                                <div>
                                  <span className="font-medium">Shape:</span>{" "}
                                  {stone.shape}
                                </div>
                                <div>
                                  <span className="font-medium">Weight:</span>{" "}
                                  {stone.weightCt} ct
                                </div>
                                <div>
                                  <span className="font-medium">
                                    Measurements:
                                  </span>{" "}
                                  {stone.measurements}
                                </div>
                                <div>
                                  <span className="font-medium">Color:</span>{" "}
                                  {stone.color || "N/A"}
                                </div>
                                <div>
                                  <span className="font-medium">Clarity:</span>{" "}
                                  {stone.clarity || "N/A"}
                                </div>
                                <div>
                                  <span className="font-medium">Category:</span>{" "}
                                  {stone.category || "N/A"}
                                </div>
                              </div>
                            </div>

                            <div className="text-xs sm:text-sm text-slate-600 space-y-1.5">
                              <div>
                                <span className="font-medium">
                                  Treatment:
                                </span>{" "}
                                {stone.treatment || "N/A"}
                              </div>
                              <div>
                                <span className="font-medium">Lab:</span>{" "}
                                {stone.lab || "N/A"}
                              </div>
                              <div>
                                <span className="font-medium">Origin:</span>{" "}
                                {stone.origin || "N/A"}
                              </div>
                              <div>
                                <span className="font-medium">Ratio:</span>{" "}
                                {stone.ratio != null ? stone.ratio : "N/A"}
                              </div>
                              <div>
                                <span className="font-medium">Luster:</span>{" "}
                                {stone.luster || "N/A"}
                              </div>
                              <div>
                                <span className="font-medium">
                                  Fluorescence:
                                </span>{" "}
                                {stone.fluorescence || "N/A"}
                              </div>

                              {(stone.imageUrl ||
                                stone.videoUrl ||
                                stone.certificateUrl) && (
                                <div className="mt-2 space-y-1">
                                  {stone.imageUrl && (
                                    <div>
                                      <span className="font-medium">
                                        Photo:
                                      </span>{" "}
                                      <a
                                        href={stone.imageUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sky-600 hover:text-sky-700 underline"
                                      >
                                        Open image
                                      </a>
                                    </div>
                                  )}
                                  {stone.videoUrl && (
                                    <div>
                                      <span className="font-medium">
                                        Video:
                                      </span>{" "}
                                      <a
                                        href={stone.videoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sky-600 hover:text-sky-700 underline"
                                      >
                                        Open video
                                      </a>
                                    </div>
                                  )}
                                  {stone.certificateUrl && (
                                    <div>
                                      <span className="font-medium">
                                        Certificate:
                                      </span>{" "}
                                      <a
                                        href={stone.certificateUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sky-600 hover:text-sky-700 underline"
                                      >
                                        Open certificate
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Email preview */}
                          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 sm:p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <h2 className="text-sm sm:text-base font-semibold text-slate-800">
                                Email preview
                              </h2>
                              <div className="flex items-center gap-2">
                                <a
                                  href={mailtoHref}
                                  className="inline-flex items-center rounded-full border border-sky-500 px-3 py-1 text-[11px] sm:text-xs font-medium text-sky-600 hover:bg-sky-50"
                                >
                                  Open in Outlook
                                </a>
                                <button
                                  type="button"
                                  onClick={handleCopyHtmlToClipboard}
                                  className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-[11px] sm:text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Copy with images
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-500 mb-2">
                              Use “Open in Outlook” for plain text, or click
                              “Copy with images” and paste into Outlook to
                              include the styled layout with image and logo.
                            </p>
                            <div className="text-xs sm:text-sm text-slate-700 whitespace-pre-line bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-200">
                              {emailBody}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ---------------- Main Page ---------------- */

const StoneSearchPage = () => {
  const [filters, setFilters] = useState({
    sku: "",
    minPrice: "",
    maxPrice: "",
    minCarat: "",
    maxCarat: "",
    shape: "All shapes",
    treatment: "All treatments",
    category: "All categories",
  });

  const [stones, setStones] = useState([]);
  const [selectedStone, setSelectedStone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [initialLoading, setInitialLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  const [sortConfig, setSortConfig] = useState({
    field: "sku",
    direction: "asc",
  });

  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { field, direction: "asc" };
    });
  };

  useEffect(() => {
    let intervalId;

    const startProgress = () => {
      setInitialLoading(true);
      setProgress(10);
      intervalId = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 300);
    };

    const stopProgress = () => {
      setProgress(100);
      setTimeout(() => {
        setInitialLoading(false);
        setProgress(0);
      }, 400);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };

    const fetchStones = async () => {
      try {
        setLoading(true);
        setError("");
        startProgress();

        const res = await fetch(
          "https://gems-dna-be.onrender.com/api/soap-stones"
        );

        if (!res.ok) {
          throw new Error("Failed to load stones");
        }

        const data = await res.json();

        const rows = Array.isArray(data.stones)
          ? data.stones
          : Array.isArray(data)
          ? data
          : [];

        const normalized = rows.map((row, index) => ({
          id: row.id ?? index,
          sku: row.sku ?? "",
          shape: row.shape ?? "",
          weightCt: row.weightCt != null ? Number(row.weightCt) : null,
          measurements: row.measurements ?? "",
          priceTotal: row.priceTotal != null ? Number(row.priceTotal) : null,
          pricePerCt: row.pricePerCt != null ? Number(row.pricePerCt) : null,
          imageUrl: row.imageUrl ?? null,
          videoUrl: row.videoUrl ?? null,
          certificateUrl: row.certificateUrl ?? null,
          lab: row.lab ?? "N/A",
          origin: row.origin ?? "N/A",
          ratio:
            row.ratio !== undefined && row.ratio !== null && row.ratio !== ""
              ? Number(row.ratio)
              : null,
          color: row.color ?? "",
          clarity: row.clarity ?? "",
          luster: row.luster ?? "",
          fluorescence: row.fluorescence ?? "",
          certificateNumber: row.certificateNumber ?? "",
          treatment: row.treatment ?? "",
          category: row.category ?? "",
        }));

        setStones(normalized);
      } catch (err) {
        console.error(err);
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
        stopProgress();
      }
    };

    fetchStones();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedStone(null);
  }, [filters]);

  const shapesOptions = useMemo(() => {
    const set = new Set();
    stones.forEach((s) => {
      if (s.shape) {
        set.add(s.shape);
      }
    });
    return ["All shapes", ...Array.from(set).sort()];
  }, [stones]);

  const categoriesOptions = useMemo(() => {
    const set = new Set();
    stones.forEach((s) => {
      if (s.category) {
        set.add(s.category);
      }
    });
    return ["All categories", ...Array.from(set).sort()];
  }, [stones]);

  const filteredStones = useMemo(() => {
    return stones.filter((stone) => {
      if (
        filters.sku &&
        !stone.sku?.toLowerCase().includes(filters.sku.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.minPrice &&
        stone.priceTotal != null &&
        stone.priceTotal < Number(filters.minPrice)
      ) {
        return false;
      }
      if (
        filters.maxPrice &&
        stone.priceTotal != null &&
        stone.priceTotal > Number(filters.maxPrice)
      ) {
        return false;
      }

      if (
        filters.minCarat &&
        stone.weightCt != null &&
        stone.weightCt < Number(filters.minCarat)
      ) {
        return false;
      }
      if (
        filters.maxCarat &&
        stone.weightCt != null &&
        stone.weightCt > Number(filters.maxCarat)
      ) {
        return false;
      }

      if (filters.shape !== "All shapes" && stone.shape !== filters.shape) {
        return false;
      }

      if (
        filters.treatment !== "All treatments" &&
        stone.treatment !== filters.treatment
      ) {
        return false;
      }

      if (
        filters.category !== "All categories" &&
        stone.category !== filters.category
      ) {
        return false;
      }

      return true;
    });
  }, [filters, stones]);

  const sortedStones = useMemo(() => {
    const sorted = [...filteredStones];
    const { field, direction } = sortConfig || {};
    if (!field) return sorted;

    const dir = direction === "desc" ? -1 : 1;

    const getString = (val) => (val || "").toString();
    const getNumber = (val) =>
      val === null || val === undefined || val === ""
        ? Number.NEGATIVE_INFINITY
        : Number(val);

    sorted.sort((a, b) => {
      let res = 0;
      switch (field) {
        case "sku":
          res = getString(a.sku).localeCompare(getString(b.sku));
          break;
        case "shape":
          res = getString(a.shape).localeCompare(getString(b.shape));
          break;
        case "weightCt":
          res = getNumber(a.weightCt) - getNumber(b.weightCt);
          break;
        case "measurements":
          res = getString(a.measurements).localeCompare(
            getString(b.measurements)
          );
          break;
        case "pricePerCt":
          res = getNumber(a.pricePerCt) - getNumber(b.pricePerCt);
          break;
        case "priceTotal":
          res = getNumber(a.priceTotal) - getNumber(b.priceTotal);
          break;
        case "treatment":
          res = getString(a.treatment).localeCompare(
            getString(b.treatment)
          );
          break;
        case "category":
          res = getString(a.category).localeCompare(getString(b.category));
          break;
        default:
          res = 0;
      }
      return res * dir;
    });

    return sorted;
  }, [filteredStones, sortConfig]);

  const totalItems = sortedStones.length;
  const totalPages =
    totalItems === 0 ? 1 : Math.ceil(totalItems / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  const paginatedStones = sortedStones.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage((prev) => (prev > 1 ? prev - 1 : prev));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev < totalPages ? prev + 1 : prev));
  };

  const handleToggleStone = (stone) => {
    setSelectedStone((prev) => (prev && prev.id === stone.id ? null : stone));
  };

  return (
    <>
      <LoadingBar active={initialLoading} progress={progress} />

      <div className="min-h-screen bg-slate-100 px-3 sm:px-4 py-5 sm:py-6 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <header className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
              Stone selector
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Search stones by SKU, weight, measurements, shape, treatment and
              category. Prices are not displayed in this view.
            </p>
          </header>

          <StoneFilters
            filters={filters}
            onChange={setFilters}
            shapesOptions={shapesOptions}
            categoriesOptions={categoriesOptions}
          />

          <StonesTable
            stones={paginatedStones}
            onToggle={handleToggleStone}
            selectedStone={selectedStone}
            loading={loading}
            error={error}
            sortConfig={sortConfig}
            onSort={handleSort}
          />

          {!loading && !error && totalItems > 0 && (
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-600">
              <div>
                Showing {totalItems === 0 ? 0 : startIndex + 1}–
                {Math.min(endIndex, totalItems)} of {totalItems} stones
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-full border text-[11px] sm:text-xs ${
                    currentPage === 1
                      ? "border-slate-200 text-slate-300 cursor-not-allowed"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Previous
                </button>
                <span className="text-[11px] sm:text-xs">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || totalItems === 0}
                  className={`px-3 py-1.5 rounded-full border text-[11px] sm:text-xs ${
                    currentPage === totalPages || totalItems === 0
                      ? "border-slate-200 text-slate-300 cursor-not-allowed"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default StoneSearchPage;
