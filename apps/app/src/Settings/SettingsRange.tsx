import { useTranslation } from "react-i18next";

function getRangePosition(value: number, min: number, max: number) {
  return `${((value - min) / (max - min)) * 100}%`;
}

function adjustRangeValue(
  value: number,
  direction: -1 | 1,
  step: number,
  min: number,
  max: number,
) {
  const adjustedValue =
    Math.round((value + direction * step * 10) / step) * step;
  return Math.min(max, Math.max(min, Number(adjustedValue.toFixed(12))));
}

export function SettingsRange({
  id,
  value,
  defaultValue,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  ariaLabel,
  onPreview,
  onCommit,
}: {
  id: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  ariaLabel: string;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const { t } = useTranslation();
  const labelButtonClass =
    "absolute rounded px-1 outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none";

  return (
    <div>
      <input
        id={id}
        className="settings-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onPreview(Number(event.currentTarget.value))}
        onPointerUp={(event) => onCommit(Number(event.currentTarget.value))}
        onKeyUp={(event) => onCommit(Number(event.currentTarget.value))}
      />
      <div className="relative mt-0.5 h-5 text-xs font-medium text-white/[0.85]">
        <button
          className={`${labelButtonClass} left-0`}
          type="button"
          onClick={() => onCommit(adjustRangeValue(value, -1, step, min, max))}
          aria-label={t("settings.decrease", { label: minLabel })}
        >
          {minLabel}
        </button>
        <button
          className={`${labelButtonClass} -translate-x-1/2`}
          style={{ left: getRangePosition(defaultValue, min, max) }}
          type="button"
          onClick={() => onCommit(defaultValue)}
          aria-label={t("settings.resetDefault", { value: defaultValue })}
        >
          {t("common.default")}
        </button>
        <button
          className={`${labelButtonClass} right-0`}
          type="button"
          onClick={() => onCommit(adjustRangeValue(value, 1, step, min, max))}
          aria-label={t("settings.increase", { label: maxLabel })}
        >
          {maxLabel}
        </button>
      </div>
    </div>
  );
}
