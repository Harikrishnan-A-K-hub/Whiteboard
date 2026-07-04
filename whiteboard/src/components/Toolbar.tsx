import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer,
  Hand,
  Pencil,
  Eraser,
  Type,
  Square,
  Circle as CircleIcon,
  Minus,
  ArrowRight,
  Triangle as TriangleIcon,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Upload,
  GripVertical,
  ChevronRight,
  Bold,
  Italic,
  FileDown,
  Image as ImageIcon,
  FileSpreadsheet,
  Camera,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToolType, BoardElement } from '../types';
import ColorPicker from './ColorPicker';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  color: string;
  setColor: (color: string) => void;
  recentColors: string[];
  brushSize: number;
  setBrushSize: (size: number) => void;
  shapeWidth: number;
  setShapeWidth: (width: number) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  fontFamily: string;
  setFontFamily: (fam: string) => void;
  isBold: boolean;
  setIsBold: (b: boolean) => void;
  isItalic: boolean;
  setIsItalic: (i: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
  onExport: (format: 'png' | 'jpeg' | 'svg' | 'pdf') => void;
  onImportFile: (file: File) => void;
  selectedElement: BoardElement | null;
  onUpdateSelectedElement: (props: Partial<BoardElement>) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onQuickSnapshot: () => void;
}

const SHAPES = [
  { type: 'line' as ToolType, icon: Minus, label: 'Line' },
  { type: 'rectangle' as ToolType, icon: Square, label: 'Rectangle' },
  { type: 'circle' as ToolType, icon: CircleIcon, label: 'Circle' },
  { type: 'arrow' as ToolType, icon: ArrowRight, label: 'Arrow' },
  { type: 'triangle' as ToolType, icon: TriangleIcon, label: 'Triangle' }
];

