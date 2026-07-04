import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Sun, Moon, Sparkles, Keyboard, HelpCircle, X, Download, MousePointer, Hand, Pencil, Eraser, Type, Minus, Square, Circle as CircleIcon, ArrowRight, Triangle as TriangleIcon, Pin, PinOff, GripHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BoardElement, WhiteboardTab, ToolType, Point } from './types';
import { drawElement } from './utils/canvas';
import Tabs from './components/Tabs';
import Toolbar from './components/Toolbar';
import ZoomControls from './components/ZoomControls';
import WhiteboardCanvas from './components/WhiteboardCanvas';

const LOCAL_STORAGE_KEY = 'whiteboard_app_tabs_v2';
const COLOR_STORAGE_KEY = 'whiteboard_app_recents';
const DARK_MODE_KEY = 'whiteboard_app_darkmode';

const DEFAULT_ELEMENTS: BoardElement[] = [];

export default function App() {
  const [tabs, setTabs] = useState<WhiteboardTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');

  // Primary Tool Settings
  const [activeTool, setActiveTool] = useState<ToolType>('pencil');
  const [color, setColor] = useState<string>('#000000');
  const [recentColors, setRecentColors] = useState<string[]>(['#000000', '#ef4444', '#3b82f6', '#22c55e']);
  const [brushSize, setBrushSize] = useState<number>(5);
  const [shapeWidth, setShapeWidth] = useState<number>(3);
  const [fontSize, setFontSize] = useState<number>(24);
  const [fontFamily, setFontFamily] = useState<string>('Inter, sans-serif');
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);

  // Selected state
  const [selectedElement, setSelectedElement] = useState<BoardElement | null>(null);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Keyboard shortcut guide modal
  const [showShortcutGuide, setShowShortcutGuide] = useState<boolean>(false);
  const [isShortcutGuidePinned, setIsShortcutGuidePinned] = useState<boolean>(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Initialize: Load from LocalStorage
  useEffect(() => {
    // Theme load
    const storedDarkMode = localStorage.getItem(DARK_MODE_KEY);
    if (storedDarkMode === 'true') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Colors load
    const storedColors = localStorage.getItem(COLOR_STORAGE_KEY);
    if (storedColors) {
      try {
        setRecentColors(JSON.parse(storedColors));
      } catch (e) {
        console.error(e);
      }
    }

    // Whiteboard Tabs load
    const storedTabs = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedTabs) {
      try {
        const parsed: WhiteboardTab[] = JSON.parse(storedTabs);
        if (parsed.length > 0) {
          setTabs(parsed);
          setActiveTabId(parsed[0].id);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Default Tab creation if empty
    const firstTabId = `tab-${Date.now()}`;
    const initialTabs: WhiteboardTab[] = [
      {
        id: firstTabId,
        name: 'Whiteboard 1',
        elements: DEFAULT_ELEMENTS,
        history: [DEFAULT_ELEMENTS],
        historyIndex: 0,
        pan: { x: 0, y: 0 },
        zoom: 1.0
      }
    ];
    setTabs(initialTabs);
    setActiveTabId(firstTabId);
  }, []);

  // Sync Tabs to LocalStorage
  const saveToLocalStorage = (latestTabs: WhiteboardTab[]) => {
    // Strip imageElements (runtime-only cache) to prevent heavy local storage payload size
    const cleanedTabs = latestTabs.map(t => ({
      ...t,
      elements: t.elements.map(el => {
        const { imageElement, ...rest } = el;
        return rest;
      }),
      history: t.history.map(histList => histList.map(el => {
        const { imageElement, ...rest } = el;
        return rest;
      }))
    }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanedTabs));
  };

  // Switch dark mode
  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(DARK_MODE_KEY, 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(DARK_MODE_KEY, 'false');
    }
  };

  // Find active tab
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Helper to update active tab state and record history
  const updateActiveTab = (
    updater: (tab: WhiteboardTab) => Partial<WhiteboardTab>,
    recordHistory: boolean = false
  ) => {
    if (!activeTabId) return;

    setTabs((prevTabs) => {
      const nextTabs = prevTabs.map((t) => {
        if (t.id !== activeTabId) return t;

        const updatedFields = updater(t);
        const nextElements = updatedFields.elements ?? t.elements;

        let nextHistory = t.history;
        let nextHistoryIndex = t.historyIndex;

        if (recordHistory) {
          // Slice history list to remove any states after current index (redo states)
          const slicedHistory = t.history.slice(0, t.historyIndex + 1);
          // Append new state
          nextHistory = [...slicedHistory, nextElements];
          // Limit history to 50 states for memory optimization
          if (nextHistory.length > 50) {
            nextHistory.shift();
          }
          nextHistoryIndex = nextHistory.length - 1;
        }

        return {
          ...t,
          ...updatedFields,
          history: nextHistory,
          historyIndex: nextHistoryIndex
        };
      });

      saveToLocalStorage(nextTabs);
      return nextTabs;
    });
  };

  // Add a new element to drawing array
  const handleAddElement = (newEl: BoardElement) => {
    // Update recent colors if a new drawing color is used
    if (newEl.type !== 'eraser_stroke' && !recentColors.includes(newEl.color)) {
      const nextColors = [newEl.color, ...recentColors.slice(0, 7)];
      setRecentColors(nextColors);
      localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(nextColors));
    }

    if (!activeTab) return;
    const nextElements = [...activeTab.elements, newEl];
    updateActiveTab(
      () => ({ elements: nextElements }),
      true // Record history state!
    );
  };

  // Update an existing element properties
  const handleUpdateElement = (id: string, props: Partial<BoardElement>) => {
    if (!activeTab) return;
    const nextElements = activeTab.elements.map((el) => {
      if (el.id !== id) return el;
      return { ...el, ...props };
    });
    updateActiveTab(
      () => ({ elements: nextElements }),
      false // Dragging/resizing does not commit full history snapshots until release to optimize performance
    );
  };

  // Record history snapshot when selection drag/resize completes
  const handleCommitMoveOrResizeHistory = () => {
    if (!activeTab) return;
    updateActiveTab(
      () => ({ elements: activeTab.elements }),
      true // Commit history!
    );
  };

  // Duplicate active selected element
  const handleDuplicateSelected = () => {
    if (!selectedElement || !activeTab) return;

    const offset = 30; // spawn slightly shifted
    const duplicated: BoardElement = {
      ...selectedElement,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: selectedElement.x + offset,
      y: selectedElement.y + offset
    };

    const nextElements = [...activeTab.elements, duplicated];
    updateActiveTab(
      () => ({ elements: nextElements }),
      true
    );
    setSelectedElement(duplicated); // auto select duplicated element
  };

  // Delete active selected element
  const handleDeleteSelected = () => {
    if (!selectedElement || !activeTab) return;

    const nextElements = activeTab.elements.filter(el => el.id !== selectedElement.id);
    updateActiveTab(
      () => ({ elements: nextElements }),
      true
    );
    setSelectedElement(null);
  };

  // Undo action
  const handleUndo = () => {
    if (!activeTab || activeTab.historyIndex <= 0) return;

    const nextIndex = activeTab.historyIndex - 1;
    const prevElements = activeTab.history[nextIndex];

    setSelectedElement(null);
    updateActiveTab(() => ({
      elements: prevElements,
      historyIndex: nextIndex
    }));
  };

  // Redo action
  const handleRedo = () => {
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;

    const nextIndex = activeTab.historyIndex + 1;
    const nextElements = activeTab.history[nextIndex];

    setSelectedElement(null);
    updateActiveTab(() => ({
      elements: nextElements,
      historyIndex: nextIndex
    }));
  };

  // Clear canvas action
  const handleClearCanvas = () => {
    setSelectedElement(null);
    updateActiveTab(
      () => ({ elements: [] }),
      true
    );
  };

  // Reset Zoom and pan center
  const handleResetZoomAndPan = () => {
    updateActiveTab(() => ({
      zoom: 1.0,
      pan: { x: 0, y: 0 }
    }));
  };

  // Toggle hand pan tool
  const handleToggleHand = () => {
    setActiveTool(activeTool === 'hand' ? 'select' : 'hand');
  };

  // Tabs management
  const handleSelectTab = (id: string) => {
    setSelectedElement(null);
    setActiveTabId(id);
  };

  const handleAddTab = () => {
    setSelectedElement(null);
    const id = `tab-${Date.now()}`;
    // Find highest whiteboard tab number to increment name sequentially
    const numbers = tabs.map(t => {
      const match = t.name.match(/Whiteboard\s+(\d+)/i);
      return match ? parseInt(match[1]) : 0;
    });
    const nextNum = Math.max(0, ...numbers) + 1;

    const newTab: WhiteboardTab = {
      id,
      name: `Whiteboard ${nextNum}`,
      elements: [],
      history: [[]],
      historyIndex: 0,
      pan: { x: 0, y: 0 },
      zoom: 1.0
    };

    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(id);
    saveToLocalStorage(nextTabs);
  };

  const handleRenameTab = (id: string, newName: string) => {
    const nextTabs = tabs.map((t) => {
      if (t.id !== id) return t;
      return { ...t, name: newName };
    });
    setTabs(nextTabs);
    saveToLocalStorage(nextTabs);
  };

  const handleDuplicateTab = (id: string) => {
    const sourceTab = tabs.find(t => t.id === id);
    if (!sourceTab) return;

    setSelectedElement(null);
    const newId = `tab-${Date.now()}`;

    // Deep copy elements to clear any references
    const clonedElements = JSON.parse(JSON.stringify(sourceTab.elements));

    const newTab: WhiteboardTab = {
      id: newId,
      name: `${sourceTab.name} (Copy)`,
      elements: clonedElements,
      history: [clonedElements],
      historyIndex: 0,
      pan: { ...sourceTab.pan },
      zoom: sourceTab.zoom
    };

    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(newId);
    saveToLocalStorage(nextTabs);
  };

  const handleDeleteTab = (id: string) => {
    if (tabs.length <= 1) return; // Prevent deleting the last remaining tab

    setSelectedElement(null);
    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);

    // If active tab was deleted, switch to the nearest existing tab
    if (activeTabId === id) {
      const deletedIdx = tabs.findIndex(t => t.id === id);
      const fallbackIdx = deletedIdx === 0 ? 0 : deletedIdx - 1;
      setActiveTabId(nextTabs[fallbackIdx].id);
    }

    saveToLocalStorage(nextTabs);
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if focusing in text boxes or input elements
      const targetTag = (e.target as HTMLElement).tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // Undo / Redo
      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // New whiteboard
      if (isCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleAddTab();
        return;
      }

      // Download / Export Trigger (defaults to PNG)
      if (isCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleExport('png');
        return;
      }

      // Delete selected element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElement) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      // Tool toggles (single letter keys)
      switch (e.key.toLowerCase()) {
        case 'p':
          setActiveTool('pencil');
          break;
        case 'e':
          setActiveTool('eraser');
          break;
        case 't':
          setActiveTool('text');
          break;
        case 'v':
          setActiveTool('select');
          break;
        case 'h':
          setActiveTool('hand');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabs, activeTabId, selectedElement, activeTool, brushSize, shapeWidth, fontSize, fontFamily, isBold, isItalic]);

  // File Import handler
  const handleImportFile = (file: File) => {
    const reader = new FileReader();

    if (file.type.startsWith('image/')) {
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) return;

        const img = new Image();
        img.src = result;
        img.onload = () => {
          const id = `img-${Date.now()}`;
          // Center image roughly in viewport
          const zoomOffset = activeTab ? activeTab.zoom : 1;
          const panOffset = activeTab ? activeTab.pan : { x: 0, y: 0 };
          const centerX = (window.innerWidth / 2 - panOffset.x) / zoomOffset;
          const centerY = (window.innerHeight / 2 - panOffset.y) / zoomOffset;

          const defaultWidth = Math.min(400, img.width);
          const defaultHeight = (defaultWidth / img.width) * img.height;

          const newEl: BoardElement = {
            id,
            type: 'image',
            x: centerX - defaultWidth / 2,
            y: centerY - defaultHeight / 2,
            width: defaultWidth,
            height: defaultHeight,
            color: '#000000',
            strokeWidth: 1,
            imageUrl: result,
            imageElement: img
          };

          handleAddElement(newEl);
          setActiveTool('select');
          setSelectedElement(newEl);
        };
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      // PDF documents - create an elegant digital placeholder box allowing them to draw on top of it!
      const id = `pdf-${Date.now()}`;
      const zoomOffset = activeTab ? activeTab.zoom : 1;
      const panOffset = activeTab ? activeTab.pan : { x: 0, y: 0 };
      const centerX = (window.innerWidth / 2 - panOffset.x) / zoomOffset;
      const centerY = (window.innerHeight / 2 - panOffset.y) / zoomOffset;

      const newEl: BoardElement = {
        id,
        type: 'text',
        x: centerX - 180,
        y: centerY - 100,
        width: 360,
        height: 180,
        color: isDarkMode ? '#3b82f6' : '#2563eb',
        strokeWidth: 2,
        text: `📄 PDF IMPORTED ASSISTANT CARD\nDocument Name: ${file.name}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\n[Markup Ready: You can sketch,\nplace notes, and shapes on top\nof this zone naturally!]`,
        fontSize: 16,
        isBold: true,
        isItalic: false
      };

      handleAddElement(newEl);
      setActiveTool('select');
      setSelectedElement(newEl);
    }
  };

  // File Export / Download handler
  const handleExport = (format: 'png' | 'jpeg' | 'svg' | 'pdf') => {
    if (!activeTab || activeTab.elements.length === 0) {
      alert('This whiteboard tab is currently empty. Add some drawings first to export!');
      return;
    }

    // Calculate crop bounds containing all vector elements
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    activeTab.elements.forEach((el) => {
      const elMinX = Math.min(el.x, el.x + el.width);
      const elMaxX = Math.max(el.x, el.x + el.width);
      const elMinY = Math.min(el.y, el.y + el.height);
      const elMaxY = Math.max(el.y, el.y + el.height);

      minX = Math.min(minX, elMinX);
      minY = Math.min(minY, elMinY);
      maxX = Math.max(maxX, elMaxX);
      maxY = Math.max(maxY, elMaxY);
    });

    const padding = 30;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // 1. Vector SVG Export (Masterpiece true-vector generation!)
    if (format === 'svg') {
      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">\n`;
      // Draw background
      svgContent += `  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${isDarkMode ? '#0f172a' : '#ffffff'}" />\n`;

      activeTab.elements.forEach((el) => {
        let strokeColor = el.color;
        // Adjust for visibility
        if (isDarkMode && strokeColor.toLowerCase() === '#000000') strokeColor = '#ffffff';
        if (!isDarkMode && strokeColor.toLowerCase() === '#ffffff') strokeColor = '#cbd5e1';

        switch (el.type) {
          case 'pencil':
            if (el.points && el.points.length > 0) {
              const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              svgContent += `  <path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />\n`;
            }
            break;

          case 'eraser_stroke':
            if (el.points && el.points.length > 0) {
              // Eraser paths rendered in background color
              const eraserColor = isDarkMode ? '#0f172a' : '#ffffff';
              const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              svgContent += `  <path d="${d}" fill="none" stroke="${eraserColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />\n`;
            }
            break;

          case 'rectangle':
            svgContent += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="none" stroke="${strokeColor}" stroke-width="${el.strokeWidth}" />\n`;
            break;

          case 'circle':
            svgContent += `  <ellipse cx="${el.x + el.width / 2}" cy="${el.y + el.height / 2}" rx="${Math.abs(el.width / 2)}" ry="${Math.abs(el.height / 2)}" fill="none" stroke="${strokeColor}" stroke-width="${el.strokeWidth}" />\n`;
            break;

          case 'triangle':
            const pts = `${el.x + el.width / 2},${el.y} ${el.x + el.width},${el.y + el.height} ${el.x},${el.y + el.height}`;
            svgContent += `  <polygon points="${pts}" fill="none" stroke="${strokeColor}" stroke-width="${el.strokeWidth}" />\n`;
            break;

          case 'line':
            svgContent += `  <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${strokeColor}" stroke-width="${el.strokeWidth}" />\n`;
            break;

          case 'arrow':
            svgContent += `  <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${strokeColor}" stroke-width="${el.strokeWidth}" />\n`;
            // Bounding arrow angle
            const angle = Math.atan2(el.height, el.width);
            const arrowLength = Math.max(12, el.strokeWidth * 3);
            const endX = el.x + el.width;
            const endY = el.y + el.height;
            const h1x = endX - arrowLength * Math.cos(angle - Math.PI / 6);
            const h1y = endY - arrowLength * Math.sin(angle - Math.PI / 6);
            const h2x = endX - arrowLength * Math.cos(angle + Math.PI / 6);
            const h2y = endY - arrowLength * Math.sin(angle + Math.PI / 6);
            svgContent += `  <polygon points="${endX},${endY} ${h1x},${h1y} ${h2x},${h2y}" fill="${strokeColor}" />\n`;
            break;

          case 'text':
            if (el.text) {
              const lines = el.text.split('\n');
              const size = el.fontSize || 20;
              lines.forEach((line, index) => {
                const textY = el.y + index * size * 1.25 + size;
                svgContent += `  <text x="${el.x}" y="${textY}" font-family="Inter, sans-serif" font-size="${size}" font-weight="${el.isBold ? 'bold' : 'normal'}" font-style="${el.isItalic ? 'italic' : 'normal'}" fill="${strokeColor}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>\n`;
              });
            }
            break;

          case 'image':
            if (el.imageUrl) {
              svgContent += `  <image href="${el.imageUrl}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" />\n`;
            }
            break;
        }
      });

      svgContent += '</svg>';

      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${activeTab.name.toLowerCase().replace(/\s+/g, '_')}_export.svg`);
      return;
    }

    // 2. Raster offscreen canvas drawing (PNG / JPEG)
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    // Fill Background
    ctx.fillStyle = format === 'jpeg' ? '#ffffff' : (isDarkMode ? '#0f172a' : '#ffffff');
    ctx.fillRect(0, 0, width, height);

    // Apply offset transform to match cropped bounding box bounds!
    ctx.translate(-minX, -minY);

    // Render elements
    activeTab.elements.forEach((element) => {
      // Temporarily swap black to white if dark mode and JPEG requires solid white bg
      const originalColor = element.color;
      if (format === 'jpeg' && originalColor.toLowerCase() === '#ffffff') {
        element.color = '#e2e8f0'; // make white visible on white background jpeg
      }
      drawElement(ctx, element, isDarkMode);
      element.color = originalColor; // restore
    });

    if (format === 'png') {
      const url = offCanvas.toDataURL('image/png');
      triggerDownload(url, `${activeTab.name.toLowerCase().replace(/\s+/g, '_')}_export.png`);
    } else if (format === 'jpeg') {
      const url = offCanvas.toDataURL('image/jpeg', 0.95);
      triggerDownload(url, `${activeTab.name.toLowerCase().replace(/\s+/g, '_')}_export.jpg`);
    } else if (format === 'pdf') {
      // 3. Document PDF Export
      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height]
      });
      const imgData = offCanvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, width, height);
      pdf.save(`${activeTab.name.toLowerCase().replace(/\s+/g, '_')}_export.pdf`);
    }
  };

  // Triggers browser native download anchor
  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Quick Snapshot handler: copies the selected drawing or entire canvas as base64 and actual image blob to clipboard
  const handleQuickSnapshot = async () => {
    if (!activeTab) return;

    const hasElements = activeTab.elements.length > 0;
    if (!hasElements && !selectedElement) {
      showToast('This whiteboard tab is currently empty!', 'error');
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    if (selectedElement) {
      // Crop to the bounds of the selected element
      const el = selectedElement;
      
      // Calculate more precise bounds for drawings
      if (el.type === 'pencil' || el.type === 'eraser_stroke') {
        if (el.points && el.points.length > 0) {
          el.points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          });
        } else {
          minX = el.x;
          minY = el.y;
          maxX = el.x + el.width;
          maxY = el.y + el.height;
        }
      } else {
        minX = Math.min(el.x, el.x + el.width);
        maxX = Math.max(el.x, el.x + el.width);
        minY = Math.min(el.y, el.y + el.height);
        maxY = Math.max(el.y, el.y + el.height);
      }
    } else {
      // Calculate bounds for the entire whiteboard drawings
      activeTab.elements.forEach((el) => {
        if (el.type === 'pencil' || el.type === 'eraser_stroke') {
          if (el.points && el.points.length > 0) {
            el.points.forEach(p => {
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x);
              maxY = Math.max(maxY, p.y);
            });
          } else {
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
            maxX = Math.max(maxX, el.x + el.width);
            maxY = Math.max(maxY, el.y + el.height);
          }
        } else {
          const elMinX = Math.min(el.x, el.x + el.width);
          const elMaxX = Math.max(el.x, el.x + el.width);
          const elMinY = Math.min(el.y, el.y + el.height);
          const elMaxY = Math.max(el.y, el.y + el.height);

          minX = Math.min(minX, elMinX);
          minY = Math.min(minY, elMinY);
          maxX = Math.max(maxX, elMaxX);
          maxY = Math.max(maxY, elMaxY);
        }
      });
    }

    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
      showToast('Could not calculate drawings bounds', 'error');
      return;
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) {
      showToast('Could not create snapshot canvas context', 'error');
      return;
    }

    // Fill background matching current theme
    ctx.fillStyle = isDarkMode ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Apply offset translate
    ctx.translate(-minX, -minY);

    if (selectedElement) {
      // Draw selected element
      drawElement(ctx, selectedElement, isDarkMode);
    } else {
      // Draw all elements
      activeTab.elements.forEach((element) => {
        drawElement(ctx, element, isDarkMode);
      });
    }

    try {
      const dataUrl = offCanvas.toDataURL('image/png');

      offCanvas.toBlob(async (blob) => {
        if (!blob) {
          showToast('Failed to create snapshot image blob', 'error');
          return;
        }

        try {
          // Write both png and fallback plain text base64 dataUrl
          const textBlob = new Blob([dataUrl], { type: 'text/plain' });
          const item = new ClipboardItem({
            'image/png': blob,
            'text/plain': textBlob
          });
          await navigator.clipboard.write([item]);
          showToast(selectedElement ? 'Element snapshot copied!' : 'Canvas snapshot copied!');
        } catch (err) {
          console.warn('ClipboardItem writing failed, falling back to base64 text...', err);
          try {
            await navigator.clipboard.writeText(dataUrl);
            showToast('Snapshot base64 copied as text!');
          } catch (writeTextErr) {
            console.error('All clipboard options failed:', writeTextErr);
            showToast('Clipboard access denied. Please grant permissions.', 'error');
          }
        }
      }, 'image/png');
    } catch (err) {
      console.error('Snapshot failed:', err);
      showToast('Failed to generate snapshot', 'error');
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors font-sans relative overflow-hidden">
      {/* HEADER BAR: Tabs & Utilities */}
      <div className="h-12 bg-gray-100 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center px-4 gap-4 shrink-0 z-30">
        {/* Logo brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6.5 h-6.5 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/10">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold tracking-tight font-display text-slate-800 dark:text-slate-100">
            Artistic Board
          </span>
        </div>

        <div className="h-5 w-px bg-gray-200 dark:bg-slate-800 shrink-0" />

        {/* Dynamic Infinite Tabs bar */}
        <div className="flex-1 h-full overflow-hidden">
          <Tabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={handleSelectTab}
            onAddTab={handleAddTab}
            onRenameTab={handleRenameTab}
            onDuplicateTab={handleDuplicateTab}
            onDeleteTab={handleDeleteTab}
          />
        </div>

        {/* Utilities */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Shortcut helper trigger */}
          <button
            onClick={() => setShowShortcutGuide(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50 cursor-pointer focus:outline-none transition-colors"
            title="Keyboard Shortcuts Guide"
          >
            <Keyboard className="w-4 h-4" />
            <span className="font-semibold hidden sm:inline">Shortcuts</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer focus:outline-none"
            title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>
        </div>
      </div>

      {/* CENTER: Drawing Canvas Zone */}
      <div className="flex-1 w-full h-full relative z-10 bg-slate-50 dark:bg-slate-950">
        {activeTab ? (
          <WhiteboardCanvas
            elements={activeTab.elements}
            onAddElement={handleAddElement}
            onUpdateElement={handleUpdateElement}
            zoom={activeTab.zoom}
            setZoom={(z) => updateActiveTab(() => ({ zoom: z }))}
            pan={activeTab.pan}
            setPan={(p) => updateActiveTab(() => ({ pan: p }))}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            color={color}
            brushSize={brushSize}
            shapeWidth={shapeWidth}
            fontSize={fontSize}
            fontFamily={fontFamily}
            isBold={isBold}
            isItalic={isItalic}
            selectedElement={selectedElement}
            setSelectedElement={setSelectedElement}
            isDarkMode={isDarkMode}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-slate-400 text-sm font-sans font-medium">
            Creating whiteboard environment...
          </div>
        )}
      </div>

      {/* LEFT: Movable floating toolbar */}
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        color={color}
        setColor={setColor}
        recentColors={recentColors}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        shapeWidth={shapeWidth}
        setShapeWidth={setShapeWidth}
        fontSize={fontSize}
        setFontSize={setFontSize}
        fontFamily={fontFamily}
        setFontFamily={setFontFamily}
        isBold={isBold}
        setIsBold={setIsBold}
        isItalic={isItalic}
        setIsItalic={setIsItalic}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={activeTab ? activeTab.historyIndex > 0 : false}
        canRedo={activeTab ? activeTab.historyIndex < activeTab.history.length - 1 : false}
        onClear={handleClearCanvas}
        onExport={handleExport}
        onImportFile={handleImportFile}
        onQuickSnapshot={handleQuickSnapshot}
        selectedElement={selectedElement}
        onUpdateSelectedElement={(props) => {
          if (selectedElement) {
            handleUpdateElement(selectedElement.id, props);
          }
        }}
        onDuplicateSelected={handleDuplicateSelected}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* BOTTOM RIGHT: Zoom and navigation controls */}
      <ZoomControls
        zoom={activeTab ? activeTab.zoom : 1.0}
        setZoom={(z) => updateActiveTab(() => ({ zoom: z }))}
        onResetZoomAndPan={handleResetZoomAndPan}
        isHandActive={activeTool === 'hand'}
        onToggleHand={handleToggleHand}
      />

      {/* MODAL: Keyboard Shortcuts Help Guide */}
      <AnimatePresence>
        {showShortcutGuide && (
          isShortcutGuidePinned ? (
            /* PINNED FLOATING DRAGGABLE WINDOW */
            <div className="fixed right-6 top-28 z-40 p-0 pointer-events-none select-none">
              <motion.div
                drag
                dragMomentum={false}
                dragElastic={0.1}
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xl w-80 text-slate-800 dark:text-slate-100 font-sans pointer-events-auto cursor-default"
              >
                {/* Header with Drag Handle */}
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-0.5 pr-2" title="Drag to move panel">
                    <GripHorizontal className="w-4 h-4 shrink-0" />
                    <Keyboard className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-bold font-display text-slate-700 dark:text-slate-300">Shortcuts (Pinned)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsShortcutGuidePinned(false)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none cursor-pointer transition-all"
                      title="Unpin / Modal view"
                    >
                      <PinOff className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowShortcutGuide(false)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none cursor-pointer transition-colors"
                      title="Close panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-4">
                  {/* Visual Tools Palette with Active State */}
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-display mb-2">
                      Active Tool & Selector
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { id: 'select' as ToolType, icon: MousePointer, label: 'Select', shortcut: 'V' },
                        { id: 'hand' as ToolType, icon: Hand, label: 'Hand', shortcut: 'H' },
                        { id: 'pencil' as ToolType, icon: Pencil, label: 'Pencil', shortcut: 'P' },
                        { id: 'eraser' as ToolType, icon: Eraser, label: 'Eraser', shortcut: 'E' },
                        { id: 'text' as ToolType, icon: Type, label: 'Text', shortcut: 'T' }
                      ].map((t) => {
                        const Icon = t.icon;
                        const isActive = activeTool === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setActiveTool(t.id)}
                            className={`relative flex flex-col items-center justify-center py-2 px-0.5 rounded-xl border text-center transition-all cursor-pointer focus:outline-none group ${
                              isActive
                                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shadow-xs'
                                : 'border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                            title={`Switch to ${t.label} [${t.shortcut}]`}
                          >
                            <Icon className={`w-4 h-4 mb-1 transition-transform group-hover:scale-105 ${isActive ? 'scale-105' : ''}`} />
                            <span className="text-[9px] font-medium tracking-tight truncate w-full">{t.label}</span>
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[8px] font-bold font-mono text-slate-500 dark:text-slate-400 border border-white dark:border-slate-900 shadow-xs">
                              {t.shortcut}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-5 gap-1 mt-2">
                      {[
                        { id: 'line' as ToolType, icon: Minus, label: 'Line' },
                        { id: 'rectangle' as ToolType, icon: Square, label: 'Rect' },
                        { id: 'circle' as ToolType, icon: CircleIcon, label: 'Circ' },
                        { id: 'arrow' as ToolType, icon: ArrowRight, label: 'Arrow' },
                        { id: 'triangle' as ToolType, icon: TriangleIcon, label: 'Tri' }
                      ].map((t) => {
                        const Icon = t.icon;
                        const isActive = activeTool === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setActiveTool(t.id)}
                            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg border text-center transition-all cursor-pointer focus:outline-none group ${
                              isActive
                                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shadow-xs'
                                : 'border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-900/20 text-slate-400 dark:text-slate-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                            title={`Switch to ${t.label} Shape`}
                          >
                            <Icon className="w-3.5 h-3.5 mb-0.5 group-hover:scale-105 text-slate-400 dark:text-slate-500" />
                            <span className="text-[8px] font-medium tracking-tight truncate w-full">{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Shortcuts reference list (stacked/vertical for compact pinned view) */}
                  <div className="flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-800/60 pt-3 text-xs">
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-display mb-1">
                      Key References
                    </div>
                    
                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1">
                      <span className="text-slate-500 dark:text-slate-400">Pencil Mode</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-semibold">P</kbd>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1">
                      <span className="text-slate-500 dark:text-slate-400">Eraser Mode</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-semibold">E</kbd>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1">
                      <span className="text-slate-500 dark:text-slate-400">Text Tool</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-semibold">T</kbd>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1">
                      <span className="text-slate-500 dark:text-slate-400">Selection Tool</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-semibold">V</kbd>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1">
                      <span className="text-slate-500 dark:text-slate-400">Hand (Pan)</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-semibold">H</kbd>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1">
                      <span className="text-slate-500 dark:text-slate-400">Undo Action</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-semibold">Ctrl + Z</kbd>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1">
                      <span className="text-slate-500 dark:text-slate-400">Redo Action</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-semibold">Ctrl + Y</kbd>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1">
                      <span className="text-slate-500 dark:text-slate-400">New Whiteboard</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-semibold">Ctrl + N</kbd>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1">
                      <span className="text-slate-500 dark:text-slate-400">Export PNG</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-semibold">Ctrl + S</kbd>
                    </div>

                    <div className="flex justify-between items-center pb-1">
                      <span className="text-slate-500 dark:text-slate-400">Delete Element</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono font-semibold">Del</kbd>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            /* STANDARD MODAL VIEW with Overlay Backdrop */
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-2xl max-w-md w-full text-slate-800 dark:text-slate-100 font-sans"
              >
                {/* Header */}
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-5 h-5 text-blue-500" />
                    <h3 className="text-base font-bold font-display">Keyboard Shortcuts</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIsShortcutGuidePinned(true)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 focus:outline-none cursor-pointer transition-all"
                      title="Pin to screen"
                    >
                      <Pin className="w-4.5 h-4.5" />
                    </button>
                    <button
                      onClick={() => setShowShortcutGuide(false)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none cursor-pointer transition-colors"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-5">
                  {/* Visual Tools Palette with Active State */}
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-display mb-2.5">
                      Active Tool & Selector
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { id: 'select' as ToolType, icon: MousePointer, label: 'Select', shortcut: 'V' },
                        { id: 'hand' as ToolType, icon: Hand, label: 'Hand', shortcut: 'H' },
                        { id: 'pencil' as ToolType, icon: Pencil, label: 'Pencil', shortcut: 'P' },
                        { id: 'eraser' as ToolType, icon: Eraser, label: 'Eraser', shortcut: 'E' },
                        { id: 'text' as ToolType, icon: Type, label: 'Text', shortcut: 'T' }
                      ].map((t) => {
                        const Icon = t.icon;
                        const isActive = activeTool === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setActiveTool(t.id)}
                            className={`relative flex flex-col items-center justify-center py-3 px-1 rounded-2xl border text-center transition-all cursor-pointer focus:outline-none group ${
                              isActive
                                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10'
                                : 'border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                            title={`Switch to ${t.label} [${t.shortcut}]`}
                          >
                            <Icon className={`w-5 h-5 mb-1 transition-transform group-hover:scale-105 ${isActive ? 'scale-105' : ''}`} />
                            <span className="text-[10px] font-semibold tracking-tight truncate w-full">{t.label}</span>
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[9px] font-bold font-mono text-slate-600 dark:text-slate-400 border border-white dark:border-slate-900 shadow-xs">
                              {t.shortcut}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 mt-2.5">
                      {[
                        { id: 'line' as ToolType, icon: Minus, label: 'Line' },
                        { id: 'rectangle' as ToolType, icon: Square, label: 'Rect' },
                        { id: 'circle' as ToolType, icon: CircleIcon, label: 'Circ' },
                        { id: 'arrow' as ToolType, icon: ArrowRight, label: 'Arrow' },
                        { id: 'triangle' as ToolType, icon: TriangleIcon, label: 'Tri' }
                      ].map((t) => {
                        const Icon = t.icon;
                        const isActive = activeTool === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setActiveTool(t.id)}
                            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition-all cursor-pointer focus:outline-none group ${
                              isActive
                                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shadow-xs'
                                : 'border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-900/20 text-slate-400 dark:text-slate-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                            title={`Switch to ${t.label} Shape`}
                          >
                            <Icon className="w-4 h-4 mb-1 group-hover:scale-105 text-slate-400 dark:text-slate-500" />
                            <span className="text-[9px] font-medium tracking-tight truncate w-full">{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dual columns for standard view */}
                  <div className="grid grid-cols-2 gap-x-5 gap-y-3.5 text-xs border-t border-slate-100 dark:border-slate-800/60 pt-4">
                    {/* Column 1: Drawing Hotkeys */}
                    <div className="flex flex-col gap-2">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-display mb-1">
                        Drawing Tools
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Pencil Mode</span>
                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-semibold">P</kbd>
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Eraser Mode</span>
                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-semibold">E</kbd>
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Text Tool</span>
                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-semibold">T</kbd>
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Selection Tool</span>
                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-semibold">V</kbd>
                      </div>

                      <div className="flex justify-between items-center pb-1">
                        <span className="text-slate-500 dark:text-slate-400">Hand Tool</span>
                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-semibold">H</kbd>
                      </div>
                    </div>

                    {/* Column 2: Core Actions */}
                    <div className="flex flex-col gap-2">
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-display mb-1">
                        Core Actions
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Undo Action</span>
                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-semibold">Ctrl + Z</kbd>
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Redo Action</span>
                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-semibold">Ctrl + Y</kbd>
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">New Board</span>
                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-semibold">Ctrl + N</kbd>
                      </div>

                      <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800/30 pb-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Export PNG</span>
                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-semibold">Ctrl + S</kbd>
                      </div>

                      <div className="flex justify-between items-center pb-1">
                        <span className="text-slate-500 dark:text-slate-400">Delete Element</span>
                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono font-semibold">Del</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowShortcutGuide(false)}
                  className="w-full mt-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors focus:outline-none shadow-sm shadow-blue-500/10"
                >
                  Got it
                </button>
              </motion.div>
            </div>
          )
        )}
      </AnimatePresence>
      {/* BOTTOM CENTER: Artistic Status Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-[0.2em] pointer-events-none z-20">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Canvas Ready
        </span>
        <span>LocalStorage Active</span>
        <span>Autosave Enabled</span>
      </div>

      {/* Toast Notification overlay */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-sans font-semibold border text-white ${
              toast.type === 'error'
                ? 'bg-red-500 border-red-400'
                : toast.type === 'info'
                ? 'bg-blue-500 border-blue-400'
                : 'bg-slate-900/95 dark:bg-slate-800/95 border-slate-800 dark:border-slate-700'
            }`}
          >
            {toast.type === 'success' && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
