import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSelection } from "../context/SelectionContext";
import { GemstoneCard, modeForStone } from "../pages/sales/SalesInventory";
import { JewelryCard } from "../pages/sales/SalesJewelry";
import { downloadCatalogPdf } from "../services/catalogPdf";

/* Floating "selection" button — bottom-right counterpart to the catalog's
 * bottom-left filter FAB. Appears once at least one stone is picked, shows the
 * running count, and opens a bottom sheet (same up-from-below, ~70%-height
 * treatment as the filters) listing every selected stone. Sits above the mobile
 * dock on phones and drops to a normal bottom margin on desktop. */
const SelectionFab = () => {
  const { items, count, clear } = useSelection();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Close the sheet whenever the route changes (e.g. tapping through to a
  // stone's page) so it never lingers over a different screen.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Collapse the actions menu whenever the sheet itself closes.
  useEffect(() => {
    if (!open) setActionsOpen(false);
  }, [open]);

  const handleExportPdf = async (showLogo = true) => {
    if (exporting || count === 0) return;
    setActionsOpen(false);
    setExporting(true);
    try {
      await downloadCatalogPdf(items, { showLogo });
    } catch (err) {
      console.error("[catalog pdf] export failed", err);
      alert("Could not generate the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {count > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Review ${count} selected ${count === 1 ? "stone" : "stones"}`}
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
          className="fixed right-4 z-40 flex items-center gap-2.5 rounded-full bg-emerald-600 px-5 py-3.5 text-white shadow-[0_10px_30px_-8px_rgba(5,150,105,0.7)] transition-all duration-200 hover:bg-emerald-700 active:scale-95 md:!bottom-6"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M5 8h14l-1 11a2 2 0 01-2 1.8H8A2 2 0 016 19L5 8z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 8V6a3 3 0 016 0v2"
            />
          </svg>
          <span className="text-[14px] font-semibold tracking-tight">Selected</span>
          <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-white px-1.5 text-[12.5px] font-bold tabular-nums text-emerald-700">
            {count}
          </span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 flex h-[70vh] flex-col rounded-t-3xl border-t border-app-line bg-app-surface"
              role="dialog"
              aria-label="Selected stones"
            >
              {/* Grab handle */}
              <div className="flex justify-center pt-3" aria-hidden>
                <span className="h-1.5 w-10 rounded-full bg-app-line" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <h2 className="text-[16px] font-semibold tracking-tight text-app-ink">
                  Selected
                  <span className="ml-1.5 text-app-soft">({count})</span>
                </h2>
                <div className="flex items-center gap-2">
                  {count > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActionsOpen((v) => !v)}
                        disabled={exporting}
                        aria-haspopup="menu"
                        aria-expanded={actionsOpen}
                        className="flex items-center gap-1.5 rounded-lg border border-app-line px-3 py-1.5 text-[13px] font-semibold text-app-ink transition hover:bg-app-canvas2 active:scale-95 disabled:opacity-60"
                      >
                        {exporting ? (
                          <svg className="h-4 w-4 animate-spin text-app-soft" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        )}
                        <span>{exporting ? "Working…" : "Action"}</span>
                        <svg className={`h-3.5 w-3.5 text-app-soft transition-transform ${actionsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
                        </svg>
                      </button>

                      {actionsOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} aria-hidden />
                          <div
                            role="menu"
                            className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-app-line bg-app-surface py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)]"
                          >
                            <div className="px-4 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-app-soft">
                              Export catalog to PDF
                            </div>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleExportPdf(true)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] font-medium text-app-ink transition hover:bg-app-canvas2"
                            >
                              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M14 3v5h5M9 13h6M9 17h6" />
                              </svg>
                              With logo
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleExportPdf(false)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] font-medium text-app-ink transition hover:bg-app-canvas2"
                            >
                              <svg className="h-4 w-4 text-app-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M14 3v5h5M9 13h6M9 17h6" />
                              </svg>
                              Without logo
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {count > 0 && (
                    <button
                      type="button"
                      onClick={clear}
                      className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-50 active:scale-95"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-app-soft transition hover:bg-app-canvas2 hover:text-app-ink"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 pb-6 pt-1">
                {count === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <p className="text-[14px] font-medium text-app-ink">No stones selected yet</p>
                    <p className="mt-1 text-[13px] text-app-soft">
                      Tap the <span className="font-semibold text-emerald-600">+</span> on any stone
                      to add it here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((stone, idx) => {
                      const isJewelry = stone.kind === "jewelry";
                      const to = isJewelry
                        ? `/sales/jewelry/${encodeURIComponent(stone.sku || "")}`
                        : `/sales/stone/${encodeURIComponent(stone.sku || "")}`;
                      return (
                        <Link
                          key={stone.id ?? stone.sku ?? idx}
                          to={to}
                          state={isJewelry ? { item: stone } : { stone }}
                          onClick={() => setOpen(false)}
                          className="transition active:opacity-80"
                        >
                          {isJewelry ? (
                            <JewelryCard item={stone} />
                          ) : (
                            <GemstoneCard stone={stone} mode={modeForStone(stone)} />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SelectionFab;
