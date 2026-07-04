import { BoardElement, Point, ToolType, ResizeHandle } from '../types';

// Helper: Rotate a point around a center by an angle in radians
export function rotatePoint(p: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

// Helper: Calculate distance between two points
export function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// Helper: Distance from point to line segment
export function getDistanceToSegment(p: Point, v: Point, w: Point): number {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return getDistance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return getDistance(p, {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y)
  });
}

// Helper: Check if a point is inside a triangle
export function isPointInTriangle(p: Point, t1: Point, t2: Point, t3: Point): boolean {
  const area = Math.abs((t1.x * (t2.y - t3.y) + t2.x * (t3.y - t1.y) + t3.x * (t1.y - t2.y)) / 2);
  const area1 = Math.abs((p.x * (t2.y - t3.y) + t2.x * (t3.y - p.y) + t3.x * (p.y - t2.y)) / 2);
  const area2 = Math.abs((t1.x * (p.y - t3.y) + p.x * (t3.y - t1.y) + t3.x * (t1.y - p.y)) / 2);
  const area3 = Math.abs((t1.x * (t2.y - p.y) + t2.x * (p.y - t1.y) + p.x * (t1.y - t2.y)) / 2);
  // Account for float precision
  return Math.abs(area - (area1 + area2 + area3)) < 0.1;
}

// Helper: Check if a point is inside an ellipse (circle)
export function isPointInEllipse(p: Point, cx: number, cy: number, rx: number, ry: number): boolean {
  if (rx === 0 || ry === 0) return false;
  return Math.pow(p.x - cx, 2) / Math.pow(rx, 2) + Math.pow(p.y - cy, 2) / Math.pow(ry, 2) <= 1.0;
}

// Check collision with any given whiteboard element
export function isPointNearElement(p: Point, element: BoardElement): boolean {
  let testPoint = p;
  if (element.angle) {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    testPoint = rotatePoint(p, { x: cx, y: cy }, -element.angle);
  }
  const threshold = Math.max(6, element.strokeWidth / 2 + 3);

  // Normalized bounds check
  const minX = Math.min(element.x, element.x + element.width);
  const maxX = Math.max(element.x, element.x + element.width);
  const minY = Math.min(element.y, element.y + element.height);
  const maxY = Math.max(element.y, element.y + element.height);

  switch (element.type) {
    case 'rectangle':
    case 'image':
      // Check boundaries with some margin
      return testPoint.x >= minX - threshold && testPoint.x <= maxX + threshold &&
             testPoint.y >= minY - threshold && testPoint.y <= maxY + threshold;

    case 'circle': {
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const rx = Math.abs(element.width / 2);
      const ry = Math.abs(element.height / 2);
      // Let it select if either on edge or inside
      return isPointInEllipse(testPoint, cx, cy, rx + threshold, ry + threshold);
    }

    case 'triangle': {
      const t1 = { x: element.x + element.width / 2, y: element.y };
      const t2 = { x: element.x + element.width, y: element.y + element.height };
      const t3 = { x: element.x, y: element.y + element.height };
      // Check inside triangle OR near any of the three edges
      if (isPointInTriangle(testPoint, t1, t2, t3)) return true;
      return getDistanceToSegment(testPoint, t1, t2) <= threshold ||
             getDistanceToSegment(testPoint, t2, t3) <= threshold ||
             getDistanceToSegment(testPoint, t3, t1) <= threshold;
    }

    case 'line': {
      const start = { x: element.x, y: element.y };
      const end = { x: element.x + element.width, y: element.y + element.height };
      return getDistanceToSegment(testPoint, start, end) <= threshold;
    }

    case 'arrow': {
      const start = { x: element.x, y: element.y };
      const end = { x: element.x + element.width, y: element.y + element.height };
      return getDistanceToSegment(testPoint, start, end) <= threshold;
    }

    case 'text':
      // Text bounding box check
      return testPoint.x >= minX && testPoint.x <= maxX && testPoint.y >= minY && testPoint.y <= maxY;

    case 'pencil':
    case 'eraser_stroke': {
      if (!element.points || element.points.length === 0) return false;
      // Quick bounds check first
      if (testPoint.x < minX - threshold || testPoint.x > maxX + threshold ||
          testPoint.y < minY - threshold || testPoint.y > maxY + threshold) {
        return false;
      }
      // Line segments check
      for (let i = 0; i < element.points.length - 1; i++) {
        if (getDistanceToSegment(testPoint, element.points[i], element.points[i + 1]) <= threshold) {
          return true;
        }
      }
      return false;
    }

    default:
      return false;
  }
}

