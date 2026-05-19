import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * RouteLoadingContext — opt-in registry that lets the route transition
 * overlay know when a destination page is still fetching its data.
 *
 * Usage from a page:
 *   const isLoading = !user || stillFetchingSomething;
 *   useRouteLoading(isLoading);
 *
 * Multiple components can report loading simultaneously — the overlay
 * stays visible while the internal counter is > 0. The hook releases
 * its slot automatically on unmount or when `isLoading` flips to false.
 */
const RouteLoadingContext = createContext({
  isLoading: false,
  beginLoad: () => () => {},
});

export const RouteLoadingProvider = ({ children }) => {
  const [counter, setCounter] = useState(0);
  const beginLoad = useCallback(() => {
    setCounter((n) => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setCounter((n) => Math.max(0, n - 1));
    };
  }, []);
  return (
    <RouteLoadingContext.Provider value={{ isLoading: counter > 0, beginLoad }}>
      {children}
    </RouteLoadingContext.Provider>
  );
};

/**
 * useRouteLoading(isLoading) — call from a page with its boolean
 * loading state. While true, the global overlay stays visible. Toggling
 * to false or unmounting releases the slot.
 */
export const useRouteLoading = (isLoading) => {
  const { beginLoad } = useContext(RouteLoadingContext);
  useEffect(() => {
    if (!isLoading) return undefined;
    return beginLoad();
  }, [isLoading, beginLoad]);
};

export const useIsRouteLoading = () => useContext(RouteLoadingContext).isLoading;
