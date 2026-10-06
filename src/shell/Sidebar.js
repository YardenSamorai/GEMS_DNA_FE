import React, { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import BrandMark from "../components/BrandMark";
import { useDismiss, useMediaQuery } from "../design/hooks";
import { activeChild } from "./navigation";
import { NavIcon } from "./icons";

const COLLAPSED_KEY = "sidebar-collapsed";
const EXPANDED_KEY = "sidebar-expanded-sections";

const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
};
const readExpanded = () => {
  try { return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) || "[]")); } catch { return new Set(); }
};

const Tip = ({ show, children }) => (show ? <span className="gd-tip" aria-hidden="true">{children}</span> : null);

const NavLeaf = ({ item, active, rail }) => (
  <Link to={item.to} className="gd-item" aria-current={active ? "page" : undefined}>
    <span className="gd-item-icon"><NavIcon name={item.icon} /></span>
    <span className="gd-item-label">{item.label}</span>
    <Tip show={rail}>{item.label}</Tip>
  </Link>
);

/* A parent with children. Expanded sidebar: an inline disclosure. Icon rail:
 * a small popover anchored to the icon. */
const NavGroup = ({ item, path, rail, open, onToggle }) => {
  const child = activeChild(item, path);
  const within = item.match(path);
  const listId = useId();
  const [popOpen, setPopOpen] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useDismiss(popOpen, (reason) => {
    setPopOpen(false);
    if (reason === "escape") btnRef.current?.focus();
  }, [btnRef, popRef]);

  useEffect(() => { setPopOpen(false); }, [path, rail]);

  useEffect(() => {
    if (popOpen) popRef.current?.querySelector("a")?.focus();
  }, [popOpen]);

  const onPopKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const links = Array.from(popRef.current?.querySelectorAll("a") || []);
    const i = links.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? (i + 1) % links.length : (i - 1 + links.length) % links.length;
    links[next]?.focus();
  };

  if (rail) {
    return (
      <div className="gd-group-item">
        <button
          ref={btnRef}
          type="button"
          className="gd-item"
          data-within={within || undefined}
          aria-expanded={popOpen}
          aria-controls={popOpen ? listId : undefined}
          onClick={() => setPopOpen((v) => !v)}
        >
          <span className="gd-item-icon"><NavIcon name={item.icon} /></span>
          <span className="gd-item-label">{item.label}</span>
          {!popOpen && <Tip show>{item.label}</Tip>}
        </button>
        {popOpen && (
          <div ref={popRef} id={listId} className="gd-pop" onKeyDown={onPopKey}>
            <p className="gd-pop-title">{item.label}</p>
            <ul>
              {item.children.map((c) => (
                <li key={c.id}>
                  <Link to={c.to} className="gd-pop-item" aria-current={c === child ? "page" : undefined}>
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="gd-group-item">
      <button
        type="button"
        className="gd-item"
        data-within={within || undefined}
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
      >
        <span className="gd-item-icon"><NavIcon name={item.icon} /></span>
        <span className="gd-item-label">{item.label}</span>
        <ChevronRight className="gd-item-chev" size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <ul id={listId} className="gd-sub" hidden={!open}>
        {item.children.map((c) => (
          <li key={c.id}>
            <Link to={c.to} className="gd-item gd-subitem" aria-current={c === child ? "page" : undefined}>
              <span className="gd-item-label">{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Sidebar = ({ nav }) => {
  const { pathname } = useLocation();
  const wide = useMediaQuery("(min-width: 1024px)");
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [expanded, setExpanded] = useState(readExpanded);
  // Tablets always get the icon rail; the remembered preference applies from 1024px.
  const rail = !wide || collapsed;

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSED_KEY, String(!c)); } catch {}
      return !c;
    });
  };

  const setGroup = (key, open) => {
    setExpanded((prev) => {
      if (prev.has(key) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(key); else next.delete(key);
      try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  // Entering a group's route opens it.
  useEffect(() => {
    nav.forEach((g) => g.items.forEach((it) => {
      if (it.children && it.match(pathname)) setGroup(it.label, true);
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, nav]);

  return (
    <aside className="gd-sidebar" data-rail={rail || undefined} aria-label="Sidebar">
      <div className="gd-brand">
        <Link to="/dashboard" className="gd-brand-link" aria-label="GEMS DNA — Dashboard">
          <BrandMark size={26} />
          <span className="gd-brand-name" aria-hidden="true">GEMS DNA</span>
        </Link>
      </div>

      <nav className="gd-nav" aria-label="Primary">
        {nav.map((group) => (
          <div
            key={group.id}
            className="gd-group"
            role={group.label ? "group" : undefined}
            aria-label={group.label || undefined}
          >
            {group.label && <p className="gd-group-label" aria-hidden="true">{group.label}</p>}
            <ul className="gd-list">
              {group.items.map((item) => (
                <li key={item.id}>
                  {item.children ? (
                    <NavGroup
                      item={item}
                      path={pathname}
                      rail={rail}
                      open={expanded.has(item.label)}
                      onToggle={() => setGroup(item.label, !expanded.has(item.label))}
                    />
                  ) : (
                    <NavLeaf item={item} active={item.match(pathname)} rail={rail} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {wide && (
        <div className="gd-sidebar-foot">
          <button
            type="button"
            className="gd-icon-btn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed
              ? <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden="true" />
              : <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden="true" />}
            <Tip show>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</Tip>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
