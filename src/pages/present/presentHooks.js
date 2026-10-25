import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchSoapStones } from "../../services/stonesApi";
import { API_BASE } from "../inventory/helpers/constants";
import {
  normalizeCatalogJewelry,
  normalizeStone,
  normalizeWorkshopJewelry,
} from "../inventory/model/inventoryModel";
import { parseItemsParam, pickItems, recallItems } from "./presentModel";

const loadJewelry = async (userId) => {
  const [catalog, workshop] = await Promise.allSettled([
    fetch(`${API_BASE}/api/jewelry`).then((r) => (r.ok ? r.json() : { jewelry: [] })),
    userId
      ? fetch(`${API_BASE}/api/jewelry-items?userId=${encodeURIComponent(userId)}`).then((r) =>
          r.ok ? r.json() : { items: [] }
        )
      : Promise.resolve({ items: [] }),
  ]);
  return [
    ...(workshop.status === "fulfilled" ? workshop.value?.items || [] : []).map(normalizeWorkshopJewelry),
    ...(catalog.status === "fulfilled" ? catalog.value?.jewelry || [] : []).map(normalizeCatalogJewelry),
  ];
};

/* Items handed over from Inventory appear instantly; a shared link loads them. */
export const usePresentationItems = (param) => {
  const { user, isLoaded } = useUser();
  const [state, setState] = useState(() => {
    const items = recallItems(param);
    return items ? { items, loading: false, error: "" } : { items: [], loading: true, error: "" };
  });

  useEffect(() => {
    if (!state.loading || !isLoaded) return undefined;
    const refs = parseItemsParam(param);
    if (!refs.length) {
      setState({ items: [], loading: false, error: "" });
      return undefined;
    }
    let alive = true;
    Promise.all([
      refs.some((r) => r.kind === "stone")
        ? fetchSoapStones({ id: user?.id, email: user?.primaryEmailAddress?.emailAddress, name: user?.fullName }).then(
            (data) => (Array.isArray(data?.stones) ? data.stones : Array.isArray(data) ? data : []).map(normalizeStone)
          )
        : [],
      refs.some((r) => r.kind === "jewelry") ? loadJewelry(user?.id) : [],
    ])
      .then(([stones, jewelry]) => {
        if (alive) setState({ items: pickItems(refs, stones, jewelry), loading: false, error: "" });
      })
      .catch((err) => {
        if (alive) setState({ items: [], loading: false, error: err?.message || "Could not load the selection" });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param, isLoaded]);

  return state;
};

/* Keeps the iPad from dimming mid-presentation. Released when the tab hides
 * (the browser drops it anyway), re-acquired when it comes back. */
export const useWakeLock = () => {
  useEffect(() => {
    let lock = null;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || !navigator.wakeLock) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* denied or unsupported: the screen just follows its own timeout */
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      lock?.release?.().catch(() => {});
    };
  }, []);
};

const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);

/* iPadOS Safari only has the prefixed API; iPhone has none, so the control hides. */
export const useFullscreen = () => {
  const root = document.documentElement;
  const supported = Boolean(root.requestFullscreen || root.webkitRequestFullscreen);
  const [on, setOn] = useState(isFullscreen);

  useEffect(() => {
    const sync = () => setOn(isFullscreen());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const el = document.documentElement;
    try {
      if (isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    } catch {
      /* the browser refused; nothing to undo */
    }
  }, []);

  return { supported, on, toggle };
};
