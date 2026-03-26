'use client';

type FieldDef = {
  id: string;
  label: string;
  type: 'number' | 'percent' | 'text' | 'textarea' | 'select';
  unit?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  options?: readonly string[] | string[];
};

interface FieldInputProps {
  field: FieldDef;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

const baseInputClass =
  'w-full border border-[#e0e0db] rounded-md px-2.5 py-0 text-xs font-[inherit] outline-none leading-normal transition-colors';

export function FieldInput({ field, value, onChange, disabled }: FieldInputProps) {
  if (field.type === 'select') {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${baseInputClass} h-8 cursor-pointer bg-[#f8f8f6] ${disabled ? 'text-[#aaa] bg-[#fafaf8]' : 'text-[#222]'}`}
      >
        <option value="">선택...</option>
        {(field.options || []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={field.rows || 3}
        placeholder={field.placeholder || ''}
        className={`${baseInputClass} p-2.5 resize-none leading-relaxed ${disabled ? 'text-[#aaa] bg-[#fafaf8]' : 'text-[#222] bg-[#f8f8f6]'}`}
      />
    );
  }
  return (
    <div className="flex items-center gap-0">
      <input
        type={field.type === 'number' || field.type === 'percent' ? 'number' : 'text'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={field.placeholder || ''}
        className={`${baseInputClass} h-8 flex-1 ${field.unit ? 'rounded-r-none' : ''} ${disabled ? 'text-[#aaa] bg-[#fafaf8]' : 'text-[#222] bg-[#f8f8f6]'}`}
      />
      {field.unit && (
        <span className="h-8 px-2.5 bg-[#f0f0ec] border border-l-0 border-[#e0e0db] rounded-r-md text-[11px] text-[#888] flex items-center whitespace-nowrap shrink-0">
          {field.unit}
        </span>
      )}
    </div>
  );
}
