import React from 'react';
import useCharCounter from '../../hooks/useCharCounter';

export default function CharTextarea({
  value = '',
  onChange,
  maxLength,
  accentColor,
  placeholder = '请输入',
  rows = 3,
  hint,
  toolbar,
}) {
  const { count } = useCharCounter(value, maxLength);

  return (
    <div>
      {toolbar && <div className="mb-2">{toolbar}</div>}
      <div className="border border-gray-300 rounded-lg focus-within:ring-2 transition-all relative bg-gray-50/50" style={{ '--accent': accentColor }}>
        <style>{`
          .char-textarea-focus:focus-within { border-color: ${accentColor}; box-shadow: 0 0 0 2px ${accentColor}20; }
        `}</style>
        <div className="char-textarea-focus relative rounded-lg bg-gray-50/50">
          <textarea
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={maxLength}
            placeholder={placeholder}
            className="w-full p-3 pb-8 outline-none resize-none rounded-lg text-sm bg-transparent leading-relaxed"
          />
          <span className="absolute bottom-2 right-3 text-gray-400 text-xs font-mono">{count} / {maxLength}</span>
        </div>
      </div>
      {hint && <div className="text-[11px] text-gray-400 mt-1.5">{hint}</div>}
    </div>
  );
}
