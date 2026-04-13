import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getMappedCategories } from '../utils/categoryMap';

const BARAK_URL = 'https://app.barakdiamonds.com/gemstones/Main.aspx';

const openInBarak = (sku) => {
  navigator.clipboard.writeText(sku).then(() => {
    toast.success(`SKU "${sku}" copied — paste in Barak search`, { duration: 3000, icon: '📋' });
    window.open(BARAK_URL, '_blank');
  });
};

const API_BASE = process.env.REACT_APP_API_URL || 'https://gems-dna-be.onrender.com';

const JUNK_VALUES = new Set(['n/a', 'na', 'none', '-', '.', '0', '', 'null', 'undefined']);

const isEmpty = (val) => {
  if (val === null || val === undefined) return true;
  if (typeof val === 'number') return val === 0;
  if (typeof val === 'string') return JUNK_VALUES.has(val.trim().toLowerCase());
  return false;
};

const cleanStr = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string' && JUNK_VALUES.has(val.trim().toLowerCase())) return null;
  return val;
};

const ZERO_MEASUREMENT = /^[0.\-xX×*,\s]+$/;
const cleanMeasurement = (val) => {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || JUNK_VALUES.has(s.toLowerCase())) return null;
  if (ZERO_MEASUREMENT.test(s)) return null;
  return s;
};

const normalizeStone = (row) => ({
  id: row.id || row.sku,
  sku: row.sku || '',
  shape: cleanStr(row.shape),
  weightCt: row.weightCt != null ? Number(row.weightCt) : 0,
  measurements: cleanMeasurement(row.measurements),
  priceTotal: row.priceTotal != null ? Number(row.priceTotal) : 0,
  pricePerCt: row.pricePerCt != null ? Number(row.pricePerCt) : 0,
  imageUrl: cleanStr(row.imageUrl),
  videoUrl: cleanStr(row.videoUrl),
  certificateUrl: cleanStr(row.certificateUrl),
  certificateNumber: cleanStr(row.certificateNumber),
  lab: cleanStr(row.lab),
  origin: cleanStr(row.origin),
  color: cleanStr(row.color),
  clarity: cleanStr(row.clarity),
  treatment: cleanStr(row.treatment),
  category: row.category || '',
  location: cleanStr(row.location),
  fluorescence: cleanStr(row.fluorescence),
  luster: cleanStr(row.luster),
  pairSku: cleanStr(row.pairSku),
  groupingType: cleanStr(row.groupingType),
  cut: cleanStr(row.cut),
  polish: cleanStr(row.polish),
  symmetry: cleanStr(row.symmetry),
  tablePercent: row.tablePercent != null ? Number(row.tablePercent) : null,
  depthPercent: row.depthPercent != null ? Number(row.depthPercent) : null,
  rapPrice: row.rapPrice != null ? Number(row.rapPrice) : null,
  fancyIntensity: cleanStr(row.fancyIntensity),
  fancyColor: cleanStr(row.fancyColor),
  fancyOvertone: cleanStr(row.fancyOvertone),
  box: cleanStr(row.box),
  ratio: row.ratio != null && row.ratio !== '' ? Number(row.ratio) : null,
  stones: row.stones != null ? Number(row.stones) : null,
});

/* ============================================================
   Validation Rules
   ============================================================ */

const STONE_RULES = [
  { id: 'missingImage',    label: 'Missing Image',        severity: 'critical', test: (s) => isEmpty(s.imageUrl) },
  { id: 'missingVideo',    label: 'Missing Video',        severity: 'critical', test: (s) => isEmpty(s.videoUrl) },
  { id: 'missingCert',     label: 'Missing Certificate',  severity: 'critical', test: (s) => isEmpty(s.certificateUrl) && isEmpty(s.certificateNumber) },
  { id: 'missingPrice',    label: 'Missing Price',        severity: 'critical', test: (s) => isEmpty(s.priceTotal) && isEmpty(s.pricePerCt) },
  { id: 'missingWeight',   label: 'Missing Weight',       severity: 'critical', test: (s) => isEmpty(s.weightCt) },
  { id: 'missingLab',      label: 'Missing Lab',          severity: 'warning',  test: (s) => isEmpty(s.lab) && (s.priceTotal || 0) >= 3000 },
  { id: 'missingOrigin',   label: 'Missing Origin',       severity: 'warning',  test: (s) => isEmpty(s.origin) },
  { id: 'missingMeasure',  label: 'Missing Measurements', severity: 'warning',  test: (s) => isEmpty(s.measurements) },
  { id: 'missingColor',    label: 'Missing Color',        severity: 'warning',  test: (s) => isEmpty(s.color) },
  { id: 'missingClarity',  label: 'Missing Clarity',      severity: 'info',     test: (s) => isEmpty(s.clarity) },
  { id: 'unknownCategory', label: 'Unknown Category',     severity: 'info',     test: (s) => getMappedCategories(s.category).includes('Empty') },
];

