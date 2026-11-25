import { useTranslation } from "react-i18next";
import styles from "./styles.module.css";

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
  const nextStep = Math.round((value - min) / step) + direction * 10;
  const lastStep = Math.floor(Number(((max - min) / step).toFixed(12)));
  const clampedStep = Math.min(lastStep, Math.max(0, nextStep));
  return Number((min + clampedStep * step).toFixed(12));
}

export function RangeSlider({
  id,
  value,
  defaultValue,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  ariaLabel,
  onChange,
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
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const labelButtonClass =
    "absolute rounded px-1 outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none";

  return (
    <div>
      <input
        id={id}
        className={`${styles.input} h-5 w-full cursor-pointer appearance-none bg-transparent outline-none`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <div className="relative mt-0.5 h-5 text-xs font-medium text-white/[0.85]">
        <button
          className={`${labelButtonClass} left-0`}
          type="button"
          onClick={() => onChange(adjustRangeValue(value, -1, step, min, max))}
          aria-label={t("common.decrease", { label: minLabel })}
        >
          {minLabel}
        </button>
        <button
          className={`${labelButtonClass} -translate-x-1/2`}
          style={{ left: getRangePosition(defaultValue, min, max) }}
          type="button"
          onClick={() => onChange(defaultValue)}
          aria-label={t("common.resetDefault", { value: defaultValue })}
        >
          {t("common.default")}
        </button>
        <button
          className={`${labelButtonClass} right-0`}
          type="button"
          onClick={() => onChange(adjustRangeValue(value, 1, step, min, max))}
          aria-label={t("common.increase", { label: maxLabel })}
        >
          {maxLabel}
        </button>
      </div>
    </div>
  );
}
