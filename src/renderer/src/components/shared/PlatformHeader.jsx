import React from 'react';

export default function PlatformHeader({ icon, name, accentColor, badgeText = '全功能开放版', badgeAccent }) {
  return (
    <div className="mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
      <div className="w-6 h-6 rounded flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: accentColor }}>
        {typeof icon === 'string' ? <span className="font-black text-sm">{icon}</span> : icon}
      </div>
      <span className="font-bold text-gray-800 text-[16px]">{name} 专属配置</span>
      <span className={`ml-auto text-xs px-2 py-1 rounded font-medium border flex items-center gap-1 ${badgeAccent || ''}`}
        style={!badgeAccent ? { backgroundColor: `${accentColor}10`, color: accentColor, borderColor: `${accentColor}30` } : {}}>
        {badgeText}
      </span>
    </div>
  );
}