const JEWELRY_RULES = [
  { id: 'missingImage',       label: 'Missing Images',           severity: 'critical', test: (s) => isEmpty(s.imageUrl) && (!s.allImages || s.allImages.length === 0) },
  { id: 'missingVideo',       label: 'Missing Video',            severity: 'critical', test: (s) => isEmpty(s.videoLink) },
  { id: 'missingCert',        label: 'Missing Certificate',      severity: 'critical', test: (s) => isEmpty(s.certificateLink) && isEmpty(s.certificateNumber) },
  { id: 'missingPrice',       label: 'Missing Price',            severity: 'critical', test: (s) => isEmpty(s.priceTotal) },
  { id: 'missingTitle',       label: 'Missing Title',            severity: 'warning',  test: (s) => isEmpty(s.title) },
  { id: 'missingCenterStone', label: 'Missing Center Stone Info',severity: 'warning',  test: (s) => isEmpty(s.centerStoneCarat) && isEmpty(s.stoneType) },
  { id: 'missingMetal',       label: 'Missing Metal Type',       severity: 'warning',  test: (s) => isEmpty(s.metalType) },
  { id: 'missingJewWeight',   label: 'Missing Jewelry Weight',   severity: 'info',     test: (s) => isEmpty(s.jewelryWeight) },
  { id: 'missingCollection',  label: 'Missing Collection',       severity: 'info',     test: (s) => isEmpty(s.collection) },
];

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-red-200',    label: 'Critical' },
  warning:  { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  border: 'border-amber-200',  label: 'Warning' },
  info:     { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',   border: 'border-blue-200',   label: 'Info' },
};

/* ============================================================
   Helpers
   ============================================================ */

const classifyStone = (stone) => {
  const cats = getMappedCategories(stone.category);
  if (cats.includes('Diamond')) return 'diamond';
  return 'gemstone';
};

const validateItem = (item, rules) => {
  const issues = [];
  rules.forEach((rule) => {
    if (rule.test(item)) issues.push(rule);
  });
  return issues;
};

const buildIssueStats = (items, rules) => {
  const counts = {};
  rules.forEach((r) => { counts[r.id] = 0; });
  let withIssues = 0;
  items.forEach((item) => {
    const issues = validateItem(item, rules);
    if (issues.length > 0) withIssues++;
    issues.forEach((iss) => { counts[iss.id]++; });
  });
  return { counts, withIssues, total: items.length };
};

const checkDuplicateSkus = (items) => {
  const seen = {};
  const dupes = [];
  items.forEach((item) => {
    const sku = item.sku;
    if (!sku) return;
    if (seen[sku]) {
      if (seen[sku] === 1) dupes.push(sku);
      seen[sku]++;
    } else {
      seen[sku] = 1;
    }
  });
  return dupes;
};

const checkBrokenPairs = (stones) => {
  const allSkus = new Set(stones.map((s) => s.sku).filter(Boolean));
  return stones.filter((s) => s.pairSku && !allSkus.has(s.pairSku));
};

/* ============================================================
   HBarChart (reusable, same as Dashboard)
   ============================================================ */

