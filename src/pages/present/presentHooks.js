import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchSoapStones } from "../../services/stonesApi";
import { API_BASE } from "../inventory/helpers/constants";
import {
  normalizeCatalogJewelry,
  normalizeStone,
  normalizeWorkshopJewelry,
} from "../inventory/model/inventoryModel";
import { fetchPresentation } from "../../services/presentationsApi";
import { missingSkus, parseItemsParam, pickItems, recallItems } from "./presentModel";

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

/* The live inventory behind a list of references, only the halves it needs. */
export const loadCatalog = (user, { stones = true, jewelry = true } = {}) =>
  Promise.all([
    stones
      ? fetchSoapStones({ id: user?.id, email: user?.primaryEmailAddress?.emailAddress, name: user?.fullName }).then(
          (data) => (Array.isArray(data?.stones) ? data.stones : Array.isArray(data) ? data : []).map(normalizeStone)
        )
      : [],
    jewelry ? loadJewelry(user?.id) : [],
  ]).then(([s, j]) => ({ stones: s, jewelry: j }));

/* Items handed over from Inventory appear instantly; a shared link or a saved
 * presentation loads them. A null param means "not known yet": keep waiting. */
export const usePresentationItems = (param) => {
  const { user, isLoaded } = useUser();
  const [state, setState] = useState(() => {
    const items = param == null ? null : recallItems(param);
    return items
      ? { param, items, missing: [], loading: false, error: "" }
      : { param: null, items: [], missing: [], loading: true, error: "" };
  });

  useEffect(() => {
    if (param == null || state.param === param || !isLoaded) return undefined;
    const done = (items, missing = [], error = "") => setState({ param, items, missing, loading: false, error });
    const recalled = recallItems(param);
    if (recalled) {
      done(recalled);
      return undefined;
    }
    const refs = parseItemsParam(param);
    if (!refs.length) {
      done([]);
      return undefined;
    }
    let alive = true;
    loadCatalog(user, { stones: refs.some((r) => r.kind === "stone"), jewelry: refs.some((r) => r.kind === "jewelry") })
      .then(({ stones, jewelry }) => {
        if (!alive) return;
        const items = pickItems(refs, stones, jewelry);
        done(items, missingSkus(refs, items));
      })
      .catch((err) => {
        if (alive) done([], [], err?.message || "Could not load the selection");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param, isLoaded]);

  return state;
};

/* A saved presentation (/present?p=<id>). */
export const useSavedPresentation = (id) => {
  const [state, setState] = useState({ presentation: null, error: "" });
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setState({ presentation: null, error: "" });
    fetchPresentation(id)
      .then((presentation) => alive && setState({ presentation, error: "" }))
      .catch((err) =>
        alive &&
        setState({
          presentation: null,
          error: err.status === 404 ? "This presentation was deleted, or it is private to someone else." : err.message,
        })
      );
    return () => {
      alive = false;
    };
  }, [id]);
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
