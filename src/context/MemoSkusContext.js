import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchActiveMemoSkus } from "../services/memosApi";

/**
 * MemoSkusContext — provides a workspace-wide map of SKUs currently
 * sitting on an active (out / partially_returned) memo. Inventory views
 * subscribe to this so each row can show an "On Memo" chip without
 * issuing one query per row. Refreshed on mount + every 60s + manually
 * after the user issues / closes a memo.
 */
const Ctx = createContext({
  byStoneSku: {},
  byJewelrySku: {},
  ready: false,
  refresh: () => {},
});

export function MemoSkusProvider({ children }) {
  const { user } = useUser();
  const [maps, setMaps] = useState({ byStoneSku: {}, byJewelrySku: {}, ready: false });
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await fetchActiveMemoSkus(user.id);
      if (!aliveRef.current) return;
      setMaps({
        byStoneSku:   data?.byStoneSku   || {},
        byJewelrySku: data?.byJewelrySku || {},
        ready: true,
      });
    } catch (_) {
      // Don't break the page over a memo lookup — the chip is non-critical.
      if (!aliveRef.current) return;
      setMaps((prev) => ({ ...prev, ready: true }));
    }
  }, [user?.id]);

  useEffect(() => {
    aliveRef.current = true;
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => { aliveRef.current = false; clearInterval(id); };
  }, [refresh]);

  return (
    <Ctx.Provider value={{ ...maps, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMemoSkus = () => useContext(Ctx);

/**
 * Lookup helper. Pass a SKU and (optionally) a hint about whether it's
 * a stone or jewelry. Returns null if the item isn't on a memo, or
 * { memoId, memoNumber, companyId, companyName } if it is.
 */
export const useMemoForSku = (sku, type = "auto") => {
  const { byStoneSku, byJewelrySku } = useMemoSkus();
  if (!sku) return null;
  if (type === "stone")   return byStoneSku[sku]   || null;
  if (type === "jewelry") return byJewelrySku[sku] || null;
  return byStoneSku[sku] || byJewelrySku[sku] || null;
};