export default function Toolbar({
  activeTool,
  setActiveTool,
  color,
  setColor,
  recentColors,
  brushSize,
  setBrushSize,
  shapeWidth,
  setShapeWidth,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  isBold,
  setIsBold,
  isItalic,
  setIsItalic,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onExport,
  onImportFile,
  selectedElement,
  onUpdateSelectedElement,
  onDuplicateSelected,
  onDeleteSelected,
  onQuickSnapshot
}: ToolbarProps) {
  // Draggable toolbar state
  const [position, setPosition] = useState({ x: 24, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Quick Snapshot feedback state
  const [isCopiedFeedback, setIsCopiedFeedback] = useState(false);

  const handleQuickSnapshotClick = () => {
    onQuickSnapshot();
    setIsCopiedFeedback(true);
    setTimeout(() => {
      setIsCopiedFeedback(false);
    }, 2050);
  };

  // Sub-menus state
  const [activeSubPanel, setActiveSubPanel] = useState<'color' | 'brush' | 'shapes' | 'export' | 'import' | 'none'>('none');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      e.preventDefault();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      // Constraint within viewport roughly
      const newX = Math.max(10, Math.min(window.innerWidth - 80, e.clientX - dragStart.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 300, e.clientY - dragStart.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const newX = Math.max(10, Math.min(window.innerWidth - 80, touch.clientX - dragStart.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 300, touch.clientY - dragStart.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  const toggleSubPanel = (panel: 'color' | 'brush' | 'shapes' | 'export' | 'import') => {
    setActiveSubPanel(activeSubPanel === panel ? 'none' : panel);
  };

  // Check if a tool is a shape
  const isShapeActive = SHAPES.some(s => s.type === activeTool);
  const activeShapeConfig = SHAPES.find(s => s.type === activeTool);
  const ActiveShapeIcon = activeShapeConfig ? activeShapeConfig.icon : Square;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportFile(e.target.files[0]);
      setActiveSubPanel('none');
    }
  };

  // Sync selected element modifications
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    if (selectedElement) {
      onUpdateSelectedElement({ color: newColor });
    }
  };

  const handleStrokeWidthChange = (w: number) => {
    if (activeTool === 'pencil' || activeTool === 'eraser') {
      setBrushSize(w);
    } else {
      setShapeWidth(w);
    }

    if (selectedElement) {
      if (selectedElement.type === 'pencil' || selectedElement.type === 'eraser_stroke') {
        onUpdateSelectedElement({ strokeWidth: w });
      } else {
        onUpdateSelectedElement({ strokeWidth: w });
      }
    }
  };

  const handleFontSizeChange = (sz: number) => {
    setFontSize(sz);
    if (selectedElement && selectedElement.type === 'text') {
      onUpdateSelectedElement({ fontSize: sz });
    }
  };

  const handleFontFamilyChange = (fam: string) => {
    setFontFamily(fam);
    if (selectedElement && selectedElement.type === 'text') {
      onUpdateSelectedElement({ fontFamily: fam });
    }
  };

  const handleBoldToggle = () => {
    const next = !isBold;
    setIsBold(next);
    if (selectedElement && selectedElement.type === 'text') {
      onUpdateSelectedElement({ isBold: next });
    }
  };

  const handleItalicToggle = () => {
    const next = !isItalic;
    setIsItalic(next);
    if (selectedElement && selectedElement.type === 'text') {
      onUpdateSelectedElement({ isItalic: next });
    }
  };

  // Get current width value based on active tool
  const currentWidthValue = (activeTool === 'pencil' || activeTool === 'eraser') ? brushSize : shapeWidth;

  return (
    <div
      ref={toolbarRef}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-40 flex items-start gap-3 select-none"
    >
      {/* Main Toolbar Body */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="flex flex-col items-center bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl p-2 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1),_0_2px_10px_-2px_rgba(0,0,0,0.05)] gap-1"
      >
        {/* Drag Handle */}
        <div className="drag-handle w-full flex justify-center py-1 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-400">
          <GripVertical className="w-4 h-4 rotate-90" />
        </div>

        {/* Selection Tool */}
        <button
          onClick={() => { setActiveTool('select'); setActiveSubPanel('none'); }}
          className={`p-2.5 rounded-xl cursor-pointer transition-all focus:outline-none ${
            activeTool === 'select'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Selection Tool (V) - Select, move and resize items"
        >
          <MousePointer className="w-5 h-5" />
        </button>

        {/* Hand Tool / Panning */}
        <button
          onClick={() => { setActiveTool('hand'); setActiveSubPanel('none'); }}
          className={`p-2.5 rounded-xl cursor-pointer transition-all focus:outline-none ${
            activeTool === 'hand'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Hand Tool (H) - Pan & Navigation"
        >
          <Hand className="w-5 h-5" />
        </button>

        <div className="w-8 border-t border-slate-100 dark:border-slate-800 my-1" />

        {/* Pencil Tool */}
        <button
          onClick={() => { setActiveTool('pencil'); setActiveSubPanel('brush'); }}
          className={`p-2.5 rounded-xl cursor-pointer transition-all focus:outline-none relative ${
            activeTool === 'pencil'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Pencil Tool (P) - Smooth vector sketching"
        >
          <Pencil className="w-5 h-5" />
          {activeTool === 'pencil' && (
            <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-white" />
          )}
        </button>

        {/* Eraser Tool */}
        <button
          onClick={() => { setActiveTool('eraser'); setActiveSubPanel('brush'); }}
          className={`p-2.5 rounded-xl cursor-pointer transition-all focus:outline-none relative ${
            activeTool === 'eraser'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Eraser Tool (E) - Clean vector eraser"
        >
          <Eraser className="w-5 h-5" />
          {activeTool === 'eraser' && (
            <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-white" />
          )}
        </button>

        {/* Text Tool */}
        <button
          onClick={() => { setActiveTool('text'); setActiveSubPanel('brush'); }}
          className={`p-2.5 rounded-xl cursor-pointer transition-all focus:outline-none ${
            activeTool === 'text'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Text Tool (T) - Click anywhere to type"
        >
          <Type className="w-5 h-5" />
        </button>

        {/* Shape Menu Trigger */}
        <button
          onClick={() => toggleSubPanel('shapes')}
          className={`p-2.5 rounded-xl cursor-pointer transition-all focus:outline-none flex items-center gap-0.5 relative ${
            isShapeActive
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Shape Tools (Line, Rectangle, Circle, Arrow, Triangle)"
        >
          <ActiveShapeIcon className="w-5 h-5" />
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeSubPanel === 'shapes' ? 'rotate-90' : ''}`} />
        </button>

        <div className="w-8 border-t border-slate-100 dark:border-slate-800 my-1" />

        {/* Color Indicator Trigger */}
        <button
          onClick={() => toggleSubPanel('color')}
          className="p-1 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all focus:outline-none"
          title="Color Settings"
        >
          <div
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs relative flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: color }}
          >
            {color === '#ffffff' && <div className="w-3 h-3 border-b-2 border-r-2 border-slate-400 transform rotate-45" />}
          </div>
        </button>

        <div className="w-8 border-t border-slate-100 dark:border-slate-800 my-1" />

        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2.5 rounded-xl transition-all focus:outline-none ${
            canUndo
              ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
              : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'
          }`}
          title="Undo (Ctrl + Z)"
        >
          <Undo2 className="w-5 h-5" />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2.5 rounded-xl transition-all focus:outline-none ${
            canRedo
              ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
              : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'
          }`}
          title="Redo (Ctrl + Y or Ctrl + Shift + Z)"
        >
          <Redo2 className="w-5 h-5" />
        </button>

        <div className="w-8 border-t border-slate-100 dark:border-slate-800 my-1" />

        {/* Import Trigger */}
        <button
          onClick={() => toggleSubPanel('import')}
          className={`p-2.5 rounded-xl cursor-pointer transition-all focus:outline-none ${
            activeSubPanel === 'import' ? 'bg-slate-100 dark:bg-slate-800 text-blue-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Import files (PNG, JPEG, SVG, PDF)"
        >
          <Upload className="w-5 h-5" />
        </button>

        {/* Export Trigger */}
        <button
          onClick={() => toggleSubPanel('export')}
          className={`p-2.5 rounded-xl cursor-pointer transition-all focus:outline-none ${
            activeSubPanel === 'export' ? 'bg-slate-100 dark:bg-slate-800 text-blue-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Export current whiteboard"
        >
          <Download className="w-5 h-5" />
        </button>

        {/* Quick Snapshot Trigger */}
        <button
          onClick={handleQuickSnapshotClick}
          className={`p-2.5 rounded-xl cursor-pointer transition-all focus:outline-none ${
            isCopiedFeedback
              ? 'bg-green-500 text-white shadow-md shadow-green-500/20'
              : 'text-blue-500 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title={selectedElement ? "Quick Snapshot: Copy Selected Item" : "Quick Snapshot: Copy Canvas Image"}
        >
          {isCopiedFeedback ? (
            <Check className="w-5 h-5 shrink-0" />
          ) : (
            <Camera className="w-5 h-5 shrink-0" />
          )}
        </button>

        <div className="w-8 border-t border-slate-100 dark:border-slate-800 my-1" />

        {/* Clear Trigger */}
        <button
          onClick={() => setShowClearConfirm(true)}
          className="p-2.5 rounded-xl cursor-pointer text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/25 transition-all focus:outline-none"
          title="Clear Board Canvas"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Floating Subpanels / Drawers */}
      <AnimatePresence>
        {/* Colors subpanel */}
        {activeSubPanel === 'color' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="ml-1"
          >
            <ColorPicker color={color} onChange={handleColorChange} recentColors={recentColors} />
          </motion.div>
        )}

        {/* Brush size & Font styles subpanel */}
        {activeSubPanel === 'brush' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="style-editor bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-2xl w-64 text-sm flex flex-col gap-4 text-slate-700 dark:text-slate-300"
          >
            {/* Width adjustment */}
            {activeTool !== 'text' && (
              <div>
                <div className="flex justify-between items-center mb-2 font-display">
                  <span className="font-semibold text-xs text-slate-400 uppercase tracking-wider">
                    {activeTool === 'eraser' ? 'Eraser Width' : (isShapeActive ? 'Border Width' : 'Brush Size')}
                  </span>
                  <span className="text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                    {currentWidthValue}px
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={activeTool === 'eraser' ? 100 : 50}
                    value={currentWidthValue}
                    onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Live Circle Preview */}
                <div className="flex justify-center items-center h-14 border border-dashed border-slate-100 dark:border-slate-800/80 rounded-xl mt-3 bg-slate-50/50 dark:bg-slate-950/20">
                  <div
                    className="rounded-full bg-slate-800 dark:bg-slate-200 transition-all shadow-xs"
                    style={{
                      width: `${currentWidthValue}px`,
                      height: `${currentWidthValue}px`,
                      backgroundColor: activeTool === 'eraser' ? '#f1f5f9' : color,
                      border: activeTool === 'eraser' ? '1px dashed #cbd5e1' : 'none'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Text options */}
            {activeTool === 'text' && (
              <div className="flex flex-col gap-3">
                {/* Font Family selector */}
                <div>
                  <div className="flex justify-between items-center mb-2 font-display">
                    <span className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Font Family</span>
                  </div>
                  <select
                    value={fontFamily}
                    onChange={(e) => handleFontFamilyChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer font-sans"
                  >
                    <option value="Inter, sans-serif">Sans-serif (Inter)</option>
                    <option value="Georgia, serif">Serif (Georgia)</option>
                    <option value="JetBrains Mono, monospace">Monospace (Mono)</option>
                  </select>
                </div>

                {/* Font Size slider */}
                <div>
                  <div className="flex justify-between items-center mb-2 font-display">
                    <span className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Font Size</span>
                    <span className="text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                      {fontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={120}
                    value={fontSize}
                    onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Bold / Italic Toggles */}
                <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <button
                    onClick={handleBoldToggle}
                    className={`flex-1 flex justify-center items-center py-2 rounded-xl border font-bold cursor-pointer transition-colors focus:outline-none ${
                      isBold
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Bold className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleItalicToggle}
                    className={`flex-1 flex justify-center items-center py-2 rounded-xl border italic cursor-pointer transition-colors focus:outline-none ${
                      isItalic
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Shapes Sub-panel */}
        {activeSubPanel === 'shapes' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl shadow-2xl flex flex-col gap-1 w-44 text-sm"
          >
            <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider font-display border-b border-slate-50 dark:border-slate-800/80 mb-1.5">Shapes</div>
            {SHAPES.map((sh) => {
              const ShIcon = sh.icon;
              const isSelected = activeTool === sh.type;
              return (
                <button
                  key={sh.type}
                  onClick={() => {
                    setActiveTool(sh.type);
                    setActiveSubPanel('brush'); // switch to brush properties immediately for thickness adjustments!
                  }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-left transition-colors focus:outline-none ${
                    isSelected
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <ShIcon className="w-4.5 h-4.5 shrink-0" />
                  <span className="font-sans text-xs font-medium">{sh.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}

        {/* Import subpanel */}
        {activeSubPanel === 'import' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl shadow-2xl flex flex-col gap-2 w-52 text-sm text-slate-600 dark:text-slate-300"
          >
            <div className="px-1 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider font-display border-b border-slate-50 dark:border-slate-800/80 mb-1">Import Files</div>
            <p className="text-[10px] text-slate-400 leading-normal px-1">Import PNG, JPEG, SVG or multi-page PDFs to mark up on the board.</p>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium cursor-pointer text-xs justify-center transition-colors focus:outline-none mt-1 shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Choose File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </motion.div>
        )}

        {/* Export subpanel */}
        {activeSubPanel === 'export' && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl shadow-2xl flex flex-col gap-1 w-44 text-sm text-slate-600 dark:text-slate-300"
          >
            <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider font-display border-b border-slate-50 dark:border-slate-800/80 mb-1.5">Export As</div>

            <button
              onClick={() => { onExport('png'); setActiveSubPanel('none'); }}
              className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-left transition-colors focus:outline-none"
            >
              <ImageIcon className="w-4.5 h-4.5 text-orange-500 shrink-0" />
              <span className="font-sans text-xs font-medium">Export PNG</span>
            </button>

            <button
              onClick={() => { onExport('jpeg'); setActiveSubPanel('none'); }}
              className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-left transition-colors focus:outline-none"
            >
              <ImageIcon className="w-4.5 h-4.5 text-blue-500 shrink-0" />
              <span className="font-sans text-xs font-medium">Export JPEG</span>
            </button>

            <button
              onClick={() => { onExport('svg'); setActiveSubPanel('none'); }}
              className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-left transition-colors focus:outline-none"
            >
              <FileSpreadsheet className="w-4.5 h-4.5 text-green-500 shrink-0" />
              <span className="font-sans text-xs font-medium">Export SVG</span>
            </button>

            <button
              onClick={() => { onExport('pdf'); setActiveSubPanel('none'); }}
              className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-left transition-colors focus:outline-none"
            >
              <FileDown className="w-4.5 h-4.5 text-red-500 shrink-0" />
              <span className="font-sans text-xs font-medium">Export PDF</span>
            </button>

            <div className="w-full border-t border-slate-100 dark:border-slate-800/80 my-1.5" />

            <button
              onClick={() => { handleQuickSnapshotClick(); setActiveSubPanel('none'); }}
              className="flex items-center gap-2.5 px-2.5 py-2.5 bg-blue-50/50 dark:bg-blue-950/25 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl cursor-pointer text-left transition-colors focus:outline-none"
              title="Copy the board snapshot directly to your clipboard"
            >
              <Camera className="w-4.5 h-4.5 text-blue-500 shrink-0" />
              <span className="font-sans text-xs font-semibold text-blue-600 dark:text-blue-400">Quick Snapshot</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Element floating adjustments when in select mode */}
      {activeTool === 'select' && selectedElement && (
        <div className="flex flex-col bg-slate-900/95 dark:bg-slate-950/95 border border-slate-800 dark:border-slate-800 p-2.5 rounded-2xl shadow-2xl gap-1 text-xs text-white min-w-44 select-none">
          <div className="text-[10px] text-slate-400 font-display font-semibold uppercase tracking-wider mb-1.5 px-1.5">Selected Item</div>

          {selectedElement.type !== 'image' && selectedElement.type !== 'text' && (
            <div className="flex flex-col gap-2 p-1 bg-slate-800/50 dark:bg-slate-900/50 rounded-xl mb-1 px-1.5 py-2">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Stroke Width</span>
                <span>{selectedElement.strokeWidth}px</span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={selectedElement.strokeWidth}
                onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          )}

          {selectedElement.type === 'text' && (
            <div className="flex flex-col gap-2 p-1 bg-slate-800/50 dark:bg-slate-900/50 rounded-xl mb-1 px-1.5 py-2">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Font Family</span>
              </div>
              <select
                value={selectedElement.fontFamily || 'Inter, sans-serif'}
                onChange={(e) => handleFontFamilyChange(e.target.value)}
                className="w-full text-[10px] px-1.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none cursor-pointer mb-1.5 font-sans"
              >
                <option value="Inter, sans-serif">Sans-serif (Inter)</option>
                <option value="Georgia, serif">Serif (Georgia)</option>
                <option value="JetBrains Mono, monospace">Monospace (Mono)</option>
              </select>

              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Font Size</span>
                <span>{selectedElement.fontSize || 20}px</span>
              </div>
              <input
                type="range"
                min={12}
                max={120}
                value={selectedElement.fontSize || 20}
                onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex gap-1.5 mt-1">
                <button
                  onClick={handleBoldToggle}
                  className={`flex-1 py-1 px-2 rounded-md border text-center font-bold text-[10px] cursor-pointer transition-colors ${
                    selectedElement.isBold ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  B
                </button>
                <button
                  onClick={handleItalicToggle}
                  className={`flex-1 py-1 px-2 rounded-md border text-center italic text-[10px] cursor-pointer transition-colors ${
                    selectedElement.isItalic ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  I
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-1">
            <button
              onClick={handleQuickSnapshotClick}
              className="flex-1 py-1.5 px-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-center cursor-pointer text-[10px] transition-colors flex items-center justify-center gap-1"
              title="Copy selected item as image to clipboard"
            >
              <Camera className="w-3 h-3 shrink-0" />
              <span>Snapshot</span>
            </button>
            <button
              onClick={onDuplicateSelected}
              className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-center cursor-pointer text-[10px] transition-colors"
            >
              Duplicate
            </button>
            <button
              onClick={onDeleteSelected}
              className="flex-1 py-1.5 px-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-center cursor-pointer text-[10px] transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-2xl max-w-sm w-full select-none"
            >
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display mb-2">Clear this Whiteboard?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                This will delete all drawings, shapes, and texts on the active whiteboard tab. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onClear();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors focus:outline-none shadow-sm shadow-red-500/10"
                >
                  Clear Board
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
