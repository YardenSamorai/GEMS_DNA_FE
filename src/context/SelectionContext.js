import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/* ============================================================================
 * SelectionContext — a cross-category "pick list" of stones.
 *
 * This is NOT a shopping cart: it's a lightweight way for a salesperson to
 * cherry-pick stones from any catalog (diamonds / emeralds / gemstones) while
 * browsing, then review the whole set in one place. The chosen stones are kept
 * in localStorage so the list survives navigation between category pages and a
 * full page reload.
 * ========================================================================== */

const STORAGE_KEY = "salesSelection:v1";

const SelectionContext = createContext(null);

// Stable identity for a stone — SKU first, falling back to the DB id.
const stoneKey = (s) => String(s?.sku ?? s?.id ?? "").trim();

export const SelectionProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });

  // Persist on every change so the pick list is durable, not momentary.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable (private mode / quota) — non-fatal */
    }
  }, [items]);

  const isSelected = useCallback(
    (stone) => {
      const k = stoneKey(stone);
      return !!k && items.some((s) => stoneKey(s) === k);
    },
    [items]
  );

  const toggle = useCallback((stone) => {
    const k = stoneKey(stone);
    if (!k) return;
    setItems((prev) =>
      prev.some((s) => stoneKey(s) === k)
        ? prev.filter((s) => stoneKey(s) !== k)
        : [...prev, stone]
    );
  }, []);

  const remove = useCallback((stone) => {
    const k = stoneKey(stone);
    if (!k) return;
    setItems((prev) => prev.filter((s) => stoneKey(s) !== k));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, count: items.length, isSelected, toggle, remove, clear }),
    [items, isSelected, toggle, remove, clear]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
};

export const useSelection = () => {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return ctx;
};
