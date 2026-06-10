import React, { useId } from 'react';

export default function CoverUpload({
  value = '',
  onChange,
  accentColor,
  secondCover,
}) {
  const id1 = useId();
  const id2 = useId();

  const handleFile = (e, cb) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => cb(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  return (
    <div className="flex gap-5 flex-1">
      {/* 主封面 */}
      <div>
        <label
          className="w-[104px] h-[104px] border border-gray-200 rounded-lg p-1.5 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden group shadow-sm bg-white"
          style={{ '--accent': accentColor }}
        >
          <style>{`
            .cover-hover:hover { border-color: ${accentColor}; }
          `}</style>
          <div className="cover-hover w-full h-full rounded-lg overflow-hidden">
            <input id={id1} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, onChange)} />
            {value ? (
              <img src={value} className="w-full h-full object-cover rounded" alt="cover" />
            ) : (
              <span className="text-xs text-gray-400 w-full h-full flex items-center justify-center">无封面</span>
            )}
          </div>
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm rounded-lg">
            <span className="text-xl leading-none">+</span>
            <span className="text-xs mt-1 font-medium">{value ? '重新上传' : '上传封面'}</span>
          </div>
        </label>
      </div>

      {/* 第二封面 */}
      {secondCover && (
        <div className="relative">
          <label
            className="w-[104px] h-[104px] border border-dashed border-gray-300 bg-gray-50 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all text-gray-400 group"
            style={{ '--accent': accentColor }}
          >
            <style>{`
              .cover2-hover:hover { border-color: ${accentColor}; background-color: ${accentColor}10; }
              .cover2-hover:hover span { color: ${accentColor}; }
            `}</style>
            <div className="cover2-hover w-full h-full rounded-lg flex flex-col items-center justify-center">
              <input id={id2} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, secondCover.onChange)} />
              {secondCover.value ? (
                <img src={secondCover.value} className="w-full h-full object-cover rounded" alt="cover2" />
              ) : (
                <>
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-sm mt-1 font-medium">上传</span>
                </>
              )}
            </div>
          </label>
          <div className="absolute -top-6 left-0 text-gray-500 text-xs w-[110px] text-center font-medium">{secondCover.label || '封面2'}</div>
        </div>
      )}
    </div>
  );
}
