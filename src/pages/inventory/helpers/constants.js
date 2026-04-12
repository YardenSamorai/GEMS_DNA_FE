import { getMappedCategories } from '../../../utils/categoryMap';

export const ITEMS_PER_PAGE = 50;
export const API_BASE = process.env.REACT_APP_API_URL || 'https://gems-dna-be.onrender.com';

export const TAG_COLORS = [
  { name: "Emerald", value: "#10b981" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Red", value: "#ef4444" },
  { name: "Cyan", value: "#06b6d4" },
];

export const treatmentOptions = [
  "All treatments", "No Oil", "Insignificant", "Minor", "Moderate", "Significant",
];

export const locationOptions = [
  "All locations", "New York", "Los Angeles", "Hong Kong", "Israel",
];

export const SHAPE_TO_DNA = {
  'ASH': ['Emerald'], 'BGT': ['Baguette'], 'BGT+RD': ['Baguette', 'Round'],
  'BRIO': ['Briollete'], 'BR': ['Round'], 'CAB': ['Cabushon'], 'CAD': ['Cadilac'],
  'Carre': ['Carre'], 'CB': ['Cushion'], 'CMB': ['Cushion'], 'CSX': ['Lucida'],
  'CU': ['Cushion'], 'CU+OV': ['Cushion', 'Oval'], 'DROPS': ['Drop'],
  'EC': ['Emerald'], 'EC-CAB': ['Cabushon'], 'EC+BGT': ['Emerald', 'Baguette'],
  'EC+CU': ['Emerald', 'Cushion'], 'ECOV': ['Emerald', 'Oval'],
  'ECPS': ['Emerald', 'Pear'], 'EM': ['Emerald'], 'FAN': ['Fantasy'],
  'HD': ['High Dome'], 'HEX': ['Hexagon'], 'HM': ['Half Moon'],
  'HS': ['Heart'], 'Kite': ['Shield'], 'Lozenge': ['Lozenge'],
  'LUC': ['Lucida'], 'MIX': ['Mix'], 'MQ': ['Marquise'],
  'MQ+EC': ['Marquise', 'Emerald'], 'MQ+TPR': ['Marquise', 'Taper'],
  'Moval': ['Oval'], 'Novelty': ['Novelty'], 'Novelty BR': ['Novelty'],
  'OCT': ['Octagon'], 'OM': ['Old Mine'], 'OMB': ['Old Mine'],
  'OTHER': ['Fantasy'], 'OV': ['Oval'], 'OV Rose': ['Oval'],
  'OV-CAB': ['Cabushon'], 'OV+PS': ['Oval', 'Pear'], 'Portrait': ['Portrait'],
  'PR': ['Princess'], 'PS': ['Pear'], 'PS+CU': ['Pear', 'Cushion'],
  'PS+MQ': ['Pear', 'Marquise'], 'PS-CAB': ['Cabushon'], 'RAD': ['Radiant'],
  'RD': ['Round'], 'RD+CU': ['Round', 'Cushion'], 'RD+EC': ['Round', 'Emerald'],
  'RD+PS': ['Round', 'Pear'], 'RD+TP': ['Round', 'Taper'],
  'RD-CAB': ['Cabushon'], 'REJ': ['Rejection'], 'Rose Cut': ['Rose'],
  'Rough': ['Rough'], 'RRC': ['Rose'], 'S.Cut': ['Step'],
  'Shield': ['Shield'], 'SHI': ['Shield'], 'SQ': ['Carre'],
  'SQEC': ['Emerald'], 'STERN': ['Stern'], 'Sugar': ['Sugarloaf'],
  'TPR': ['Taper'], 'TR': ['Triangle'], 'TRI-CAB': ['Cabushon'],
  'TRPZ': ['Trapez'],
};

export const getDnaShapes = (barakShape) => {
  if (!barakShape) return [];
  return SHAPE_TO_DNA[barakShape] || SHAPE_TO_DNA[barakShape.trim()] || [barakShape];
};

export const getDisplayShape = (barakShape) => {
  const dna = getDnaShapes(barakShape);
  return dna.length > 0 ? dna[0] : barakShape || '';
};

export const LEVEL_1_SHAPES = [
  'Round', 'Emerald', 'Cushion', 'Pear', 'Oval', 'Marquise',
  'Baguette', 'Heart', 'Radiant', 'Old Mine', 'Cabushon', 'Carre',
];

export const EXTRA_BARAK_FILTERS = ['ASH', 'TPR'];
export const BARAK_DISPLAY_NAMES = { 'ASH': 'Asscher', 'TPR': 'Taper' };

export const DNA_TO_SHORT = {
  'Emerald': 'EM', 'Round': 'RD', 'Oval': 'OV', 'Pear': 'PS',
  'Cushion': 'CU', 'Marquise': 'MQ', 'Baguette': 'BGT', 'Cabushon': 'CAB',
  'Heart': 'HS', 'Carre': 'SQ', 'Old Mine': 'OM', 'Radiant': 'RAD',
  'Taper': 'TPR', 'Fantasy': 'FAN', 'Sugarloaf': 'SLF',
  'Briollete': 'BRIO', 'Cadilac': 'CAD', 'Drop': 'DROP', 'Half Moon': 'HM',
  'Hexagon': 'HEX', 'High Dome': 'HD', 'Lozenge': 'LOZ', 'Lucida': 'LUC',
  'Mix': 'MIX', 'Novelty': 'NOV', 'Octagon': 'OCT', 'Portrait': 'POR',
  'Princess': 'PR', 'Rose': 'ROSE', 'Shield': 'SHI', 'Step': 'STEP',
  'Stern': 'STERN', 'Trapez': 'TRPZ', 'Triangle': 'TR',
  'Rejection': 'REJ', 'Rough': 'RGH',
};

export const getShortShape = (dnaName) => DNA_TO_SHORT[dnaName] || dnaName;

export const getDisplayColor = (stone) => {
  const mapped = getMappedCategories(stone.category);
  if (mapped.includes('Fancy')) {
    return [stone.fancyIntensity, stone.fancyColor].filter(Boolean).join(' ') || stone.color || '';
  }
  if (mapped.includes('Diamond') || mapped.includes('Emerald')) {
    return stone.color || '';
  }
  return [stone.fancyIntensity, stone.fancyColor].filter(Boolean).join(' ') || stone.color || '';
};

export const shortTreatment = (t) => {
  if (!t) return 'N/A';
  const lower = t.toLowerCase().trim();
  if (lower === 'insignificant') return 'Ins';
  if (lower === 'insignificant to minor') return 'Ins - Min';
  if (lower === 'moderate') return 'Mod';
  if (lower === 'minor to moderate') return 'Min - Mod';
  return t;
};

// Column configurations
export const EMERALD_COLUMNS = [
  { key: "num", header: "#", width: 5 },
  { key: "sku", header: "SKU", width: 18 },
  { key: "pairSku", header: "Pair SKU", width: 18 },
  { key: "shape", header: "Shape", width: 12 },
  { key: "weight", header: "Weight (ct)", width: 12 },
  { key: "measurements", header: "Measurements", width: 20 },
  { key: "ratio", header: "Ratio", width: 8 },
  { key: "treatment", header: "Clarity", width: 18 },
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

export const DIAMOND_COLUMNS = [
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

export const FANCY_COLUMNS = [
  { key: "num", header: "#", width: 5 },
  { key: "sku", header: "SKU", width: 18 },
  { key: "pairSku", header: "Pair SKU", width: 18 },
  { key: "shape", header: "Shape", width: 12 },
  { key: "weight", header: "Weight (ct)", width: 12 },
  { key: "fancyIntensity", header: "Intensity", width: 12 },
  { key: "fancyColor", header: "Fancy Color", width: 14 },
  { key: "fancyOvertone", header: "Overtone", width: 12 },
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

export const DIAMOND_DEFAULT_COLUMNS = [
  { id: 'sku', label: 'SKU', sortField: 'sku', alwaysVisible: true },
  { id: 'img', label: 'Img' },
  { id: 'video', label: 'Video' },
  { id: 'type', label: 'Type' },
  { id: 'shape', label: 'Shape', sortField: 'shape' },
  { id: 'color', label: 'Color' },
  { id: 'clarity', label: 'Clarity' },
  { id: 'qty', label: 'Qty' },
  { id: 'weight', label: 'Weight', sortField: 'weightCt' },
  { id: 'measurements', label: 'Measurements', sortField: 'measurements' },
  { id: 'ratio', label: 'Ratio', sortField: 'ratio' },
  { id: 'lab', label: 'Lab', sortField: 'lab' },
  { id: 'fluorescence', label: 'Fluor.' },
  { id: 'ppc', label: 'PPC', sortField: 'pricePerCt' },
  { id: 'total', label: 'Total', sortField: 'priceTotal' },
  { id: 'location', label: 'Location', sortField: 'location' },
];

export const GEMSTONE_DEFAULT_COLUMNS = [
  { id: 'sku', label: 'SKU', sortField: 'sku', alwaysVisible: true },
  { id: 'img', label: 'Img' },
  { id: 'video', label: 'Video' },
  { id: 'category', label: 'Category', sortField: 'category' },
  { id: 'type', label: 'Type' },
  { id: 'shape', label: 'Shape', sortField: 'shape' },
  { id: 'treatment', label: 'Clarity', sortField: 'treatment' },
  { id: 'origin', label: 'Origin' },
  { id: 'qty', label: 'Qty' },
  { id: 'weight', label: 'Weight', sortField: 'weightCt' },
  { id: 'measurements', label: 'Measurements', sortField: 'measurements' },
  { id: 'ratio', label: 'Ratio', sortField: 'ratio' },
  { id: 'lab', label: 'Lab', sortField: 'lab' },
  { id: 'ppc', label: 'PPC', sortField: 'pricePerCt' },
  { id: 'total', label: 'Total', sortField: 'priceTotal' },
  { id: 'location', label: 'Location', sortField: 'location' },
];

export const JEWELRY_DEFAULT_COLUMNS = [
  { id: 'sku', label: 'Model', sortField: 'sku', alwaysVisible: true },
  { id: 'img', label: 'Img' },
  { id: 'video', label: 'Video' },
  { id: 'title', label: 'Title', sortField: 'title' },
  { id: 'jewelryType', label: 'Type', sortField: 'jewelryType' },
  { id: 'style', label: 'Style', sortField: 'style' },
  { id: 'collection', label: 'Collection', sortField: 'collection' },
  { id: 'stoneType', label: 'Stone', sortField: 'stoneType' },
  { id: 'weight', label: 'Carats', sortField: 'weightCt' },
  { id: 'metalType', label: 'Metal', sortField: 'metalType' },
  { id: 'total', label: 'Price', sortField: 'priceTotal' },
  { id: 'availability', label: 'Avail.', sortField: 'availability' },
];

export const DEFAULT_COLUMNS = DIAMOND_DEFAULT_COLUMNS;

export const COLUMNS_STORAGE_KEY = 'gems_dna_column_config';

export const getColumnConfig = (userId, mode = 'diamonds') => {
  const defaults = mode === 'diamonds' ? DIAMOND_DEFAULT_COLUMNS : mode === 'gemstones' ? GEMSTONE_DEFAULT_COLUMNS : JEWELRY_DEFAULT_COLUMNS;
  const storageKey = `${COLUMNS_STORAGE_KEY}_${mode}_${userId}`;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      const knownIds = new Set(defaults.map(c => c.id));
      const storedIds = new Set(parsed.map(c => c.id));
      const merged = parsed.filter(c => knownIds.has(c.id));
      defaults.forEach(col => {
        if (!storedIds.has(col.id)) {
          merged.push({ id: col.id, visible: true });
        }
      });
      return merged;
    }
  } catch {}
  return defaults.map(c => ({ id: c.id, visible: true }));
};

export const saveColumnConfig = (userId, config, mode = 'diamonds') => {
  const storageKey = `${COLUMNS_STORAGE_KEY}_${mode}_${userId}`;
  try {
    localStorage.setItem(storageKey, JSON.stringify(config));
  } catch {}
};

// Smart Search constants
export const SMART_SEARCH_SHAPES = new Set([
  ...Object.keys(SHAPE_TO_DNA).map(k => k.toUpperCase()),
  ...new Set(Object.values(SHAPE_TO_DNA).flat().map(v => v.toUpperCase())),
]);

export const SMART_SEARCH_CLARITIES = new Set([
  'FL', 'IF', 'LOUPE CLEAN', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'SI3', 'I1', 'I2', 'I3',
]);

export const SMART_SEARCH_LABS = new Set([
  'GIA', 'GRS', 'SSEF', 'GUBELIN', 'GÜBELIN', 'CDC', 'AIGS', 'AGL', 'GIT', 'LOTUS', 'CGL',
]);

export const SMART_SEARCH_CATEGORIES = new Set([
  'DIAMOND', 'EMERALD', 'RUBY', 'SAPPHIRE', 'SPINEL', 'TOURMALINE',
  'ALEXANDRITE', 'AQUAMARINE', 'GARNET', 'TANZANITE', 'TSAVORITE',
  'RUBELLITE', 'MORGANITE', 'KUNZITE', 'TOPAZ', 'OPAL', 'ONYX', 'FANCY',
]);

export const SMART_SEARCH_TREATMENTS = {
  'NO OIL': 'No Oil', 'INSIGNIFICANT': 'Insignificant',
  'MINOR': 'Minor', 'MODERATE': 'Moderate', 'SIGNIFICANT': 'Significant',
};

export const SMART_SEARCH_LOCATIONS = {
  'NEW YORK': 'New York', 'LOS ANGELES': 'Los Angeles',
  'HONG KONG': 'Hong Kong', 'ISRAEL': 'Israel',
  'NY': 'New York', 'LA': 'Los Angeles', 'HK': 'Hong Kong',
};

export const SMART_SEARCH_FANCY_COLORS = new Set([
  'YELLOW', 'GREEN', 'BLUE', 'PINK', 'RED', 'ORANGE', 'PURPLE', 'BROWN',
  'BLACK', 'GREY', 'GRAY', 'WHITE', 'VIOLET', 'TEAL', 'PADPARADSCHA',
]);

export const SMART_SEARCH_ORIGINS = new Set([
  'COLOMBIA', 'ZAMBIA', 'BRAZIL', 'ETHIOPIA', 'AFGHANISTAN', 'MADAGASCAR',
  'MOZAMBIQUE', 'BURMA', 'MYANMAR', 'SRI LANKA', 'KASHMIR', 'TANZANIA',
  'KENYA', 'PAKISTAN', 'RUSSIA', 'TAJIKISTAN', 'VIETNAM', 'THAILAND',
  'CAMBODIA', 'AUSTRALIA', 'NIGERIA', 'ZIMBABWE', 'INDIA',
]);

export const SMART_SEARCH_GROUPING = new Set([
  'SINGLE', 'PAIR', 'SET', 'PARCEL', 'SIDE STONES', 'MELEE',
]);

export const parseSmartSearch = (text) => {
  const result = {
    shapes: [], weight: null, weightRange: null, clarities: [], colors: [], categories: [],
    treatments: [], locations: [], labs: [], origins: [], skus: [],
    fancyColors: [], groupingTypes: [], pricePerCt: null, unmatched: [],
  };
  if (!text || !text.trim()) return result;

  let remaining = text.trim();

  remaining = remaining.replace(/\b(?:TC-?\d+|T\d+)\b/gi, (match) => {
    result.skus.push(match.toUpperCase());
    return ' ';
  });

  remaining = remaining.replace(/\b(\d+(?:\.\d+)?)\s*(?:pc)?\s*-\s*(\d+(?:\.\d+)?)\s*pc\b/gi, (match, min, max) => {
    result.pricePerCt = { min: parseFloat(min), max: parseFloat(max) };
    return ' ';
  });

  remaining = remaining.replace(/\b(\d+(?:\.\d+)?)\s*pc\b/gi, (match, num) => {
    if (!result.pricePerCt) {
      const val = parseFloat(num);
      result.pricePerCt = { min: val * 0.85, max: val * 1.15 };
    }
    return ' ';
  });

  remaining = remaining.replace(/\b(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:ct|carat|cts|carats)\b/gi, (match, min, max) => {
    result.weightRange = { min: parseFloat(min), max: parseFloat(max) };
    return ' ';
  });

  remaining = remaining.replace(/\b(\d+(?:\.\d+)?)\s*(?:ct|carat|cts|carats)?\b/gi, (match, num) => {
    if (!result.weight && !result.weightRange) result.weight = parseFloat(num);
    return ' ';
  });

  const multiWordSets = [
    { dict: SMART_SEARCH_TREATMENTS, target: 'treatments', isMap: true },
    { dict: SMART_SEARCH_LOCATIONS, target: 'locations', isMap: true },
  ];
  for (const { dict, target, isMap } of multiWordSets) {
    const keys = Object.keys(dict);
    for (const key of keys) {
      const regex = new RegExp('\\b' + key.replace(/\s+/g, '\\s+') + '\\b', 'gi');
      remaining = remaining.replace(regex, () => {
        result[target].push(isMap ? dict[key] : key);
        return ' ';
      });
    }
  }
  for (const origin of SMART_SEARCH_ORIGINS) {
    if (origin.includes(' ')) {
      const regex = new RegExp('\\b' + origin.replace(/\s+/g, '\\s+') + '\\b', 'gi');
      remaining = remaining.replace(regex, () => {
        result.origins.push(origin.charAt(0) + origin.slice(1).toLowerCase());
        return ' ';
      });
    }
  }
  for (const gt of SMART_SEARCH_GROUPING) {
    if (gt.includes(' ')) {
      const regex = new RegExp('\\b' + gt.replace(/\s+/g, '\\s+') + '\\b', 'gi');
      remaining = remaining.replace(regex, () => {
        result.groupingTypes.push(gt.charAt(0) + gt.slice(1).toLowerCase());
        return ' ';
      });
    }
  }

  const tokens = remaining.split(/[\s,]+/).filter(t => t.length > 0);
  const deferred = [];
  let pureShapeCount = 0;
  let pureCategoryCount = 0;

  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (['SHAPE', 'COLOR', 'CUT', 'STONE', 'GEM', 'GEMSTONE', 'THE', 'AND', 'WITH', 'CT', 'CARAT'].includes(upper)) continue;
    if (SMART_SEARCH_CLARITIES.has(upper)) { result.clarities.push(upper); continue; }
    if (SMART_SEARCH_LABS.has(upper)) { result.labs.push(upper); continue; }

    const isShape = SMART_SEARCH_SHAPES.has(upper);
    const isCategory = SMART_SEARCH_CATEGORIES.has(upper);

    if (isShape && isCategory) {
      const dnaNames = SHAPE_TO_DNA[upper] || SHAPE_TO_DNA[token];
      const shapeName = dnaNames ? dnaNames[0] : (token.charAt(0).toUpperCase() + token.slice(1).toLowerCase());
      deferred.push({ token, upper, shapeName });
      continue;
    }
    if (isShape) {
      const dnaNames = SHAPE_TO_DNA[upper] || SHAPE_TO_DNA[token];
      if (dnaNames) { result.shapes.push(...dnaNames); } else { result.shapes.push(token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()); }
      pureShapeCount++;
      continue;
    }
    if (isCategory) {
      result.categories.push(upper.charAt(0) + upper.slice(1).toLowerCase());
      pureCategoryCount++;
      continue;
    }

    if (SMART_SEARCH_TREATMENTS[upper]) { result.treatments.push(SMART_SEARCH_TREATMENTS[upper]); continue; }
    if (SMART_SEARCH_ORIGINS.has(upper)) { result.origins.push(upper.charAt(0) + upper.slice(1).toLowerCase()); continue; }
    if (SMART_SEARCH_GROUPING.has(upper)) { result.groupingTypes.push(upper.charAt(0) + upper.slice(1).toLowerCase()); continue; }
    if (SMART_SEARCH_FANCY_COLORS.has(upper)) { result.fancyColors.push(upper.charAt(0) + upper.slice(1).toLowerCase()); continue; }
    if (/^[D-Z]$/i.test(token)) { result.colors.push(upper); continue; }
    result.unmatched.push(token);
  }

  const deferredByWord = {};
  for (const item of deferred) {
    if (!deferredByWord[item.upper]) deferredByWord[item.upper] = [];
    deferredByWord[item.upper].push(item);
  }
  for (const [, items] of Object.entries(deferredByWord)) {
    const catName = items[0].upper.charAt(0) + items[0].upper.slice(1).toLowerCase();
    if (items.length >= 2) {
      result.categories.push(catName);
      result.shapes.push(items[1].shapeName);
    } else if (pureCategoryCount > 0) {
      result.shapes.push(items[0].shapeName);
    } else {
      result.categories.push(catName);
    }
  }

  result.shapes = [...new Set(result.shapes)];
  result.clarities = [...new Set(result.clarities)];
  result.colors = [...new Set(result.colors)];
  result.categories = [...new Set(result.categories)];
  result.fancyColors = [...new Set(result.fancyColors)];
  return result;
};

// Diamond color grading helpers
export const ALL_GRADES = ['D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
export const DIAMOND_COLOR_OTHER = new Set(['BR','CON','FNTY','TLB']);
export const DIAMOND_COLOR_ALIAS = { 'COL': ['D','E','F'], 'COM': ['H','I','J'] };
export const DIAMOND_FILTER_GROUPS = ['D','E','F','G','H','I','J','K','L','M','N','O-P','U-V','W-X','Y-Z','Other'];

export const GRADE_TO_GROUP = {};
'DEFGHIJKLMN'.split('').forEach(g => { GRADE_TO_GROUP[g] = g; });
['O','P'].forEach(g => { GRADE_TO_GROUP[g] = 'O-P'; });
['U','V'].forEach(g => { GRADE_TO_GROUP[g] = 'U-V'; });
['W','X'].forEach(g => { GRADE_TO_GROUP[g] = 'W-X'; });
['Y','Z'].forEach(g => { GRADE_TO_GROUP[g] = 'Y-Z'; });
['Q','R','S','T'].forEach(g => { GRADE_TO_GROUP[g] = 'Other'; });

export const getDiamondColorGroups = (color) => {
  if (!color) return [];
  const raw = color.trim().toUpperCase();
  if (DIAMOND_COLOR_OTHER.has(raw)) return ['Other'];
  const alias = DIAMOND_COLOR_ALIAS[raw];
  if (alias) return alias;
  const mainPart = raw.split(/[\s,]+/)[0].replace(/[+-]$/, '');
  const rangeMatch = mainPart.match(/^([A-Z])-([A-Z])$/);
  if (rangeMatch) {
    const start = ALL_GRADES.indexOf(rangeMatch[1]);
    const end = ALL_GRADES.indexOf(rangeMatch[2]);
    if (start !== -1 && end !== -1 && start <= end) {
      const groups = new Set();
      ALL_GRADES.slice(start, end + 1).forEach(g => groups.add(GRADE_TO_GROUP[g] || 'Other'));
      return Array.from(groups);
    }
  }
  if (mainPart.length === 1 && GRADE_TO_GROUP[mainPart]) {
    return [GRADE_TO_GROUP[mainPart]];
  }
  return ['Other'];
};

export const isDiamondColorStone = (mapped) => (mapped.includes('Diamond') || mapped.includes('Emerald')) && !mapped.includes('Fancy');

export const getBaseFancyColor = (fancyColorStr) => {
  if (!fancyColorStr) return '';
  const words = fancyColorStr.trim().split(/\s+/);
  const base = words[words.length - 1];
  if (base === 'Vivid') return 'Other';
  return base;
};
