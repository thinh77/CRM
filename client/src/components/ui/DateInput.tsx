import { useRef, useState, useCallback, useEffect, type InputHTMLAttributes } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

/** Convert YYYY-MM-DD → DD/MM/YYYY */
function toDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/** Convert DD/MM/YYYY → YYYY-MM-DD (returns "" if incomplete/invalid) */
function toIso(display: string): string {
  if (!display) return "";
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
}

/** Validate a DD/MM/YYYY string is a real calendar date */
function isValidDate(display: string): boolean {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

interface DateInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Value in YYYY-MM-DD format (internal/API format) */
  value: string;
  /** Called with YYYY-MM-DD string */
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  /** Max date in YYYY-MM-DD format */
  max?: string;
}

export function DateInput({
  value,
  onChange,
  label,
  error,
  max,
  className,
  id,
  disabled,
  ...rest
}: DateInputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  const hiddenDateRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Text shown in the visible input (DD/MM/YYYY format)
  const [displayValue, setDisplayValue] = useState(() => toDisplay(value));

  // Validation error for the text input
  const [internalError, setInternalError] = useState("");

  // Sync external value → display when value changes from outside
  useEffect(() => {
    const newDisplay = toDisplay(value);
    setDisplayValue(newDisplay);
    setInternalError("");
  }, [value]);

  const emitChange = useCallback(
    (iso: string) => {
      if (max && iso && iso > max) {
        setInternalError("Ngày không được ở tương lai");
        return;
      }
      setInternalError("");
      onChange(iso);
    },
    [max, onChange]
  );

  /** Auto-insert `/` separators as user types digits */
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value;

      // Strip non-digit, non-slash
      raw = raw.replace(/[^\d/]/g, "");

      // Auto-insert slashes after DD and MM
      const digits = raw.replace(/\//g, "");
      let formatted = "";
      for (let i = 0; i < digits.length && i < 8; i++) {
        if (i === 2 || i === 4) formatted += "/";
        formatted += digits[i];
      }

      setDisplayValue(formatted);

      // Complete DD/MM/YYYY → validate & emit
      if (formatted.length === 10) {
        if (isValidDate(formatted)) {
          emitChange(toIso(formatted));
        } else {
          setInternalError("Ngày không hợp lệ");
        }
      } else {
        // Partial input → clear the ISO value
        if (formatted.length === 0) {
          emitChange("");
        }
        setInternalError("");
      }
    },
    [emitChange]
  );

  /** When text input loses focus, validate completeness */
  const handleBlur = useCallback(() => {
    if (displayValue.length === 0) {
      emitChange("");
      return;
    }
    if (displayValue.length < 10) {
      setInternalError("Nhập đầy đủ DD/MM/YYYY");
      return;
    }
    if (!isValidDate(displayValue)) {
      setInternalError("Ngày không hợp lệ");
      return;
    }
    emitChange(toIso(displayValue));
  }, [displayValue, emitChange]);

  /** Open native date picker when calendar icon is clicked */
  const handleCalendarClick = useCallback(() => {
    if (disabled) return;
    const el = hiddenDateRef.current;
    if (el) {
      // showPicker is supported in modern browsers
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.click();
      }
    }
  }, [disabled]);

  /** When user picks from native calendar, sync to text */
  const handleNativeDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const iso = e.target.value; // YYYY-MM-DD
      if (iso) {
        setDisplayValue(toDisplay(iso));
        emitChange(iso);
      }
    },
    [emitChange]
  );

  const shownError = error || internalError;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={textInputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/YYYY"
          maxLength={10}
          value={displayValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          disabled={disabled}
          className={cn(
            "w-full px-3 py-2 pr-10 border rounded-md text-sm transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-agribank-500 focus:border-agribank",
            shownError
              ? "border-red-300 focus:ring-red-500 focus:border-red-500"
              : "border-gray-300",
            disabled && "bg-gray-100 cursor-not-allowed",
            className
          )}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={handleCalendarClick}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
          aria-label="Mở lịch"
        >
          <Calendar className="w-4 h-4" />
        </button>

        {/* Hidden native date input for calendar popup */}
        <input
          ref={hiddenDateRef}
          type="date"
          value={value}
          max={max}
          onChange={handleNativeDateChange}
          tabIndex={-1}
          className="sr-only"
          aria-hidden="true"
        />
      </div>
      {shownError && <p className="mt-1 text-xs text-red-600">{shownError}</p>}
    </div>
  );
}
