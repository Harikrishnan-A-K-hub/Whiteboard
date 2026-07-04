import React, { useRef, useEffect, useState } from 'react';
import { BoardElement, Point, ToolType, ResizeHandle } from '../types';
import {
  drawElement,
  drawSelectionOutline,
  getElementAtPosition,
  getResizeHandleAtPosition,
  getBoundingBox,
  getDistance,
  drawBezierPath
} from '../utils/canvas';

interface WhiteboardCanvasProps {
  elements: BoardElement[];
  onAddElement: (el: BoardElement) => void;
  onUpdateElement: (id: string, props: Partial<BoardElement>) => void;
  zoom: number;
  setZoom: (z: number) => void;
  pan: { x: number; y: number };
  setPan: (p: { x: number; y: number }) => void;
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  color: string;
  brushSize: number;
  shapeWidth: number;
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  selectedElement: BoardElement | null;
  setSelectedElement: (el: BoardElement | null) => void;
  isDarkMode: boolean;
}

export default function WhiteboardCanvas({
  elements,
  onAddElement,
  onUpdateElement,
  zoom,
  setZoom,
  pan,
  setPan,
  activeTool,
  setActiveTool,
  color,
  brushSize,
  shapeWidth,
  fontSize,
  fontFamily,
  isBold,
  isItalic,
  selectedElement,
  setSelectedElement,
  isDarkMode
}: WhiteboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Interaction State
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point>({ x: 0, y: 0 });
  const [currentPoint, setCurrentPoint] = useState<Point>({ x: 0, y: 0 });
  const [tempPoints, setTempPoints] = useState<Point[]>([]);

  // Text placing / Editing overlay
  const [textEditState, setTextEditState] = useState<{
    id?: string; // empty if new
    x: number;
    y: number;
    val: string;
    fontSize: number;
    fontFamily: string;
    isBold: boolean;
    isItalic: boolean;
    color?: string;
    angle?: number;
  } | null>(null);

  // Selection Drag/Resize State
  const [action, setAction] = useState<'none' | 'drawing' | 'moving' | 'resizing' | 'panning' | 'text-input'>('none');
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [initialSelectedElement, setInitialSelectedElement] = useState<BoardElement | null>(null);

  // Touch zoom/pinch state
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [touchStartZoom, setTouchStartZoom] = useState<number>(1);

  // Resize canvas to fill viewport
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    };

    window.addEventListener('resize', handleResize);
    // Initial size
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [elements, zoom, pan, selectedElement, isDarkMode]);

  // Focus textarea when text edit state becomes active (only on initial opening/selection to avoid jumping/keyboard flickering)
  const isEditingText = textEditState !== null;
  const editingId = textEditState?.id;
  useEffect(() => {
    if (isEditingText && textareaRef.current) {
      // Direct focus
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);

      // Async fallback to ensure focus is not stolen by subsequent pointerup/click browser actions
      const timeoutId = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const currentLen = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(currentLen, currentLen);
        }
      }, 30);
      return () => clearTimeout(timeoutId);
    }
  }, [isEditingText, editingId]);

  // Sync toolbar styling changes to the active text edit overlay in real-time
  useEffect(() => {
    if (textEditState) {
      setTextEditState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          fontSize,
          fontFamily,
          isBold,
          isItalic,
          color
        };
      });
    }
  }, [fontSize, fontFamily, isBold, isItalic, color]);

  // Convert screen coordinates to canvas space
  const getCanvasCoords = (clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom
    };
  };

  // Redraw the canvas
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure offscreen canvas exists and matches size
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offscreenCanvas = offscreenCanvasRef.current;
    if (offscreenCanvas.width !== canvas.width || offscreenCanvas.height !== canvas.height) {
      offscreenCanvas.width = canvas.width;
      offscreenCanvas.height = canvas.height;
    }
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) return;

    // Clear offscreen canvas to keep it transparent
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Clear and set background on MAIN canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isDarkMode ? '#0f172a' : '#ffffff'; // Slate-900 or White
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw coordinate dots (Subtle grid background) directly on MAIN canvas
    drawGrid(ctx, canvas.width, canvas.height);

    // Apply viewport transform (pan & zoom) to OFFSCREEN context
    offscreenCtx.save();
    offscreenCtx.translate(pan.x, pan.y);
    offscreenCtx.scale(zoom, zoom);

    // 1. Draw existing whiteboard elements on the OFFSCREEN canvas
    elements.forEach((element) => {
      drawElement(offscreenCtx, element, isDarkMode);
    });

    // 2. Draw current active drawing in progress on the OFFSCREEN canvas
    if (isDrawing && action === 'drawing') {
      offscreenCtx.save();
      offscreenCtx.strokeStyle = color;
      offscreenCtx.fillStyle = color;
      offscreenCtx.lineWidth = activeTool === 'eraser' ? brushSize : (activeTool === 'pencil' ? brushSize : shapeWidth);
      offscreenCtx.lineCap = 'round';
      offscreenCtx.lineJoin = 'round';

      if (activeTool === 'pencil') {
        drawBezierPath(offscreenCtx, tempPoints);
      } else if (activeTool === 'eraser') {
        // Erase in real-time on the transparent offscreen canvas
        offscreenCtx.save();
        offscreenCtx.globalCompositeOperation = 'destination-out';
        offscreenCtx.strokeStyle = 'rgba(0,0,0,1)';
        offscreenCtx.lineWidth = brushSize;
        drawBezierPath(offscreenCtx, tempPoints);
        offscreenCtx.restore();
      } else if (activeTool === 'line') {
        offscreenCtx.beginPath();
        offscreenCtx.moveTo(drawStart.x, drawStart.y);
        offscreenCtx.lineTo(currentPoint.x, currentPoint.y);
        offscreenCtx.stroke();
      } else if (activeTool === 'rectangle') {
        const box = getBoundingBox(drawStart.x, drawStart.y, currentPoint.x, currentPoint.y);
        offscreenCtx.beginPath();
        offscreenCtx.rect(box.x, box.y, box.width, box.height);
        offscreenCtx.stroke();
      } else if (activeTool === 'circle') {
        const box = getBoundingBox(drawStart.x, drawStart.y, currentPoint.x, currentPoint.y);
        offscreenCtx.beginPath();
        offscreenCtx.ellipse(box.x + box.width / 2, box.y + box.height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2);
        offscreenCtx.stroke();
      } else if (activeTool === 'triangle') {
        const box = getBoundingBox(drawStart.x, drawStart.y, currentPoint.x, currentPoint.y);
        offscreenCtx.beginPath();
        offscreenCtx.moveTo(box.x + box.width / 2, box.y);
        offscreenCtx.lineTo(box.x + box.width, box.y + box.height);
        offscreenCtx.lineTo(box.x, box.y + box.height);
        offscreenCtx.closePath();
        offscreenCtx.stroke();
      } else if (activeTool === 'arrow') {
        offscreenCtx.beginPath();
        offscreenCtx.moveTo(drawStart.x, drawStart.y);
        offscreenCtx.lineTo(currentPoint.x, currentPoint.y);
        offscreenCtx.stroke();

        const angle = Math.atan2(currentPoint.y - drawStart.y, currentPoint.x - drawStart.x);
        const arrowLength = Math.max(12, shapeWidth * 3);
        offscreenCtx.beginPath();
        offscreenCtx.moveTo(currentPoint.x, currentPoint.y);
        offscreenCtx.lineTo(
          currentPoint.x - arrowLength * Math.cos(angle - Math.PI / 6),
          currentPoint.y - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        offscreenCtx.lineTo(
          currentPoint.x - arrowLength * Math.cos(angle + Math.PI / 6),
          currentPoint.y - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        offscreenCtx.closePath();
        offscreenCtx.fill();
      }
      offscreenCtx.restore();
    }

    offscreenCtx.restore();

    // 3. Draw the transparent offscreen canvas containing all elements onto the MAIN canvas
    ctx.drawImage(offscreenCanvas, 0, 0);

    // 4. Draw active eraser path preview outline / cursor outline on MAIN canvas
    if (isDrawing && action === 'drawing' && activeTool === 'eraser') {
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      
      // Dashed eraser path outline
      ctx.strokeStyle = isDarkMode ? '#60a5fa' : '#3b82f6';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      drawBezierPath(ctx, tempPoints);

      // Circle representing eraser width at current brush position
      if (currentPoint) {
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.arc(currentPoint.x, currentPoint.y, brushSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 5. Draw bounding box on MAIN canvas if an element is selected
    if (selectedElement) {
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      drawSelectionOutline(ctx, selectedElement, zoom);
      ctx.restore();
    }
  };

  // Draw coordinate grids
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    const gridSpacing = 30 * zoom;
    const offsetX = pan.x % gridSpacing;
    const offsetY = pan.y % gridSpacing;

    ctx.fillStyle = isDarkMode ? '#334155' : '#e2e8f0'; // slate-700 or slate-200 dots

    for (let x = offsetX; x < width; x += gridSpacing) {
      for (let y = offsetY; y < height; y += gridSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  // Redraw every time elements, zoom, pan, active drawing points, or active settings change
  useEffect(() => {
    draw();
  }, [elements, zoom, pan, isDrawing, tempPoints, currentPoint, selectedElement, isDarkMode]);

  // Pointer Down Interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    // If typing text, commit text first (do not return early so we can immediately start typing on the newly clicked spot)
    if (textEditState) {
      commitTextEdit();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const pt = getCanvasCoords(e.clientX, e.clientY);

    // Mode: HAND / PANNING
    if (activeTool === 'hand' || e.button === 1) {
      setAction('panning');
      setIsDrawing(true);
      setDrawStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // Mode: SELECT / SELECTION TOOL
    if (activeTool === 'select') {
      // Check if double click on a text element to edit it
      if (e.detail === 2) {
        const clickedEl = getElementAtPosition(pt, elements);
        if (clickedEl && clickedEl.type === 'text') {
          setSelectedElement(clickedEl);
          setTextEditState({
            id: clickedEl.id,
            x: clickedEl.x,
            y: clickedEl.y,
            val: clickedEl.text || '',
            fontSize: clickedEl.fontSize || fontSize,
            fontFamily: clickedEl.fontFamily || fontFamily,
            isBold: clickedEl.isBold || isBold,
            isItalic: clickedEl.isItalic || isItalic,
            color: clickedEl.color || color,
            angle: clickedEl.angle || 0
          });
          return;
        }
      }
 
      // Check if clicking inside a resize handle first
      if (selectedElement) {
        const handle = getResizeHandleAtPosition(pt, selectedElement, zoom);
        if (handle) {
          setAction('resizing');
          setResizeHandle(handle);
          setDrawStart(pt);
          setInitialSelectedElement(JSON.parse(JSON.stringify(selectedElement))); // deep clone initial state
          return;
        }
      }
 
      // Check if clicking on an element
      const clickedEl = getElementAtPosition(pt, elements);
      if (clickedEl) {
        setSelectedElement(clickedEl);
        setAction('moving');
        setDrawStart(pt);
        setDragOffset({
          x: pt.x - clickedEl.x,
          y: pt.y - clickedEl.y
        });
      } else {
        setSelectedElement(null);
        setAction('none');
      }
      return;
    }
 
    // Mode: TEXT TOOL
    if (activeTool === 'text') {
      e.preventDefault();
      setAction('text-input');
      // Click on existing text element to edit (or double click)
      const clickedEl = getElementAtPosition(pt, elements);
      if (clickedEl && clickedEl.type === 'text') {
        setSelectedElement(clickedEl);
        setTextEditState({
          id: clickedEl.id,
          x: clickedEl.x,
          y: clickedEl.y,
          val: clickedEl.text || '',
          fontSize: clickedEl.fontSize || fontSize,
          fontFamily: clickedEl.fontFamily || fontFamily,
          isBold: clickedEl.isBold || isBold,
          isItalic: clickedEl.isItalic || isItalic,
          color: clickedEl.color || color,
          angle: clickedEl.angle || 0
        });
      } else {
        // Create new text box
        setTextEditState({
          x: pt.x,
          y: pt.y,
          val: '',
          fontSize: fontSize,
          fontFamily: fontFamily,
          isBold: isBold,
          isItalic: isItalic,
          color: color,
          angle: 0
        });
      }
      return;
    }

    // Mode: DRAWING (Pencil, Eraser, Shapes)
    setAction('drawing');
    setIsDrawing(true);
    setDrawStart(pt);
    setCurrentPoint(pt);

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      setTempPoints([pt]);
    }
  };

  // Pointer Move Interaction
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing && action === 'none') {
      // Custom cursor feedback on hover
      const pt = getCanvasCoords(e.clientX, e.clientY);
      updateCursorStyle(pt);
      return;
    }

    const pt = getCanvasCoords(e.clientX, e.clientY);
    setCurrentPoint(pt);

    // 1. Hand panning
    if (action === 'panning') {
      setPan({
        x: e.clientX - drawStart.x,
        y: e.clientY - drawStart.y
      });
      return;
    }

    // 2. Elements Movement
    if (action === 'moving' && selectedElement) {
      const newX = pt.x - dragOffset.x;
      const newY = pt.y - dragOffset.y;
      onUpdateElement(selectedElement.id, { x: newX, y: newY });
      setSelectedElement({ ...selectedElement, x: newX, y: newY });
      return;
    }

    // 3. Elements Resizing
    if (action === 'resizing' && selectedElement && initialSelectedElement && resizeHandle) {
      if (resizeHandle === 'rotation') {
        const cx = initialSelectedElement.x + initialSelectedElement.width / 2;
        const cy = initialSelectedElement.y + initialSelectedElement.height / 2;
        let newAngle = Math.atan2(pt.y - cy, pt.x - cx) + Math.PI / 2;

        if (e.shiftKey) {
          const snapStep = Math.PI / 12; // 15 degrees
          newAngle = Math.round(newAngle / snapStep) * snapStep;
        }

        // Normalize angle to [-PI, PI]
        newAngle = Math.atan2(Math.sin(newAngle), Math.cos(newAngle));

        onUpdateElement(selectedElement.id, { angle: newAngle });
        setSelectedElement({ ...selectedElement, angle: newAngle });
        return;
      }

      const dx = pt.x - drawStart.x;
      const dy = pt.y - drawStart.y;
      const minSize = 10;

      let nextX = initialSelectedElement.x;
      let nextY = initialSelectedElement.y;
      let nextW = initialSelectedElement.width;
      let nextH = initialSelectedElement.height;

      switch (resizeHandle) {
        case 'br':
          nextW = Math.max(minSize, initialSelectedElement.width + dx);
          nextH = Math.max(minSize, initialSelectedElement.height + dy);
          break;
        case 'tr':
          nextY = Math.min(initialSelectedElement.y + initialSelectedElement.height - minSize, initialSelectedElement.y + dy);
          nextW = Math.max(minSize, initialSelectedElement.width + dx);
          nextH = Math.max(minSize, initialSelectedElement.height - dy);
          break;
        case 'bl':
          nextX = Math.min(initialSelectedElement.x + initialSelectedElement.width - minSize, initialSelectedElement.x + dx);
          nextW = Math.max(minSize, initialSelectedElement.width - dx);
          nextH = Math.max(minSize, initialSelectedElement.height + dy);
          break;
        case 'tl':
          nextX = Math.min(initialSelectedElement.x + initialSelectedElement.width - minSize, initialSelectedElement.x + dx);
          nextY = Math.min(initialSelectedElement.y + initialSelectedElement.height - minSize, initialSelectedElement.y + dy);
          nextW = Math.max(minSize, initialSelectedElement.width - dx);
          nextH = Math.max(minSize, initialSelectedElement.height - dy);
          break;
        case 'mr':
          nextW = Math.max(minSize, initialSelectedElement.width + dx);
          break;
        case 'ml':
          nextX = Math.min(initialSelectedElement.x + initialSelectedElement.width - minSize, initialSelectedElement.x + dx);
          nextW = Math.max(minSize, initialSelectedElement.width - dx);
          break;
        case 'bc':
          nextH = Math.max(minSize, initialSelectedElement.height + dy);
          break;
        case 'tc':
          nextY = Math.min(initialSelectedElement.y + initialSelectedElement.height - minSize, initialSelectedElement.y + dy);
          nextH = Math.max(minSize, initialSelectedElement.height - dy);
          break;
      }

      onUpdateElement(selectedElement.id, { x: nextX, y: nextY, width: nextW, height: nextH });
      setSelectedElement({ ...selectedElement, x: nextX, y: nextY, width: nextW, height: nextH });
      return;
    }

    // 4. Drawing (Pencil/Eraser continuous path updates)
    if (action === 'drawing' && isDrawing) {
      if (activeTool === 'pencil' || activeTool === 'eraser') {
        setTempPoints((prev) => [...prev, pt]);
      }
    }
  };

  // Pointer Up Interaction (Commit drawings / actions)
  const handlePointerUp = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (!isDrawing && action === 'none') return;

    setIsDrawing(false);

    // Commit hand Panning
    if (action === 'panning') {
      setAction('none');
      return;
    }

    if (action === 'text-input') {
      setAction('none');
      return;
    }

    // Commit shapes
    if (action === 'drawing') {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      if (activeTool === 'pencil') {
        if (tempPoints.length > 1) {
          // Calculate bounds for freehand drawings
          const xs = tempPoints.map(p => p.x);
          const ys = tempPoints.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          onAddElement({
            id,
            type: 'pencil',
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            color,
            strokeWidth: brushSize,
            points: tempPoints
          });
        }
      } else if (activeTool === 'eraser') {
        if (tempPoints.length > 1) {
          // Store Eraser strokes in vector list with "eraser_stroke" type
          const xs = tempPoints.map(p => p.x);
          const ys = tempPoints.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          onAddElement({
            id,
            type: 'eraser_stroke',
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            color: 'rgba(0,0,0,1)', // alpha composite destination-out
            strokeWidth: brushSize,
            points: tempPoints
          });
        }
      } else {
        // Shapes
        const box = getBoundingBox(drawStart.x, drawStart.y, currentPoint.x, currentPoint.y);
        // Only add if size is valid
        if (box.width > 2 || box.height > 2) {
          onAddElement({
            id,
            type: activeTool,
            x: activeTool === 'line' || activeTool === 'arrow' ? drawStart.x : box.x,
            y: activeTool === 'line' || activeTool === 'arrow' ? drawStart.y : box.y,
            width: activeTool === 'line' || activeTool === 'arrow' ? currentPoint.x - drawStart.x : box.width,
            height: activeTool === 'line' || activeTool === 'arrow' ? currentPoint.y - drawStart.y : box.height,
            color,
            strokeWidth: shapeWidth
          });
        }
      }
    }

    setAction('none');
    setTempPoints([]);
    setResizeHandle(null);
    setInitialSelectedElement(null);
  };

  // Set cursors dynamically
  const updateCursorStyle = (pt: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (activeTool === 'hand') {
      canvas.style.cursor = isDrawing ? 'grabbing' : 'grab';
      return;
    }

    if (activeTool === 'select') {
      if (selectedElement) {
        const handle = getResizeHandleAtPosition(pt, selectedElement, zoom);
        if (handle) {
          if (handle === 'rotation') canvas.style.cursor = 'grab';
          else if (handle === 'tl' || handle === 'br') canvas.style.cursor = 'nwse-resize';
          else if (handle === 'tr' || handle === 'bl') canvas.style.cursor = 'nesw-resize';
          else if (handle === 'tc' || handle === 'bc') canvas.style.cursor = 'ns-resize';
          else canvas.style.cursor = 'ew-resize';
          return;
        }
      }

      const hoverEl = getElementAtPosition(pt, elements);
      if (hoverEl) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
      return;
    }

    if (activeTool === 'text') {
      canvas.style.cursor = 'text';
      return;
    }

    canvas.style.cursor = 'crosshair';
  };

  // Wheel Zoom support
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Center of zoom
    const zoomCenter = getCanvasCoords(e.clientX, e.clientY);
    const zoomFactor = 1.1;
    let nextZoom = zoom;

    if (e.deltaY < 0) {
      nextZoom = Math.min(5, zoom * zoomFactor);
    } else {
      nextZoom = Math.max(0.1, zoom / zoomFactor);
    }

    // Shift pan offset to zoom into mouse cursor position!
    const nextPan = {
      x: e.clientX - zoomCenter.x * nextZoom,
      y: e.clientY - zoomCenter.y * nextZoom
    };

    setZoom(nextZoom);
    setPan(nextPan);
  };

  // Mobile multi-touch pinch to zoom & multi-touch panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const d = getDistance(p1, p2);
      setTouchStartDist(d);
      setTouchStartZoom(zoom);
      setIsDrawing(false);
      setAction('panning');
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist !== null) {
      const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const d = getDistance(p1, p2);

      // Pinch zoom factor
      const nextZoom = Math.max(0.1, Math.min(5, touchStartZoom * (d / touchStartDist)));

      // Midpoint for panning center
      const midScreenX = (p1.x + p2.x) / 2;
      const midScreenY = (p1.y + p2.y) / 2;

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const midCanvasX = ((midScreenX - rect.left) - pan.x) / zoom;
        const midCanvasY = ((midScreenY - rect.top) - pan.y) / zoom;

        setZoom(nextZoom);
        setPan({
          x: midScreenX - rect.left - midCanvasX * nextZoom,
          y: midScreenY - rect.top - midCanvasY * nextZoom
        });
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchStartDist(null);
    setAction('none');
  };

  // Commit text editing overlay state
  const commitTextEdit = () => {
    if (!textEditState) return;

    const trimmed = textEditState.val.trim();
    if (trimmed) {
      if (textEditState.id) {
        // Edit existing text
        onUpdateElement(textEditState.id, {
          text: trimmed,
          fontSize: textEditState.fontSize,
          fontFamily: textEditState.fontFamily,
          isBold: textEditState.isBold,
          isItalic: textEditState.isItalic,
          color: textEditState.color || color,
          angle: textEditState.angle
        });
      } else {
        // Add new text element
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Calculate a bounding box for selection
        const canvas = canvasRef.current;
        let textWidth = trimmed.length * (textEditState.fontSize * 0.6);
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.save();
            const currentFontFamily = textEditState.fontFamily || fontFamily || 'Inter, sans-serif';
            ctx.font = `${textEditState.isItalic ? 'italic' : ''} ${textEditState.isBold ? 'bold' : ''} ${textEditState.fontSize}px ${currentFontFamily}`;
            const metrics = ctx.measureText(trimmed);
            textWidth = metrics.width;
            ctx.restore();
          }
        }

        onAddElement({
          id,
          type: 'text',
          x: textEditState.x,
          y: textEditState.y,
          width: textWidth,
          height: textEditState.fontSize * 1.3,
          color: textEditState.color || color,
          strokeWidth: 2,
          text: trimmed,
          fontSize: textEditState.fontSize,
          fontFamily: textEditState.fontFamily,
          isBold: textEditState.isBold,
          isItalic: textEditState.isItalic,
          angle: textEditState.angle || 0
        });
      }
    } else if (textEditState.id) {
      // If empty, delete existing text element
      onUpdateElement(textEditState.id, { type: 'eraser_stroke' }); // hides/removes element
    }

    setTextEditState(null);
    if (activeTool !== 'text') {
      setActiveTool('select');
    }
  };

  // Inline input overlay style (converted back to screen coords)
  const getTextOverlayStyle = () => {
    if (!textEditState) return {};
    const screenX = textEditState.x * zoom + pan.x;
    const screenY = textEditState.y * zoom + pan.y;
    const textCol = textEditState.color || color;

    // Check contrast to make sure text is ALWAYS visible while typing
    let bgCol = isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    if (textCol.toLowerCase() === '#ffffff' && !isDarkMode) {
      bgCol = 'rgba(15, 23, 42, 0.95)'; // force dark bg for white text in light mode
    } else if (textCol.toLowerCase() === '#000000' && isDarkMode) {
      bgCol = 'rgba(255, 255, 255, 0.95)'; // force light bg for black text in dark mode
    }

    return {
      left: `${screenX}px`,
      top: `${screenY}px`,
      fontSize: `${textEditState.fontSize * zoom}px`,
      fontFamily: textEditState.fontFamily || fontFamily || 'Inter, sans-serif',
      color: textCol,
      backgroundColor: bgCol,
      fontWeight: textEditState.isBold ? 'bold' : 'normal',
      fontStyle: textEditState.isItalic ? 'italic' : 'normal',
      lineHeight: 1.25,
      minWidth: '160px',
      minHeight: '48px',
      transform: textEditState.angle ? `rotate(${textEditState.angle}rad)` : undefined,
      transformOrigin: 'top left'
    };
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="block touch-none select-none bg-white dark:bg-slate-950 transition-colors"
      />

      {/* Interactive Text Field Overlay */}
      {textEditState && (
        <textarea
          ref={textareaRef}
          style={{
            ...getTextOverlayStyle(),
            userSelect: 'text',
            WebkitUserSelect: 'text'
          }}
          value={textEditState.val}
          onChange={(e) => setTextEditState({ ...textEditState, val: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onBlur={(e) => {
            // Ignore blur if focusing on style-editor elements (like sliders, color pickers, style toggles)
            const isStyleEditor = e.relatedTarget && (
              (e.relatedTarget as HTMLElement).closest('.style-editor')
            );
            if (!isStyleEditor) {
              commitTextEdit();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitTextEdit();
            } else if (e.key === 'Escape') {
              setTextEditState(null);
            }
          }}
          className="absolute z-50 border border-blue-400 dark:border-blue-500 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xl overflow-hidden resize font-sans select-text placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:opacity-75"
          placeholder="Click and Type..."
          rows={Math.max(1, textEditState.val.split('\n').length)}
        />
      )}
    </div>
  );
}
