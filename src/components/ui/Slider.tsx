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
        <label
          className="font-semibold uppercase"
          style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--text-tertiary)" }}
        >
          {label}
        </label>
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 400,
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
          }}
        >
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
        className="forge-slider"
        style={{
          background: `linear-gradient(to right, var(--indigo-core) 0%, var(--indigo-core) ${((value - min) / (max - min)) * 100}%, var(--bg-overlay) ${((value - min) / (max - min)) * 100}%, var(--bg-overlay) 100%)`,
        }}
      />
      {(leftHint || rightHint) && (
        <div className="flex justify-between" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
          <span>{leftHint}</span>
          <span>{rightHint}</span>
        </div>
      )}
    </div>
  );
});
