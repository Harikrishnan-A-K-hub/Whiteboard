import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Compass } from 'lucide-react';
import { motion } from 'motion/react';

interface ZoomControlsProps {
  zoom: number;
  setZoom: (z: number) => void;
  onResetZoomAndPan: () => void;
  isHandActive: boolean;
  onToggleHand: () => void;
}

export default function ZoomControls({
  zoom,
  setZoom,
  onResetZoomAndPan,
  isHandActive,
  onToggleHand
}: ZoomControlsProps) {
  const zoomPercent = Math.round(zoom * 100);

  const handleZoomIn = () => {
    setZoom(Math.min(5, zoom + 0.1));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(0.1, zoom - 0.1));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(Number(e.target.value) / 100);
  };

  return (
    <div className="fixed bottom-6 right-6 z-30 flex items-center gap-3 bg-white/95 dark:bg-slate-950/95 border border-gray-200 dark:border-slate-800 px-4 py-2.5 rounded-lg shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1),_0_2px_10px_-2px_rgba(0,0,0,0.05)] select-none">
      {/* Hand Tool Indicator */}
      <button
        onClick={onToggleHand}
        className={`p-2 rounded-xl border transition-all cursor-pointer focus:outline-none ${
          isHandActive
            ? 'bg-blue-500 border-blue-500 text-white shadow-sm shadow-blue-500/10'
            : 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
        }`}
        title="Toggle Hand/Pan Tool (H) - Click and drag the canvas to pan around"
      >
        <Compass className="w-4 h-4" />
      </button>

      <div className="h-5 w-px bg-slate-100 dark:bg-slate-800" />

      {/* Zoom Out Button */}
      <button
        onClick={handleZoomOut}
        disabled={zoom <= 0.1}
        className={`p-1.5 rounded-lg border focus:outline-none transition-colors ${
          zoom <= 0.1
            ? 'text-slate-200 dark:text-slate-700 border-slate-50 dark:border-slate-800/50 cursor-not-allowed'
            : 'text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
        }`}
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      {/* Zoom Percent / Reset */}
      <button
        onClick={onResetZoomAndPan}
        className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 w-12 hover:text-blue-500 hover:scale-105 transition-all text-center focus:outline-none cursor-pointer"
        title="Click to reset zoom & center whiteboard to (100%, 0, 0)"
      >
        {zoomPercent}%
      </button>

      {/* Zoom In Button */}
      <button
        onClick={handleZoomIn}
        disabled={zoom >= 5}
        className={`p-1.5 rounded-lg border focus:outline-none transition-colors ${
          zoom >= 5
            ? 'text-slate-200 dark:text-slate-700 border-slate-50 dark:border-slate-800/50 cursor-not-allowed'
            : 'text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
        }`}
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      {/* Zoom Slider */}
      <input
        type="range"
        min={10}
        max={500}
        value={zoomPercent}
        onChange={handleSliderChange}
        className="w-20 h-1 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        title="Zoom Slider (10% - 500%)"
      />

      <div className="h-5 w-px bg-slate-100 dark:bg-slate-800" />

      {/* Center Whiteboard (Fit bounds) */}
      <button
        onClick={onResetZoomAndPan}
        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg focus:outline-none cursor-pointer transition-colors"
        title="Reset Pan & Zoom"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}
