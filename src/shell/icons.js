import React from "react";
import { BookUser, Camera, Gem, House, KeyRound, LayoutGrid, ShieldCheck, Tag, Users } from "lucide-react";

const lucide = (Icon) => {
  const Wrapped = ({ size = 18 }) => <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
  return Wrapped;
};

// Category glyphs for the sales catalog — drawn at the same weight as lucide.
const cut = (paths) => {
  const Cut = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths}
    </svg>
  );
  return Cut;
};

export const ICONS = {
  dashboard: lucide(LayoutGrid),
  inventory: lucide(Gem),
  sales: lucide(Tag),
  crm: lucide(BookUser),
  photos: lucide(Camera),
  quality: lucide(ShieldCheck),
  api: lucide(KeyRound),
  team: lucide(Users),
  salesHome: lucide(House),
  diamond: cut(<path d="M9 3.5h6L20 9l-8 11.5L4 9l5-5.5zM4 9h16M9 3.5L6.5 9l5.5 11.5L17.5 9 15 3.5M9 3.5L12 9l3-5.5" />),
  emerald: cut(
    <>
      <path d="M8 3.5h8L20.5 8v8L16 20.5H8L3.5 16V8L8 3.5z" />
      <path d="M9.2 6.5h5.6l2.7 2.7v5.6l-2.7 2.7H9.2l-2.7-2.7V9.2l2.7-2.7z" />
    </>
  ),
  gemstone: cut(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2l3.4 1.4 1.4 3.4-1.4 3.4-3.4 1.4-3.4-1.4-1.4-3.4 1.4-3.4L12 7.2z" />
    </>
  ),
  jewelry: cut(
    <>
      <circle cx="12" cy="15.25" r="5.75" />
      <path d="M8.8 6.2l1.6-2.7h3.2l1.6 2.7L12 9.5 8.8 6.2zM8.8 6.2h6.4" />
    </>
  ),
};

export const NavIcon = ({ name, size }) => {
  const Icon = ICONS[name];
  return Icon ? <Icon size={size} /> : null;
};
