import React from 'react';
import useCharCounter from '../../hooks/useCharCounter';

export default function CharInput({
  value = '',
  onChange,
  maxLength,
  accentColor,
  placeholder = '请输入',
  showClearButton = true,
}) {
  const { count } = useCharCounter(value, maxLength);

  return (
    <div className="relative flex items-center border border-gray-300 rounded-lg focus-within:ring-2 transition-all bg-gray-50/50" style={{ borderColor: undefined, focusRingColor: accentColor }}>
      <style>{`
        .char-input-focus:focus-within { border-color: ${accentColor}; box-shadow: 0 0 0 2px ${accentColor}20; }
      `}</style>
      <div className="char-input-focus relative flex items-center w-full rounded-lg bg-gray-50/50">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 outline-none rounded-lg bg-transparent text-sm text-gray-800"
        />
        <div className="flex items-center gap-2 pr-3">
          {showClearButton && value && (
            <button className="text-gray-400 hover:text-gray-600" onClick={() => onChange('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
            </button>
          )}
          <span className="text-gray-400 text-xs font-mono">{count} / {maxLength}</span>
        </div>
      </div>
    </div>
  );
}