import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from "@clerk/clerk-react";
import { motion, AnimatePresence } from 'framer-motion';
import { getMappedCategories } from "../utils/categoryMap";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

const API_BASE = process.env.REACT_APP_API_URL || 'https://gems-dna-be.onrender.com';

/* ─── Animated Counter Hook ───────────────────────────────── */
const useAnimatedCounter = (end, duration = 1200) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (end === 0) { setCount(0); return; }
    let start;
    let raf;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * end));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, duration]);

  return count;
};

/* ─── Donut Chart ─────────────────────────────────────────── */
const DonutChart = ({ data, size = 160, thickness = 24 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={thickness} />
      {data.map((item, i) => {
        const pct = item.value / total;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const o = offset;
        offset += dash;
        return (
          <motion.circle
            key={i}
            cx={size/2} cy={size/2} r={r}
            fill="none"
            stroke={item.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-o}
            strokeLinecap="butt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.12, duration: 0.5 }}
            style={{ transformOrigin: `${size/2}px ${size/2}px`, transform: 'rotate(-90deg)' }}
          />
        );
      })}
      <text x={size/2} y={size/2 - 6} textAnchor="middle" className="fill-foreground text-xl font-bold">{total.toLocaleString()}</text>
      <text x={size/2} y={size/2 + 12} textAnchor="middle" className="fill-muted-foreground text-[10px]">stones</text>
    </svg>
  );
};

/* ─── Horizontal Bar Chart ────────────────────────────────── */
const HBarChart = ({ data, maxValue }) => (
  <div className="space-y-2.5">
    {data.map((item, i) => {
      const pct = maxValue ? (item.value / maxValue) * 100 : 0;
      return (
        <div key={i} className="group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground truncate max-w-[120px]">{item.label}</span>
            <span className="text-xs font-semibold tabular-nums">{item.value.toLocaleString()}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: i * 0.08, duration: 0.7, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: item.color }}
            />
          </div>
        </div>
      );
    })}
  </div>
);

/* ─── Skeleton helpers ────────────────────────────────────── */
const Skeleton = ({ className }) => <div className={`animate-pulse rounded-md bg-muted ${className}`} />;

const StatCardSkeleton = () => (
  <Card>
    <CardContent className="p-5">
      <Skeleton className="h-4 w-20 mb-3" />
      <Skeleton className="h-8 w-28 mb-1" />
      <Skeleton className="h-3 w-16" />
    </CardContent>
  </Card>
);

/* ─── Phase labels (sync) ─────────────────────────────────── */
const SYNC_PHASE_LABELS = {
  idle: 'Ready to sync',
  starting: 'Starting sync...',
  connecting: 'Connecting to SOAP API...',
  parsing: 'Parsing stone data...',
  processing: 'Processing stones...',
  clearing: 'Preparing database...',
  inserting: 'Saving stones to database...',
  complete: 'Sync complete!',
  error: 'Sync failed',
};

/* ═══════════════════════════════════════════════════════════════
   Sync Info Dialog
   ═══════════════════════════════════════════════════════════════ */
