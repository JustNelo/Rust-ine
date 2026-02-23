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
        <label className="text-xs font-medium text-text-secondary">{label}</label>
        <span className="text-xs font-mono text-text-muted">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-accent-muted [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(108,108,237,0.4)]"
      />
      {(leftHint || rightHint) && (
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>{leftHint}</span>
          <span>{rightHint}</span>
        </div>
      )}
    </div>
  );
});
