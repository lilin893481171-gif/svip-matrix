import React from 'react';

export default function SchedulePicker({
  scheduleType = 'now',
  scheduleTime = '',
  onScheduleTypeChange,
  onScheduleTimeChange,
  accentColor,
  name = 'schedule',
}) {
  const accentStyle = { accentColor };

  return (
    <div>
      <div className="flex gap-6 pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input type="radio" name={name} checked={scheduleType === 'now'} onChange={() => onScheduleTypeChange('now')} style={accentStyle} className="w-4 h-4" /> 立即发布
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input type="radio" name={name} checked={scheduleType === 'platform'} onChange={() => onScheduleTypeChange('platform')} style={accentStyle} className="w-4 h-4" /> 定时发布
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input type="radio" name={name} checked={scheduleType === 'local'} onChange={() => onScheduleTypeChange('local')} style={accentStyle} className="w-4 h-4" /> 本机定时
        </label>
      </div>
      {scheduleType !== 'now' && (
        <div className="mt-3">
          <input
            type="datetime-local"
            className="w-full max-w-xs border border-gray-300 rounded-lg h-10 px-3 text-sm outline-none focus:ring-2"
            style={{ '--accent': accentColor }}
            value={scheduleTime}
            onChange={(e) => onScheduleTimeChange(e.target.value)}
          />
          <style>{`
            .schedule-dt:focus { border-color: ${accentColor}; box-shadow: 0 0 0 2px ${accentColor}20; }
          `}</style>
        </div>
      )}
    </div>
  );
}