import React, { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useClerk } from "@clerk/clerk-react";
import { Check, ChevronDown, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useTheme } from "../App";
import { colorFromSeed, initialsFromName } from "../services/teamApi";
import { useDismiss } from "../design/hooks";
import { useIdentity } from "./useIdentity";

export const Avatar = ({ identity, size = 28 }) => {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (identity.imageUrl) {
    return <img className="gd-avatar" src={identity.imageUrl} alt="" style={style} />;
  }
  const seed = identity.member?.clerk_user_id || identity.userId || identity.name || "?";
  return (
    <span
      className="gd-avatar gd-avatar--initials"
      style={{ ...style, backgroundColor: identity.member?.avatar_color || colorFromSeed(seed) }}
      aria-hidden="true"
    >
      {initialsFromName(identity.name || identity.email || "?")}
    </span>
  );
};

const AccountMenu = () => {
  const identity = useIdentity();
  const clerk = useClerk();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const close = (refocus) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };

  useDismiss(open, (reason) => close(reason === "escape"), [btnRef, menuRef]);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (open) menuRef.current?.querySelector('[role^="menuitem"]')?.focus();
  }, [open]);

  const items = () => Array.from(menuRef.current?.querySelectorAll('[role^="menuitem"]') || []);
  const onMenuKey = (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    const go = (n) => { e.preventDefault(); list[(n + list.length) % list.length]?.focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
    else if (e.key === "Tab") setOpen(false);
  };

  const setTheme = (next) => {
    if (theme !== next) toggleTheme();
  };

  const manage = () => {
    close(false);
    clerk.openUserProfile?.();
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await clerk.signOut({ redirectUrl: pathname });
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  };

  const label = identity.name || identity.email || "Account";

  return (
    <div className="gd-account">
      <button
        ref={btnRef}
        type="button"
        className="gd-account-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account: ${label}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); }
        }}
      >
        <Avatar identity={identity} />
        <span className="gd-account-id" aria-hidden="true">
          <span className="gd-account-name">{label}</span>
          {identity.role && <span className="gd-account-role">{identity.role}</span>}
        </span>
        <ChevronDown className="gd-account-chev" size={14} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div ref={menuRef} id={menuId} className="gd-menu" role="menu" aria-label="Account" onKeyDown={onMenuKey}>
          <div className="gd-menu-head" role="presentation">
            <Avatar identity={identity} size={36} />
            <div className="gd-menu-who">
              <p className="gd-menu-name">{label}</p>
              {identity.email && identity.email !== label && <p className="gd-menu-meta">{identity.email}</p>}
              {identity.role && <p className="gd-menu-meta">{identity.role}</p>}
            </div>
          </div>
          <div className="gd-menu-sep" role="separator" />
          <button type="button" role="menuitem" className="gd-menu-item" tabIndex={-1} onClick={manage}>
            <UserRound size={16} strokeWidth={1.75} aria-hidden="true" />
            Manage account
          </button>
          <div className="gd-menu-sep" role="separator" />
          <p className="gd-menu-label" id={`${menuId}-appearance`} aria-hidden="true">Appearance</p>
          <div role="group" aria-labelledby={`${menuId}-appearance`}>
            {[["light", "Light", Sun], ["dark", "Dark", Moon]].map(([value, text, Icon]) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={theme === value}
                className="gd-menu-item"
                tabIndex={-1}
                onClick={() => setTheme(value)}
              >
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                {text}
                {theme === value && <Check className="gd-menu-check" size={16} strokeWidth={2} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="gd-menu-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="gd-menu-item"
            tabIndex={-1}
            onClick={signOut}
            disabled={signingOut}
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
