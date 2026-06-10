import React from 'react';

export default function CoverRatioSelect({ value, onChange, options, accentColor, label = '封面比例' }) {
  return (
    <div className="flex-1 max-w-[200px]">
      <div className="text-xs font-bold text-gray-400 mb-2">{label}</div>
      <select
        className="w-full h-[38px] border border-gray-300 rounded-lg px-3 bg-white cursor-pointer transition-colors shadow-sm outline-none text-sm text-gray-400"
        style={{ '--hover-color': accentColor }}
        onMouseEnter={(e) => e.target.style.borderColor = accentColor}
        onMouseLeave={(e) => e.target.style.borderColor = '#d1d5db'}
        value={value}
        onChange={e => onChange?.(e.target.value)}
      >
        <option value="">请选择封面比例</option>
        {options?.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>
  );
}
