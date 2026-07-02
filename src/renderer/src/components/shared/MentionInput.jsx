import React from 'react';

export default function MentionInput({
  value = '',
  onChange,
  accentColor,
  position = '末尾',
  onPositionChange,
  label = '@好友',
  searchPlaceholder = '请输入关键词搜索',
  hintText = '@将追加到简介',
}) {
  return (
    <div>
      <div className="h-[38px] border border-gray-300 rounded-lg px-3 flex items-center bg-gray-50/50 cursor-text transition-colors focus-within:ring-2 mb-2"
        style={{ '--accent': accentColor }}>
        <style>{`
          .mention-focus:hover { border-color: ${accentColor}; }
          .mention-focus:focus-within { border-color: ${accentColor}; box-shadow: 0 0 0 2px ${accentColor}20; }
        `}</style>
        <div className="mention-focus w-full h-full rounded-lg flex items-center">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-gray-800"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>{hintText}</span>
        <select
          className="border border-gray-300 rounded-md px-3 py-1 bg-white cursor-pointer transition-colors shadow-sm outline-none text-sm text-gray-800"
          style={{ '--accent': accentColor }}
          value={position}
          onChange={(e) => onPositionChange && onPositionChange(e.target.value)}
        >
          <option value="末尾">末尾</option>
          <option value="开头">开头</option>
        </select>
      </div>
    </div>
  );
}