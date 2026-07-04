export type Point = {
  x: number;
  y: number;
  pressure?: number;
};

export type ToolType =
  | 'select'
  | 'hand'
  | 'pencil'
  | 'eraser'
  | 'text'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'triangle';

export interface BoardElement {
  id: string;
  type: ToolType | 'image' | 'eraser_stroke';
  x: number; // Starting X coordinate (or bounding box min X)
  y: number; // Starting Y coordinate (or bounding box min Y)
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  points?: Point[]; // For freehand pencil/eraser paths
  text?: string; // For text elements
  fontSize?: number;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  imageUrl?: string; // For imported images
  imageElement?: HTMLImageElement; // Cached HTML image element (runtime only)
  angle?: number; // Rotation angle in radians
}

export interface WhiteboardTab {
  id: string;
  name: string;
  elements: BoardElement[];
  history: BoardElement[][];
  historyIndex: number;
  pan: { x: number; y: number };
  zoom: number; // Zoom value, e.g., 1.0 (100%)
}

export type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc' | 'ml' | 'mr' | 'rotation' | null;
