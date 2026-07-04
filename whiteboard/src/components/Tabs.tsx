import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Copy, Edit2, Check, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WhiteboardTab } from '../types';

interface TabsProps {
  tabs: WhiteboardTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onRenameTab: (id: string, newName: string) => void;
  onDuplicateTab: (id: string) => void;
  onDeleteTab: (id: string) => void;
}

export default function Tabs({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onRenameTab,
  onDuplicateTab,
  onDeleteTab
}: TabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const startEditing = (tab: WhiteboardTab, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(tab.id);
    setEditingText(tab.name);
  };

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const saveRename = () => {
    if (editingId && editingText.trim()) {
      onRenameTab(editingId, editingText.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div className="w-full h-full flex items-end select-none">
      {/* Scrollable Tabs Area */}
      <div className="flex items-end gap-1 overflow-x-auto custom-scrollbar flex-1 h-full pr-2">
        <AnimatePresence initial={false}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isEditing = tab.id === editingId;

            return (
              <motion.div
                key={tab.id}
                layoutId={`tab-wrapper-${tab.id}`}
                className={`relative flex items-center gap-2 px-4 h-10 border-t-2 transition-all shrink-0 group ${
                  isActive
                    ? 'bg-white dark:bg-slate-950 border-t-blue-500 text-gray-900 dark:text-white font-semibold rounded-t-md shadow-xs'
                    : 'border-t-transparent text-gray-500 hover:bg-white/50 dark:hover:bg-slate-800/30 rounded-t-md hover:text-gray-800 dark:hover:text-slate-200 cursor-pointer'
                }`}
                onClick={() => !isEditing && onSelectTab(tab.id)}
                whileHover={{ y: isEditing ? 0 : -0.5 }}
                transition={{ duration: 0.15 }}
              >
                <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />

                {isEditing ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={handleKeyDown}
                    className="bg-white dark:bg-slate-800 border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none w-28 font-sans"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="max-w-28 truncate font-sans text-xs select-none pr-1"
                    onDoubleClick={(e) => startEditing(tab, e)}
                    title="Double-click to rename"
                  >
                    {tab.name}
                  </span>
                )}

                {/* Tab Actions */}
                <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 shrink-0">
                  {isEditing ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveRename();
                      }}
                      className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-green-600 focus:outline-none"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => startEditing(tab, e)}
                        title="Rename"
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateTab(tab.id);
                        }}
                        title="Duplicate Board"
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {tabs.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTab(tab.id);
                          }}
                          title="Delete Board"
                          className="p-0.5 hover:bg-red-100 dark:hover:bg-red-950/40 rounded text-slate-400 hover:text-red-500 focus:outline-none cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Add Tab Button */}
        <motion.button
          onClick={onAddTab}
          whileTap={{ scale: 0.95 }}
          title="New Whiteboard (Ctrl + N)"
          className="flex items-center justify-center p-2 mb-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors focus:outline-none cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
}
