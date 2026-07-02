import React from 'react';

export default function TrendInput({
  value = '',
  onChange,
  accentColor,
  placeholder = '点击输入',
  buttonLabel,
  onButtonClick,
  hint,
}) {
  return (
    <div>
      <div className="flex items-center gap-3 h-[38px]">
        <input
          type="text"
          placeholder={placeholder}
          className="flex-1 h-full border border-gray-300 rounded-lg px-3 bg-white text-sm text-gray-700 outline-none transition-all"
          style={{
            borderColor: '#d1d5db',
          }}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          onFocus={(e) => {
            if (accentColor) e.target.style.borderColor = accentColor;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#d1d5db';
          }}
        />
        {buttonLabel && (
          <button
            type="button"
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 flex-shrink-0 transition-all"
            style={{
              borderColor: '#d1d5db',
            }}
            onMouseEnter={(e) => {
              if (accentColor) {
                e.target.style.borderColor = accentColor;
                e.target.style.color = accentColor;
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#d1d5db';
              e.target.style.color = '#374151';
            }}
            onClick={onButtonClick}
          >
            {buttonLabel}
          </button>
        )}
      </div>
      {hint && (
        <div className="text-xs text-gray-500 mt-2 leading-relaxed">{hint}</div>
      )}
    </div>
  );
}