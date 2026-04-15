import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  renderLabel,
  renderLabels,
  LABEL_W,
  LABEL_H,
  ELEMENT_TYPES,
  DEFAULT_ELEMENTS,
  FONT_FAMILIES,
  LABEL_SIZE_PRESETS,
  loadAllTemplates,
  saveAllTemplates,
  getActiveTemplate,
  setActiveTemplateId,
  createNewTemplate,
  duplicateTemplate,
  loadLabelSize,
  saveLabelSize,
} from "./LabelRenderer";
import {
  connect,
  disconnect,
  printCanvas,
  printBatch,
  getStatus,
  subscribe,
  isBluetoothAvailable,
} from "../services/niimbotPrint";

const PREVIEW_SCALE = 2.5;

/* ─── Alignment icon helpers ─── */
const AlignLeftIcon  = () => <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="10" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="1" y="12" width="8" height="2" rx="0.5"/></svg>;
const AlignCenterIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="10" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="4" y="12" width="8" height="2" rx="0.5"/></svg>;
const AlignRightIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="5" y="2" width="10" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="7" y="12" width="8" height="2" rx="0.5"/></svg>;
const VAlignTopIcon    = () => <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="1" width="12" height="1.5" rx="0.5"/><rect x="6" y="4" width="4" height="10" rx="0.5" opacity="0.4"/><rect x="6" y="4" width="4" height="3" rx="0.5"/></svg>;
const VAlignMiddleIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="6" y="2" width="4" height="12" rx="0.5" opacity="0.4"/><rect x="6" y="5.5" width="4" height="5" rx="0.5"/><rect x="2" y="7.5" width="12" height="1" rx="0.5"/></svg>;
const VAlignBottomIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="13.5" width="12" height="1.5" rx="0.5"/><rect x="6" y="2" width="4" height="10" rx="0.5" opacity="0.4"/><rect x="6" y="9" width="4" height="3" rx="0.5"/></svg>;
const CenterHIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="1.5" height="12" rx="0.5"/><rect x="13.5" y="2" width="1.5" height="12" rx="0.5"/><rect x="5" y="5" width="6" height="6" rx="1"/></svg>;
const CenterVIcon = () => <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="1" width="12" height="1.5" rx="0.5"/><rect x="2" y="13.5" width="12" height="1.5" rx="0.5"/><rect x="5" y="5" width="6" height="6" rx="1"/></svg>;

/* ─── Label Designer with always-visible styling panel ─── */
const MIN_EL_SIZE = 8;
const HANDLE_SIZE = 8;

