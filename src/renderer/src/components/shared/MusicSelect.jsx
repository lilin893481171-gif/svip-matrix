import React from 'react';

export default function MusicSelect({
  value = '',
  onChange,
  accentColor = '#FE2C55',
  accept = 'audio/*',
  placeholder = '点击选择合适作品风格音乐',
  icon = '🎵',
}) {
  return (
    <label className="h-[46px] border border-gray-300 border-dashed rounded-lg bg-gray-50 flex items-center justify-center gap-2 cursor-pointer transition-colors text-gray-500"
      style={{
        '--hover-color': accentColor
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accentColor;
        e.currentTarget.style.backgroundColor = `${accentColor}10`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#d1d5db';
        e.currentTarget.style.backgroundColor = '#f9fafb';
      }}
    >
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChange?.(file.name);
        }}
      />
      {value ? (
        <span className="text-sm font-medium" style={{ color: accentColor }}>
          {value}
        </span>
      ) : (
        <>
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium">{placeholder}</span>
        </>
      )}
    </label>
  );
}