const HBarChart = ({ data, colorClass = 'bg-emerald-500' }) => {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-stone-500 w-40 truncate text-right">{d.label}</span>
          <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(d.value / maxVal) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className={`h-full rounded-full ${d.color || colorClass} flex items-center justify-end pr-2`}
            >
              {d.value > 0 && <span className="text-[10px] font-bold text-white">{d.value}</span>}
            </motion.div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ============================================================
   QAPage Component
   ============================================================ */

const QAPage = () => {
  const [loading, setLoading] = useState(true);
  const [stones, setStones] = useState([]);
  const [jewelryItems, setJewelryItems] = useState([]);
  const [activeTab, setActiveTab] = useState('diamonds');
  const [groupingFilter, setGroupingFilter] = useState('all');
  const [issueFilter, setIssueFilter] = useState(new Set());
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('issues');
  const [sortDir, setSortDir] = useState('desc');
  const [priceMode, setPriceMode] = useState('neto');

  const displayPrice = (val) => {
    if (!val) return null;
    const n = Number(val);
    if (!n) return null;
    return priceMode === 'neto' ? Math.round(n / 2) : Math.round(n);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [stonesRes, jewelryRes] = await Promise.all([
        fetch(`${API_BASE}/api/soap-stones`),
        fetch(`${API_BASE}/api/jewelry`),
      ]);
      const stonesData = await stonesRes.json();
      const jewelryData = await jewelryRes.json();
      setStones((Array.isArray(stonesData.stones) ? stonesData.stones : []).map(normalizeStone));

      const jwl = (jewelryData.jewelry || []).map((row, idx) => {
        const images = (row.all_pictures_link || '').split(';').map((u) => u.trim()).filter((u) => u && !JUNK_VALUES.has(u.toLowerCase()));
        return {
          id: `jwl_${idx}_${row.model_number || idx}`,
          sku: row.model_number || '',
          title: cleanStr(row.title),
          jewelryType: cleanStr(row.jewelry_type),
          collection: cleanStr(row.collection),
          priceTotal: row.price || 0,
          imageUrl: images[0] || null,
          allImages: images,
          videoLink: cleanStr(row.video_link),
          certificateLink: cleanStr(row.certificate_link),
          certificateNumber: cleanStr(row.certificate_number),
          jewelryWeight: cleanStr(row.jewelry_weight),
          weightCt: row.total_carat || 0,
          stoneType: cleanStr(row.stone_type)?.replace(/\s+O$/i, '').trim() || null,
          centerStoneCarat: row.center_stone_carat || 0,
          metalType: cleanStr(row.metal_type),
          category: 'Jewelry',
        };
      });
      setJewelryItems(jwl);
    } catch (err) {
      console.error('QA fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const diamonds = useMemo(() => stones.filter((s) => classifyStone(s) === 'diamond'), [stones]);
  const gemstones = useMemo(() => stones.filter((s) => classifyStone(s) === 'gemstone'), [stones]);

  const currentItems = useMemo(() => {
    let items;
    if (activeTab === 'diamonds') items = diamonds;
    else if (activeTab === 'gemstones') items = gemstones;
    else items = jewelryItems;

    if (activeTab !== 'jewelry' && groupingFilter !== 'all') {
      items = items.filter((s) => {
        const gt = (s.groupingType || '').toLowerCase();
        if (groupingFilter === 'single') return gt === 'single' || gt === '' || !gt;
        return gt === groupingFilter;
      });
    }
    return items;
  }, [activeTab, diamonds, gemstones, jewelryItems, groupingFilter]);

  const currentRules = activeTab === 'jewelry' ? JEWELRY_RULES : STONE_RULES;

  const issueStats = useMemo(() => buildIssueStats(currentItems, currentRules), [currentItems, currentRules]);

  const duplicateSkus = useMemo(() => checkDuplicateSkus([...stones, ...jewelryItems]), [stones, jewelryItems]);
  const brokenPairs = useMemo(() => checkBrokenPairs(stones), [stones]);

  const itemsWithIssues = useMemo(() => {
    return currentItems
      .map((item) => ({ item, issues: validateItem(item, currentRules) }))
      .filter((entry) => entry.issues.length > 0);
  }, [currentItems, currentRules]);

  const filteredItems = useMemo(() => {
    let result = itemsWithIssues;
    if (issueFilter.size > 0) {
      result = result.filter((entry) => entry.issues.some((iss) => issueFilter.has(iss.id)));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((entry) => entry.item.sku?.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'issues') { aVal = a.issues.length; bVal = b.issues.length; }
      else if (sortField === 'sku') { aVal = a.item.sku || ''; bVal = b.item.sku || ''; }
      else if (sortField === 'weight') { aVal = a.item.weightCt || 0; bVal = b.item.weightCt || 0; }
      else if (sortField === 'price') { aVal = a.item.priceTotal || 0; bVal = b.item.priceTotal || 0; }
      else { aVal = a.issues.length; bVal = b.issues.length; }
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [itemsWithIssues, issueFilter, search, sortField, sortDir]);

  const chartData = useMemo(() => {
    return currentRules
      .map((rule) => ({
        label: rule.label,
        value: issueStats.counts[rule.id] || 0,
        color: rule.severity === 'critical' ? 'bg-red-500' : rule.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-400',
      }))
      .sort((a, b) => b.value - a.value);
  }, [currentRules, issueStats]);

  const severityCounts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 };
    currentRules.forEach((rule) => {
      c[rule.severity] += issueStats.counts[rule.id] || 0;
    });
    return c;
  }, [currentRules, issueStats]);

  const completenessScore = useMemo(() => {
    if (currentItems.length === 0) return 100;
    const totalFields = currentRules.length * currentItems.length;
    let filledFields = totalFields;
    currentItems.forEach((item) => {
      currentRules.forEach((rule) => {
        if (rule.test(item)) filledFields--;
      });
    });
    return Math.round((filledFields / totalFields) * 100);
  }, [currentItems, currentRules]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  const toggleIssueFilter = (id) => {
    setIssueFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    const headers = ['SKU', 'Category', 'Issues', 'Weight', 'Price'];
    const rows = filteredItems.map((e) => [
      e.item.sku || '',
      activeTab,
      e.issues.map((i) => i.label).join('; '),
      e.item.weightCt || '',
      displayPrice(e.item.priceTotal) || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa_issues_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDnaLink = (item) => {
    if (activeTab === 'jewelry') return `/jewelry/${item.sku}`;
    return `/${item.sku}`;
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-primary-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
          </div>
          <p className="text-stone-500 font-medium">Scanning data quality...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-800 mb-1">Data Quality</h1>
        <p className="text-stone-500">Scan and fix missing or incomplete data across your inventory</p>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-4 border-b border-stone-200 mb-6">
        {[
          { id: 'diamonds', label: 'Diamonds', count: diamonds.length },
          { id: 'gemstones', label: 'Gemstones', count: gemstones.length },
          { id: 'jewelry', label: 'Jewelry', count: jewelryItems.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setGroupingFilter('all'); setIssueFilter(new Set()); setSearch(''); }}
            className={`pb-2.5 text-sm font-medium transition-all flex items-center gap-1.5 border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-stone-800 text-stone-900'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${
              activeTab === tab.id ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-400'
            }`}>{tab.count.toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* Grouping Type Filter (stones only) */}
      {activeTab !== 'jewelry' && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-medium text-stone-400 uppercase tracking-wider mr-1">Grouping:</span>
          {[
            { id: 'all', label: 'All' },
            { id: 'single', label: 'Single' },
            { id: 'pair', label: 'Pair' },
            { id: 'parcel', label: 'Parcel' },
            { id: 'set', label: 'Set' },
          ].map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupingFilter(g.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                groupingFilter === g.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <SummaryCard label="Total Items" value={issueStats.total} icon={
          <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
        } />
        <SummaryCard
          label="With Issues"
          value={issueStats.withIssues}
          subtitle={issueStats.total > 0 ? `${Math.round((issueStats.withIssues / issueStats.total) * 100)}%` : '0%'}
          className={issueStats.withIssues > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'}
          icon={
            issueStats.withIssues > 0
              ? <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              : <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          }
        />
        <SummaryCard label="Critical" value={severityCounts.critical} className="border-red-200" icon={<div className="w-3 h-3 rounded-full bg-red-500" />} />
        <SummaryCard label="Warning" value={severityCounts.warning} className="border-amber-200" icon={<div className="w-3 h-3 rounded-full bg-amber-500" />} />
        <SummaryCard
          label="Completeness"
          value={`${completenessScore}%`}
          icon={
            <div className="w-8 h-8 relative">
              <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" stroke="#e7e5e4" />
                <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" stroke={completenessScore > 80 ? '#10b981' : completenessScore > 50 ? '#f59e0b' : '#ef4444'}
                  strokeDasharray={`${completenessScore} ${100 - completenessScore}`} strokeLinecap="round" />
              </svg>
            </div>
          }
        />
      </div>

      {/* Integrity Alerts */}
      {(duplicateSkus.length > 0 || brokenPairs.length > 0) && (
        <div className="mb-6 space-y-3">
          {duplicateSkus.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-50 border border-orange-200">
              <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              <div>
                <p className="text-sm font-medium text-orange-800">Duplicate SKUs detected ({duplicateSkus.length})</p>
                <p className="text-xs text-orange-600 mt-1">{duplicateSkus.slice(0, 10).join(', ')}{duplicateSkus.length > 10 ? ` +${duplicateSkus.length - 10} more` : ''}</p>
              </div>
            </div>
          )}
          {brokenPairs.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-50 border border-purple-200">
              <svg className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              <div>
                <p className="text-sm font-medium text-purple-800">Broken pair references ({brokenPairs.length})</p>
                <p className="text-xs text-purple-600 mt-1">Stones referencing non-existent pair SKUs: {brokenPairs.slice(0, 5).map((s) => s.sku).join(', ')}{brokenPairs.length > 5 ? ` +${brokenPairs.length - 5} more` : ''}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Issue Breakdown Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass rounded-2xl border border-stone-200/50 p-6">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-4">Issue Breakdown</h2>
          <HBarChart data={chartData} />
        </div>

        {/* Issue Filters */}
        <div className="glass rounded-2xl border border-stone-200/50 p-6">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-4">Filter by Issue</h2>
          <div className="space-y-2">
            {currentRules.map((rule) => {
              const count = issueStats.counts[rule.id] || 0;
              const sev = SEVERITY_CONFIG[rule.severity];
              return (
                <button
                  key={rule.id}
                  onClick={() => toggleIssueFilter(rule.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    issueFilter.has(rule.id) ? `${sev.bg} ${sev.text} ${sev.border} border` : 'hover:bg-stone-100 text-stone-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${sev.dot}`} />
                    {rule.label}
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${count > 0 ? `${sev.bg} ${sev.text}` : 'bg-stone-100 text-stone-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
            {issueFilter.size > 0 && (
              <button onClick={() => setIssueFilter(new Set())} className="text-xs text-stone-400 hover:text-stone-600 mt-2 w-full text-center">
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Issue Table */}
      <div className="glass rounded-2xl border border-stone-200/50 overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-stone-200/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-stone-700">
              Items with Issues
              <span className="ml-2 text-xs font-normal text-stone-400">({filteredItems.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPriceMode(priceMode === 'neto' ? 'bruto' : 'neto')}
              className={`px-2.5 py-2 text-xs font-bold rounded-lg border transition-colors ${
                priceMode === 'bruto'
                  ? 'bg-amber-100 border-amber-300 text-amber-700'
                  : 'bg-emerald-100 border-emerald-300 text-emerald-700'
              }`}
              title={priceMode === 'neto' ? 'Showing Neto prices (click for Bruto)' : 'Showing Bruto prices (click for Neto)'}
            >
              {priceMode === 'neto' ? 'N' : 'B'}
            </button>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 w-48"
              />
            </div>
            <button
              onClick={exportCSV}
              className="px-3 py-2 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-200/50">
                <SortableHeader field="sku" label="SKU" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase">Issues</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase">Image</th>
                <SortableHeader field="weight" label="Weight" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader field="price" label="Price" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader field="issues" label="# Issues" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <AnimatePresence>
                {filteredItems.slice(0, 100).map(({ item, issues }) => (
                  <motion.tr
                    key={item.id || item.sku}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-stone-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openInBarak(item.sku)}
                        className="text-sm font-medium text-emerald-700 hover:text-emerald-900 font-mono hover:underline cursor-pointer transition-colors"
                        title="Copy SKU & open Barak"
                      >
                        {item.sku || '-'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {issues.map((iss) => {
                          const sev = SEVERITY_CONFIG[iss.severity];
                          return (
                            <span key={iss.id} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sev.bg} ${sev.text}`}>
                              {iss.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300 text-[10px]">N/A</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-600">{item.weightCt ? `${item.weightCt} ct` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-stone-600">{displayPrice(item.priceTotal) ? `$${displayPrice(item.priceTotal).toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        issues.length >= 3 ? 'bg-red-100 text-red-700' : issues.length === 2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {issues.length}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openInBarak(item.sku)}
                          className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-400 hover:text-orange-700 transition-colors"
                          title="Open in Barak"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </button>
                        <a
                          href={getDnaLink(item)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
                          title="View DNA"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                        <Link
                          to={`/inventory?search=${encodeURIComponent(item.sku)}`}
                          className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
                          title="Find in Inventory"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="py-16 text-center">
              <svg className="w-12 h-12 text-green-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-stone-500 font-medium">No issues found</p>
              <p className="text-sm text-stone-400 mt-1">All items pass the selected checks</p>
            </div>
          )}
          {filteredItems.length > 100 && (
            <div className="py-3 text-center text-xs text-stone-400 border-t border-stone-100">
              Showing first 100 of {filteredItems.length} items. Use filters or search to narrow down.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   Sub-components
   ============================================================ */

const SummaryCard = ({ label, value, subtitle, icon, className = '' }) => (
  <div className={`glass rounded-2xl border border-stone-200/50 p-4 ${className}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-stone-500 uppercase tracking-wider">{label}</span>
      {icon}
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold text-stone-800">{value}</span>
      {subtitle && <span className="text-sm text-stone-400">{subtitle}</span>}
    </div>
  </div>
);

const SortableHeader = ({ field, label, sortField, sortDir, onSort }) => (
  <th
    className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase cursor-pointer hover:text-stone-700 transition-colors select-none"
    onClick={() => onSort(field)}
  >
    <div className="flex items-center gap-1">
      {label}
      {sortField === field && (
        <svg className={`w-3 h-3 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )}
    </div>
  </th>
);

export default QAPage;
