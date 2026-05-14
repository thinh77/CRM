import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  error?: string;
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  clearable?: boolean;
}

export function SearchableSelect({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = "-- Chọn --",
  searchPlaceholder = "Tìm kiếm...",
  disabled,
  id,
  clearable = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return options;

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedKeyword)
    );
  }, [options, keyword]);

  useEffect(() => {
    if (!open) return;

    searchInputRef.current?.focus();

    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setKeyword("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
    setKeyword("");
  };

  const handleClear = () => {
    onChange("");
    setKeyword("");
  };

  const fieldId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          id={fieldId}
          type="text"
          readOnly
          disabled={disabled}
          value={selectedOption?.label || ""}
          placeholder={placeholder}
          onFocus={() => !disabled && setOpen(true)}
          onClick={() => !disabled && setOpen(true)}
          className={cn(
            "w-full px-3 py-2 pr-16 border rounded-md text-sm transition-colors bg-white",
            "focus:outline-none focus:ring-2 focus:ring-agribank-500 focus:border-agribank",
            error ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-gray-300",
            disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "cursor-pointer"
          )}
        />

        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {clearable && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label="Xóa lựa chọn"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((prev) => !prev)}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
            aria-label="Mở danh sách"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-agribank-500 focus:border-agribank"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto py-1">
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500">Không tìm thấy</p>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between",
                      value === option.value && "bg-agribank-50 text-agribank-dark"
                    )}
                  >
                    <span>{option.label}</span>
                    {value === option.value && <Check className="w-4 h-4" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
