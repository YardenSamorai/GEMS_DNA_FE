import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TAG_COLORS } from "../helpers/constants";

const TagsModal = ({ isOpen, onClose, tags, onCreateTag, onDeleteTag, onUpdateTag }) => {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#10b981");
  const [editingTag, setEditingTag] = useState(null);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (newTagName.trim()) {
      onCreateTag(newTagName.trim(), newTagColor);
      setNewTagName("");
      setNewTagColor("#10b981");
    }
  };

  const handleUpdate = () => {
    if (editingTag && editingTag.name.trim()) {
      onUpdateTag(editingTag.id, editingTag.name, editingTag.color);
      setEditingTag(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="bg-background rounded-lg border border-border shadow-lg w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-stone-300"></div>
          </div>
          
          {/* Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                  <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">Manage Client Tags</h2>
                  <p className="text-muted-foreground text-xs">{tags.length} tags</p>
                </div>
              </div>
              <button onClick={onClose} className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Create New Tag */}
          <div className="flex-shrink-0 p-4 border-b border-border bg-muted/50">
            <p className="text-xs font-medium text-stone-500 mb-3">Create New Tag</p>
            
            <div className="space-y-3">
              {/* Tag Name Input */}
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter client name..."
                className="w-full px-4 py-3 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              
              {/* Color Selection */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">Choose Color</p>
                <div className="grid grid-cols-8 gap-2">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewTagColor(c.value)}
                      className={`aspect-square rounded-xl transition-all ${
                        newTagColor === c.value 
                          ? "ring-2 ring-offset-2 ring-blue-500 scale-105 shadow-lg" 
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
              
              {/* Add Button */}
              <button
                onClick={handleCreate}
                disabled={!newTagName.trim()}
                className="w-full py-3 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Tag
              </button>
            </div>
          </div>

          {/* Tags List */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Your Tags</p>
            {tags.length === 0 ? (
              <div className="text-center py-8 text-stone-400">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <p>No tags yet</p>
                <p className="text-xs">Create your first client tag above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200 hover:border-stone-300 hover:shadow-sm transition-all"
                  >
                    {editingTag?.id === tag.id ? (
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={editingTag.name}
                          onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <div className="grid grid-cols-8 gap-1.5">
                          {TAG_COLORS.map((c) => (
                            <button
                              key={c.value}
                              onClick={() => setEditingTag({ ...editingTag, color: c.value })}
                              className={`aspect-square rounded-lg transition-transform ${editingTag.color === c.value ? "scale-110 ring-2 ring-offset-1 ring-blue-500" : "hover:scale-105"}`}
                              style={{ backgroundColor: c.value }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleUpdate} className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600">
                            Save
                          </button>
                          <button onClick={() => setEditingTag(null)} className="flex-1 py-2 bg-stone-200 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-300">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 font-medium text-stone-700">{tag.name}</span>
                        <span className="text-xs text-stone-400 bg-stone-100 px-2 py-1 rounded-full">{tag.stone_count || 0} stones</span>
                        <button
                          onClick={() => setEditingTag({ id: tag.id, name: tag.name, color: tag.color })}
                          className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                          title="Edit tag"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onDeleteTag(tag.id)}
                          className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation"
                          title="Delete tag"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TagsModal;
