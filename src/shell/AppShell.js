import React, { useMemo } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";
import { NAV, visibleNav } from "./navigation";
import "./shell.css";

/* Sidebar + top bar + content for the signed-in app.
 *
 * Phones pin the shell to the viewport and scroll <main> instead of the
 * document: iOS Safari strands `position: fixed` bars mid-screen during
 * momentum scroll of the document, never of an inner container. From
 * 768px the document scrolls and the sidebar and top bar are sticky. */
const AppShell = ({ access, children }) => {
  const nav = useMemo(() => visibleNav(NAV, access), [access]);
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
