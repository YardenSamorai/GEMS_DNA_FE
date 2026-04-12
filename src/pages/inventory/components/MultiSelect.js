import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

const MultiSelect = ({ value, options, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const dropRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handler = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (dropRef.current && dropRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropHeight = 240;
      const showAbove = spaceBelow < dropHeight && rect.top > dropHeight;
      setPos({
        top: showAbove ? rect.top - dropHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [open]);

  const toggle = (opt) => {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  const display = value.length === 0
    ? placeholder
    : value.length <= 2
      ? value.join(', ')
      : `${value.length} selected`;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="input-modern w-full text-left flex items-center justify-between gap-1"
      >
        <span className={`truncate text-sm ${value.length === 0 ? 'text-stone-400' : 'text-stone-700'}`}>{display}</span>
        <svg className={`w-4 h-4 text-stone-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={dropRef}
          className="bg-white border border-stone-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          style={{ position: 'fixed', zIndex: 9999, top: pos.top, left: pos.left, width: pos.width }}
        >
          {value.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 border-b border-stone-100 sticky top-0 bg-white"
            >
              Clear all
            </button>
          )}
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
                className="w-3.5 h-3.5 text-primary-600 rounded border-stone-300 focus:ring-primary-500"
              />
              <span className="text-sm text-stone-700">{opt}</span>
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default MultiSelect;
export { MultiSelect };
