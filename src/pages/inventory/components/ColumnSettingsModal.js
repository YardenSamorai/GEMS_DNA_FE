import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ColumnSettingsModal = ({ isOpen, onClose, columnConfig, onSave, activeDefaultColumns }) => {
  const defaultCols = activeDefaultColumns || [];
  const [localConfig, setLocalConfig] = useState(columnConfig);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  useEffect(() => {
    setLocalConfig(columnConfig);
  }, [columnConfig, isOpen]);

  if (!isOpen) return null;

  const colMeta = Object.fromEntries(defaultCols.map(c => [c.id, c]));

  const handleDragStart = (idx) => (e) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (idx) => (e) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx) => (e) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const updated = [...localConfig];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    setLocalConfig(updated);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const toggleVisibility = (id) => {
    const meta = colMeta[id];
    if (meta?.alwaysVisible) return;
    setLocalConfig(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  const handleReset = () => {
    const reset = defaultCols.map(c => ({ id: c.id, visible: true }));
    setLocalConfig(reset);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-background rounded-lg border border-border shadow-lg w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-800">Column Settings</h3>
                <p className="text-xs text-stone-400 mt-0.5">Drag to reorder, toggle to show/hide</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {localConfig.map((col, idx) => {
                const meta = colMeta[col.id];
                if (!meta) return null;
                return (
                  <div
                    key={col.id}
                    draggable
                    onDragStart={handleDragStart(idx)}
                    onDragOver={handleDragOver(idx)}
                    onDrop={handleDrop(idx)}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                      dragOverIdx === idx ? 'border-primary-400 bg-primary-50' :
                      dragIdx === idx ? 'opacity-50 border-stone-200 bg-stone-50' :
                      'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
                    }`}
                  >
                    <svg className="w-4 h-4 text-stone-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
                    </svg>
                    <span className="flex-1 text-sm font-medium text-stone-700">{meta.label}</span>
                    {meta.alwaysVisible ? (
                      <span className="text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">Required</span>
                    ) : (
                      <button
                        onClick={() => toggleVisibility(col.id)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${col.visible ? 'bg-primary-500' : 'bg-stone-300'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${col.visible ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t border-stone-200 flex items-center justify-between gap-3">
              <button onClick={handleReset} className="px-4 py-2 text-xs font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors">
                Reset to Default
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} className="px-4 py-2 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors">
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ColumnSettingsModal;
