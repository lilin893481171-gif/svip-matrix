import React from 'react';

export default function ProductLink({
  value = '',
  onChange,
  accentColor,
  placeholder = '粘贴商品ID / 链接',
  buttonLabel = '＋ 添加商品',
  maxCount = 18,
  maxCountText = '最多可添加 18 个商品',
  showButton = true,
  onAddClick,
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={placeholder}
          className="flex-1 h-[38px] border border-gray-300 rounded-lg px-3 bg-gray-50/50 text-sm text-gray-700 outline-none focus:border-gray-300 focus:ring-2 transition-all"
          style={{
            '--focus-ring-color': accentColor ? `${accentColor}20` : undefined
          }}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          onFocus={(e) => {
            if (accentColor) {
              e.target.style.borderColor = accentColor;
              e.target.style.boxShadow = `0 0 0 2px ${accentColor}20`;
            }
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#d1d5db';
            e.target.style.boxShadow = 'none';
          }}
        />
        {showButton && (
          <button
            type="button"
            className="px-5 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg transition-colors shadow-sm font-medium text-sm flex-shrink-0"
            style={{
              borderColor: '#d1d5db',
              color: '#374151',
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
            onClick={onAddClick}
          >
            {buttonLabel}
          </button>
        )}
      </div>
      {maxCountText && (
        <div className="text-[11px] text-gray-400 mt-2 font-mono">{maxCountText}</div>
      )}
    </div>
  );
}
