import React from 'react';

export default function VisibilityRadio({
  value,
  onChange,
  accentColor,
  options = [
    { value: 'public', label: '公开' },
    { value: 'private', label: '私密' },
    { value: 'friends', label: '好友可见' },
  ],
  name = 'visibility',
}) {
  return (
    <div className="flex gap-6 pt-1">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="w-4 h-4"
            style={{ accentColor }}
          /> {opt.label}
        </label>
      ))}
    </div>
  );
}