const SyncInfoDialog = ({ isOpen, onClose, currentStats, onSyncComplete }) => {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [progress, setProgress] = useState({ phase: 'idle', progress: 0, detail: '', totalStones: 0, processedStones: 0 });
  const [elapsedTime, setElapsedTime] = useState(0);
  const pollingRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const syncCommand = 'cd GEMS_DNA_BE && node api/stones/importFromSoap.js';

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sync/progress`);
        const data = await res.json();
        setProgress(data);
        if (!data.active && data.phase === 'complete') {
          stopPolling();
        }
      } catch (err) { /* continue */ }
    }, 800);
  };

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncMessage('');
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    
    startPolling();
    
    try {
      const res = await fetch(`${API_BASE}/api/sync`, { method: 'POST' });
      const data = await res.json();
      stopPolling();
      
      if (data.success) {
        setSyncResult('success');
        setSyncMessage(`Successfully synced ${data.count} stones`);
        setProgress({ phase: 'complete', progress: 100, detail: '', totalStones: data.count, processedStones: data.count });
        if (onSyncComplete) onSyncComplete();
      } else {
        setSyncResult('error');
        setSyncMessage(data.error || 'Sync failed');
        setProgress(prev => ({ ...prev, phase: 'error' }));
      }
    } catch (err) {
      stopPolling();
      setSyncResult('error');
      setSyncMessage(`Network error: ${err.message}`);
      setProgress(prev => ({ ...prev, phase: 'error' }));
    } finally {
      setSyncing(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(syncCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto border"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">SOAP Data Sync</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold">{currentStats.totalStones.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">Current Stones</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold">{Object.keys(currentStats.categories).length}</p>
                <p className="text-[11px] text-muted-foreground">Categories</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold">{Object.keys(currentStats.locations).length}</p>
                <p className="text-[11px] text-muted-foreground">Locations</p>
              </div>
            </div>

            {syncing && (
              <div className="mb-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{SYNC_PHASE_LABELS[progress.phase] || progress.phase}</span>
                  <span className="text-muted-foreground tabular-nums">{formatTime(elapsedTime)}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${progress.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                {progress.detail && <p className="text-xs text-muted-foreground">{progress.detail}</p>}
                {progress.processedStones > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {progress.processedStones.toLocaleString()} / {progress.totalStones.toLocaleString()} stones processed
                  </p>
                )}
              </div>
            )}

            {syncResult === 'success' && (
              <div className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                {syncMessage}
              </div>
            )}
            {syncResult === 'error' && (
              <div className="mb-5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {syncMessage}
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? 'Syncing...' : 'Start Sync'}
              </button>
            </div>

            <Separator className="my-4" />

            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showTerminal ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Manual terminal sync
            </button>

            {showTerminal && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden mt-3">
                <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm text-zinc-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-500 text-xs">Terminal command</span>
                    <button onClick={handleCopyCommand} className="text-zinc-400 hover:text-white text-xs flex items-center gap-1">
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <code className="text-emerald-400 text-xs">{syncCommand}</code>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ═══════════════════════════════════════════════════════════════
   CSV Upload Dialog (Stones)
   ═══════════════════════════════════════════════════════════════ */
const CsvUploadDialog = ({ isOpen, onClose, onImportComplete }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [progress, setProgress] = useState({ phase: 'idle', progress: 0, detail: '' });
  const [dragOver, setDragOver] = useState(false);
  const pollingRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/import-csv/progress`);
        const data = await res.json();
        setProgress(data);
      } catch { /* continue */ }
    }, 800);
  };

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportMessage('');

    try {
      const text = await file.text();
      startPolling();
      const res = await fetch(`${API_BASE}/api/import-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text })
      });
      const data = await res.json();
      stopPolling();

      if (data.success) {
        setImportResult('success');
        setImportMessage(`Imported ${data.imported || data.count || 0} stones`);
        setProgress({ phase: 'complete', progress: 100, detail: '' });
        if (onImportComplete) onImportComplete();
      } else {
        setImportResult('error');
        setImportMessage(data.error || 'Import failed');
      }
    } catch (err) {
      stopPolling();
      setImportResult('error');
      setImportMessage(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.csv') || dropped.name.endsWith('.xlsx'))) setFile(dropped);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-xl shadow-xl max-w-md w-full border"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Import Stones CSV</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : file ? 'border-emerald-300 bg-emerald-50/50' : 'border-border hover:border-primary/50'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <div>
                  <svg className="w-8 h-8 text-emerald-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 text-muted-foreground mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="text-sm text-muted-foreground">Drop CSV file here or click to browse</p>
                </div>
              )}
            </div>

            {importing && (
              <div className="mt-4 space-y-2">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${progress.progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{progress.detail || 'Processing...'}</p>
              </div>
            )}

            {importResult === 'success' && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{importMessage}</div>
            )}
            {importResult === 'error' && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{importMessage}</div>
            )}

            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="mt-4 w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ═══════════════════════════════════════════════════════════════
   CSV Upload Dialog (Jewelry)
   ═══════════════════════════════════════════════════════════════ */
const JewelryCsvUploadDialog = ({ isOpen, onClose, onImportComplete }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [progress, setProgress] = useState({ phase: 'idle', progress: 0, detail: '' });
  const [dragOver, setDragOver] = useState(false);
  const pollingRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jewelry/import-csv/progress`);
        const data = await res.json();
        setProgress(data);
      } catch { /* continue */ }
    }, 800);
  };

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      startPolling();
      const res = await fetch(`${API_BASE}/api/jewelry/import-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text })
      });
      const data = await res.json();
      stopPolling();

      if (data.success) {
        setImportResult('success');
        setImportMessage(`Imported ${data.imported || data.count || 0} jewelry items`);
        if (onImportComplete) onImportComplete();
      } else {
        setImportResult('error');
        setImportMessage(data.error || 'Import failed');
      }
    } catch (err) {
      stopPolling();
      setImportResult('error');
      setImportMessage(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.csv') || dropped.name.endsWith('.xlsx'))) setFile(dropped);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-xl shadow-xl max-w-md w-full border"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Import Jewelry CSV</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : file ? 'border-pink-300 bg-pink-50/50' : 'border-border hover:border-primary/50'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <div>
                  <svg className="w-8 h-8 text-pink-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <svg className="w-8 h-8 text-muted-foreground mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="text-sm text-muted-foreground">Drop jewelry CSV here or click to browse</p>
                </div>
              )}
            </div>

            {importing && (
              <div className="mt-4 space-y-2">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div className="h-full rounded-full bg-pink-500" animate={{ width: `${progress.progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{progress.detail || 'Processing...'}</p>
              </div>
            )}

            {importResult === 'success' && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{importMessage}</div>
            )}
            {importResult === 'error' && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{importMessage}</div>
            )}

            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="mt-4 w-full h-10 rounded-lg bg-pink-600 text-white font-medium text-sm hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? 'Importing...' : 'Import Jewelry'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
