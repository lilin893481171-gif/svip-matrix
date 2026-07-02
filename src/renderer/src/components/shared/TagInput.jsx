import React from 'react';

export default function TagInput({
  value = '',
  onChange,
  accentColor,
  placeholder = '请输入话题进行搜索',
  hint,
  suggestedTags,
}) {
  return (
    <div>
      <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 cursor-text transition-colors focus-within:ring-2"
        style={{ '--accent': accentColor }}>
        <style>{`
          .tag-input-focus:hover { border-color: ${accentColor}; }
          .tag-input-focus:focus-within { border-color: ${accentColor}; box-shadow: 0 0 0 2px ${accentColor}20; }
        `}</style>
        <div className="tag-input-focus w-full h-full rounded-lg flex items-center">
          <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-gray-800"
          />
        </div>
      </div>
      {hint && <div className="text-[11px] text-gray-400 mt-1.5">{hint}</div>}
      {suggestedTags && suggestedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {suggestedTags.map((tag, i) => (
            <span key={i} className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full cursor-pointer hover:bg-gray-200 transition-colors"
              onClick={() => onChange(value ? `${value},${tag}` : tag)}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}