// Find element at clicked coordinate (searches backwards, top-most first)
export function getElementAtPosition(p: Point, elements: BoardElement[]): BoardElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === 'eraser_stroke') continue; // Don't allow selecting eraser strokes directly
    if (isPointNearElement(p, el)) {
      return el;
    }
  }
  return null;
}

// Helper: Draw a smooth path using cubic Bezier curve fitting (Catmull-Rom spline approximation)
export function drawBezierPath(ctx: CanvasRenderingContext2D, pts: Point[]) {
  if (pts.length === 0) return;
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (pts.length === 2) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p0 = i > 0 ? pts[i - 1] : p1;
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

    const t = 0.35; // Tension smoothing factor. 0.35 creates perfectly balanced natural curves.
    const d12 = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const d01 = Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
    const d23 = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));

    const fa = t * d12 / (d01 + d12 || 1);
    const fb = t * d12 / (d12 + d23 || 1);

    const cp1x = p1.x + fa * (p2.x - p0.x);
    const cp1y = p1.y + fa * (p2.y - p0.y);

    const cp2x = p2.x - fb * (p3.x - p1.x);
    const cp2y = p2.y - fb * (p3.y - p1.y);

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  ctx.stroke();
}

// Draw a single board element
export function drawElement(ctx: CanvasRenderingContext2D, element: BoardElement, isDarkMode: boolean) {
  ctx.save();
  if (element.angle) {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(element.angle);
    ctx.translate(-cx, -cy);
  }
  ctx.strokeStyle = element.color;
  ctx.fillStyle = element.color;
  ctx.lineWidth = element.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (element.type) {
    case 'pencil': {
      if (!element.points || element.points.length === 0) break;
      drawBezierPath(ctx, element.points);
      break;
    }

    case 'eraser_stroke': {
      if (!element.points || element.points.length === 0) break;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = element.strokeWidth;
      drawBezierPath(ctx, element.points);
      ctx.restore();
      break;
    }

    case 'rectangle': {
      ctx.beginPath();
      ctx.rect(element.x, element.y, element.width, element.height);
      ctx.stroke();
      break;
    }

    case 'circle': {
      ctx.beginPath();
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      const rx = Math.abs(element.width / 2);
      const ry = Math.abs(element.height / 2);
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'triangle': {
      ctx.beginPath();
      ctx.moveTo(element.x + element.width / 2, element.y);
      ctx.lineTo(element.x + element.width, element.y + element.height);
      ctx.lineTo(element.x, element.y + element.height);
      ctx.closePath();
      ctx.stroke();
      break;
    }

    case 'line': {
      ctx.beginPath();
      ctx.moveTo(element.x, element.y);
      ctx.lineTo(element.x + element.width, element.y + element.height);
      ctx.stroke();
      break;
    }

    case 'arrow': {
      const startX = element.x;
      const startY = element.y;
      const endX = element.x + element.width;
      const endY = element.y + element.height;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw arrowhead
      const angle = Math.atan2(endY - startY, endX - startX);
      const arrowLength = Math.max(12, element.strokeWidth * 3);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle - Math.PI / 6),
        endY - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - arrowLength * Math.cos(angle + Math.PI / 6),
        endY - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'text': {
      if (element.text) {
        const fontFamily = element.fontFamily || 'Inter, sans-serif';
        const style = `${element.isItalic ? 'italic' : ''} ${element.isBold ? 'bold' : ''} ${element.fontSize || 20}px ${fontFamily}`;
        ctx.font = style;
        ctx.textBaseline = 'top';
        const lines = element.text.split('\n');
        const lineHeight = (element.fontSize || 20) * 1.25;

        // Draw multiple lines if any
        lines.forEach((line, index) => {
          ctx.fillText(line, element.x, element.y + index * lineHeight);
        });
      }
      break;
    }

    case 'image': {
      if (element.imageElement) {
        ctx.drawImage(element.imageElement, element.x, element.y, element.width, element.height);
      } else if (element.imageUrl) {
        // Load image and cache it
        const img = new Image();
        img.src = element.imageUrl;
        img.onload = () => {
          element.imageElement = img;
        };
      }
      break;
    }
  }

  ctx.restore();
}

// Draw the dotted selection outline around a selected element
export function drawSelectionOutline(ctx: CanvasRenderingContext2D, element: BoardElement, zoom: number) {
  const margin = 6 / zoom;
  const handleSize = 8 / zoom;

  const minX = Math.min(element.x, element.x + element.width) - margin;
  const maxX = Math.max(element.x, element.x + element.width) + margin;
  const minY = Math.min(element.y, element.y + element.height) - margin;
  const maxY = Math.max(element.y, element.y + element.height) + margin;

  const w = maxX - minX;
  const h = maxY - minY;

  ctx.save();
  if (element.angle) {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(element.angle);
    ctx.translate(-cx, -cy);
  }

  ctx.strokeStyle = '#3b82f6'; // Blue-500
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  ctx.strokeRect(minX, minY, w, h);

  // Draw handles
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([]); // solid lines for handles

  const handles = [
    { x: minX, y: minY }, // Top-left
    { x: minX + w / 2, y: minY }, // Top-center
    { x: maxX, y: minY }, // Top-right
    { x: maxX, y: minY + h / 2 }, // Middle-right
    { x: maxX, y: maxY }, // Bottom-right
    { x: minX + w / 2, y: maxY }, // Bottom-center
    { x: minX, y: maxY }, // Bottom-left
    { x: minX, y: minY + h / 2 } // Middle-left
  ];

  handles.forEach((hd) => {
    ctx.fillRect(hd.x - handleSize / 2, hd.y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(hd.x - handleSize / 2, hd.y - handleSize / 2, handleSize, handleSize);
  });

  // Draw rotation handle
  const rotationOffset = 24 / zoom;
  const rotX = minX + w / 2;
  const rotY = minY - rotationOffset;

  // Connector line
  ctx.beginPath();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([2 / zoom, 2 / zoom]);
  ctx.moveTo(minX + w / 2, minY);
  ctx.lineTo(rotX, rotY);
  ctx.stroke();

  // Rotation handle dot
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.arc(rotX, rotY, 5 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Determine which resize handle is under the point, if any
export function getResizeHandleAtPosition(p: Point, element: BoardElement, zoom: number): ResizeHandle {
  let testPoint = p;
  if (element.angle) {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    testPoint = rotatePoint(p, { x: cx, y: cy }, -element.angle);
  }

  const margin = 6 / zoom;
  const handleThreshold = 10 / zoom; // easy click zone

  const minX = Math.min(element.x, element.x + element.width) - margin;
  const maxX = Math.max(element.x, element.x + element.width) + margin;
  const minY = Math.min(element.y, element.y + element.height) - margin;
  const maxY = Math.max(element.y, element.y + element.height) + margin;

  const w = maxX - minX;
  const h = maxY - minY;

  const handles: { key: ResizeHandle; x: number; y: number }[] = [
    { key: 'tl', x: minX, y: minY },
    { key: 'tc', x: minX + w / 2, y: minY },
    { key: 'tr', x: maxX, y: minY },
    { key: 'mr', x: maxX, y: minY + h / 2 },
    { key: 'br', x: maxX, y: maxY },
    { key: 'bc', x: minX + w / 2, y: maxY },
    { key: 'bl', x: minX, y: maxY },
    { key: 'ml', x: minX, y: minY + h / 2 },
    { key: 'rotation', x: minX + w / 2, y: minY - 24 / zoom }
  ];

  for (const hd of handles) {
    if (Math.abs(testPoint.x - hd.x) <= handleThreshold && Math.abs(testPoint.y - hd.y) <= handleThreshold) {
      return hd.key;
    }
  }

  return null;
}

// Recalculate dimensions for a custom shape or line bounding box based on start and current pointer
export function getBoundingBox(x1: number, y1: number, x2: number, y2: number) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  };
}
