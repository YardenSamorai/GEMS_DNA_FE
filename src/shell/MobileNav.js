import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Ellipsis } from "lucide-react";
import Sheet from "../pages/inventory/ui/Sheet";
import { flatItems, mobileNav, SALES_TABS } from "./navigation";
import { NavIcon } from "./icons";

const NON_TEXT_INPUTS = ["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"];
const isEditable = (el) => {
  if (!el) return false;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName === "INPUT") return !NON_TEXT_INPUTS.includes((el.getAttribute("type") || "text").toLowerCase());
  return el.isContentEditable;
};

/* The on-screen keyboard would push a fixed bar up over the field, so the
 * bars step aside while a text field has focus. */
const useTyping = () => {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const onIn = (e) => { if (isEditable(e.target)) setTyping(true); };
    const onOut = () => setTimeout(() => { if (!isEditable(document.activeElement)) setTyping(false); }, 0);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return typing;
};

const Tab = ({ to, icon, label, active, onClick, expanded }) => {
  const body = (
    <>
      <span className="gd-tab-icon">{icon}</span>
      <span className="gd-tab-label">{label}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="gd-tab" aria-current={active ? "page" : undefined}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className="gd-tab" data-active={active || undefined} aria-haspopup="dialog" aria-expanded={expanded} onClick={onClick}>
      {body}
    </button>
  );
};

const MobileNav = ({ nav, access }) => {
  const { pathname } = useLocation();
  const typing = useTyping();
  const [moreOpen, setMoreOpen] = useState(false);
  const { tabs, more, inSales } = useMemo(() => mobileNav(nav, pathname, access), [nav, pathname, access]);

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const moreActive = flatItems(more).some((it) => it.match(pathname));
  const categories = SALES_TABS.filter((t) => t.id !== "sales-home");

  return (
    <>
      <nav className="gd-tabbar" data-hidden={typing || undefined} aria-label="Primary">
        <div className="gd-tabbar-row">
          {tabs.map((t) => (
            <Tab
              key={t.id}
              to={t.to}
              icon={<NavIcon name={t.icon} size={24} />}
              label={t.label}
              active={t.match(pathname)}
            />
          ))}
          {more.length > 0 && (
            <Tab
              icon={<Ellipsis size={24} strokeWidth={1.75} aria-hidden="true" />}
              label="More"
              active={moreActive || moreOpen}
              expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
            />
          )}
        </div>
      </nav>

      {/* Tablets get the icon rail, so the catalog categories stay one tap away here. */}
      {inSales && access.can("sales") && (
        <nav className="gd-catbar" data-hidden={typing || undefined} aria-label="Sales categories">
          {categories.map((t) => (
            <Link key={t.id} to={t.to} className="gd-cat" aria-current={t.match(pathname) ? "page" : undefined}>
              <NavIcon name={t.icon} size={18} />
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      <Sheet open={moreOpen} variant="bottom" title="More" titleId="gd-more-title" onClose={() => setMoreOpen(false)}>
        <div className="gd gd-more">
          {more.map((group) => (
            <section key={group.id} className="gd-more-group" aria-label={group.label || "Sections"}>
              {group.label && <h3 className="gd-more-label">{group.label}</h3>}
              <ul className="gd-more-list">
                {group.items.map((it) => {
                  const active = it.match(pathname);
                  return (
                    <li key={it.id}>
                      <Link to={it.to} className="gd-more-row" aria-current={active ? "page" : undefined}>
                        <span className="gd-more-icon"><NavIcon name={it.icon} size={20} /></span>
                        <span className="gd-more-text">{it.label}</span>
                        {active && <Check size={18} strokeWidth={2} className="gd-more-check" aria-hidden="true" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </Sheet>
    </>
  );
};

export default MobileNav;
