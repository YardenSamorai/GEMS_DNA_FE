import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * RequestBasketContext — a tiny store for the "items I want to request a memo for".
 *
 * This is the equivalent of a shopping cart on the store-portal side. It's
 * intentionally lightweight — items are kept in memory + localStorage so a
 * full page refresh doesn't lose the basket while the store user is browsing.
 *
 * Items are keyed by a stable composite (kind + sku) so attempting to add the
 * same SKU twice is a no-op.
 */
const STORAGE_KEY = "gems_portal_request_basket_v1";

const Ctx = createContext({
  items: [],
  count: 0,
  add: () => {},
  remove: () => {},
  clear: () => {},
  has: () => false,
  toggle: () => {},
});

const keyFor = (item) => `${item?.kind || "stone"}::${item?.sku || ""}::${item?.id || ""}`;

function loadInitial() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function RequestBasketProvider({ children }) {
  const [items, setItems] = useState(loadInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_) {}
  }, [items]);

  const add = useCallback((item) => {
    if (!item || (!item.sku && !item.id)) return;
    setItems((prev) => {
      const k = keyFor(item);
      if (prev.some((p) => keyFor(p) === k)) return prev;
      return [...prev, { ...item, _addedAt: Date.now() }];
    });
  }, []);

  const remove = useCallback((item) => {
    if (!item) return;
    const k = keyFor(item);
    setItems((prev) => prev.filter((p) => keyFor(p) !== k));
  }, []);

  const has = useCallback(
    (item) => items.some((p) => keyFor(p) === keyFor(item)),
    [items]
  );

  const toggle = useCallback((item) => {
    setItems((prev) => {
      const k = keyFor(item);
      if (prev.some((p) => keyFor(p) === k)) return prev.filter((p) => keyFor(p) !== k);
      return [...prev, { ...item, _addedAt: Date.now() }];
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, count: items.length, add, remove, clear, has, toggle }),
    [items, add, remove, clear, has, toggle]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRequestBasket = () => useContext(Ctx);
