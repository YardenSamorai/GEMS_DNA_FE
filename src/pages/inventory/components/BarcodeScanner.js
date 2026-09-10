import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";

/* ============================================================================
 * Camera barcode / QR scanner.
 *
 * Two modes. The default reads one code and closes, which is what a "find this
 * stone" lookup wants. In `continuous` mode the camera stays on and every code
 * is handed up as it is read, so a rep can walk a tray of stones and build a
 * list in one go without touching the screen between items.
 *
 * Continuous scanning needs a guard the single mode never did: the decoder
 * fires its success callback on every frame a barcode is visible — ten times a
 * second — so one stone held in view would otherwise be reported dozens of
 * times. Codes are therefore collected in a set and each one only counts once
 * per session, which also matches what the caller wants (a list of distinct
 * stock numbers) and needs no timing guesswork.
 * ========================================================================== */

const BarcodeScanner = ({ isOpen, onClose, onScan, continuous = false }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  // Codes read in this session, newest first — both the on-screen receipt and,
  // via the ref below, the duplicate guard.
  const [collected, setCollected] = useState([]);
  // Flashes when the camera re-reads something already collected, so holding a
  // stone in view a moment too long looks deliberate rather than broken.
  const [repeat, setRepeat] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const collectedRef = useRef(new Set());
  // The decoder callback is created once, when the camera starts, so it must
  // not close over props that change between renders.
  const onScanRef = useRef(onScan);
  const continuousRef = useRef(continuous);
  useEffect(() => {
    onScanRef.current = onScan;
    continuousRef.current = continuous;
  }, [onScan, continuous]);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setScanning(false);
  }, []);

  const handleDecoded = useCallback((decodedText) => {
    const code = String(decodedText || "").trim();
    if (!code) return;

    if (!continuousRef.current) {
      setLastResult(code);
      onScanRef.current(code);
      stopScanner();
      return;
    }

    if (collectedRef.current.has(code)) {
      setRepeat(code);
      return;
    }
    collectedRef.current.add(code);
    setRepeat(null);
    setLastResult(code);
    setCollected((prev) => [code, ...prev]);
    // A short buzz is the only confirmation available when the rep is looking
    // at the tray rather than the screen.
    try {
      navigator.vibrate?.(40);
    } catch {
      /* unsupported — the on-screen list is the fallback */
    }
    onScanRef.current(code);
  }, [stopScanner]);

  const startScanner = useCallback(async () => {
    if (!scannerRef.current || html5QrCodeRef.current) return;

    try {
      setError(null);
      setScanning(true);

      const html5QrCode = new Html5Qrcode("barcode-reader");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.5,
        },
        handleDecoded,
        () => {
        }
      );
    } catch (err) {
      setError(err.message || "Failed to start camera");
      setScanning(false);
    }
  }, [handleDecoded]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    }
    stopScanner();
    return undefined;
  }, [isOpen, startScanner, stopScanner]);

  // Each opening starts a fresh session, or yesterday's codes would still be
  // blocking today's scans.
  useEffect(() => {
    if (!isOpen) {
      collectedRef.current = new Set();
      setCollected([]);
      setLastResult(null);
      setRepeat(null);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const finish = () => {
    stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={finish}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-background rounded-lg border border-border shadow-lg w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Scan Barcode</h2>
                  <p className="text-emerald-100 text-xs">
                    {continuous
                      ? "Keep scanning — every code is added to your search"
                      : "Point camera at barcode or QR code"}
                  </p>
                </div>
              </div>
              <button
                onClick={finish}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scanner Area */}
          <div className="p-4">
            <div className="relative rounded-xl overflow-hidden bg-black">
              <div 
                id="barcode-reader" 
                ref={scannerRef}
                className="w-full aspect-[4/3]"
              />
              
              {/* Scanning overlay */}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-40 border-2 border-emerald-400 rounded-lg relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>
                      {/* Scanning line animation */}
                      <motion.div
                        className="absolute left-2 right-2 h-0.5 bg-emerald-400"
                        animate={{ top: ["10%", "90%", "10%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="mt-4 text-center">
              {error ? (
                <div className="text-red-400 text-sm bg-red-900/30 rounded-lg p-3">
                  <p className="font-medium">Camera Error</p>
                  <p className="text-xs mt-1">{error}</p>
                </div>
              ) : scanning ? (
                <p className="text-emerald-400 text-sm flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  {continuous && collected.length > 0
                    ? `Scanning\u2026 ${collected.length} added`
                    : "Scanning... Point at barcode"}
                </p>
              ) : (
                <p className="text-stone-400 text-sm">Initializing camera...</p>
              )}
            </div>

            {/* Everything read so far — the receipt that lets the rep look away
                from the tray and know the scan landed. */}
            {continuous ? (
              collected.length > 0 && (
                <div className="mt-4 p-3 bg-emerald-900/30 rounded-lg border border-emerald-700">
                  <p className="text-xs text-emerald-300">
                    Scanned ({collected.length})
                    {repeat && <span className="text-amber-300"> · {repeat} already added</span>}
                  </p>
                  <div className="mt-1.5 max-h-24 overflow-y-auto flex flex-wrap gap-1.5">
                    {collected.map((code) => (
                      <span
                        key={code}
                        className="text-xs font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-800 rounded px-1.5 py-0.5"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )
            ) : (
              lastResult && (
                <div className="mt-4 p-3 bg-emerald-900/30 rounded-lg border border-emerald-700">
                  <p className="text-xs text-emerald-300">Last scanned:</p>
                  <p className="text-sm font-mono text-emerald-400 font-semibold">{lastResult}</p>
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-stone-700 bg-stone-800/50">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>Supports: Code128, QR Code</span>
              <button
                onClick={finish}
                className={
                  continuous && collected.length > 0
                    ? "px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
                    : "px-4 py-2 bg-stone-700 hover:bg-stone-600 text-white rounded-lg transition-colors"
                }
              >
                {continuous && collected.length > 0 ? `Show ${collected.length}` : "Cancel"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BarcodeScanner;