const LabelDesigner = ({ template, onChange, sampleStone, labelSize }) => {
  const PW = LABEL_W * PREVIEW_SCALE;
  const PH = LABEL_H * PREVIEW_SCALE;
  const containerRef = useRef(null);
  const [interaction, setInteraction] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const canvasRef = useRef(null);

  const redrawPreview = useCallback(async () => {
    if (!canvasRef.current || !sampleStone) return;
    const rendered = await renderLabel(sampleStone, { template, labelSize });
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, PW, PH);
    ctx.drawImage(rendered, 0, 0, PW, PH);
  }, [template, sampleStone, labelSize, PW, PH]);

  useEffect(() => { redrawPreview(); }, [redrawPreview]);

  const startMove = (e, elId) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const el = template.find(t => t.id === elId);
    if (!el) return;
    setSelectedId(elId);
    setInteraction({
      type: "move", id: elId,
      offsetX: e.clientX - rect.left - el.x * PREVIEW_SCALE,
      offsetY: e.clientY - rect.top  - el.y * PREVIEW_SCALE,
    });
  };

  const startResize = (e, elId, handle) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const el = template.find(t => t.id === elId);
    if (!el) return;
    setSelectedId(elId);
    setInteraction({
      type: "resize", id: elId, handle,
      startMouseX: e.clientX - rect.left,
      startMouseY: e.clientY - rect.top,
      startX: el.x, startY: el.y, startW: el.w, startH: el.h,
      startFontSize: el.fontSize || 10,
    });
  };

  const handlePointerMove = useCallback((e) => {
    if (!interaction || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const el = template.find(t => t.id === interaction.id);
    if (!el) return;

    if (interaction.type === "move") {
      const newX = Math.round((e.clientX - rect.left - interaction.offsetX) / PREVIEW_SCALE);
      const newY = Math.round((e.clientY - rect.top  - interaction.offsetY) / PREVIEW_SCALE);
      const clampedX = Math.max(0, Math.min(LABEL_W - el.w, newX));
      const clampedY = Math.max(0, Math.min(LABEL_H - el.h, newY));
      onChange(template.map(t => t.id === interaction.id ? { ...t, x: clampedX, y: clampedY } : t));
    } else if (interaction.type === "resize") {
      const dx = Math.round((e.clientX - rect.left - interaction.startMouseX) / PREVIEW_SCALE);
      const dy = Math.round((e.clientY - rect.top  - interaction.startMouseY) / PREVIEW_SCALE);
      const h = interaction.handle;
      let { startX: nx, startY: ny, startW: nw, startH: nh } = interaction;

      if (h.includes("r")) nw = Math.max(MIN_EL_SIZE, nw + dx);
      if (h.includes("b")) nh = Math.max(MIN_EL_SIZE, nh + dy);
      if (h.includes("l")) { const d = Math.min(dx, nw - MIN_EL_SIZE); nx += d; nw -= d; }
      if (h.includes("t")) { const d = Math.min(dy, nh - MIN_EL_SIZE); ny += d; nh -= d; }

      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      nw = Math.min(nw, LABEL_W - nx);
      nh = Math.min(nh, LABEL_H - ny);

      const scale = Math.max(nh / interaction.startH, nw / interaction.startW);
      const newFontSize = Math.max(6, Math.min(48, Math.round(interaction.startFontSize * scale)));

      onChange(template.map(t => t.id === interaction.id ? { ...t, x: nx, y: ny, w: nw, h: nh, fontSize: newFontSize } : t));
    }
  }, [interaction, template, onChange]);

  const handlePointerUp = useCallback(() => { setInteraction(null); }, []);

  useEffect(() => {
    if (interaction) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup",   handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup",   handlePointerUp);
      };
    }
  }, [interaction, handlePointerMove, handlePointerUp]);

  const updateEl = (id, patch) => onChange(template.map(t => t.id === id ? { ...t, ...patch } : t));
  const toggleVisibility = (id) => {
    const el = template.find(t => t.id === id);
    if (el?.visible) {
      updateEl(id, { visible: false });
      if (selectedId === id) setSelectedId(null);
    } else {
      updateEl(id, { visible: true });
      setSelectedId(id);
    }
  };
  const selectElement = (id) => {
    const el = template.find(t => t.id === id);
    if (el?.visible) setSelectedId(id);
  };
  const changeFontSize = (id, delta) => {
    const el = template.find(t => t.id === id);
    if (el) updateEl(id, { fontSize: Math.max(6, Math.min(24, (el.fontSize || 10) + delta)) });
  };
  const changeLetterSpacing = (id, delta) => {
    const el = template.find(t => t.id === id);
    if (el) updateEl(id, { letterSpacing: Math.max(-2, Math.min(8, (el.letterSpacing || 0) + delta)) });
  };
  const centerOnLabel = (id, axis) => {
    const el = template.find(t => t.id === id);
    if (!el) return;
    if (axis === "h") updateEl(id, { x: Math.round((LABEL_W - el.w) / 2) });
    else updateEl(id, { y: Math.round((LABEL_H - el.h) / 2) });
  };

  const selectedEl = template.find(t => t.id === selectedId);
  const meta = selectedId ? ELEMENT_TYPES.find(t => t.id === selectedId) : null;
  const isTextElement = meta && meta.icon === "text";

  const resizeHandles = ["tl", "tr", "bl", "br", "t", "b", "l", "r"];
  const handleCursors = { tl: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize", br: "nwse-resize", t: "ns-resize", b: "ns-resize", l: "ew-resize", r: "ew-resize" };
  const handlePositions = (elW, elH) => ({
    tl: { left: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 },
    tr: { left: elW - HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 },
    bl: { left: -HANDLE_SIZE / 2, top: elH - HANDLE_SIZE / 2 },
    br: { left: elW - HANDLE_SIZE / 2, top: elH - HANDLE_SIZE / 2 },
    t:  { left: elW / 2 - HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 },
    b:  { left: elW / 2 - HANDLE_SIZE / 2, top: elH - HANDLE_SIZE / 2 },
    l:  { left: -HANDLE_SIZE / 2, top: elH / 2 - HANDLE_SIZE / 2 },
    r:  { left: elW - HANDLE_SIZE / 2, top: elH / 2 - HANDLE_SIZE / 2 },
  });

  return (
    <div className="space-y-3">
      {/* Canvas with draggable/resizable overlays */}
      <div
        ref={containerRef}
        className="relative bg-white border-2 border-stone-300 rounded-lg mx-auto overflow-hidden select-none"
        style={{ width: PW, height: PH }}
        onClick={() => setSelectedId(null)}
      >
        <canvas ref={canvasRef} width={PW} height={PH} className="absolute inset-0" />
        {template.filter(t => t.visible).map(el => {
          const typeMeta = ELEMENT_TYPES.find(t => t.id === el.id);
          const isSel = selectedId === el.id;
          const elW = el.w * PREVIEW_SCALE;
          const elH = el.h * PREVIEW_SCALE;
          const positions = handlePositions(elW, elH);
          return (
            <div
              key={el.id}
              onPointerDown={(e) => startMove(e, el.id)}
              className={`absolute border rounded cursor-move flex items-center justify-center transition-colors ${
                isSel ? "border-blue-500 bg-blue-500/10"
                  : interaction?.id === el.id ? "border-blue-400 bg-blue-400/10"
                  : "border-transparent hover:border-stone-300 hover:bg-white/30"
              }`}
              style={{
                left: el.x * PREVIEW_SCALE, top: el.y * PREVIEW_SCALE,
                width: elW, height: elH,
                touchAction: "none",
              }}
              title={typeMeta?.label}
            >
              {isSel && (
                <>
                  <span className="absolute -top-4 left-0 text-[9px] bg-blue-500 text-white px-1 rounded whitespace-nowrap z-10">
                    {typeMeta?.label}
                  </span>
                  {resizeHandles.map(h => (
                    <div
                      key={h}
                      onPointerDown={(e) => startResize(e, el.id, h)}
                      className="absolute bg-blue-500 border border-white rounded-sm z-20"
                      style={{
                        width: HANDLE_SIZE, height: HANDLE_SIZE,
                        cursor: handleCursors[h],
                        ...positions[h],
                        touchAction: "none",
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Element toggle chips — click to select, long-press icon to toggle visibility */}
      <div>
        <span className="text-xs font-medium text-stone-500 mb-1.5 block">Elements</span>
        <div className="flex flex-wrap gap-1.5">
          {ELEMENT_TYPES.map(type => {
            const el = template.find(t => t.id === type.id);
            const vis = el?.visible;
            const isSel = selectedId === type.id;
            return (
              <div key={type.id} className="flex items-center gap-0.5">
                <button
                  onClick={() => vis ? selectElement(type.id) : toggleVisibility(type.id)}
                  className={`px-2.5 py-1 rounded-l-lg text-xs font-medium transition-all border-y border-l ${
                    vis
                      ? isSel ? "bg-blue-500 text-white border-blue-500"
                        : "bg-stone-800 text-white border-stone-800"
                      : "bg-white text-stone-400 border-stone-200 line-through"
                  }`}
                >
                  {type.label}
                </button>
                <button
                  onClick={() => toggleVisibility(type.id)}
                  className={`px-1 py-1 rounded-r-lg text-[10px] transition-all border-y border-r ${
                    vis
                      ? isSel ? "bg-blue-400 text-white border-blue-500"
                        : "bg-stone-700 text-stone-300 border-stone-800"
                      : "bg-stone-100 text-stone-300 border-stone-200"
                  }`}
                  title={vis ? "Hide" : "Show"}
                >
                  {vis ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/></svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Always-visible styling panel */}
      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
        {!selectedEl ? (
          <p className="text-xs text-stone-400 text-center py-2">Click an element on the label or in the list above to style it</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-700">{meta?.label || selectedId}</span>
              <span className="text-[10px] text-stone-400 tabular-nums">x:{selectedEl.x} y:{selectedEl.y} &middot; {selectedEl.w}&times;{selectedEl.h}</span>
            </div>

            {isTextElement && (
              <>
                {/* Font Family */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-500 w-14 shrink-0">Font</span>
                  <select
                    value={selectedEl.fontFamily || "markazi"}
                    onChange={(e) => updateEl(selectedId, { fontFamily: e.target.value })}
                    className="flex-1 text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {FONT_FAMILIES.map(f => (
                      <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>{f.label}</option>
                    ))}
                  </select>
                </div>

                {/* Size + Spacing row */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[10px] text-stone-500 w-14 shrink-0">Size</span>
                    <button onClick={() => changeFontSize(selectedId, -1)} className="w-6 h-6 rounded bg-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-300 flex items-center justify-center">-</button>
                    <span className="text-xs font-mono w-5 text-center tabular-nums">{selectedEl.fontSize || 10}</span>
                    <button onClick={() => changeFontSize(selectedId, 1)} className="w-6 h-6 rounded bg-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-300 flex items-center justify-center">+</button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[10px] text-stone-500 w-14 shrink-0">Spacing</span>
                    <button onClick={() => changeLetterSpacing(selectedId, -0.5)} className="w-6 h-6 rounded bg-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-300 flex items-center justify-center">-</button>
                    <span className="text-xs font-mono w-5 text-center tabular-nums">{selectedEl.letterSpacing || 0}</span>
                    <button onClick={() => changeLetterSpacing(selectedId, 0.5)} className="w-6 h-6 rounded bg-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-300 flex items-center justify-center">+</button>
                  </div>
                </div>

                {/* Bold + Horizontal Align + Vertical Align */}
                <div className="flex items-center gap-3">
                  {/* Bold */}
                  <button
                    onClick={() => updateEl(selectedId, { bold: !selectedEl.bold })}
                    className={`w-7 h-7 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center ${
                      selectedEl.bold ? "bg-stone-800 text-white border-stone-800" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
                    }`}
                    title="Bold"
                  >B</button>

                  <div className="w-px h-5 bg-stone-200" />

                  {/* Horizontal text align */}
                  <div className="flex items-center gap-0.5">
                    {[
                      { val: "left",   Icon: AlignLeftIcon },
                      { val: "center", Icon: AlignCenterIcon },
                      { val: "right",  Icon: AlignRightIcon },
                    ].map(({ val, Icon }) => (
                      <button
                        key={val}
                        onClick={() => updateEl(selectedId, { textAlign: val })}
                        className={`w-7 h-7 rounded-lg border transition-colors flex items-center justify-center ${
                          (selectedEl.textAlign || "left") === val
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white text-stone-400 border-stone-200 hover:border-stone-300 hover:text-stone-600"
                        }`}
                        title={`Align ${val}`}
                      ><Icon /></button>
                    ))}
                  </div>

                  <div className="w-px h-5 bg-stone-200" />

                  {/* Vertical text align */}
                  <div className="flex items-center gap-0.5">
                    {[
                      { val: "top",    Icon: VAlignTopIcon },
                      { val: "middle", Icon: VAlignMiddleIcon },
                      { val: "bottom", Icon: VAlignBottomIcon },
                    ].map(({ val, Icon }) => (
                      <button
                        key={val}
                        onClick={() => updateEl(selectedId, { verticalAlign: val })}
                        className={`w-7 h-7 rounded-lg border transition-colors flex items-center justify-center ${
                          (selectedEl.verticalAlign || "top") === val
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white text-stone-400 border-stone-200 hover:border-stone-300 hover:text-stone-600"
                        }`}
                        title={`Vertical ${val}`}
                      ><Icon /></button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Position on label — always visible for any element */}
            <div className="flex items-center gap-2 pt-1 border-t border-stone-200">
              <span className="text-[10px] text-stone-500 shrink-0">Position on label</span>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => centerOnLabel(selectedId, "h")}
                  className="h-6 px-1.5 rounded bg-stone-200 text-stone-600 hover:bg-stone-300 transition-colors flex items-center gap-1"
                  title="Center horizontally on label"
                >
                  <CenterHIcon />
                  <span className="text-[9px] font-medium">Center H</span>
                </button>
                <button
                  onClick={() => centerOnLabel(selectedId, "v")}
                  className="h-6 px-1.5 rounded bg-stone-200 text-stone-600 hover:bg-stone-300 transition-colors flex items-center gap-1"
                  title="Center vertically on label"
                >
                  <CenterVIcon />
                  <span className="text-[9px] font-medium">Center V</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── Template Manager (picker + rename + delete) ─── */
const TemplateManager = ({ templates, activeId, onSelect, onAdd, onDuplicate, onDelete, onRename }) => {
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { if (renaming && inputRef.current) inputRef.current.focus(); }, [renaming]);

  const startRename = (tpl) => { setRenaming(tpl.id); setRenameVal(tpl.name); };
  const commitRename = () => {
    if (renaming && renameVal.trim()) { onRename(renaming, renameVal.trim()); }
    setRenaming(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-600">My Templates</span>
        <div className="flex items-center gap-1">
          <button onClick={onAdd} className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors" title="New blank template">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
          {templates.length > 0 && (
            <button onClick={() => onDuplicate(activeId)} className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors" title="Duplicate current">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
        {templates.map(tpl => (
          <div key={tpl.id} className="group flex items-center gap-0.5">
            {renaming === tpl.id ? (
              <input
                ref={inputRef}
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                className="px-2 py-1 text-xs border border-blue-400 rounded-lg bg-white focus:outline-none w-28"
              />
            ) : (
              <button
                onClick={() => onSelect(tpl.id)}
                onDoubleClick={() => startRename(tpl)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                  tpl.id === activeId
                    ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                }`}
                title="Double-click to rename"
              >
                {tpl.name}
              </button>
            )}
            {templates.length > 1 && tpl.id === activeId && renaming !== tpl.id && (
              <button
                onClick={() => onDelete(tpl.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-stone-300 hover:text-red-500 transition-all"
                title="Delete template"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Preview Only (no editing) ─── */
const PreviewOnly = ({ stone, template, labelSize }) => {
  const ref = useRef(null);
  const PW = LABEL_W * PREVIEW_SCALE;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!stone?.sku) return;
      const canvas = await renderLabel(stone, { template, labelSize });
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = "";
      canvas.style.width = "100%";
      canvas.style.maxWidth = `${PW}px`;
      canvas.style.height = "auto";
      canvas.style.border = "1px solid #e7e5e4";
      canvas.style.borderRadius = "8px";
      ref.current.appendChild(canvas);
    })();
    return () => { cancelled = true; };
  }, [stone, template, labelSize, PW]);

  return <div ref={ref} className="flex items-center justify-center bg-stone-50 rounded-xl p-4 min-h-[100px]" />;
};

/* ─── Main Dialog ─── */
const NiimbotPrintDialog = ({ isOpen, onClose, stones = [] }) => {
  const [printerStatus, setPrinterStatus] = useState(getStatus());
  const [connecting, setConnecting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState({ current: 0, total: 0 });
  const [quantity, setQuantity] = useState(1);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [showDesigner, setShowDesigner] = useState(false);

  const [labelSize, setLabelSize] = useState(() => loadLabelSize());
  const [allTemplates, setAllTemplates] = useState(() => loadAllTemplates());
  const [activeTemplateId, setActiveTemplateIdState] = useState(() => {
    const all = loadAllTemplates();
    const active = getActiveTemplate(all);
    return active.id;
  });

  const activeTemplate = allTemplates.find(t => t.id === activeTemplateId) || allTemplates[0];
  const currentElements = activeTemplate?.elements || DEFAULT_ELEMENTS;

  useEffect(() => subscribe(setPrinterStatus), []);
  useEffect(() => { if (isOpen) setPreviewIdx(0); }, [isOpen]);

  const persistAll = useCallback((templates, newActiveId) => {
    setAllTemplates(templates);
    saveAllTemplates(templates);
    if (newActiveId) {
      setActiveTemplateIdState(newActiveId);
      setActiveTemplateId(newActiveId);
    }
  }, []);

  const handleSelectTemplate = useCallback((id) => {
    setActiveTemplateIdState(id);
    setActiveTemplateId(id);
  }, []);

  const handleAddTemplate = useCallback(() => {
    const newTpl = createNewTemplate(`Template ${allTemplates.length + 1}`);
    const updated = [...allTemplates, newTpl];
    persistAll(updated, newTpl.id);
    toast.success("New template created!");
  }, [allTemplates, persistAll]);

  const handleDuplicateTemplate = useCallback((id) => {
    const source = allTemplates.find(t => t.id === id);
    if (!source) return;
    const dup = duplicateTemplate(source);
    const updated = [...allTemplates, dup];
    persistAll(updated, dup.id);
    toast.success("Template duplicated!");
  }, [allTemplates, persistAll]);

  const handleDeleteTemplate = useCallback((id) => {
    if (allTemplates.length <= 1) return;
    const filtered = allTemplates.filter(t => t.id !== id);
    const newActiveId = id === activeTemplateId ? filtered[0].id : activeTemplateId;
    persistAll(filtered, newActiveId);
    toast("Template deleted");
  }, [allTemplates, activeTemplateId, persistAll]);

  const handleRenameTemplate = useCallback((id, newName) => {
    const updated = allTemplates.map(t => t.id === id ? { ...t, name: newName } : t);
    persistAll(updated);
  }, [allTemplates, persistAll]);

  const handleElementsChange = useCallback((newElements) => {
    const updated = allTemplates.map(t =>
      t.id === activeTemplateId ? { ...t, elements: newElements } : t
    );
    setAllTemplates(updated);
  }, [allTemplates, activeTemplateId]);

  const handleSave = () => {
    saveAllTemplates(allTemplates);
    toast.success("All templates saved!");
  };

  const handleResetCurrent = () => {
    const updated = allTemplates.map(t =>
      t.id === activeTemplateId ? { ...t, elements: DEFAULT_ELEMENTS.map(e => ({ ...e })) } : t
    );
    persistAll(updated);
    toast("Template reset to default");
  };

  if (!isOpen) return null;

  const currentStone = stones[Math.min(previewIdx, stones.length - 1)] || {};

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const status = await connect();
      setPrinterStatus(status);
      toast.success("Printer connected!");
    } catch (err) { toast.error(err.message || "Failed to connect"); }
    finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setPrinterStatus({ connected: false, printerInfo: null });
    toast("Printer disconnected", { icon: "\uD83D\uDD0C" });
  };

  const handlePrint = async () => {
    if (!printerStatus.connected) { toast.error("Connect a printer first"); return; }
    setPrinting(true);
    setPrintProgress({ current: 0, total: stones.length * quantity });
    try {
      for (let q = 0; q < quantity; q++) {
        const canvases = await renderLabels(stones, { template: currentElements, labelSize });
        await printBatch(canvases, (cur) => {
          setPrintProgress(p => ({ ...p, current: q * stones.length + cur }));
        });
      }
      toast.success(`Printed ${stones.length * quantity} labels!`);
      onClose();
    } catch (err) { toast.error(err.message || "Print failed"); }
    finally { setPrinting(false); }
  };

  const handlePrintSingle = async () => {
    if (!printerStatus.connected) { toast.error("Connect a printer first"); return; }
    setPrinting(true);
    try {
      const canvas = await renderLabel(currentStone, { template: currentElements, labelSize });
      await printCanvas(canvas, quantity);
      toast.success("Label printed!");
    } catch (err) { toast.error(err.message || "Print failed"); }
    finally { setPrinting(false); }
  };

  const totalLabels = stones.length * quantity;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-stone-800">Print Labels</h3>
                  <p className="text-xs text-stone-500">
                    {stones.length} {stones.length === 1 ? "item" : "items"} &middot; {activeTemplate?.name || "Default"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowDesigner(v => !v)}
                  className={`p-2 rounded-lg transition-colors ${showDesigner ? "bg-blue-100 text-blue-600" : "hover:bg-stone-100 text-stone-400 hover:text-stone-600"}`}
                  title={showDesigner ? "Close designer" : "Design label"}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-6 space-y-4">
              {/* Printer Connection */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${printerStatus.connected ? "bg-green-500 animate-pulse" : "bg-stone-300"}`} />
                  <span className="text-sm font-medium text-stone-700">
                    {printerStatus.connected ? "Printer connected" : "No printer connected"}
                  </span>
                </div>
                {printerStatus.connected ? (
                  <button onClick={handleDisconnect} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-200 text-stone-600 hover:bg-stone-300 transition-colors">Disconnect</button>
                ) : (
                  <button onClick={handleConnect} disabled={connecting} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50">
                    {connecting ? "Connecting..." : "Connect"}
                  </button>
                )}
              </div>

              {/* Template Picker */}
              <TemplateManager
                templates={allTemplates}
                activeId={activeTemplateId}
                onSelect={handleSelectTemplate}
                onAdd={handleAddTemplate}
                onDuplicate={handleDuplicateTemplate}
                onDelete={handleDeleteTemplate}
                onRename={handleRenameTemplate}
              />

              {/* Stone navigation */}
              {stones.length > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setPreviewIdx(i => Math.max(0, i - 1))} disabled={previewIdx === 0} className="p-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-30 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-xs text-stone-500 tabular-nums font-medium bg-stone-100 px-2.5 py-1 rounded-lg">
                    {previewIdx + 1} / {stones.length}
                  </span>
                  <button onClick={() => setPreviewIdx(i => Math.min(stones.length - 1, i + 1))} disabled={previewIdx >= stones.length - 1} className="p-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-30 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}

              {/* Label Designer / Preview */}
              {showDesigner ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-700">Design: {activeTemplate?.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={handleResetCurrent} className="px-2 py-1 text-[10px] font-medium rounded bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors">Reset</button>
                      <button onClick={handleSave} className="px-2 py-1 text-[10px] font-medium rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors">Save All</button>
                    </div>
                  </div>
                  <LabelDesigner
                    template={currentElements}
                    onChange={handleElementsChange}
                    sampleStone={currentStone}
                    labelSize={labelSize}
                  />
                  <p className="text-[10px] text-stone-400 text-center">
                    Drag elements to reposition &middot; Click chips to show/hide &middot; Double-click template name to rename
                  </p>
                </div>
              ) : (
                <PreviewOnly stone={currentStone} template={currentElements} labelSize={labelSize} />
              )}

              {/* Options */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-500 mb-1 block">Copies per label</label>
                  <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-2 hover:bg-stone-100 text-stone-600">-</button>
                    <span className="flex-1 text-center text-sm font-medium tabular-nums">{quantity}</span>
                    <button onClick={() => setQuantity(q => Math.min(50, q + 1))} className="px-3 py-2 hover:bg-stone-100 text-stone-600">+</button>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setShowDesigner(v => !v)}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors border ${
                      showDesigner ? "bg-blue-500 text-white border-blue-500" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    {showDesigner ? "Close Editor" : "Edit Design"}
                  </button>
                </div>
              </div>

              {/* Print progress */}
              {printing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>Printing...</span>
                    <span className="tabular-nums">{printProgress.current} / {printProgress.total}</span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-2">
                    <div className="bg-stone-800 h-2 rounded-full transition-all" style={{ width: `${printProgress.total ? (printProgress.current / printProgress.total) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-stone-200 space-y-2">
              {stones.length > 1 ? (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handlePrintSingle} disabled={printing || !printerStatus.connected} className="py-2.5 px-4 rounded-xl text-sm font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors disabled:opacity-40">Print Current</button>
                  <button onClick={handlePrint} disabled={printing || !printerStatus.connected} className="py-2.5 px-4 rounded-xl text-sm font-medium bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-40">
                    {printing ? "Printing..." : `Print All (${totalLabels})`}
                  </button>
                </div>
              ) : (
                <button onClick={handlePrintSingle} disabled={printing || !printerStatus.connected} className="w-full py-2.5 px-4 rounded-xl text-sm font-medium bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-40">
                  {printing ? "Printing..." : `Print Label${quantity > 1 ? ` (\u00D7${quantity})` : ""}`}
                </button>
              )}
              {!isBluetoothAvailable() && (
                <p className="text-xs text-amber-600 text-center">
                  Web Bluetooth is not supported in this browser. Please use Chrome or Edge.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NiimbotPrintDialog;
