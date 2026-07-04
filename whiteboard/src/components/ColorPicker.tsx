import { useState, useEffect } from 'react';
import { Pipette, Check } from 'lucide-react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  recentColors: string[];
}

const PRESET_COLORS = [
  '#000000', // Black
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#a855f7', // Purple
  '#f97316', // Orange
  '#eab308', // Yellow
  '#ffffff', // White
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Slate Gray
  '#78350f'  // Brown
];

export default function ColorPicker({ color, onChange, recentColors }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(color);
  const [r, setR] = useState(0);
  const [g, setG] = useState(0);
  const [b, setB] = useState(0);

  // Parse HEX to RGB
  useEffect(() => {
    setHexInput(color);
    const hex = color.replace('#', '');
    if (hex.length === 6) {
      setR(parseInt(hex.substring(0, 2), 16));
      setG(parseInt(hex.substring(2, 4), 16));
      setB(parseInt(hex.substring(4, 6), 16));
    }
  }, [color]);

  // Handle RGB sliders
  const handleRgbChange = (newR: number, newG: number, newB: number) => {
    setR(newR);
    setG(newG);
    setB(newB);
    const hex = '#' + [newR, newG, newB].map(x => {
      const h = x.toString(16);
      return h.length === 1 ? '0' + h : h;
    }).join('');
    setHexInput(hex);
    onChange(hex);
  };

  // Handle HEX text input
  const handleHexInputChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      onChange(val);
    } else if (/^[0-9A-F]{6}$/i.test(val)) {
      onChange(`#${val}`);
    }
  };

  return (
    <div className="style-editor flex flex-col gap-4 p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 w-64 select-none">
      {/* Preset Palette */}
      <div>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-display">Palette</div>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 relative hover:scale-110 transition-transform focus:outline-none flex items-center justify-center shadow-xs"
              style={{ backgroundColor: c }}
              title={c}
            >
              {color.toLowerCase() === c.toLowerCase() && (
                <Check className={`w-4 h-4 ${c === '#ffffff' ? 'text-black' : 'text-white'}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Recents */}
      {recentColors.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-display">Recent Colors</div>
          <div className="flex flex-wrap gap-2">
            {recentColors.slice(0, 8).map((c) => (
              <button
                key={c}
                onClick={() => onChange(c)}
                className="w-7 h-7 rounded-md cursor-pointer border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform relative focus:outline-none flex items-center justify-center shadow-xs"
                style={{ backgroundColor: c }}
                title={c}
              >
                {color.toLowerCase() === c.toLowerCase() && (
                  <Check className={`w-3.5 h-3.5 ${c === '#ffffff' ? 'text-black' : 'text-white'}`} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hex & Color Inputs */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-display">Custom Color</div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">#</span>
            <input
              type="text"
              value={hexInput.replace('#', '')}
              onChange={(e) => handleHexInputChange(e.target.value)}
              className="w-full pl-6 pr-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000000"
              maxLength={7}
            />
          </div>
          {/* Native Color Picker Circle */}
          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
            <input
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer scale-150"
            />
          </div>
        </div>

        {/* RGB Sliders */}
        <div className="flex flex-col gap-2 pt-1 text-xs">
          {/* Red Slider */}
          <div className="flex items-center gap-2">
            <span className="w-4 font-mono text-red-500 font-bold">R</span>
            <input
              type="range"
              min={0}
              max={255}
              value={r}
              onChange={(e) => handleRgbChange(Number(e.target.value), g, b)}
              className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <span className="w-8 text-right font-mono text-slate-500 dark:text-slate-400">{r}</span>
          </div>

          {/* Green Slider */}
          <div className="flex items-center gap-2">
            <span className="w-4 font-mono text-green-500 font-bold">G</span>
            <input
              type="range"
              min={0}
              max={255}
              value={g}
              onChange={(e) => handleRgbChange(r, Number(e.target.value), b)}
              className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
            <span className="w-8 text-right font-mono text-slate-500 dark:text-slate-400">{g}</span>
          </div>

          {/* Blue Slider */}
          <div className="flex items-center gap-2">
            <span className="w-4 font-mono text-blue-500 font-bold">B</span>
            <input
              type="range"
              min={0}
              max={255}
              value={b}
              onChange={(e) => handleRgbChange(r, g, Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="w-8 text-right font-mono text-slate-500 dark:text-slate-400">{b}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
