import { memo } from "react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  leftHint?: string;
  rightHint?: string;
  onChange: (value: number) => void;
}

export const Slider = memo(function Slider({
  label,
  value,
  min,
  max,
  unit = "%",
  leftHint,
  rightHint,
  onChange,
}: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          {label}
        </label>
        <span className="text-sm font-light text-neutral-900 dark:text-white font-mono">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-black/12 dark:bg-white/8 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(129,140,248,0.5)]"
      />
      {(leftHint || rightHint) && (
        <div className="flex justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
          <span>{leftHint}</span>
          <span>{rightHint}</span>
        </div>
      )}
    </div>
  );
});
