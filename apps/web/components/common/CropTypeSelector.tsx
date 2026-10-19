"use client";

import React, { useMemo } from "react";
import {
  getCropTypes,
  hasCropTypes,
  isValidCropType,
  CropTypeOption,
} from "../../lib/cropTypes";
import { AlertCircle } from "lucide-react";

export interface CropTypeSelectorProps {
  /** The selected crop name or alias (e.g. "Rice", "Wheat", "paddy", "Corn") */
  crop: string | null | undefined;
  /** Current crop_type_id value */
  value: string | null | undefined;
  /** Change handler called with the new crop_type_id (or null if cleared) */
  onChange: (cropTypeId: string | null) => void;
  /** Optional HTML element ID for accessibility */
  id?: string;
  /** Optional custom class name */
  className?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether crop type is required (defaults to false / optional) */
  required?: boolean;
  /** Custom label text (defaults to "Crop Type / Variety") */
  label?: string;
}

/**
 * Accessible, data-driven Crop Type Selector component.
 * Conditionally renders ONLY when the provided crop has an approved catalog in the registry.
 * Completely hidden when crop has no approved type catalog.
 */
export const CropTypeSelector: React.FC<CropTypeSelectorProps> = ({
  crop,
  value,
  onChange,
  id = "crop-type-select",
  className = "",
  disabled = false,
  required = false,
  label = "Crop Type / Variety",
}) => {
  // 1. Check if the crop has an approved catalog
  const supportsTypes = useMemo(() => hasCropTypes(crop), [crop]);
  const options = useMemo(() => getCropTypes(crop), [crop]);

  // If crop has no approved types in catalog, hide completely
  if (!supportsTypes || options.length === 0) {
    return null;
  }

  // 2. Check if current value is invalid or legacy
  const isInvalidOrUnknown = Boolean(value && !isValidCropType(crop, value));

  return (
    <div className={`space-y-1.5 text-left animate-fade-in ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-xs font-bold text-slate-700 select-none"
        >
          {label} {required && <span className="text-rose-500">*</span>}
          {!required && (
            <span className="text-[10px] font-normal text-slate-400 ml-1">
              (Optional)
            </span>
          )}
        </label>
      </div>

      <div className="relative">
        <select
          id={id}
          name="crop_type_id"
          value={value || ""}
          disabled={disabled}
          required={required}
          onChange={(e) => {
            const val = e.target.value.trim();
            onChange(val === "" ? null : val);
          }}
          className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isInvalidOrUnknown
              ? "border-amber-300 bg-amber-50/50 focus:border-amber-500"
              : "border-slate-200 focus:bg-white focus:border-emerald-600"
          }`}
          aria-describedby={isInvalidOrUnknown ? `${id}-warning` : undefined}
          data-testid="crop-type-selector"
        >
          <option value="">
            {required ? "-- Select Approved Type --" : "All / Standard Variety"}
          </option>
          {options.map((opt: CropTypeOption) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Non-blocking "Type unavailable" notice for legacy or invalid saved values */}
      {isInvalidOrUnknown && (
        <div
          id={`${id}-warning`}
          className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-tight"
          data-testid="crop-type-unavailable-warning"
        >
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <span>
            Previous type <strong className="font-semibold">"{value}"</strong> is
            unavailable for this crop. Please select an approved type or leave as
            standard.
          </span>
        </div>
      )}
    </div>
  );
};

export default CropTypeSelector;
