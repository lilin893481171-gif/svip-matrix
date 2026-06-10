import React from 'react';

export default function FirstComment({
  value = '',
  onChange,
  accentColor,
  pinComment = false,
  onPinCommentChange,
  placeholder = '在此设置视频发布后的首发评论...',
  hintText,
  pinLabel = '尝试置顶该评论',
  showPin = true,
}) {
  return (
    <div>
      <div className="relative border border-gray-300 rounded-lg p-3 bg-white focus-within:ring-2 transition-all shadow-sm"
        style={{ '--accent': accentColor }}>
        <style>{`
          .fc-focus:focus-within { border-color: ${accentColor}; box-shadow: 0 0 0 2px ${accentColor}20; }
        `}</style>
        <div className="fc-focus rounded-lg">
          <div className="text-right text-[12px] mb-2 cursor-pointer font-medium" style={{ color: accentColor }}>历史记录</div>
          <textarea
            rows={3}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full outline-none resize-none bg-transparent text-sm leading-relaxed"
          />
          {showPin && (
            <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded w-4 h-4"
                  style={{ accentColor }}
                  checked={pinComment}
                  onChange={(e) => onPinCommentChange && onPinCommentChange(e.target.checked)}
                /> {pinLabel}
              </label>
            </div>
          )}
        </div>
      </div>
      {hintText && <div className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{hintText}</div>}
    </div>
  );
}
