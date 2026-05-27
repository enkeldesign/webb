import { useState } from "react";
import { Info, ChevronDown, X } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";

interface FieldLabelProps {
  label: string;
  help?: ReactNode;
  tooltipColor?: string;
  open: boolean;
  onToggle: () => void;
}

function FieldLabel({ label, help, tooltipColor = "#005299", open, onToggle }: FieldLabelProps) {
  return (
    <div className="flex flex-col w-full">
      <div className="flex gap-2 items-center">
        <label className="flex-1 font-semibold text-[#2a2b2d] text-[16px] leading-6">{label}</label>
        {help && (
          <button
            type="button"
            aria-label={open ? "Stäng hjälptext" : "Visa hjälptext"}
            aria-expanded={open}
            onClick={onToggle}
            className="shrink-0 rounded-full hover:opacity-80 relative"
          >
            <Info className="w-5 h-5" style={{ color: tooltipColor }} fill={tooltipColor} stroke="white" />
          </button>
        )}
      </div>
    </div>
  );
}

function HelpPanel({ help, onClose }: { help: ReactNode; onClose: () => void }) {
  return (
    <div className="bg-[#ecf7fe] border-2 border-[#0065bd] rounded relative px-4 py-3 mt-1">
      <div className="absolute -top-2 right-6 w-3 h-3 bg-[#ecf7fe] border-l-2 border-t-2 border-[#0065bd] rotate-45" />
      <div className="flex items-start justify-between gap-4">
        <div className="text-[#2a2b2d] text-[16px]">{help}</div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-[#2a2b2d] hover:underline shrink-0"
        >
          <span>Stäng</span>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  help?: ReactNode;
}

export function TextField({ label, placeholder, value, onChange, help }: TextFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1 w-full">
      <FieldLabel label={label} help={help} open={open} onToggle={() => setOpen((v) => !v)} />
      {open && help && <HelpPanel help={help} onClose={() => setOpen(false)} />}
      <input
        type="text"
        className="bg-white h-10 rounded border-2 border-[#8a8d93] px-3 py-2 text-[16px] text-[#2a2b2d] outline-none focus:border-[#005299]"
        placeholder={placeholder}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  help?: ReactNode;
}

export function SelectField({ label, value, onChange, options, placeholder = "Välj", help }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1 w-full">
      <FieldLabel label={label} help={help} open={open} onToggle={() => setOpen((v) => !v)} />
      {open && help && <HelpPanel help={help} onClose={() => setOpen(false)} />}
      <div className="relative">
        <select
          value={value}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
          className="appearance-none bg-white w-full rounded border-2 border-[#808289] px-3 py-2 text-[16px] text-[#2a2b2d] outline-none focus:border-[#005299] h-10 pr-10 cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black" />
      </div>
    </div>
  );
}
