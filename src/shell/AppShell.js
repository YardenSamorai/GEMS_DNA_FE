import React, { useEffect, useMemo } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";
import { NAV, visibleNav } from "./navigation";
import { useTheme } from "../App";
import "./shell.css";

/* The status bar takes its colour from `theme-color`. The app picks its
 * theme itself (not from the OS), so the per-scheme tags in index.html can
 * be wrong here: match the top bar while the shell is mounted. */
const useStatusBarColor = (theme) => {
  useEffect(() => {
    const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    const saved = metas.map((m) => m.getAttribute("content"));
    // The provider flips data-theme in its own effect, which runs after this one.
    const raf = requestAnimationFrame(() => {
      const rgb = getComputedStyle(document.documentElement).getPropertyValue("--app-canvas").trim();
      if (rgb) metas.forEach((m) => m.setAttribute("content", `rgb(${rgb.split(/\s+/).join(", ")})`));
    });
    return () => {
      cancelAnimationFrame(raf);
      metas.forEach((m, i) => m.setAttribute("content", saved[i]));
    };
  }, [theme]);
};

/* Sidebar + top bar + content for the signed-in app.
 *
 * Phones pin the shell to the viewport and scroll <main> instead of the
 * document: iOS Safari strands `position: fixed` bars mid-screen during
 * momentum scroll of the document, never of an inner container. From
 * 768px the document scrolls and the sidebar and top bar are sticky. */
const AppShell = ({ access, children }) => {
  const nav = useMemo(() => visibleNav(NAV, access), [access]);
  const { theme } = useTheme();
  useStatusBarColor(theme);
  return (
    <div className="gd gd-shell flex h-[100dvh] overflow-hidden md:h-auto md:min-h-screen md:overflow-visible">
      <a href="#main" className="gd-skip">Skip to content</a>
      <Sidebar nav={nav} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar />
        <main
          id="main"
          tabIndex={-1}
          className="gd-main flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain md:overflow-visible"
        >
          {children}
        </main>
      </div>
      <MobileNav nav={NAV} access={access} />
    </div>
  );
};

export default AppShell;