const HomePage = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stones, setStones] = useState([]);
  const searchRef = useRef(null);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [showJewelryCsvDialog, setShowJewelryCsvDialog] = useState(false);
  const [qaMinPpc, setQaMinPpc] = useState('');
  const [qaPriceMode, setQaPriceMode] = useState('bruto');
  const [copiedSku, setCopiedSku] = useState(null);
  const [topStonesMode, setTopStonesMode] = useState('bruto');
  const [stats, setStats] = useState({
    totalStones: 0, totalValue: 0, categories: {}, locations: {}, locationValues: {},
    shapes: {}, topStones: [], recentStones: [], avgPrice: 0, avgWeight: 0,
    priceRanges: {}, weightRanges: {}, groupingTypes: {}, labs: {},
    missingMedia: 0, missingCerts: 0,
    missingMediaByType: { Single: [], Pair: [], Parcel: [], Set: [] },
    missingCertByType: { Single: [], Pair: [], Parcel: [], Set: [] },
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [stonesRes, tagsRes] = await Promise.all([
        fetch(`${API_BASE}/api/soap-stones`),
        fetch(`${API_BASE}/api/tags`).catch(() => ({ json: () => [] }))
      ]);
      const stonesData = await stonesRes.json();
      const tagsData = await tagsRes.json();
      const allStones = Array.isArray(stonesData.stones) ? stonesData.stones : [];
      setStones(allStones);
      setTags(Array.isArray(tagsData) ? tagsData : []);

      const categories = {};
      const locations = {};
      const locationValues = {};
      const shapes = {};
      const groupingTypes = {};
      const labs = {};
      const priceRanges = { '$0-1K': 0, '$1K-5K': 0, '$5K-20K': 0, '$20K+': 0 };
      const weightRanges = { '< 1ct': 0, '1-3ct': 0, '3-5ct': 0, '5ct+': 0 };
      const missingMediaByType = { Single: [], Pair: [], Parcel: [], Set: [] };
      const missingCertByType = { Single: [], Pair: [], Parcel: [], Set: [] };
      let missingMediaTotal = 0;
      let missingCertTotal = 0;
      let totalValue = 0;
      let totalWeight = 0;
      let priceCount = 0;

      allStones.forEach(stone => {
        getMappedCategories(stone.category).forEach(cat => { categories[cat] = (categories[cat] || 0) + 1; });
        const loc = stone.location || 'Unknown';
        locations[loc] = (locations[loc] || 0) + 1;
        locationValues[loc] = (locationValues[loc] || 0) + (stone.priceTotal || 0);
        shapes[stone.shape || 'Unknown'] = (shapes[stone.shape || 'Unknown'] || 0) + 1;
        totalValue += stone.priceTotal || 0;
        totalWeight += stone.weightCt || 0;
        if (stone.priceTotal) priceCount++;

        const gt = stone.groupingType || 'Unknown';
        groupingTypes[gt] = (groupingTypes[gt] || 0) + 1;

        if (stone.lab) labs[stone.lab] = (labs[stone.lab] || 0) + 1;

        const p = stone.priceTotal || 0;
        if (p < 1000) priceRanges['$0-1K']++;
        else if (p < 5000) priceRanges['$1K-5K']++;
        else if (p < 20000) priceRanges['$5K-20K']++;
        else priceRanges['$20K+']++;

        const w = stone.weightCt || 0;
        if (w < 1) weightRanges['< 1ct']++;
        else if (w < 3) weightRanges['1-3ct']++;
        else if (w < 5) weightRanges['3-5ct']++;
        else weightRanges['5ct+']++;

        if (!stone.imageUrl && !stone.videoUrl) {
          missingMediaTotal++;
          const bucket = missingMediaByType[stone.groupingType] !== undefined ? stone.groupingType : 'Single';
          missingMediaByType[bucket].push(stone);
        }
        if (!stone.certificateUrl && !stone.certificateNumber) {
          missingCertTotal++;
          const bucket = missingCertByType[stone.groupingType] !== undefined ? stone.groupingType : 'Single';
          missingCertByType[bucket].push(stone);
        }
      });

      const topStones = [...allStones].filter(s => s.priceTotal).sort((a, b) => b.priceTotal - a.priceTotal).slice(0, 6);
      const recentStones = allStones.slice(0, 8);

      setStats({
        totalStones: allStones.length,
        totalValue,
        categories,
        locations,
        locationValues,
        shapes,
        topStones,
        recentStones,
        avgPrice: priceCount ? Math.round(totalValue / priceCount) : 0,
        avgWeight: allStones.length ? (totalWeight / allStones.length).toFixed(2) : '0',
        priceRanges,
        weightRanges,
        groupingTypes,
        labs,
        missingMedia: missingMediaTotal,
        missingCerts: missingCertTotal,
        missingMediaByType,
        missingCertByType,
      });
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleQuickSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      navigate(`/inventory?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const skuSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return stones.filter(s => s.sku?.toLowerCase().includes(q)).slice(0, 8).map(s => ({
      sku: s.sku, shape: s.shape, category: s.category, weightCt: s.weightCt, imageUrl: s.imageUrl
    }));
  }, [searchQuery, stones]);

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ─── Derived data ────────────────────────────────────────── */
  const totalStonesC = useAnimatedCounter(stats.totalStones);
  const totalValueC = useAnimatedCounter(Math.round(stats.totalValue));
  const avgPriceC = useAnimatedCounter(stats.avgPrice);

  const categoryColors = { 'Emerald': '#10b981', 'Diamond': '#3b82f6', 'Fancy Diamonds': '#f59e0b', 'Gemstones': '#8b5cf6', 'Empty': '#94a3b8' };
  const categoryChartData = Object.entries(stats.categories).filter(([n]) => n !== 'Empty').map(([name, value]) => ({
    label: name, value, color: categoryColors[name] || '#6b7280'
  }));

  const locationColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  const locationChartData = Object.entries(stats.locations).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value], i) => ({
    label: name, value, color: locationColors[i % locationColors.length]
  }));
  const maxLocationValue = Math.max(...locationChartData.map(d => d.value), 1);

  const locationValueData = Object.entries(stats.locationValues || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value], i) => ({
    label: name, value: Math.round(value), color: locationColors[i % locationColors.length]
  }));
  const maxLocationVal = Math.max(...locationValueData.map(d => d.value), 1);

  const topShapes = Object.entries(stats.shapes).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const priceBarColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
  const priceChartData = Object.entries(stats.priceRanges).map(([label, value], i) => ({
    label, value, color: priceBarColors[i % priceBarColors.length]
  }));
  const maxPriceRange = Math.max(...priceChartData.map(d => d.value), 1);

  const weightBarColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
  const weightChartData = Object.entries(stats.weightRanges).map(([label, value], i) => ({
    label, value, color: weightBarColors[i % weightBarColors.length]
  }));
  const maxWeightRange = Math.max(...weightChartData.map(d => d.value), 1);

  const groupingColors = { 'Single': '#3b82f6', 'Pair': '#8b5cf6', 'Set': '#ec4899', 'Parcel': '#f59e0b', 'Melee': '#ef4444', 'Side Stones': '#14b8a6', 'Fancy': '#f97316', 'Unknown': '#94a3b8' };
  const groupingChartData = Object.entries(stats.groupingTypes).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({
    label: name, value, color: groupingColors[name] || '#6b7280'
  }));

  const labColors = { 'GIA': '#3b82f6', 'GRS': '#10b981', 'AGL': '#f59e0b', 'Gubelin': '#8b5cf6', 'SSEF': '#ec4899', 'C.Dunaigre': '#14b8a6' };
  const labEntries = Object.entries(stats.labs).sort((a, b) => b[1] - a[1]);
  const topLabs = labEntries.slice(0, 5);
  const otherLabsCount = labEntries.slice(5).reduce((s, [, v]) => s + v, 0);
  const labChartData = [
    ...topLabs.map(([name, value]) => ({ label: name, value, color: labColors[name] || '#6b7280' })),
    ...(otherLabsCount > 0 ? [{ label: 'Other', value: otherLabsCount, color: '#94a3b8' }] : []),
  ];

  const isNeto = qaPriceMode === 'neto';
  const qaMinPpcNum = qaMinPpc ? Number(qaMinPpc) : 0;
  const getEffectivePpc = (s) => {
    const raw = s.pricePerCt || 0;
    return isNeto ? raw / 2 : raw;
  };
  const filterByPpc = (list) => {
    if (!qaMinPpcNum) return list;
    return list.filter(s => getEffectivePpc(s) >= qaMinPpcNum);
  };
  const filteredMediaByType = useMemo(() => {
    const result = {};
    for (const type of ['Single', 'Pair', 'Parcel', 'Set']) {
      result[type] = filterByPpc(stats.missingMediaByType[type] || []);
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.missingMediaByType, qaMinPpcNum, isNeto]);
  const filteredCertByType = useMemo(() => {
    const result = {};
    for (const type of ['Single', 'Pair', 'Parcel', 'Set']) {
      result[type] = filterByPpc(stats.missingCertByType[type] || []);
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.missingCertByType, qaMinPpcNum, isNeto]);
  const filteredMediaTotal = Object.values(filteredMediaByType).reduce((s, arr) => s + arr.length, 0);
  const filteredCertTotal = Object.values(filteredCertByType).reduce((s, arr) => s + arr.length, 0);
  const formatPpc = (stone) => {
    const ppc = getEffectivePpc(stone);
    return ppc ? `$${Math.round(ppc).toLocaleString()}/ct` : '';
  };
  const topStonesIsNeto = topStonesMode === 'neto';
  const getTopStonePrice = (s) => {
    const raw = s.priceTotal || 0;
    return topStonesIsNeto ? raw / 2 : raw;
  };
  const sortedTopStones = useMemo(() => {
    return [...(stats.topStones || [])].sort((a, b) => getTopStonePrice(b) - getTopStonePrice(a));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.topStones, topStonesIsNeto]);

  const handleCopySku = (e, sku) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    setTimeout(() => setCopiedSku(null), 1500);
  };

  const stagger = (i, base = 0.05) => ({ delay: i * base, duration: 0.4 });
  const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  /* ─── Render ──────────────────────────────────────────────── */
  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* ── Header ──────────────────────────────────────── */}
          <motion.div {...fadeUp} transition={stagger(0)} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {getGreeting()}, {user?.firstName || 'there'}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Here's what's happening with your inventory
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowSyncDialog(true)}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Sync
                  </button>
                </TooltipTrigger>
                <TooltipContent>Sync stone data from SOAP API</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowCsvDialog(true)}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    CSV
                  </button>
                </TooltipTrigger>
                <TooltipContent>Import stones from CSV</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowJewelryCsvDialog(true)}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    Jewelry
                  </button>
                </TooltipTrigger>
                <TooltipContent>Import jewelry from CSV</TooltipContent>
              </Tooltip>
            </div>
          </motion.div>

          {/* ── Search ──────────────────────────────────────── */}
          <motion.div {...fadeUp} transition={stagger(1)} ref={searchRef}>
            <form onSubmit={handleQuickSearch} className="relative">
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search by SKU, shape, or category..."
                  className="w-full h-11 pl-10 pr-24 rounded-lg border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow"
                />
                <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                  Search
                </button>
              </div>

              <AnimatePresence>
                {showSuggestions && skuSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 right-0 mt-1.5 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden"
                  >
                    {skuSuggestions.map((stone, i) => (
                      <button
                        key={stone.sku}
                        type="button"
                        onClick={() => { setSearchQuery(stone.sku); setShowSuggestions(false); navigate(`/inventory?search=${encodeURIComponent(stone.sku)}`); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors ${i !== skuSuggestions.length - 1 ? 'border-b border-border' : ''}`}
                      >
                        <div className="w-9 h-9 rounded-md overflow-hidden bg-muted flex-shrink-0">
                          {stone.imageUrl ? (
                            <img src={stone.imageUrl} alt={stone.sku} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-medium">{stone.sku}</p>
                          <p className="text-xs text-muted-foreground truncate">{stone.shape} {stone.weightCt ? `• ${stone.weightCt}ct` : ''}</p>
                        </div>
                        <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.div>

          {/* ── KPI Cards ───────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              <>
                <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
              </>
            ) : (
              <>
                {/* Total Stones */}
                <motion.div {...fadeUp} transition={stagger(2)}>
                  <Card className="relative overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Total Stones</p>
                          <p className="text-2xl font-bold tabular-nums">{totalStonesC.toLocaleString()}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{Object.keys(stats.categories).filter(c => c !== 'Empty').length} categories</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Total Value */}
                <motion.div {...fadeUp} transition={stagger(3)}>
                  <Card className="relative overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Total Value</p>
                          <p className="text-2xl font-bold tabular-nums">${totalValueC.toLocaleString()}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Inventory B value</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Avg Price */}
                <motion.div {...fadeUp} transition={stagger(4)}>
                  <Card className="relative overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Avg. Price</p>
                          <p className="text-2xl font-bold tabular-nums">${avgPriceC.toLocaleString()}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Per stone (B)</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Avg Weight */}
                <motion.div {...fadeUp} transition={stagger(5)}>
                  <Card className="relative overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Avg. Weight</p>
                          <p className="text-2xl font-bold tabular-nums">{stats.avgWeight} ct</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{Object.keys(stats.locations).length} locations</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}
          </div>

          {/* ── Charts Row ──────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
            {/* Category Distribution - takes 2 cols */}
            <motion.div {...fadeUp} transition={stagger(6)} className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Category Distribution</CardTitle>
                  <CardDescription>Stones by category type</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center h-48"><Skeleton className="w-32 h-32 rounded-full" /></div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <DonutChart data={categoryChartData} size={160} thickness={22} />
                      <div className="w-full space-y-2">
                        {categoryChartData.map((item) => (
                          <div key={item.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-sm text-muted-foreground">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold tabular-nums">{item.value.toLocaleString()}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {stats.totalStones ? Math.round((item.value / stats.totalStones) * 100) : 0}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Location Distribution - Stone Count */}
            <motion.div {...fadeUp} transition={stagger(7)} className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Stones by Location</CardTitle>
                  <CardDescription>Number of stones per location</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
                  ) : (
                    <HBarChart data={locationChartData} maxValue={maxLocationValue} />
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Location Distribution - Value */}
            <motion.div {...fadeUp} transition={stagger(7.5)} className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Value by Location</CardTitle>
                  <CardDescription>Total inventory value per location</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
                  ) : (
                    <div className="space-y-2.5">
                      {locationValueData.map((item, i) => {
                        const pct = maxLocationVal ? (item.value / maxLocationVal) * 100 : 0;
                        return (
                          <div key={i} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-muted-foreground truncate max-w-[120px]">{item.label}</span>
                              <span className="text-xs font-semibold tabular-nums">${item.value.toLocaleString()}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: i * 0.08, duration: 0.7, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ── Quick Actions ───────────────────────────────── */}
          <motion.div {...fadeUp} transition={stagger(8)}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Browse Inventory', desc: 'Search & filter', to: '/inventory', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', color: 'bg-primary text-primary-foreground' },
                { label: 'Diamonds', desc: 'Diamond inventory', to: '/inventory?mode=diamonds', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'bg-blue-600 text-white' },
                { label: 'Gemstones', desc: 'Emeralds & gems', to: '/inventory?mode=gemstones', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', color: 'bg-emerald-600 text-white' },
                { label: 'Jewelry', desc: 'Jewelry collection', to: '/inventory?mode=jewelry', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7', color: 'bg-pink-600 text-white' },
              ].map((action, i) => (
                <Link key={action.label} to={action.to} className={`group rounded-lg p-4 ${action.color} hover:opacity-90 transition-all hover:shadow-md`}>
                  <svg className="w-6 h-6 mb-2 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={action.icon} /></svg>
                  <p className="font-medium text-sm">{action.label}</p>
                  <p className="text-[11px] opacity-70">{action.desc}</p>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* ── Price & Weight Distribution ─────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div {...fadeUp} transition={stagger(9)}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Price Distribution</CardTitle>
                  <CardDescription>Number of stones per price range</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
                  ) : (
                    <HBarChart data={priceChartData} maxValue={maxPriceRange} />
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...fadeUp} transition={stagger(10)}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Weight Distribution</CardTitle>
                  <CardDescription>Number of stones per carat range</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
                  ) : (
                    <HBarChart data={weightChartData} maxValue={maxWeightRange} />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ── Grouping Types & Lab Distribution ────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div {...fadeUp} transition={stagger(11)}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Inventory by Type</CardTitle>
                  <CardDescription>Stone grouping breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center h-48"><Skeleton className="w-32 h-32 rounded-full" /></div>
                  ) : groupingChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <DonutChart data={groupingChartData} size={150} thickness={20} />
                      <div className="w-full space-y-2">
                        {groupingChartData.map((item) => (
                          <div key={item.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-sm text-muted-foreground">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold tabular-nums">{item.value.toLocaleString()}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {stats.totalStones ? Math.round((item.value / stats.totalStones) * 100) : 0}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...fadeUp} transition={stagger(12)}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Lab Distribution</CardTitle>
                  <CardDescription>Certification laboratories</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center h-48"><Skeleton className="w-32 h-32 rounded-full" /></div>
                  ) : labChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No lab data</p>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <DonutChart data={labChartData} size={150} thickness={20} />
                      <div className="w-full space-y-2">
                        {labChartData.map((item) => (
                          <div key={item.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-sm text-muted-foreground">{item.label}</span>
                            </div>
                            <span className="text-sm font-semibold tabular-nums">{item.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ── Bottom Row: Top Stones + Tags + Shapes ───── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Stones */}
            <motion.div {...fadeUp} transition={stagger(9)} className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Top Stones</CardTitle>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTopStonesMode(prev => prev === 'bruto' ? 'neto' : 'bruto')}
                        className={`h-7 px-2.5 rounded-md text-[10px] font-semibold transition-colors border ${topStonesIsNeto ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                      >
                        {topStonesIsNeto ? 'Neto' : 'B'}
                      </button>
                      <Badge variant="success" className="text-[10px]">By Value</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {loading ? (
                    <div className="space-y-2.5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : (
                    <div className="space-y-1.5">
                      {sortedTopStones.map((stone, i) => (
                        <Link key={stone.sku} to={`/${stone.sku}`} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors group">
                          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <div className="w-8 h-8 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            {stone.imageUrl ? (
                              <img src={stone.imageUrl} alt={stone.sku} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs font-medium truncate group-hover:text-primary transition-colors">{stone.sku}</p>
                            <p className="text-[11px] text-muted-foreground">{stone.shape} {stone.weightCt ? `• ${stone.weightCt}ct` : ''}</p>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 tabular-nums flex-shrink-0">
                            ${getTopStonePrice(stone).toLocaleString()}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Tags */}
            <motion.div {...fadeUp} transition={stagger(10)} className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Tags</CardTitle>
                    <Link to="/inventory" className="text-xs text-primary hover:underline">Manage</Link>
                  </div>
                  <CardDescription>{tags.length} tags created</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {loading ? (
                    <div className="space-y-2.5">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : tags.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                        <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                      </div>
                      <p className="text-sm text-muted-foreground">No tags yet</p>
                      <Link to="/inventory" className="text-xs text-primary hover:underline">Create one</Link>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {tags.slice(0, 7).map((tag) => (
                        <div key={tag.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors">
                          <div className="flex items-center gap-2.5">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#10b981' }} />
                            <span className="text-sm font-medium truncate max-w-[140px]">{tag.name}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">{tag.stone_count || 0}</Badge>
                        </div>
                      ))}
                      {tags.length > 7 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">+{tags.length - 7} more</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Top Shapes */}
            <motion.div {...fadeUp} transition={stagger(11)} className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Top Shapes</CardTitle>
                  <CardDescription>Most common stone shapes</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {loading ? (
                    <div className="space-y-2.5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : (
                    <div className="space-y-2">
                      {topShapes.map(([shape, count], i) => {
                        const maxShape = topShapes[0]?.[1] || 1;
                        return (
                          <div key={shape}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{shape}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">{count.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(count / maxShape) * 100}%` }}
                                transition={{ delay: i * 0.08 + 0.3, duration: 0.6 }}
                                className="h-full rounded-full bg-primary/60"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ── QA Alerts ──────────────────────────────────── */}
          <motion.div {...fadeUp} transition={stagger(15)}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">QA Alerts</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQaPriceMode(prev => prev === 'bruto' ? 'neto' : 'bruto')}
                  className={`h-8 px-3 rounded-md text-xs font-semibold transition-colors border ${isNeto ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                >
                  {isNeto ? 'Neto' : 'B'}
                </button>
                <label className="text-xs text-muted-foreground whitespace-nowrap">Min $/ct</label>
                <input
                  type="number"
                  min="0"
                  value={qaMinPpc}
                  onChange={(e) => setQaMinPpc(e.target.value)}
                  placeholder="0"
                  className="w-24 h-8 px-2.5 rounded-md border border-input bg-background text-xs tabular-nums ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                />
                {qaMinPpcNum > 0 && (
                  <button onClick={() => setQaMinPpc('')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                )}
              </div>
            </div>
          </motion.div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Missing Images / Video */}
            <motion.div {...fadeUp} transition={stagger(16)}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Missing Images / Video</CardTitle>
                    <Badge variant={filteredMediaTotal === 0 ? 'success' : 'warning'} className="text-[10px]">
                      {filteredMediaTotal === 0 ? 'All good' : `${filteredMediaTotal} stones`}
                    </Badge>
                  </div>
                  <CardDescription>Stones without any image or video attached</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {loading ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : filteredMediaTotal === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="text-sm font-medium text-emerald-700">{qaMinPpcNum > 0 ? 'No matches for this filter' : 'All stones have media'}</p>
                    </div>
                  ) : (
                    <Tabs defaultValue="Single">
                      <TabsList className="w-full">
                        {['Single', 'Pair', 'Parcel', 'Set'].map(type => (
                          <TabsTrigger key={type} value={type} className="flex-1 text-xs gap-1.5">
                            {type}
                            {filteredMediaByType[type]?.length > 0 && (
                              <Badge variant="warning" className="text-[9px] px-1 py-0 ml-0.5">{filteredMediaByType[type].length}</Badge>
                            )}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {['Single', 'Pair', 'Parcel', 'Set'].map(type => (
                        <TabsContent key={type} value={type}>
                          {(filteredMediaByType[type]?.length || 0) === 0 ? (
                            <div className="text-center py-4">
                              <p className="text-xs text-muted-foreground">No missing media for {type} stones</p>
                            </div>
                          ) : (
                            <div className="space-y-1 max-h-[220px] overflow-y-auto">
                              {filteredMediaByType[type].slice(0, 20).map((stone) => (
                                <Link key={stone.sku} to={`/inventory?search=${encodeURIComponent(stone.sku)}`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors group">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <span className="font-mono text-xs font-medium group-hover:text-primary transition-colors">{stone.sku}</span>
                                    <button onClick={(e) => handleCopySku(e, stone.sku)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted-foreground/10" title="Copy SKU">
                                      {copiedSku === stone.sku ? (
                                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                      ) : (
                                        <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                      )}
                                    </button>
                                  </div>
                                  <span className="text-[11px] text-muted-foreground">{formatPpc(stone)} {stone.shape} {stone.weightCt ? `• ${stone.weightCt}ct` : ''}</span>
                                </Link>
                              ))}
                              {filteredMediaByType[type].length > 20 && (
                                <p className="text-xs text-muted-foreground text-center pt-1">+{filteredMediaByType[type].length - 20} more</p>
                              )}
                            </div>
                          )}
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Missing Certificates */}
            <motion.div {...fadeUp} transition={stagger(17)}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Missing Certificates</CardTitle>
                    <Badge variant={filteredCertTotal === 0 ? 'success' : 'warning'} className="text-[10px]">
                      {filteredCertTotal === 0 ? 'All good' : `${filteredCertTotal} stones`}
                    </Badge>
                  </div>
                  <CardDescription>Stones without certificate URL or number</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {loading ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : filteredCertTotal === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="text-sm font-medium text-emerald-700">{qaMinPpcNum > 0 ? 'No matches for this filter' : 'All stones have certificates'}</p>
                    </div>
                  ) : (
                    <Tabs defaultValue="Single">
                      <TabsList className="w-full">
                        {['Single', 'Pair', 'Parcel', 'Set'].map(type => (
                          <TabsTrigger key={type} value={type} className="flex-1 text-xs gap-1.5">
                            {type}
                            {filteredCertByType[type]?.length > 0 && (
                              <Badge variant="warning" className="text-[9px] px-1 py-0 ml-0.5">{filteredCertByType[type].length}</Badge>
                            )}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {['Single', 'Pair', 'Parcel', 'Set'].map(type => (
                        <TabsContent key={type} value={type}>
                          {(filteredCertByType[type]?.length || 0) === 0 ? (
                            <div className="text-center py-4">
                              <p className="text-xs text-muted-foreground">No missing certificates for {type} stones</p>
                            </div>
                          ) : (
                            <div className="space-y-1 max-h-[220px] overflow-y-auto">
                              {filteredCertByType[type].slice(0, 20).map((stone) => (
                                <Link key={stone.sku} to={`/inventory?search=${encodeURIComponent(stone.sku)}`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors group">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <span className="font-mono text-xs font-medium group-hover:text-primary transition-colors">{stone.sku}</span>
                                    <button onClick={(e) => handleCopySku(e, stone.sku)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted-foreground/10" title="Copy SKU">
                                      {copiedSku === stone.sku ? (
                                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                      ) : (
                                        <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                      )}
                                    </button>
                                  </div>
                                  <span className="text-[11px] text-muted-foreground">{formatPpc(stone)} {stone.shape} {stone.weightCt ? `• ${stone.weightCt}ct` : ''}</span>
                                </Link>
                              ))}
                              {filteredCertByType[type].length > 20 && (
                                <p className="text-xs text-muted-foreground text-center pt-1">+{filteredCertByType[type].length - 20} more</p>
                              )}
                            </div>
                          )}
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ── Recent Stones Gallery ───────────────────────── */}
          <motion.div {...fadeUp} transition={stagger(17)}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Recent Stones</CardTitle>
                    <CardDescription>Latest additions to inventory</CardDescription>
                  </div>
                  <Link to="/inventory" className="text-xs text-primary hover:underline font-medium">View all</Link>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {stats.recentStones.map((stone) => (
                      <Link key={stone.sku} to={`/${stone.sku}`} className="group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-muted relative">
                          {stone.imageUrl ? (
                            <img src={stone.imageUrl} alt={stone.sku} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                            <span className="text-white text-[10px] font-medium">View</span>
                          </div>
                        </div>
                        <p className="font-mono text-[11px] font-medium mt-1.5 truncate group-hover:text-primary transition-colors">{stone.sku}</p>
                        <p className="text-[10px] text-muted-foreground">{stone.weightCt ? `${stone.weightCt}ct` : ''}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Footer ──────────────────────────────────────── */}
          <div className="text-center pb-4">
            <p className="text-xs text-muted-foreground">GEMS DNA &middot; Diamond Network by Gemstar</p>
          </div>

        </div>

        {/* ── Dialogs ─────────────────────────────────────── */}
        <SyncInfoDialog isOpen={showSyncDialog} onClose={() => setShowSyncDialog(false)} currentStats={stats} onSyncComplete={fetchData} />
        <CsvUploadDialog isOpen={showCsvDialog} onClose={() => setShowCsvDialog(false)} onImportComplete={fetchData} />
        <JewelryCsvUploadDialog isOpen={showJewelryCsvDialog} onClose={() => setShowJewelryCsvDialog(false)} onImportComplete={fetchData} />
      </div>
    </TooltipProvider>
  );
};

export default HomePage;
