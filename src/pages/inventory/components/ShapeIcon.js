import React from "react";

const ShapeIcon = ({ shape, isActive }) => {
  const c = isActive ? '#059669' : '#a8a29e';
  const size = 32;
  const sw = '1.3';
  const fw = '0.6';
  
  const shapeKey = shape?.toUpperCase?.() || '';
  
  // Round Brilliant
  if (shapeKey === 'RD' || shapeKey === 'ROUND' || shapeKey === 'BR' || shapeKey === 'BRILLIANT') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="15" stroke={c} strokeWidth={sw}/>
        <polygon points="20,5 25.5,15 35,20 25.5,25 20,35 14.5,25 5,20 14.5,15" stroke={c} strokeWidth={fw} fill="none"/>
        <line x1="20" y1="5" x2="14.5" y2="15" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="5" x2="25.5" y2="15" stroke={c} strokeWidth={fw}/>
        <line x1="35" y1="20" x2="25.5" y2="15" stroke={c} strokeWidth={fw}/>
        <line x1="35" y1="20" x2="25.5" y2="25" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="35" x2="25.5" y2="25" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="35" x2="14.5" y2="25" stroke={c} strokeWidth={fw}/>
        <line x1="5" y1="20" x2="14.5" y2="25" stroke={c} strokeWidth={fw}/>
        <line x1="5" y1="20" x2="14.5" y2="15" stroke={c} strokeWidth={fw}/>
        <polygon points="20,14 24,20 20,26 16,20" stroke={c} strokeWidth={fw} fill="none"/>
      </svg>
    );
  }
  
  // Pear
  if (shapeKey === 'PS' || shapeKey === 'PEAR') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 4 C20 4 9 15 9 25 C9 31.5 14 36 20 36 C26 36 31 31.5 31 25 C31 15 20 4 20 4Z" stroke={c} strokeWidth={sw} fill="none"/>
        <line x1="20" y1="4" x2="14" y2="18" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="4" x2="26" y2="18" stroke={c} strokeWidth={fw}/>
        <line x1="14" y1="18" x2="9.5" y2="24" stroke={c} strokeWidth={fw}/>
        <line x1="26" y1="18" x2="30.5" y2="24" stroke={c} strokeWidth={fw}/>
        <line x1="14" y1="18" x2="20" y2="22" stroke={c} strokeWidth={fw}/>
        <line x1="26" y1="18" x2="20" y2="22" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="22" x2="12" y2="31" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="22" x2="28" y2="31" stroke={c} strokeWidth={fw}/>
        <line x1="9.5" y1="24" x2="12" y2="31" stroke={c} strokeWidth={fw}/>
        <line x1="30.5" y1="24" x2="28" y2="31" stroke={c} strokeWidth={fw}/>
        <line x1="12" y1="31" x2="20" y2="36" stroke={c} strokeWidth={fw}/>
        <line x1="28" y1="31" x2="20" y2="36" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }
  
  // Oval
  if (shapeKey === 'OV' || shapeKey === 'OVAL') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="20" cy="20" rx="11" ry="16" stroke={c} strokeWidth={sw}/>
        <line x1="20" y1="4" x2="14" y2="12" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="4" x2="26" y2="12" stroke={c} strokeWidth={fw}/>
        <line x1="14" y1="12" x2="9.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="26" y1="12" x2="30.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="14" y1="12" x2="20" y2="17" stroke={c} strokeWidth={fw}/>
        <line x1="26" y1="12" x2="20" y2="17" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="17" x2="9.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="17" x2="30.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="23" x2="9.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="23" x2="30.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="23" x2="14" y2="28" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="23" x2="26" y2="28" stroke={c} strokeWidth={fw}/>
        <line x1="14" y1="28" x2="20" y2="36" stroke={c} strokeWidth={fw}/>
        <line x1="26" y1="28" x2="20" y2="36" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }
  
  // Cushion
  if (shapeKey === 'CU' || shapeKey === 'CUSHION') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="7" width="26" height="26" rx="5" stroke={c} strokeWidth={sw}/>
        <line x1="9" y1="7" x2="15" y2="15" stroke={c} strokeWidth={fw}/>
        <line x1="31" y1="7" x2="25" y2="15" stroke={c} strokeWidth={fw}/>
        <line x1="9" y1="33" x2="15" y2="25" stroke={c} strokeWidth={fw}/>
        <line x1="31" y1="33" x2="25" y2="25" stroke={c} strokeWidth={fw}/>
        <line x1="15" y1="15" x2="25" y2="15" stroke={c} strokeWidth={fw}/>
        <line x1="15" y1="25" x2="25" y2="25" stroke={c} strokeWidth={fw}/>
        <line x1="15" y1="15" x2="15" y2="25" stroke={c} strokeWidth={fw}/>
        <line x1="25" y1="15" x2="25" y2="25" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="7" x2="20" y2="15" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="33" x2="20" y2="25" stroke={c} strokeWidth={fw}/>
        <line x1="7" y1="20" x2="15" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="33" y1="20" x2="25" y2="20" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }
  
  // Heart
  if (shapeKey === 'HS' || shapeKey === 'HEART') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 36 L6 22 C3 18.5 3 12.5 7.5 9.5 C12 6.5 16.5 9 20 14 C23.5 9 28 6.5 32.5 9.5 C37 12.5 37 18.5 34 22 Z" stroke={c} strokeWidth={sw} fill="none"/>
        <line x1="20" y1="14" x2="20" y2="36" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="14" x2="10" y2="11" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="14" x2="30" y2="11" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="14" x2="8" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="14" x2="32" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="36" x2="8" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="36" x2="32" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="8" y1="20" x2="12" y2="28" stroke={c} strokeWidth={fw}/>
        <line x1="32" y1="20" x2="28" y2="28" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="36" x2="12" y2="28" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="36" x2="28" y2="28" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }
  
  // Marquise
  if (shapeKey === 'MQ' || shapeKey === 'MARQUISE') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 3 C27 11 31 17 31 20 C31 23 27 29 20 37 C13 29 9 23 9 20 C9 17 13 11 20 3Z" stroke={c} strokeWidth={sw} fill="none"/>
        <line x1="20" y1="3" x2="15" y2="13" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="3" x2="25" y2="13" stroke={c} strokeWidth={fw}/>
        <line x1="15" y1="13" x2="9.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="25" y1="13" x2="30.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="15" y1="13" x2="20" y2="17" stroke={c} strokeWidth={fw}/>
        <line x1="25" y1="13" x2="20" y2="17" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="17" x2="9.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="17" x2="30.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="23" x2="9.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="23" x2="30.5" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="23" x2="15" y2="27" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="23" x2="25" y2="27" stroke={c} strokeWidth={fw}/>
        <line x1="15" y1="27" x2="20" y2="37" stroke={c} strokeWidth={fw}/>
        <line x1="25" y1="27" x2="20" y2="37" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }
  
  // Emerald (step cut)
  if (shapeKey === 'EM' || shapeKey === 'EMERALD') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 5 L29 5 L34 10 L34 30 L29 35 L11 35 L6 30 L6 10 Z" stroke={c} strokeWidth={sw} fill="none"/>
        <path d="M15 10 L25 10 L28 13 L28 27 L25 30 L15 30 L12 27 L12 13 Z" stroke={c} strokeWidth={fw} fill="none"/>
        <path d="M18 14 L22 14 L23 15 L23 25 L22 26 L18 26 L17 25 L17 15 Z" stroke={c} strokeWidth={fw} fill="none"/>
        <line x1="11" y1="5" x2="15" y2="10" stroke={c} strokeWidth={fw}/>
        <line x1="29" y1="5" x2="25" y2="10" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="10" x2="12" y2="13" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="10" x2="28" y2="13" stroke={c} strokeWidth={fw}/>
        <line x1="11" y1="35" x2="15" y2="30" stroke={c} strokeWidth={fw}/>
        <line x1="29" y1="35" x2="25" y2="30" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="30" x2="12" y2="27" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="30" x2="28" y2="27" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }
  
  // Radiant
  if (shapeKey === 'RA' || shapeKey === 'RADIANT') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 3 L27 3 L34 10 L34 30 L27 37 L13 37 L6 30 L6 10 Z" stroke={c} strokeWidth={sw} fill="none"/>
        <line x1="13" y1="3" x2="16" y2="12" stroke={c} strokeWidth={fw}/>
        <line x1="27" y1="3" x2="24" y2="12" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="10" x2="26" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="30" x2="26" y2="26" stroke={c} strokeWidth={fw}/>
        <line x1="27" y1="37" x2="24" y2="28" stroke={c} strokeWidth={fw}/>
        <line x1="13" y1="37" x2="16" y2="28" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="30" x2="14" y2="26" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="10" x2="14" y2="14" stroke={c} strokeWidth={fw}/>
        <polygon points="16,12 24,12 26,14 26,26 24,28 16,28 14,26 14,14" stroke={c} strokeWidth={fw} fill="none"/>
        <line x1="20" y1="3" x2="20" y2="12" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="37" x2="20" y2="28" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="20" x2="14" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="20" x2="26" y2="20" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }
  
  // Princess
  if (shapeKey === 'PR' || shapeKey === 'PRINCESS') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="28" height="28" stroke={c} strokeWidth={sw}/>
        <line x1="6" y1="6" x2="20" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="6" x2="20" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="34" x2="20" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="34" x2="20" y2="20" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="6" x2="14" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="6" x2="26" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="20" x2="14" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="20" x2="14" y2="26" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="20" x2="26" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="20" x2="26" y2="26" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="34" x2="14" y2="26" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="34" x2="26" y2="26" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }
  
  // Asscher (step-cut square)
  if (shapeKey === 'AS' || shapeKey === 'ASSCHER') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 6 L30 6 L34 10 L34 30 L30 34 L10 34 L6 30 L6 10 Z" stroke={c} strokeWidth={sw} fill="none"/>
        <path d="M14 11 L26 11 L29 14 L29 26 L26 29 L14 29 L11 26 L11 14 Z" stroke={c} strokeWidth={fw} fill="none"/>
        <rect x="16" y="16" width="8" height="8" stroke={c} strokeWidth={fw}/>
        <line x1="10" y1="6" x2="14" y2="11" stroke={c} strokeWidth={fw}/>
        <line x1="30" y1="6" x2="26" y2="11" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="10" x2="29" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="30" x2="29" y2="26" stroke={c} strokeWidth={fw}/>
        <line x1="30" y1="34" x2="26" y2="29" stroke={c} strokeWidth={fw}/>
        <line x1="10" y1="34" x2="14" y2="29" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="30" x2="11" y2="26" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="10" x2="11" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="14" y1="11" x2="16" y2="16" stroke={c} strokeWidth={fw}/>
        <line x1="26" y1="11" x2="24" y2="16" stroke={c} strokeWidth={fw}/>
        <line x1="29" y1="14" x2="24" y2="16" stroke={c} strokeWidth={fw}/>
        <line x1="29" y1="26" x2="24" y2="24" stroke={c} strokeWidth={fw}/>
        <line x1="26" y1="29" x2="24" y2="24" stroke={c} strokeWidth={fw}/>
        <line x1="14" y1="29" x2="16" y2="24" stroke={c} strokeWidth={fw}/>
        <line x1="11" y1="26" x2="16" y2="24" stroke={c} strokeWidth={fw}/>
        <line x1="11" y1="14" x2="16" y2="16" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }

  // Trillion / Triangle
  if (shapeKey === 'TR' || shapeKey === 'TRILLION' || shapeKey === 'TRILLIANT' || shapeKey === 'TRIANGLE') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 4 L36 34 L4 34 Z" stroke={c} strokeWidth={sw} fill="none"/>
        <line x1="20" y1="4" x2="14" y2="22" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="4" x2="26" y2="22" stroke={c} strokeWidth={fw}/>
        <line x1="14" y1="22" x2="26" y2="22" stroke={c} strokeWidth={fw}/>
        <line x1="14" y1="22" x2="7" y2="34" stroke={c} strokeWidth={fw}/>
        <line x1="26" y1="22" x2="33" y2="34" stroke={c} strokeWidth={fw}/>
        <line x1="14" y1="22" x2="20" y2="34" stroke={c} strokeWidth={fw}/>
        <line x1="26" y1="22" x2="20" y2="34" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }

  // Baguette (step cut rectangle)
  if (shapeKey === 'BG' || shapeKey === 'BAGUETTE') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="11" y="5" width="18" height="30" stroke={c} strokeWidth={sw}/>
        <rect x="15" y="10" width="10" height="20" stroke={c} strokeWidth={fw}/>
        <line x1="11" y1="5" x2="15" y2="10" stroke={c} strokeWidth={fw}/>
        <line x1="29" y1="5" x2="25" y2="10" stroke={c} strokeWidth={fw}/>
        <line x1="11" y1="35" x2="15" y2="30" stroke={c} strokeWidth={fw}/>
        <line x1="29" y1="35" x2="25" y2="30" stroke={c} strokeWidth={fw}/>
        <line x1="15" y1="17" x2="25" y2="17" stroke={c} strokeWidth={fw}/>
        <line x1="15" y1="23" x2="25" y2="23" stroke={c} strokeWidth={fw}/>
        <line x1="11" y1="14" x2="15" y2="17" stroke={c} strokeWidth={fw}/>
        <line x1="29" y1="14" x2="25" y2="17" stroke={c} strokeWidth={fw}/>
        <line x1="11" y1="26" x2="15" y2="23" stroke={c} strokeWidth={fw}/>
        <line x1="29" y1="26" x2="25" y2="23" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }

  // Old Mine (rounded square with brilliant facets)
  if (shapeKey === 'OLD MINE' || shapeKey === 'OM') {
  return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="28" height="28" rx="4" stroke={c} strokeWidth={sw}/>
        <polygon points="20,8 28,14 32,20 28,26 20,32 12,26 8,20 12,14" stroke={c} strokeWidth={fw} fill="none"/>
        <line x1="20" y1="8" x2="12" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="8" x2="28" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="8" y1="20" x2="12" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="8" y1="20" x2="12" y2="26" stroke={c} strokeWidth={fw}/>
        <line x1="32" y1="20" x2="28" y2="14" stroke={c} strokeWidth={fw}/>
        <line x1="32" y1="20" x2="28" y2="26" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="32" x2="12" y2="26" stroke={c} strokeWidth={fw}/>
        <line x1="20" y1="32" x2="28" y2="26" stroke={c} strokeWidth={fw}/>
        <polygon points="20,15 24,20 20,25 16,20" stroke={c} strokeWidth={fw} fill="none"/>
      </svg>
    );
  }

  // Cabochon (smooth dome, no facets)
  if (shapeKey === 'CABUSHON' || shapeKey === 'CABOCHON' || shapeKey === 'CAB') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 28 C5 14 12 4 20 4 C28 4 35 14 35 28" stroke={c} strokeWidth={sw} fill="none"/>
        <line x1="5" y1="28" x2="35" y2="28" stroke={c} strokeWidth={sw}/>
        <path d="M10 28 C10 17 14 9 20 9 C26 9 30 17 30 28" stroke={c} strokeWidth={fw} opacity="0.6" fill="none"/>
        <path d="M15 28 C15 20 17 14 20 14 C23 14 25 20 25 28" stroke={c} strokeWidth={fw} opacity="0.4" fill="none"/>
        <ellipse cx="16" cy="16" rx="3" ry="1.5" stroke={c} strokeWidth={fw} opacity="0.3" transform="rotate(-20 16 16)" fill="none"/>
      </svg>
    );
  }

  // Carre (square step cut)
  if (shapeKey === 'CARRE' || shapeKey === 'SQ') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="28" height="28" stroke={c} strokeWidth={sw}/>
        <rect x="12" y="12" width="16" height="16" stroke={c} strokeWidth={fw}/>
        <rect x="17" y="17" width="6" height="6" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="6" x2="12" y2="12" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="6" x2="28" y2="12" stroke={c} strokeWidth={fw}/>
        <line x1="6" y1="34" x2="12" y2="28" stroke={c} strokeWidth={fw}/>
        <line x1="34" y1="34" x2="28" y2="28" stroke={c} strokeWidth={fw}/>
        <line x1="12" y1="12" x2="17" y2="17" stroke={c} strokeWidth={fw}/>
        <line x1="28" y1="12" x2="23" y2="17" stroke={c} strokeWidth={fw}/>
        <line x1="12" y1="28" x2="17" y2="23" stroke={c} strokeWidth={fw}/>
        <line x1="28" y1="28" x2="23" y2="23" stroke={c} strokeWidth={fw}/>
      </svg>
    );
  }

  // Default fallback (pentagon)
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 4 L35 15 L30 34 L10 34 L5 15 Z" stroke={c} strokeWidth={sw} fill="none"/>
      <line x1="20" y1="4" x2="15" y2="18" stroke={c} strokeWidth={fw}/>
      <line x1="20" y1="4" x2="25" y2="18" stroke={c} strokeWidth={fw}/>
      <line x1="5" y1="15" x2="15" y2="18" stroke={c} strokeWidth={fw}/>
      <line x1="35" y1="15" x2="25" y2="18" stroke={c} strokeWidth={fw}/>
      <line x1="15" y1="18" x2="25" y2="18" stroke={c} strokeWidth={fw}/>
      <line x1="15" y1="18" x2="10" y2="34" stroke={c} strokeWidth={fw}/>
      <line x1="25" y1="18" x2="30" y2="34" stroke={c} strokeWidth={fw}/>
    </svg>
  );
};

export default ShapeIcon;
export { ShapeIcon };
