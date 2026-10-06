import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { pageContext } from "./navigation";
import AccountMenu from "./AccountMenu";

/* Where am I (breadcrumb) and who am I (account menu). */
const TopBar = () => {
  const { pathname } = useLocation();
  const { crumbs, heading } = pageContext(pathname);

  return (
    <header className="gd-topbar">
      <div className="gd-topbar-row">
        <nav className="gd-crumbs" aria-label="Breadcrumb">
          <ol>
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              if (!last) {
                return (
                  <li key={c.label} className="gd-crumb-parent">
                    <Link to={c.to}>{c.label}</Link>
                    <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
                  </li>
                );
              }
              const Tag = heading ? "h1" : "span";
              return (
                <li key={c.label} className="gd-crumb-current">
                  <Tag aria-current="page">{c.label}</Tag>
                </li>
              );
            })}
          </ol>
        </nav>
        <AccountMenu />
      </div>
    </header>
  );
};

export default TopBar;
